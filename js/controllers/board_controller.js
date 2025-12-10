
import { TaskService } from "../services/task_service.js";

class BoardController {
    constructor() {
        this.taskService = new TaskService();

        // DOM Elements
        this.columns = {
            'todo': document.getElementById('todo-list'),
            'inprogress': document.getElementById('inprogress-list'),
            'done': document.getElementById('done-list')
        };

        this.counts = {
            'todo': document.getElementById('todo-count'),
            'inprogress': document.getElementById('inprogress-count'),
            'done': document.getElementById('done-count')
        };

        // UI State
        this.draggedItem = null;
        this.isEditing = false;
        this.currentTaskId = null;

        this.init();
    }

    init() {
        this.setupBoardUI();
        this.setupModal();
        this.setupDragAndDrop();

        // Subscribe to boards
        this.taskService.subscribeToBoards(
            (boards) => this.renderBoardsSidebar(boards),
            (error) => console.error(error)
        );
    }

    setupBoardUI() {
        const createBoardBtn = document.getElementById('createBoardBtn');
        if (createBoardBtn) {
            createBoardBtn.addEventListener('click', () => {
                const name = prompt("Enter board name:");
                if (name && name.trim()) {
                    this.taskService.createBoard(name.trim());
                }
            });
        }
    }

    renderBoardsSidebar(boards) {
        const list = document.getElementById('boardsList');
        if (!list) return;

        // Auto-select first board if none selected
        if (boards.length > 0 && (!this.taskService.currentBoardId || !boards.find(b => b.id === this.taskService.currentBoardId))) {
            this.switchBoard(boards[0].id, boards);
        } else if (boards.length === 0) {
            // Create default if empty
            this.taskService.createBoard("Main Board");
        } else {
            this.updateBoardHeader(boards);
        }

        list.innerHTML = '';
        boards.forEach(board => {
            const li = document.createElement('li');
            li.className = `board-item ${board.id === this.taskService.currentBoardId ? 'active' : ''}`;
            li.innerHTML = `
                <span>
                    <span class="board-item-icon">📋</span>
                    ${this.escapeHtml(board.name)}
                </span>
                ${boards.length > 1 ? '<button class="board-delete-btn" title="Delete Board">×</button>' : ''}
            `;

            li.addEventListener('click', () => this.switchBoard(board.id, boards));

            const delBtn = li.querySelector('.board-delete-btn');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteBoard(board.id);
                });
            }

