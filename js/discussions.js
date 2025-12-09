
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
        }));
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

    return div;
}

// Task Operations
async function addTask(title, description, status = 'todo') {
    try {
        await addDoc(collection(db, COLLECTION_NAME), {
            title,
            description,
            status,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Error adding task: ", e);
        alert("Failed to add task. See console for details.");
        return false;
    }
}

async function updateTaskStatus(taskId, newStatus) {
    const taskRef = doc(db, COLLECTION_NAME, taskId);
    try {
        await updateDoc(taskRef, {
            status: newStatus
        });
    } catch (e) {
        console.error("Error updating task: ", e);
        // Revert UI if needed (subscription will handle handle eventual consistency, but optimistic update might be better)
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
            e.preventDefault(); // Allow dropping
            e.dataTransfer.dropEffect = 'move';
            col.classList.add('drag-over');
        });

        col.addEventListener('dragleave', (e) => {
            col.classList.remove('drag-over');
        });

        col.addEventListener('drop', async (e) => {
            e.preventDefault();
            col.classList.remove('drag-over');

            const taskId = e.dataTransfer.getData('text/plain');
            const newStatus = col.dataset.status;

            if (draggedItem && draggedItem.dataset.status !== newStatus) {
                // Optimistic UI update could go here, but we'll rely on the snapshot listener for simplicity
                await updateTaskStatus(taskId, newStatus);
            }
        });
    });
}

// Modal Handling
function setupModal() {
    const modalOverlay = document.getElementById('addTaskModal');
    const openBtn = document.getElementById('openAddTaskBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveBtn = document.getElementById('saveTaskBtn');
    const titleInput = document.getElementById('taskTitle');
    const descInput = document.getElementById('taskDescription');
    const statusInput = document.getElementById('taskStatus');

    function openModal() {
        modalOverlay.classList.add('active');
        titleInput.focus();
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
        // Reset form
        titleInput.value = '';
        descInput.value = '';
        statusInput.value = 'todo';
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

        if (!title) {
            alert('Please enter a task title');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const success = await addTask(title, description, status);

        saveBtn.disabled = false;
        saveBtn.textContent = 'Add Task';

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
