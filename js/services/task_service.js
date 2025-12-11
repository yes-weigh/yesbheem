
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
                createdAt: serverTimestamp()
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

    async updateBoard(boardId, name) {
        try {
            const boardRef = doc(db, COLLECTION_BOARDS, boardId);
            await updateDoc(boardRef, {
                name: name,
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
}
