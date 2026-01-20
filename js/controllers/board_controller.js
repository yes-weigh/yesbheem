import { TaskService } from "../services/task_service.js";
import { BoardRenderer } from "../renderers/board_renderer.js";
import { BoardDnDManager } from "../managers/board_dnd_manager.js";
import { BoardModalManager } from "../managers/board_modal_manager.js";


class BoardController {
    constructor() {
        this.taskService = new TaskService();
        this.currentTasks = [];

        // Initialize Components
        this.renderer = new BoardRenderer({
            onSwitchBoard: (id) => this.switchBoard(id),
            onDeleteBoard: (id) => this.deleteBoard(id),
            onAddTask: (statusId) => this.modalManager.openModal(statusId),
            onDeleteColumn: (statusId) => this.deleteColumn(statusId),
            onAddColumn: () => this.addColumn(),
            onDeleteTask: (taskId) => this.deleteTask(taskId),
            onEditTask: (task) => this.modalManager.openEditModal(task),
            onSaveTask: (data, isEdit) => this.saveTaskPartial(data, isEdit),
            setupTaskDnD: (el, task) => this.dndManager.setupTaskDnD(el, task),
            setupColumnDnD: (el) => this.dndManager.setupColumnDnD(el),
            getColumns: () => this.getCurrentColumns()
        });

        this.dndManager = new BoardDnDManager({
            onTaskDrop: (taskId, newStatus, prevId, nextId) => this.handleTaskDrop(taskId, newStatus, prevId, nextId),
            onColumnReorder: (newOrderIds) => this.handleColumnReorder(newOrderIds)
        });

        this.modalManager = new BoardModalManager({
            onSaveSettings: (data) => this.saveBoardSettings(data),
            onDeleteBoardRequest: () => this.deleteCurrentBoard(),
            onBulkUpload: (files) => this.taskService.uploadBoardImages(files),
            getGalleryImages: () => this.taskService.getAvailableBackgrounds(),
            onDeleteImages: (urls) => this.deleteBoardImages(urls),
            onSaveTask: (data, isEdit) => this.saveTaskFull(data, isEdit)
        });

        this.init();
    }

    init() {
        this.setupComponents();

        // Subscribe to boards
        this.taskService.subscribeToBoards(
            (boards) => {
                this.renderer.renderBoardsDropdown(boards, this.taskService.currentBoardId);

                // If viewing a board, re-render it
                if (this.taskService.currentBoardId) {
                    const currentBoard = boards.find(b => b.id === this.taskService.currentBoardId);
                    if (currentBoard) {
                        this.renderCurrentBoard();
                    }
                } else if (boards.length > 0) {
                    // Auto-load first board if none selected
                    this.switchBoard(boards[0].id);
                }
            },
            (error) => console.error(error)
        );
    }

    setupComponents() {
        this.renderer.setupHoverPreview((data) => this.saveTaskPartial(data, true)); // Quick Edit Save
        this.modalManager.setupModals();

        // Bind UI triggers
        const editBoardBtn = document.getElementById('editBoardBtn');
        if (editBoardBtn) {
            editBoardBtn.replaceWith(editBoardBtn.cloneNode(true)); // Clear old listeners
            const newBtn = document.getElementById('editBoardBtn');
            newBtn.textContent = '⚙️';
            newBtn.title = "Board Settings";
            newBtn.addEventListener('click', () => {
                const board = this.taskService.boards.find(b => b.id === this.taskService.currentBoardId);
                this.modalManager.openSettingsModal(board);
            });
        }

        const createBoardBtn = document.getElementById('createBoardBtn');
        if (createBoardBtn) {
            createBoardBtn.replaceWith(createBoardBtn.cloneNode(true));
            document.getElementById('createBoardBtn').addEventListener('click', () => {
                const name = prompt("Enter board name:");
                if (name && name.trim()) {
                    this.taskService.createBoard(name.trim());
                    document.querySelector('.board-picker-wrapper')?.classList.remove('active');
                }
            });
        }
    }

    /* --- BOARD LOGIC --- */

