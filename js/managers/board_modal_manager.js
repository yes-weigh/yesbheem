
export class BoardModalManager {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.isEditing = false;
        this.currentTaskId = null;
        this.currentChecklist = [];

        // Gallery State
        this.isGalleryManageMode = false;
        this.gallerySelection = new Set();
        this.selectedGalleryUrl = null;
        this.tempBgRemoved = false;
    }

    setupModals() {
        this.setupSettingsModal();
        this.setupTaskModal();
    }

    /* --- BOARD SETTINGS MODAL --- */

    setupSettingsModal() {
        const modal = document.getElementById('boardSettingsModal');
        const closeBtn = document.getElementById('closeSettingsBtn');
        const cancelBtn = document.getElementById('cancelSettingsBtn');
        const saveBtn = document.getElementById('saveSettingsBtn');
        const deleteBoardBtn = document.getElementById('deleteBoardBtn');

        const closeModal = () => modal.classList.remove('active');

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        // Tabs
        modal.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                modal.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                modal.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
                tab.classList.add('active');
                document.getElementById(`tab-${tab.dataset.tab}`).style.display = 'block';
            });
        });

        // Font Size
        const slider = document.getElementById('fontSizeSlider');
        slider.addEventListener('input', (e) => {
            document.documentElement.style.setProperty('--task-font-size', e.target.value + 'px');
        });

        // Save
        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            const data = {
                newName: document.getElementById('settingsBoardName').value.trim(),
                fontSize: document.getElementById('fontSizeSlider').value,
                bgInput: document.getElementById('bgImageInput'), // Pass element for file extraction
                tempBgRemoved: this.tempBgRemoved,
                selectedGalleryUrl: this.selectedGalleryUrl
            };

            if (this.callbacks.onSaveSettings) {
                await this.callbacks.onSaveSettings(data);
            }

            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
            closeModal();
        });

        // Delete Board UI confirmation
        deleteBoardBtn.addEventListener('click', () => {
            if (this.callbacks.onDeleteBoardRequest) {
                this.callbacks.onDeleteBoardRequest();
                closeModal();
            }
        });

        // Gallery Setup
        this.setupGalleryUI();
    }

    setupGalleryUI() {
        // Background Image Input Preview
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
                    this.selectedGalleryUrl = null;
                    this.highlightGalleryItem(null);
                };
                reader.readAsDataURL(file);
                this.tempBgRemoved = false;
            }
        });

        removeBgBtn.addEventListener('click', () => {
            bgInput.value = '';
            preview.style.backgroundImage = '';
            preview.style.display = 'none';
            this.tempBgRemoved = true;
            this.selectedGalleryUrl = null;
            this.highlightGalleryItem(null);
        });

        // Bulk Upload
        const bulkInput = document.getElementById('bulkUploadInput');
        bulkInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (files && files.length > 0 && this.callbacks.onBulkUpload) {
                await this.callbacks.onBulkUpload(files);
                this.loadGallery(); // Refresh
                bulkInput.value = '';
            }
        });

        // Manage Mode
        document.getElementById('manageGalleryBtn').addEventListener('click', () => this.toggleGalleryManageMode(true));
        document.getElementById('cancelManageBtn').addEventListener('click', () => this.toggleGalleryManageMode(false));

        document.getElementById('deleteImagesBtn').addEventListener('click', async () => {
            if (this.gallerySelection.size === 0) return;
            if (!confirm(`Delete ${this.gallerySelection.size} images?`)) return;

            const btn = document.getElementById('deleteImagesBtn');
            btn.textContent = 'Deleting...';
            btn.disabled = true;

            if (this.callbacks.onDeleteImages) {
                await this.callbacks.onDeleteImages(Array.from(this.gallerySelection));
            }

            this.gallerySelection.clear();
            this.toggleGalleryManageMode(false);
            this.loadGallery();

            btn.textContent = 'Delete';
            btn.disabled = false;
        });
    }

    toggleGalleryManageMode(active) {
        this.isGalleryManageMode = active;
        this.gallerySelection.clear();
        document.getElementById('galleryActions').style.display = active ? 'flex' : 'none';
        document.getElementById('manageGalleryBtn').style.display = active ? 'none' : 'inline-block';
        this.updateGallerySelectionUI();
    }

    openSettingsModal(board) {
        if (!board) return;

        document.getElementById('settingsBoardName').value = board.name;
        document.getElementById('fontSizeSlider').value = parseInt(board.fontSize) || 14;

        const preview = document.getElementById('bgImagePreview');
        if (board.bgImage) {
            preview.style.backgroundImage = `url('${board.bgImage}')`;
            preview.style.display = 'block';
            this.selectedGalleryUrl = board.bgImage;
        } else {
            preview.style.display = 'none';
            this.selectedGalleryUrl = null;
        }
        this.tempBgRemoved = false;

        this.loadGallery();
        document.getElementById('boardSettingsModal').classList.add('active');
    }

    async loadGallery() {
        const gallery = document.getElementById('bgImageGallery');
        if (!gallery) return;
        gallery.innerHTML = 'Loading...';

        if (!this.callbacks.getGalleryImages) return;
        const urls = await this.callbacks.getGalleryImages();

        gallery.innerHTML = '';
        if (urls.length === 0) {
            gallery.innerHTML = 'No uploads yet.';
            return;
        }

        urls.forEach(url => {
            const div = document.createElement('div');
            div.className = 'bg-gallery-item';
            div.style.backgroundImage = `url('${url}')`;
            div.dataset.url = url;

            if (url === this.selectedGalleryUrl && !this.isGalleryManageMode) div.classList.add('selected');

            div.addEventListener('click', () => {
                if (this.isGalleryManageMode) {
                    if (this.gallerySelection.has(url)) {
                        this.gallerySelection.delete(url);
                        div.classList.remove('deletion-selected');
                    } else {
                        this.gallerySelection.add(url);
                        div.classList.add('deletion-selected');
                    }
                } else {
                    this.selectedGalleryUrl = url;
                    this.tempBgRemoved = false;
                    document.getElementById('bgImagePreview').style.backgroundImage = `url('${url}')`;
                    document.getElementById('bgImagePreview').style.display = 'block';
                    document.getElementById('bgImageInput').value = '';
                    this.highlightGalleryItem(div);
                }
            });

            gallery.appendChild(div);
        });
    }

    highlightGalleryItem(selectedDiv) {
        document.querySelectorAll('.bg-gallery-item').forEach(el => el.classList.remove('selected'));
        if (selectedDiv) selectedDiv.classList.add('selected');
    }

    updateGallerySelectionUI() {
        document.getElementById('selectedCountText').textContent = `${this.gallerySelection.size} selected`;
        // Re-render handled by manual class toggling in click handlers mostly, 
        // but if switching modes, we rely on loadGallery to refresh or manual cleanup.
        // Simple fix: reload gallery to reset states
        this.loadGallery();
    }

    /* --- ADD/EDIT TASK MODAL --- */

    setupTaskModal() {
        const modal = document.getElementById('addTaskModal');
        const closeModal = () => modal.classList.remove('active');

        document.getElementById('closeModalBtn').addEventListener('click', closeModal);
        document.getElementById('cancelBtn').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        // Add Checklist Item
        const addBtn = document.getElementById('addChecklistBtn');
        const input = document.getElementById('newChecklistItem');

        if (addBtn) addBtn.addEventListener('click', () => this.addChecklistItem());
        if (input) input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.addChecklistItem(); }
        });

        // Save
        document.getElementById('saveTaskBtn').addEventListener('click', () => this.handleSaveTask(closeModal));
    }

    addChecklistItem() {
        const input = document.getElementById('newChecklistItem');
        const text = input.value.trim();
        if (!text) return;
        this.currentChecklist.push({ text, done: false });
        this.renderChecklistItems();
        input.value = '';
        input.focus();
    }

    renderChecklistItems() {
        const container = document.getElementById('checklistItems');
        container.innerHTML = '';
        this.currentChecklist.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'checklist-item';
            div.innerHTML = `
                <input type="checkbox" ${item.done ? 'checked' : ''}>
                <span class="${item.done ? 'completed' : ''}">${this.escapeHtml(item.text)}</span>
                <button class="delete-item-btn">×</button>
            `;
            div.querySelector('input').addEventListener('change', (e) => {
                item.done = e.target.checked;
                div.querySelector('span').classList.toggle('completed', item.done);
            });
            div.querySelector('.delete-item-btn').addEventListener('click', () => {
                this.currentChecklist.splice(index, 1);
                this.renderChecklistItems();
            });
            container.appendChild(div);
        });
    }

    openModal(defaultStatusId = null) {
        this.resetModal('Add New Task', 'Add Task');
        if (defaultStatusId) document.getElementById('taskStatus').value = defaultStatusId;
        document.getElementById('addTaskModal').classList.add('active');
        document.getElementById('taskTitle').focus();
    }

    openEditModal(task) {
        this.resetModal('Edit Task', 'Update Task');
        this.isEditing = true;
        this.currentTaskId = task.id;

        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskStatus').value = task.status || 'todo';

        const colorInput = document.querySelector(`input[name="taskColor"][value="${task.color || ''}"]`);
        if (colorInput) colorInput.checked = true;

        this.currentChecklist = task.checklist ? JSON.parse(JSON.stringify(task.checklist)) : [];
        this.renderChecklistItems();

        document.getElementById('addTaskModal').classList.add('active');
    }

    resetModal(title, btnText) {
        this.isEditing = false;
        this.currentTaskId = null;
        this.currentChecklist = [];
        this.renderChecklistItems();
        document.querySelector('.modal-title').textContent = title;
        document.getElementById('saveTaskBtn').textContent = btnText;
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDescription').value = '';
        document.getElementById('color-none').checked = true;
    }

    async handleSaveTask(closeModalCallback) {
        const title = document.getElementById('taskTitle').value.trim();
        if (!title) return alert('Enter title');

        const data = {
            id: this.currentTaskId,
            title,
            description: document.getElementById('taskDescription').value.trim(),
            status: document.getElementById('taskStatus').value,
            color: document.querySelector('input[name="taskColor"]:checked')?.value || '',
            checklist: this.currentChecklist
        };

        const saveBtn = document.getElementById('saveTaskBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        if (this.callbacks.onSaveTask) {
            await this.callbacks.onSaveTask(data, this.isEditing);
            closeModalCallback();
        }

        saveBtn.disabled = false;
        saveBtn.textContent = this.isEditing ? 'Update Task' : 'Add Task';
    }

    escapeHtml(text) {
        if (!text) return text;
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
}

window.BoardModalManager = BoardModalManager;
