
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAe60OJTWPBt0KsL7q5TMHOf2ecwp_sFEo",
    authDomain: "yesweighmomentumhub.firebaseapp.com",
    projectId: "yesweighmomentumhub",
    storageBucket: "yesweighmomentumhub.firebasestorage.app",
    messagingSenderId: "979624929975",
    appId: "1:979624929975:web:96962436134197488f3b32"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTION_NAME = "project_tasks";

// State
let tasks = [];

// DOM Elements
const columns = {
    'todo': document.getElementById('todo-list'),
    'inprogress': document.getElementById('inprogress-list'),
    'done': document.getElementById('done-list')
};

const counts = {
    'todo': document.getElementById('todo-count'),
    'inprogress': document.getElementById('inprogress-count'),
    'done': document.getElementById('done-count')
};

// Initialize
function init() {
    subscribeToTasks();
    setupDragAndDrop();
    setupModal();
}

// Firestore Subscription
function subscribeToTasks() {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));

    // Show loading state
    Object.values(columns).forEach(col => {
        if (col) col.innerHTML = '<div class="loading-spinner">Loading tasks...</div>';
    });

    onSnapshot(q, (snapshot) => {
        tasks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a, b) => (a.order || 0) - (b.order || 0));

        renderBoard();
    }, (error) => {
        console.error("Error fetching tasks:", error);
        Object.values(columns).forEach(col => {
            if (col) col.innerHTML = '<div class="loading-spinner" style="color: var(--danger-color)">Error loading tasks</div>';
        });
    });
}

// Rendering
function renderBoard() {
    // Clear columns
    Object.values(columns).forEach(col => {
        if (col) col.innerHTML = '';
    });

    // Reset counts
    const columnCounts = { todo: 0, inprogress: 0, done: 0 };

    tasks.forEach(task => {
        const card = createCardElement(task);
        const status = task.status || 'todo';
        if (columns[status]) {
            columns[status].appendChild(card);
            columnCounts[status]++;
        }
    });

    // Update counters
    Object.keys(columnCounts).forEach(status => {
        if (counts[status]) counts[status].textContent = columnCounts[status];
    });
}