    switchBoard(boardId) {
        if (this.taskService.currentBoardId === boardId) return;

        this.taskService.subscribeToTasks(
            boardId,
            (tasks) => {
                this.currentTasks = tasks;
                this.renderCurrentBoard();
            },
            (error) => console.error(error)
        );

        this.renderer.updateBoardHeader(this.taskService.boards, boardId);
        this.renderer.renderBoardsDropdown(this.taskService.boards, boardId); // Update active state
    }

    renderCurrentBoard() {
        const board = this.taskService.boards.find(b => b.id === this.taskService.currentBoardId);
        if (!board) return;

        this.renderer.renderBoard(this.currentTasks, board);
        // Re-attach drop zones after render
        const cols = document.querySelectorAll('.kanban-column');
        this.dndManager.setupColumnDropZones(cols);
    }

    getCurrentColumns() {
        const board = this.taskService.boards.find(b => b.id === this.taskService.currentBoardId);
        return board?.columns || [];
    }

    /* --- ACTIONS --- */

    async saveBoardSettings(data) {
        const updates = {};
        if (data.newName) updates.name = data.newName;
        updates.fontSize = data.fontSize;

        if (data.tempBgRemoved) updates.bgImage = null;
        else if (data.selectedGalleryUrl) updates.bgImage = data.selectedGalleryUrl;

        const file = data.bgInput?.files[0];
        if (file) {
            const url = await this.taskService.uploadBoardImage(file);
            if (url) updates.bgImage = url;
        }

        await this.taskService.updateBoard(this.taskService.currentBoardId, updates);
    }

    async deleteCurrentBoard() {
        if (!confirm("Delete board and all tasks?")) return;
        const id = this.taskService.currentBoardId;
        await this.taskService.deleteBoard(id);
    }

    async deleteBoard(id) {
        if (!confirm("Are you sure?")) return;
        await this.taskService.deleteBoard(id);
    }

    async deleteBoardImages(urls) {
        for (const url of urls) {
            await this.taskService.deleteBoardImage(url);
        }
    }

    /* --- COLUMN ACTIONS --- */

    async addColumn() {
        const name = prompt("Column Name:");
        if (name?.trim()) {
            await this.taskService.addColumn(this.taskService.currentBoardId, name.trim());
        }
    }

    async deleteColumn(statusId) {
        await this.taskService.deleteColumn(this.taskService.currentBoardId, statusId);
    }

    async handleColumnReorder(newOrderIds) {
        const board = this.taskService.boards.find(b => b.id === this.taskService.currentBoardId);
        if (!board) return;
        const currentColumns = board.columns || [];
        const newColumns = newOrderIds.map(id => currentColumns.find(c => c.id === id)).filter(c => c);
        await this.taskService.updateBoard(board.id, { columns: newColumns });
    }

    /* --- TASK ACTIONS --- */

    async saveTaskFull(data, isEdit) {
        if (isEdit) {
            await this.taskService.updateTask(data.id, data);
        } else {
            await this.taskService.addTask(data);
        }
    }

    async saveTaskPartial(data, isEdit) {
        if (!data || !data.id) return;
        // For quick edits or checklist toggles
        await this.taskService.updateTask(data.id, data);
    }

    async deleteTask(taskId) {
        await this.taskService.deleteTask(taskId);
    }

    async handleTaskDrop(taskId, newStatus, prevId, nextId) {
        const prevOrder = prevId ? this.getOrder(prevId) : 0;
        let newOrder;

        if (!prevId && !nextId) {
            newOrder = Date.now();
        } else if (!prevId) {
            const nextOrder = this.getOrder(nextId);
            newOrder = nextOrder - 10000;
        } else if (!nextId) {
            newOrder = prevOrder + 10000;
        } else {
            const nextOrder = this.getOrder(nextId);
            newOrder = (prevOrder + nextOrder) / 2;
        }

        await this.taskService.moveTask(taskId, newStatus, newOrder);
    }

    getOrder(id) {
        const task = this.currentTasks.find(t => t.id === id); // Use local cache
        return task ? (task.order || 0) : 0;
    }
}

// Initialize
new BoardController();
