
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

        const editBoardBtn = document.getElementById('editBoardBtn');
        if (editBoardBtn) {
            // Change icon to settings gear
            editBoardBtn.textContent = '⚙️';
            editBoardBtn.title = "Board Settings";
            editBoardBtn.addEventListener('click', () => this.openSettingsModal());
        }

        // Settings Modal Bindings
        this.setupSettingsModal();
    }

    setupSettingsModal() {
        const modal = document.getElementById('boardSettingsModal');
        const closeBtn = document.getElementById('closeSettingsBtn');
        const cancelBtn = document.getElementById('cancelSettingsBtn');
        const saveBtn = document.getElementById('saveSettingsBtn');

        const closeModal = () => modal.classList.remove('active');

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        // Tabs
        const tabs = modal.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                modal.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

                tab.classList.add('active');
                document.getElementById(`tab-${tab.dataset.tab}`).style.display = 'block';
            });
        });

        // Background Image Preview
        const bgInput = document.getElementById('bgImageInput');
        const removeBgBtn = document.getElementById('removeBgBtn');
        const preview = document.getElementById('bgImagePreview');

        bgInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.style.backgroundImage = `url('${e.target.result}')`;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });

        removeBgBtn.addEventListener('click', () => {
            bgInput.value = '';
            preview.style.backgroundImage = '';
            preview.style.display = 'none';
            this.tempBgRemoved = true;
        });

        // Font Size Slider
        const slider = document.getElementById('fontSizeSlider');
        slider.addEventListener('input', (e) => {
            document.documentElement.style.setProperty('--task-font-size', e.target.value + 'px');
        });

        // Add Column
        document.getElementById('addColumnBtn').addEventListener('click', () => {
            const input = document.getElementById('newColumnName');
            const name = input.value.trim();
            if (name) {
                this.addSettingsColumn(name);
                input.value = '';
            }
        });

        // Delete Board
        document.getElementById('deleteBoardBtn').addEventListener('click', () => {
            if (this.taskService.currentBoardId) {
                this.deleteBoard(this.taskService.currentBoardId);
                closeModal();
            }
        });

        // Save Changes
        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            await this.saveSettings();
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
            closeModal();
        });
    }

    openSettingsModal() {
        if (!this.taskService.currentBoardId) return;
        const board = this.taskService.boards.find(b => b.id === this.taskService.currentBoardId);
        if (!board) return;

        const modal = document.getElementById('boardSettingsModal');

        // Populate Data
        document.getElementById('settingsBoardName').value = board.name;
        document.getElementById('fontSizeSlider').value = parseInt(board.fontSize) || 14;

        // Background
        const preview = document.getElementById('bgImagePreview');
        if (board.bgImage) {
            preview.style.backgroundImage = `url('${board.bgImage}')`;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
        this.tempBgRemoved = false;

        // Columns
        this.renderSettingsColumns(board.columns || []);

        modal.classList.add('active');
    }

    renderSettingsColumns(columns) {
        const list = document.getElementById('settingsColumnsList');
        list.innerHTML = '';
        columns.forEach((col, index) => {
            const li = document.createElement('li');
            li.className = 'column-list-item';

            const isFirst = index === 0;
            const isLast = index === columns.length - 1;

            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <button class="btn-icon-sm" ${isFirst ? 'disabled' : ''} data-action="up" title="Move Left/Up">▲</button>
                        <button class="btn-icon-sm" ${isLast ? 'disabled' : ''} data-action="down" title="Move Right/Down">▼</button>
                    </div>
                    <h4>${this.escapeHtml(col.title)}</h4>
                </div>
                <button class="btn-danger-sm" title="Delete Column">🗑️</button>
            `;

            // Move Handlers
            li.querySelectorAll('button[data-action]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const direction = btn.dataset.action;
                    const newIndex = direction === 'up' ? index - 1 : index + 1;
                    await this.moveColumn(index, newIndex);
                });
            });

            // Delete Handlers
            li.querySelector('.btn-danger-sm').addEventListener('click', async () => {
                if (confirm(`Delete column "${col.title}"?`)) {
                    const success = await this.taskService.deleteColumn(this.taskService.currentBoardId, col.id);
                    if (!success) {
                        alert('Cannot delete: Column is not empty or error occurred.');
                    } else {
                        li.remove();
                    }
                }
            });
            list.appendChild(li);
        });
    }

    async moveColumn(oldIndex, newIndex) {
        const board = this.taskService.boards.find(b => b.id === this.taskService.currentBoardId);
        if (!board || !board.columns) return;

        const columns = [...board.columns];
        // Swap
        const [movedCol] = columns.splice(oldIndex, 1);
        columns.splice(newIndex, 0, movedCol);

        // Optimistic update
        this.renderSettingsColumns(columns);

        await this.taskService.updateBoard(board.id, { columns });
    }

    async addSettingsColumn(name) {
        await this.taskService.addColumn(this.taskService.currentBoardId, name);
        // List update handled by subscription re-render? No, subscription updates main board.
        // We should manually add to list or re-open modal. 
        // For now, let's just append to list to show feedback
        const list = document.getElementById('settingsColumnsList');
        const li = document.createElement('li');
        li.className = 'column-list-item';
        li.innerHTML = `<h4>${this.escapeHtml(name)} (Saving...)</h4>`;
        list.appendChild(li);

        // Real update comes from subscription, which might close modal if we aren't careful? 
        // Subscription calls renderBoard. It doesn't close modal.
        // But we need to refresh the "Settings" list.
        setTimeout(() => {
            const board = this.taskService.boards.find(b => b.id === this.taskService.currentBoardId);
            if (board) this.renderSettingsColumns(board.columns || []);
        }, 500);
    }

    async saveSettings() {
        const boardId = this.taskService.currentBoardId;
        const newName = document.getElementById('settingsBoardName').value.trim();
        const fontSize = document.getElementById('fontSizeSlider').value;
        const bgInput = document.getElementById('bgImageInput');

        let updates = {};

        if (newName) updates.name = newName;
        updates.fontSize = fontSize;

        if (this.tempBgRemoved) updates.bgImage = null;

        const file = bgInput.files[0];
        if (file) {
            const url = await this.taskService.uploadBoardImage(file);
            if (url) updates.bgImage = url;
        }

        await this.taskService.updateBoard(boardId, updates);
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
                <span class="board-item-content">
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
            // UI updates via subscription
        }
    }

    renderBoard(tasks) {
        const board = this.taskService.boards.find(b => b.id === this.taskService.currentBoardId);
        const columns = board?.columns || [
            { id: 'todo', title: 'To Do', color: '#64748b' },
            { id: 'inprogress', title: 'In Progress', color: '#3b82f6' },
            { id: 'done', title: 'Done', color: '#22c55e' }
        ];

        // Apply Styles
        const boardContainer = document.querySelector('.board-main-content');
        if (boardContainer && board?.bgImage) {
            boardContainer.style.backgroundImage = `url('${board.bgImage}')`;
            boardContainer.style.backgroundSize = 'cover';
            boardContainer.style.backgroundPosition = 'center';
            boardContainer.classList.add('has-bg');
        } else if (boardContainer) {
            boardContainer.style.backgroundImage = '';
            boardContainer.classList.remove('has-bg');
        }

        if (board?.fontSize) {
            document.documentElement.style.setProperty('--task-font-size', board.fontSize + 'px');
        }

        // Render Structure
        const kanbanBoard = document.getElementById('kanbanBoard');
        kanbanBoard.innerHTML = '';

        // Populate Lookup Maps
        this.columns = {};
        this.counts = {};

        columns.forEach(col => {
            const colDiv = document.createElement('div');
            colDiv.className = 'kanban-column';
            colDiv.dataset.status = col.id;
            colDiv.innerHTML = `
                <div class="column-header">
                    <span class="column-title">
                        <span style="color: ${col.color || '#64748b'};">●</span> ${this.escapeHtml(col.title)}
                    </span>
                    <span class="task-count" id="count-${col.id}">0</span>
                </div>
                <div class="column-content" id="list-${col.id}"></div>
            `;
            kanbanBoard.appendChild(colDiv);

            this.columns[col.id] = colDiv.querySelector('.column-content');
            this.counts[col.id] = colDiv.querySelector('.task-count');
        });

        // Initialize Drag Drops for new columns
        this.setupDragAndDrop();

        // Populate Tasks
        const columnCounts = {};
        columns.forEach(c => columnCounts[c.id] = 0);

        tasks.forEach(task => {
            // Default to first column if status invalid
            let status = task.status;
            if (!this.columns[status]) status = columns[0].id;

            const card = this.createCardElement(task);
            this.columns[status].appendChild(card);
            columnCounts[status] = (columnCounts[status] || 0) + 1;
        });

        // Update Counts
        Object.keys(columnCounts).forEach(status => {
            if (this.counts[status]) this.counts[status].textContent = columnCounts[status];
        });

        // Update Status Dropdown in Add Task Modal
        const statusSelect = document.getElementById('taskStatus');
        if (statusSelect) {
            statusSelect.innerHTML = columns.map(c =>
                `<option value="${c.id}">${this.escapeHtml(c.title)}</option>`
            ).join('');
        }
    }

    handleTaskError(error) {
        console.error("Task error:", error);
        // Show error in board
    }

    createCardElement(task) {
        const div = document.createElement('div');
        div.className = 'kanban-card';
        div.draggable = true;
        div.dataset.id = task.id;
        div.dataset.status = task.status;

        // Font Size Support
        div.style.fontSize = 'var(--task-font-size, 14px)';

        // Label Section (using task.color)
        let labelHtml = '';
        if (task.color) {
            div.style.setProperty('--task-color', task.color);
            // Also add a visible label bar if color is present
            labelHtml = `
                <div class="card-labels">
                    <div class="card-label" title="Label"></div>
                </div>
            `;
        }

        // Date Handling
        const dateObj = task.createdAt && task.createdAt.toDate ? task.createdAt.toDate() : new Date();
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const hasDescription = !!task.description;
        const checklistCount = Math.floor(Math.random() * 5); // Mock for visual density

        let badgesHtml = '<div class="card-badges">';

        // Date Badge
        badgesHtml += `
            <div class="card-badge" title="Due Date">
                <span class="card-badge-icon">🕒</span>
                <span>${dateStr}</span>
            </div>
        `;

        if (hasDescription) {
            badgesHtml += `
                <div class="card-badge" title="This card has a description">
                    <span class="card-badge-icon">≡</span>
                </div>
            `;
        }

        // Description Preview Section
        let descriptionHtml = '';
        if (hasDescription) {
            descriptionHtml = `<div class="card-description-preview">${this.escapeHtml(task.description)}</div>`;
        }

        // Mock Checklist Badge
        badgesHtml += `
            <div class="card-badge" title="Checklist items">
                <span class="card-badge-icon">☑</span>
                <span>${Math.floor(Math.random() * 3)}/${checklistCount + 3}</span>
            </div>
        `;

        badgesHtml += '</div>';

        // Mock Members
        const membersHtml = `
            <div class="card-members">
                 <div class="member-avatar" title="Member">MB</div>
            </div>
        `;

        // Assemble HTML
        div.innerHTML = `
            ${labelHtml}
            <div class="card-content">
                <div class="card-title">${this.escapeHtml(task.title)}</div>
                ${descriptionHtml}
            </div>
            <div class="card-footer-row">
                ${badgesHtml}
                ${membersHtml}
            </div>
            <button class="delete-task-btn" type="button" title="Delete Task">🗑️</button>
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

    // ... Drag & Drop Methods (unchanged) ...
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
        // Need to query dynamically now as columns are recreated
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

    // ... Existing openEditModal/resetModal/handleSaveTask/escapeHtml ...
    // NOTE: Need to preserve them or re-implement if replacing whole block

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
        // 'taskStatus' is now dynamic, default to first option if possible
        const select = document.getElementById('taskStatus');
        if (select && select.options.length > 0) select.selectedIndex = 0;

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
