
import { db } from "./firebase_config.js";
import {
    collection,
    addDoc,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const COLLECTION_TASKS = "project_tasks";
const COLLECTION_BOARDS = "task_boards";

export class TaskService {
    constructor() {
        this.boards = [];
        this.tasks = [];
        this.currentBoardId = null;
        this.tasksUnsubscribe = null;
        this.boardsUnsubscribe = null;
    }

    subscribeToBoards(onUpdate, onError) {
        const q = query(collection(db, COLLECTION_BOARDS), orderBy("createdAt", "asc"));

        this.boardsUnsubscribe = onSnapshot(q, (snapshot) => {
            this.boards = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            if (onUpdate) onUpdate(this.boards);
        }, (error) => {
            console.error("Error fetching boards:", error);
            if (onError) onError(error);
        });
    }

    async createBoard(name) {
        try {
            await addDoc(collection(db, COLLECTION_BOARDS), {
                name: name,
                createdAt: serverTimestamp(),
                // Default Columns
                columns: [
                    { id: 'todo', title: 'To Do', color: '#64748b' },
                    { id: 'inprogress', title: 'In Progress', color: '#3b82f6' },
                    { id: 'done', title: 'Done', color: '#22c55e' }
                ],
                bgImage: null,
                fontSize: 'medium' // small, medium, large
            });
            return true;
        } catch (e) {
            console.error("Error creating board:", e);
            return false;
        }
    }

    async deleteBoard(boardId) {
        try {
            await deleteDoc(doc(db, COLLECTION_BOARDS, boardId));
            return true;
        } catch (e) {
            console.error("Failed to delete board:", e);
            return false;
        }
    }

    async updateBoard(boardId, updates) {
        try {
            const boardRef = doc(db, COLLECTION_BOARDS, boardId);
            // If updates is just string, treat as name for backward compatibility
            const data = typeof updates === 'string' ? { name: updates } : updates;

            await updateDoc(boardRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (e) {
            console.error("Error updating board:", e);
            return false;
        }
    }

    subscribeToTasks(boardId, onUpdate, onError) {
        if (this.tasksUnsubscribe) {
            this.tasksUnsubscribe();
            this.tasksUnsubscribe = null;
        }

        if (!boardId) {
            this.tasks = [];
            if (onUpdate) onUpdate([]);
            return;
        }

        this.currentBoardId = boardId;

        const q = query(
            collection(db, COLLECTION_TASKS),
            where("boardId", "==", boardId),
            orderBy("createdAt", "desc")
        );

        this.tasksUnsubscribe = onSnapshot(q, (snapshot) => {
            this.tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a, b) => (a.order || 0) - (b.order || 0));

            if (onUpdate) onUpdate(this.tasks);
        }, (error) => {
            if (onError) onError(error);
        });
    }

    async addTask(taskData) {
        if (!this.currentBoardId) return false;

        try {
            await addDoc(collection(db, COLLECTION_TASKS), {
                ...taskData,
                boardId: this.currentBoardId,
                order: Date.now(),
                createdAt: serverTimestamp()
            });
            return true;
        } catch (e) {
            console.error("Error adding task: ", e);
            return false;
        }
    }

    async updateTask(taskId, updateData) {
        const taskRef = doc(db, COLLECTION_TASKS, taskId);
        try {
            await updateDoc(taskRef, {
                ...updateData,
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (e) {
            console.error("Error updating task: ", e);
            return false;
        }
    }

    async moveTask(taskId, newStatus, newOrder) {
        const taskRef = doc(db, COLLECTION_TASKS, taskId);
        try {
            await updateDoc(taskRef, {
                status: newStatus,
                order: newOrder
            });
            // Also update local cache optimistically if needed, but snapshots handle it
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = newStatus;
                task.order = newOrder;
            }
        } catch (e) {
            console.error("Error moving task: ", e);
        }
    }

    async deleteTask(taskId) {
        try {
            await deleteDoc(doc(db, COLLECTION_TASKS, taskId));
            return true;
        } catch (e) {
            console.error("Error deleting task: ", e);
            return false;
        }
    }

    getTask(id) {
        return this.tasks.find(t => t.id === id);
    }

    async uploadBoardImage(file) {
        if (!file) return null;
        try {
            const fileRef = ref(storage, `board_backgrounds/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(fileRef, file);
            const url = await getDownloadURL(snapshot.ref);
            return url;
        } catch (e) {
            console.error("Error uploading image:", e);
            return null;
        }
    }

    async addColumn(boardId, columnTitle) {
        const board = this.boards.find(b => b.id === boardId);
        if (!board) return false;

        const newCol = {
            id: 'col_' + Date.now(),
            title: columnTitle,
            color: '#64748b' // Default color
        };

        // Fix for legacy boards: if columns is undefined, use defaults
        let columns = board.columns;
        if (!columns || columns.length === 0) {
            columns = [
                { id: 'todo', title: 'To Do', color: '#64748b' },
                { id: 'inprogress', title: 'In Progress', color: '#3b82f6' },
                { id: 'done', title: 'Done', color: '#22c55e' }
            ];
        }

        // Create a copy to avoid mutating cache directly before server confirm (though we re-fetch)
        const updatedColumns = [...columns, newCol];

        return await this.updateBoard(boardId, { columns: updatedColumns });
    }

    async deleteColumn(boardId, columnId) {
        const board = this.boards.find(b => b.id === boardId);
        if (!board) return false;

        // Check if tasks exist in this column
        if (this.currentBoardId === boardId) {
            const hasTasks = this.tasks.some(t => t.status === columnId);
            if (hasTasks) return false;
        }

        let columns = board.columns;
        if (!columns || columns.length === 0) {
            // If legacy board, we can't delete "virtual" columns if they are not saved yet.
            // But if user tries to delete one of the defaults on a legacy board, 
            // we should materialize the other defaults.
            columns = [
                { id: 'todo', title: 'To Do', color: '#64748b' },
                { id: 'inprogress', title: 'In Progress', color: '#3b82f6' },
                { id: 'done', title: 'Done', color: '#22c55e' }
            ];
        }

        const newCols = columns.filter(c => c.id !== columnId);

        return await this.updateBoard(boardId, { columns: newCols });
    }
}
