
export class BoardDnDManager {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.draggedItem = null;
        this.draggedColumn = null;
    }

    /* --- TASKS --- */

    setupTaskDnD(cardElement, task) {
        cardElement.addEventListener('dragstart', (e) => this.handleTaskDragStart(e, cardElement));
        cardElement.addEventListener('dragend', (e) => this.handleTaskDragEnd(e, cardElement));
    }

    handleTaskDragStart(e, item) {
        this.draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.setData('text/plain', item.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
    }

    handleTaskDragEnd(e, item) {
        item.classList.remove('dragging');
        this.draggedItem = null;
        document.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
    }

    setupColumnDropZones(columnElements) {
        columnElements.forEach(col => {
            col.addEventListener('dragover', (e) => {
                // If dragging a column, ignore task logic
                if (this.draggedColumn) return;

                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                col.classList.add('drag-over');

                const container = col.querySelector('.column-content');
                const afterElement = this.getDragAfterElement(container, e.clientY);

                if (this.draggedItem) {
                    if (afterElement == null) {
                        container.appendChild(this.draggedItem);
                    } else {
                        container.insertBefore(this.draggedItem, afterElement);
                    }
                }
            });

            col.addEventListener('dragleave', () => col.classList.remove('drag-over'));

            col.addEventListener('drop', async (e) => {
                // If dragging column, ignore
                if (this.draggedColumn) return;

                e.preventDefault();
                col.classList.remove('drag-over');

                if (!this.draggedItem) return;

                const taskId = this.draggedItem.dataset.id;
                const newStatus = col.dataset.status;

                // Calculate Order
                const prevCard = this.draggedItem.previousElementSibling;
                const nextCard = this.draggedItem.nextElementSibling;

                // We need to fetch order values. Since we don't have task objects here directly,
                // we rely on callbacks to get task info or calculate it.
                // Or we can assume 'dataset-order' attributes?
                // Better: Pass the adjacent IDs to callback, let controller calculate logic.
                // BUT, to keep logic simple, let's replicate the `getOrder` fetch via callback.

                const prevId = prevCard ? prevCard.dataset.id : null;
                const nextId = nextCard ? nextCard.dataset.id : null;

                if (this.callbacks.onTaskDrop) {
                    await this.callbacks.onTaskDrop(taskId, newStatus, prevId, nextId);
                }
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

    /* --- COLUMNS --- */

    setupColumnDnD(columnElement) {
        columnElement.addEventListener('dragstart', (e) => this.handleColumnDragStart(e, columnElement));
        columnElement.addEventListener('dragover', (e) => this.handleColumnDragOver(e, columnElement));
        columnElement.addEventListener('dragend', (e) => this.handleColumnDragEnd(e, columnElement));
        columnElement.addEventListener('drop', (e) => this.handleColumnDrop(e, columnElement));
    }

    handleColumnDragStart(e, columnDiv) {
        this.draggedColumn = columnDiv;
        columnDiv.classList.add('dragging-column');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', columnDiv.dataset.status);
    }

    handleColumnDragOver(e, columnDiv) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (this.draggedColumn === columnDiv) return;
    }

    handleColumnDragEnd(e, columnDiv) {
        columnDiv.classList.remove('dragging-column');
        this.draggedColumn = null;
    }

    async handleColumnDrop(e, targetColumnDiv) {
        e.preventDefault();
        if (!this.draggedColumn || this.draggedColumn === targetColumnDiv) return;

        const rect = targetColumnDiv.getBoundingClientRect();
        const after = e.clientX > rect.left + rect.width / 2;

        if (after) {
            targetColumnDiv.after(this.draggedColumn);
        } else {
            targetColumnDiv.before(this.draggedColumn);
        }

        // Persist
        if (this.callbacks.onColumnReorder) {
            // Get all IDs in new order
            const newOrderIds = [...document.querySelectorAll('.kanban-column')].map(el => el.dataset.status);
            await this.callbacks.onColumnReorder(newOrderIds);
        }
    }
}

window.BoardDnDManager = BoardDnDManager;