            list.appendChild(li);
        });
    }

    switchBoard(boardId, boards) {
        if (this.taskService.currentBoardId === boardId) return;

        // Subscribe to new board tasks
        this.taskService.subscribeToTasks(
            boardId,
            (tasks) => this.renderBoard(tasks),
            (error) => this.handleTaskError(error)
        );

        this.updateBoardHeader(boards);

        // Re-render sidebar to update active class
        this.renderBoardsSidebar(boards || this.taskService.boards);
    }

    updateBoardHeader(boards) {
        const titleEl = document.getElementById('currentBoardTitle');
        const board = boards.find(b => b.id === this.taskService.currentBoardId);
        if (titleEl) {
            titleEl.textContent = board ? board.name : 'Tasks';
        }
    }

    async deleteBoard(boardId) {
        if (!confirm("Are you sure? This will delete the board and hide its tasks.")) return;

        const currentId = this.taskService.currentBoardId;
        const success = await this.taskService.deleteBoard(boardId);

        if (success && currentId === boardId) {
            // UI will update via subscription, but we might want to manually clear or switch
            // Subscription to boards will trigger re-render, picking new default
        }
    }

    renderBoard(tasks) {
        // Clear columns
        Object.values(this.columns).forEach(col => {
            if (col) col.innerHTML = '';
        });

        // Reset counts
        const columnCounts = { todo: 0, inprogress: 0, done: 0 };

        tasks.forEach(task => {
            const card = this.createCardElement(task);
            const status = task.status || 'todo';
            if (this.columns[status]) {
                this.columns[status].appendChild(card);
                columnCounts[status]++;
            }
        });

        // Update counters
        Object.keys(columnCounts).forEach(status => {
            if (this.counts[status]) this.counts[status].textContent = columnCounts[status];
        });
    }

    handleTaskError(error) {
        console.error("Task error:", error);
        Object.values(this.columns).forEach(col => {
            if (col) col.innerHTML = '<div class="loading-spinner" style="color: var(--danger-color)">Error loading tasks</div>';
        });
    }

    createCardElement(task) {
        const div = document.createElement('div');
        div.className = 'kanban-card';
        div.draggable = true;
        div.dataset.id = task.id;
        div.dataset.status = task.status;

        if (task.color) {
            div.style.setProperty('--task-color', task.color);
        }

        const dateStr = task.createdAt && task.createdAt.toDate ? task.createdAt.toDate().toLocaleDateString() : '';

        div.innerHTML = `
            <div class="card-title">${this.escapeHtml(task.title)}</div>
            <div class="card-description">${this.escapeHtml(task.description || '')}</div>
            <div class="card-footer">
                <span class="card-date">📅 ${dateStr}</span>
                <button class="delete-task-btn" type="button" title="Delete Task">🗑️</button>
            </div>
        `;

        // Drag events
        div.addEventListener('dragstart', (e) => this.handleDragStart(e, div));
        div.addEventListener('dragend', (e) => this.handleDragEnd(e, div));

        // Delete button
        const deleteBtn = div.querySelector('.delete-task-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this task?')) {
                this.taskService.deleteTask(task.id);
            }
        });

        // Edit functionality
        div.addEventListener('click', () => {
            this.openEditModal(task);
        });

        return div;
    }

    // Drag and Drop
    handleDragStart(e, item) {
        this.draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.setData('text/plain', item.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDragEnd(e, item) {
        item.classList.remove('dragging');
        this.draggedItem = null;
        document.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
    }

    setupDragAndDrop() {
        const columnElements = document.querySelectorAll('.kanban-column');

        columnElements.forEach(col => {
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                col.classList.add('drag-over');

                const afterElement = this.getDragAfterElement(col.querySelector('.column-content'), e.clientY);
                const container = col.querySelector('.column-content');
                if (this.draggedItem) {
                    if (afterElement == null) {
                        container.appendChild(this.draggedItem);
                    } else {
                        container.insertBefore(this.draggedItem, afterElement);
                    }
                }
            });

            col.addEventListener('dragleave', (e) => {
                col.classList.remove('drag-over');
            });

            col.addEventListener('drop', async (e) => {
                e.preventDefault();
                col.classList.remove('drag-over');

                if (!this.draggedItem) return;

                const taskId = this.draggedItem.dataset.id;
                const newStatus = col.dataset.status;

                // Calculate Order
                const prevCard = this.draggedItem.previousElementSibling;
                const nextCard = this.draggedItem.nextElementSibling;

                const prevOrder = prevCard ? this.getOrder(prevCard.dataset.id) : 0;
                let newOrder;

                if (!prevCard && !nextCard) {
                    newOrder = Date.now();
                } else if (!prevCard) {
                    const nextOrder = this.getOrder(nextCard.dataset.id);
                    newOrder = nextOrder - 10000;
                } else if (!nextCard) {
                    newOrder = prevOrder + 10000;
                } else {
                    const nextOrder = this.getOrder(nextCard.dataset.id);
                    newOrder = (prevOrder + nextOrder) / 2;
                }

                await this.taskService.moveTask(taskId, newStatus, newOrder);
            });
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    getOrder(id) {
        const task = this.taskService.getTask(id);
        return task ? (task.order || 0) : 0;
    }

    // Modal
    setupModal() {
        const modalOverlay = document.getElementById('addTaskModal');
        const openBtn = document.getElementById('openAddTaskBtn');
        const closeBtn = document.getElementById('closeModalBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const saveBtn = document.getElementById('saveTaskBtn');

        const openModal = () => {
            if (!this.taskService.currentBoardId) {
                alert('Please select or create a board first.');
                return;
            }
            this.resetModal('Add New Task', 'Add Task');
            modalOverlay.classList.add('active');
            document.getElementById('taskTitle').focus();
        };

        const closeModal = () => modalOverlay.classList.remove('active');

        if (openBtn) openBtn.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        saveBtn.addEventListener('click', () => this.handleSaveTask(closeModal));
    }

    openEditModal(task) {
        const modalOverlay = document.getElementById('addTaskModal');
        this.resetModal('Edit Task', 'Update Task');

        this.isEditing = true;
        this.currentTaskId = task.id;

        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskStatus').value = task.status || 'todo';

        const colorInput = document.querySelector(`input[name="taskColor"][value="${task.color || ''}"]`);
        if (colorInput) colorInput.checked = true;
        else document.getElementById('color-none').checked = true;

        modalOverlay.classList.add('active');
    }

    resetModal(title, btnText) {
        this.isEditing = false;
        this.currentTaskId = null;
        document.querySelector('.modal-title').textContent = title;
        document.getElementById('saveTaskBtn').textContent = btnText;

        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDescription').value = '';
        document.getElementById('taskStatus').value = 'todo';
        document.getElementById('color-none').checked = true;
    }

    async handleSaveTask(closeModalCallback) {
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const status = document.getElementById('taskStatus').value;
        const colorInput = document.querySelector('input[name="taskColor"]:checked');
        const color = colorInput ? colorInput.value : '';
        const saveBtn = document.getElementById('saveTaskBtn');

        if (!title) {
            alert('Please enter a task title');
            return;
        }

        saveBtn.disabled = true;
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';

        let success;
        if (this.isEditing && this.currentTaskId) {
            success = await this.taskService.updateTask(this.currentTaskId, { title, description, status, color });
        } else {
            success = await this.taskService.addTask({ title, description, status, color });
        }

        saveBtn.disabled = false;
        saveBtn.textContent = originalText;

        if (success) {
            closeModalCallback();
        } else {
            alert('Operation failed. Please try again.');
        }
    }

    escapeHtml(text) {
        if (!text) return text;
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize
new BoardController();
