
export class BoardRenderer {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.columns = {};
        this.counts = {};
        this.quickEditColumn = null;
        this.hoverHideTimeout = null;
        this.currentHoverTaskId = null;
        this.currentHoverTask = null;
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

    renderBoardsDropdown(boards, currentBoardId) {
        const list = document.getElementById('dropdownBoardList');
        if (!list) return;

        // Header Update
        this.updateBoardHeader(boards, currentBoardId);

        list.innerHTML = '';
        boards.forEach(board => {
            const li = document.createElement('li');
            li.className = `dropdown-item ${board.id === currentBoardId ? 'active' : ''}`;

            const deleteBtnHtml = boards.length > 1 ? '<span class="delete-board-icon" title="Delete Board" style="font-size:0.8rem; opacity:0.6; cursor:pointer;">✕</span>' : '';

            li.innerHTML = `
                <span class="board-name-text">${this.escapeHtml(board.name)}</span>
                ${deleteBtnHtml}
            `;

            li.addEventListener('click', () => {
                if (this.callbacks.onSwitchBoard) this.callbacks.onSwitchBoard(board.id);
                document.querySelector('.board-picker-wrapper')?.classList.remove('active');
            });

            if (deleteBtnHtml) {
                const delBtn = li.querySelector('.delete-board-icon');
                if (delBtn) {
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (this.callbacks.onDeleteBoard) this.callbacks.onDeleteBoard(board.id);
                    });
                }
            }

            list.appendChild(li);
        });
    }

    updateBoardHeader(boards, currentBoardId) {
        const titleEl = document.getElementById('currentBoardTitle');
        const board = boards.find(b => b.id === currentBoardId);
        if (titleEl) {
            titleEl.textContent = board ? board.name : 'Tasks';
        }
    }

    renderBoard(tasks, board, callbacks = {}) {
        // board: { id, fontSize, bgImage, columns: [...] }
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

        this.columns = {};
        this.counts = {};

        columns.forEach(col => {
            const colDiv = document.createElement('div');
            colDiv.className = 'kanban-column';
            colDiv.dataset.status = col.id;
            colDiv.draggable = true;

            const deleteBtnHtml = `<button class="delete-column-btn" title="Delete Column">✕</button>`;

            colDiv.innerHTML = `
                <div class="column-header">
                    <span class="column-title">
                        <span style="color: ${col.color || '#64748b'};">●</span> ${this.escapeHtml(col.title)}
                    </span>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="task-count" id="count-${col.id}">0</span>
                        ${deleteBtnHtml}
                    </div>
                </div>
                <div class="column-content" id="list-${col.id}"></div>
                <button class="inline-add-task-btn" data-status="${col.id}">+ Add Task</button>
            `;
            kanbanBoard.appendChild(colDiv);

            this.columns[col.id] = colDiv.querySelector('.column-content');
            this.counts[col.id] = colDiv.querySelector('.task-count');

            // Events
            colDiv.querySelector('.inline-add-task-btn').addEventListener('click', () => {
                if (callbacks.onAddTask) callbacks.onAddTask(col.id);
            });

            colDiv.querySelector('.delete-column-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (colDiv.querySelector('.kanban-card')) {
                    alert('Column must be empty to delete.');
                    return;
                }
                if (confirm(`Delete column "${col.title}"?`)) {
                    if (callbacks.onDeleteColumn) callbacks.onDeleteColumn(col.id);
                }
            });

            // Column Drag Events delegated to DnDManager via callback binding? 
            // Better to let DnDManager attach listeners, or trigger callback here.
            // Let's expose elements for DnDManager to attach to, OR DnDManager can scan DOM.
            // But if we re-render, we lose listeners.
            // Plan: DnDManager should have a 'setup(boardElement)' method or we pass callbacks for drag events here.

            // For now, let's assume DnDManager will re-init or we call a setup callback
            if (callbacks.setupColumnDnD) callbacks.setupColumnDnD(colDiv);
        });

        // Add Column Button
        const addColBtn = document.createElement('div');
        addColBtn.className = 'add-column-btn';
        addColBtn.innerHTML = `<span>+ Add Column</span>`;
        addColBtn.addEventListener('click', () => {
            if (callbacks.onAddColumn) callbacks.onAddColumn();
        });
        kanbanBoard.appendChild(addColBtn);

        // Populate Tasks
        const columnCounts = {};
        columns.forEach(c => columnCounts[c.id] = 0);

        tasks.forEach(task => {
            let status = task.status;
            if (!this.columns[status]) status = columns[0].id;

            const card = this.createCardElement(task, callbacks);
            this.columns[status].appendChild(card);
            columnCounts[status] = (columnCounts[status] || 0) + 1;
        });

        Object.keys(columnCounts).forEach(status => {
            if (this.counts[status]) this.counts[status].textContent = columnCounts[status];
        });
    }

    createCardElement(task, callbacks) {
        const div = document.createElement('div');
        div.className = 'kanban-card';
        div.draggable = true;
        div.dataset.id = task.id;
        div.dataset.status = task.status;
        div.style.fontSize = 'var(--task-font-size, 14px)';

        let labelHtml = '';
        if (task.color) {
            div.style.setProperty('--task-color', task.color);
            labelHtml = `<div class="card-labels"><div class="card-label" title="Label"></div></div>`;
        }

        const dateObj = task.createdAt && task.createdAt.toDate ? task.createdAt.toDate() : new Date();
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const hasDescription = !!task.description;
        const checklist = task.checklist || [];
        const totalItems = checklist.length;
        const completedItems = checklist.filter(i => i.done).length;

        let badgesHtml = '<div class="card-badges">';
        badgesHtml += `<div class="card-badge" title="Due Date"><span class="card-badge-icon">🕒</span><span>${dateStr}</span></div>`;

        if (hasDescription) {
            badgesHtml += `<div class="card-badge" title="Description"><span class="card-badge-icon">≡</span></div>`;
        }

        let descriptionHtml = '';
        if (hasDescription) {
            descriptionHtml = `<div class="card-description-preview">${this.escapeHtml(task.description)}</div>`;
        }

        if (totalItems > 0) {
            const isDone = totalItems === completedItems;
            const badgeStyle = isDone ? 'style="color: #22c55e;"' : '';
            badgesHtml += `<div class="card-badge" title="Checklist" ${badgeStyle}><span class="card-badge-icon">☑</span><span>${completedItems}/${totalItems}</span></div>`;
        }
        badgesHtml += '</div>';

        const membersHtml = `<div class="card-members"><div class="member-avatar" title="Member">MB</div></div>`;

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

        // Delete
        div.querySelector('.delete-task-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete task?')) {
                if (callbacks.onDeleteTask) callbacks.onDeleteTask(task.id);
            }
        });

        // Edit
        div.addEventListener('click', () => {
            if (callbacks.onEditTask) callbacks.onEditTask(task);
        });

        // Hover
        div.addEventListener('mouseenter', () => this.prepareHoverEditor(task, div, callbacks));
        div.addEventListener('mouseleave', () => this.scheduleHideHoverEditor());

        // DnD Setup
        if (callbacks.setupTaskDnD) callbacks.setupTaskDnD(div, task);

        return div;
    }

    /* --- HOVER EDITOR --- */

    setupHoverPreview(onSave) {
        if (this.quickEditColumn) return;

        this.quickEditColumn = document.createElement('div');
        this.quickEditColumn.className = 'quick-edit-column';
        this.quickEditColumn.innerHTML = `
            <div class="qe-connector"></div>
            <div class="quick-edit-header">
                <span class="qe-header-title">Quick Edit</span>
                <button class="qe-close-icon close-quick-edit" title="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
            <div class="quick-edit-body">
                <div class="qe-input-group"><label class="qe-label">Title</label><input type="text" class="qe-input qe-title"></div>
                <div class="qe-input-group"><label class="qe-label">Description</label><textarea class="qe-textarea qe-desc"></textarea></div>
                <div class="qe-checklist-panel" style="display:none;">
                    <label class="qe-label" style="margin-bottom:8px; display:block;">Checklist</label>
                    <div class="qe-checklist" style="display:flex; flex-direction:column; gap:8px;"></div>
                </div>
                <div class="qe-input-group">
                    <label class="qe-label">Status</label>
                    <div class="select-wrapper"><select class="qe-select qe-status"></select></div>
                </div>
            </div>
            <div class="quick-edit-footer">
                <span class="qe-status-text" style="font-size:0.75rem; color:var(--text-tertiary); margin-right:auto; opacity:0; transition:opacity 0.2s;">Saved!</span>
                <button class="qe-btn qe-btn-ghost close-quick-edit">Cancel</button>
                <button class="qe-btn qe-btn-primary qe-save">Save</button>
            </div>
        `;

        this.quickEditColumn.addEventListener('mouseenter', () => this.cancelHideHoverEditor());
        this.quickEditColumn.addEventListener('mouseleave', () => this.scheduleHideHoverEditor());

        this.quickEditColumn.querySelectorAll('.close-quick-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideHoverEditor();
            });
        });

        this.quickEditColumn.querySelector('.qe-save').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (onSave) await onSave(this.getQuickEditData());
        });

        this.quickEditColumn.querySelector('.qe-title').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && onSave) onSave(this.getQuickEditData());
        });
    }

    prepareHoverEditor(task, cardElement, callbacks) {
        this.cancelHideHoverEditor();
        if (this.currentHoverTaskId === task.id && this.quickEditColumn && this.quickEditColumn.classList.contains('active')) return;

        this.currentHoverTaskId = task.id;
        this.currentHoverTask = task;

        const parentColumn = cardElement.closest('.kanban-column');
        if (!parentColumn) return;

        // Populate
        this.quickEditColumn.querySelector('.qe-title').value = task.title || '';
        this.quickEditColumn.querySelector('.qe-desc').value = task.description || '';

        // Checklist
        const checklistContainer = this.quickEditColumn.querySelector('.qe-checklist');
        const checklistPanel = this.quickEditColumn.querySelector('.qe-checklist-panel');
        checklistContainer.innerHTML = '';

        if (task.checklist && task.checklist.length > 0) {
            task.checklist.forEach(item => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; align-items:center; gap:8px;';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = item.done;

                const span = document.createElement('span');
                span.textContent = item.text;
                span.style.cssText = `font-size:0.85rem; flex:1; ${item.done ? 'text-decoration:line-through; opacity:0.6;' : ''}`;

                checkbox.addEventListener('change', () => {
                    item.done = checkbox.checked;
                    span.style.textDecoration = item.done ? 'line-through' : 'none';
                    span.style.opacity = item.done ? '0.6' : '1';
                    // Auto-save checklist changes
                    if (callbacks.onSaveTask) callbacks.onSaveTask(this.getQuickEditData());
                });

                row.appendChild(checkbox);
                row.appendChild(span);
                checklistContainer.appendChild(row);
            });
            checklistPanel.style.display = 'block';
        } else {
            checklistPanel.style.display = 'none';
        }

        // Status Select
        const colStatus = this.quickEditColumn.querySelector('.qe-status');
        // Need columns list... pass it in callbacks or store in renderer?
        // Reuse stored columns from last renderBoard? We don't have the config object, but we have DOM.
        // Better: pass columns in callbacks.prepareHover?
        // Or assume we have `this.currentBoardConfig`?
        // Let's use `callbacks.getColumns()`
        if (callbacks.getColumns) {
            const columns = callbacks.getColumns();
            colStatus.innerHTML = columns.map(c => `<option value="${c.id}">${this.escapeHtml(c.title)}</option>`).join('');
            colStatus.value = task.status;
        }

        // DOM Insert
        const headerParent = parentColumn.parentElement;
        const nextSibling = parentColumn.nextElementSibling;
        if (nextSibling === this.quickEditColumn) { }
        else if (nextSibling) headerParent.insertBefore(this.quickEditColumn, nextSibling);
        else headerParent.appendChild(this.quickEditColumn);

        void this.quickEditColumn.offsetWidth; // Reflow

        // Position
        const cardRect = cardElement.getBoundingClientRect();
        const refRect = parentColumn.getBoundingClientRect();
        const relativeY = (cardRect.top + (cardRect.height / 2)) - refRect.top;
        this.quickEditColumn.style.setProperty('--card-y', `${relativeY}px`);

        this.quickEditColumn.classList.add('active');
    }

    getQuickEditData() {
        if (!this.currentHoverTask) return null;
        return {
            id: this.currentHoverTask.id,
            title: this.quickEditColumn.querySelector('.qe-title').value.trim(),
            description: this.quickEditColumn.querySelector('.qe-desc').value.trim(),
            status: this.quickEditColumn.querySelector('.qe-status').value,
            checklist: this.currentHoverTask.checklist // Updated in place by listeners
        };
    }

    scheduleHideHoverEditor() {
        this.cancelHideHoverEditor();
        this.hoverHideTimeout = setTimeout(() => this.hideHoverEditor(), 300);
    }

    cancelHideHoverEditor() {
        if (this.hoverHideTimeout) {
            clearTimeout(this.hoverHideTimeout);
            this.hoverHideTimeout = null;
        }
    }

    hideHoverEditor() {
        if (!this.quickEditColumn) return;
        this.quickEditColumn.classList.remove('active');
        this.currentHoverTaskId = null;
    }
}

window.BoardRenderer = BoardRenderer;