function createCardElement(task) {
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
        <div class="card-title">${escapeHtml(task.title)}</div>
        <div class="card-description">${escapeHtml(task.description || '')}</div>
        <div class="card-footer">
            <span class="card-date">📅 ${dateStr}</span>
            <button class="delete-task-btn" type="button" title="Delete Task">🗑️</button>
        </div>
    `;

    // Drag events
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragend', handleDragEnd);

    // Delete button
    const deleteBtn = div.querySelector('.delete-task-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this task?')) {
            deleteTask(task.id);
        }
    });

    // Edit functionality
    div.addEventListener('click', () => {
        openEditModal(task);
    });

    return div;
}

// Task Operations
async function addTask(title, description, status = 'todo', color = '') {
    try {
        // Default order: max order + 1000, or Date.now() if lazy
        // Let's use Date.now() for simplicity as it always increases
        await addDoc(collection(db, COLLECTION_NAME), {
            title,
            description,
            status,
            color,
            order: Date.now(),
            createdAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Error adding task: ", e);
        alert("Failed to add task. See console for details.");
        return false;
    }
}

async function moveTask(taskId, newStatus, newOrder) {
    const taskRef = doc(db, COLLECTION_NAME, taskId);
    try {
        await updateDoc(taskRef, {
            status: newStatus,
            order: newOrder
        });
    } catch (e) {
        console.error("Error moving task: ", e);
    }
}


async function updateTask(taskId, title, description, status, color) {
    const taskRef = doc(db, COLLECTION_NAME, taskId);
    try {
        await updateDoc(taskRef, {
            title,
            description,
            status,
            color,
            updatedAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Error updating task: ", e);
        alert("Failed to update task.");
        return false;
    }
}

async function deleteTask(taskId) {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, taskId));
    } catch (e) {
        console.error("Error deleting task: ", e);
        alert("Failed to delete task.");
    }
}

// Drag and Drop
let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.setData('text/plain', this.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggedItem = null;

    // Remove drag-over classes
    document.querySelectorAll('.kanban-column').forEach(col => {
        col.classList.remove('drag-over');
    });
}

function setupDragAndDrop() {
    const columnElements = document.querySelectorAll('.kanban-column');

    columnElements.forEach(col => {
        col.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            col.classList.add('drag-over');

            // Visual Reordering
            const afterElement = getDragAfterElement(col.querySelector('.column-content'), e.clientY);
            const container = col.querySelector('.column-content');
            if (draggedItem) {
                if (afterElement == null) {
                    container.appendChild(draggedItem);
                } else {
                    container.insertBefore(draggedItem, afterElement);
                }
            }
        });

        col.addEventListener('dragleave', (e) => {
            col.classList.remove('drag-over');
        });

        col.addEventListener('drop', async (e) => {
            e.preventDefault();
            col.classList.remove('drag-over');

            if (!draggedItem) return;

            const taskId = draggedItem.dataset.id;
            const newStatus = col.dataset.status;

            // Calculate new Order
            const prevCard = draggedItem.previousElementSibling;
            const nextCard = draggedItem.nextElementSibling;

            // Safe defaults
            const prevOrder = prevCard ? getOrder(prevCard.dataset.id) : 0;
            // If nextCard exists, use its order. If there is no next card, we are at bottom.
            // If at bottom, we want a larger number. 
            // However, our logic: New = (Prev + Next)/2
            // Case 1: Insert at Top. Prev=null(0). Next=Exists(1000). New = 500.
            // Case 2: Insert at Bottom. Prev=Exists(1000). Next=null. New = 1000 + 1000 = 2000.
            // Case 3: Middle. Prev=1000. Next=2000. New=1500.

            let newOrder;
            if (!prevCard && !nextCard) {
                // Only item in list
                newOrder = Date.now();
            } else if (!prevCard) {
                // Top of list
                const nextOrder = getOrder(nextCard.dataset.id);
                newOrder = nextOrder - 10000; // Arbitrary gap
            } else if (!nextCard) {
                // Bottom of list
                newOrder = prevOrder + 10000;
            } else {
                // Middle
                const nextOrder = getOrder(nextCard.dataset.id);
                newOrder = (prevOrder + nextOrder) / 2;
            }

            // Optimistic update local model to prevent jitter on snapshot
            updateLocalTask(taskId, newStatus, newOrder);

            await moveTask(taskId, newStatus, newOrder);
        });
    });
}

function getDragAfterElement(container, y) {
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

function getOrder(id) {
    const task = tasks.find(t => t.id === id);
    return task ? (task.order || 0) : 0;
}

function updateLocalTask(id, status, order) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.status = status;
        task.order = order;
    }
}

// Modal Handling
let isEditing = false;
let currentTaskId = null;

function openEditModal(task) {
    const modalOverlay = document.getElementById('addTaskModal');
    const titleInput = document.getElementById('taskTitle');
    const descInput = document.getElementById('taskDescription');
    const statusInput = document.getElementById('taskStatus');
    const saveBtn = document.getElementById('saveTaskBtn');
    const modalTitle = document.querySelector('.modal-title');

    isEditing = true;
    currentTaskId = task.id;

    modalTitle.textContent = 'Edit Task';
    titleInput.value = task.title;
    descInput.value = task.description || '';
    statusInput.value = task.status || 'todo';
    saveBtn.textContent = 'Update Task';

    // Set color
    const colorInput = document.querySelector(`input[name="taskColor"][value="${task.color || ''}"]`);
    if (colorInput) colorInput.checked = true;
    else document.getElementById('color-none').checked = true;

    modalOverlay.classList.add('active');
    titleInput.focus();
}

function setupModal() {
    const modalOverlay = document.getElementById('addTaskModal');
    const openBtn = document.getElementById('openAddTaskBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveBtn = document.getElementById('saveTaskBtn');
    const titleInput = document.getElementById('taskTitle');
    const descInput = document.getElementById('taskDescription');
    const statusInput = document.getElementById('taskStatus');
    const modalTitle = document.querySelector('.modal-title');

    function openModal() {
        isEditing = false;
        currentTaskId = null;
        modalTitle.textContent = 'Add New Task';
        saveBtn.textContent = 'Add Task';

        // Reset form
        titleInput.value = '';
        descInput.value = '';
        statusInput.value = 'todo';
        document.getElementById('color-none').checked = true;

        modalOverlay.classList.add('active');
        titleInput.focus();
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
    }

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Close on click outside
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    saveBtn.addEventListener('click', async () => {
        const title = titleInput.value.trim();
        const description = descInput.value.trim();
        const status = statusInput.value;
        const colorInput = document.querySelector('input[name="taskColor"]:checked');
        const color = colorInput ? colorInput.value : '';

        if (!title) {
            alert('Please enter a task title');
            return;
        }

        saveBtn.disabled = true;

        let success;
        if (isEditing && currentTaskId) {
            saveBtn.textContent = 'Updating...';
            success = await updateTask(currentTaskId, title, description, status, color);
        } else {
            saveBtn.textContent = 'Saving...';
            success = await addTask(title, description, status, color);
        }

        saveBtn.disabled = false;
        saveBtn.textContent = isEditing ? 'Update Task' : 'Add Task';

        if (success) {
            closeModal();
        }
    });
}

// Utils
function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Start
init();
