export class StateSelector {
    constructor(options = {}) {
        this.containerId = options.containerId || 'state-selector-container';
        this.onChange = options.onChange || (() => { });
        this.selectedStates = new Set();
        this.allStates = [];
        this.isOpen = false;

        this.init();
    }

    init() {
        this.renderBase();
        this.attachGlobalListeners();
    }

    renderBase() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="state-selector-wrapper" style="position: relative;">
                <button id="state-trigger" class="filter-select" style="display: flex; align-items: center; justify-content: space-between; min-width: 140px; cursor: pointer;">
                    <span id="state-trigger-text">States</span>
                    <span style="font-size: 0.7rem; opacity: 0.7;">▼</span>
                </button>
                
                <!-- Dropdown -->
                <div id="state-dropdown" class="fancy-dropdown-state" style="display: none;">
                    <div class="dropdown-header">
                        SELECT STATES
                    </div>
                    <div class="dropdown-list" id="state-list">
                        <!-- Options injected here -->
                    </div>
                    <div class="dropdown-footer">
                        <button id="state-apply-btn" class="apply-btn">Apply Changes</button>
                    </div>
                </div>
            </div>
            
            <style>
                .fancy-dropdown-state {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    margin-top: 8px;
                    width: 280px;
                    background: #1e293b; /* Dark slate */
                    border: 1px solid var(--border-light);
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                    z-index: 100;
                    overflow: hidden;
                    animation: slideDownState 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    display: flex;
                    flex-direction: column;
                }

                @keyframes slideDownState {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .fancy-dropdown-state .dropdown-header {
                    padding: 12px 16px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    background: rgba(0,0,0,0.2);
                }

                .fancy-dropdown-state .dropdown-list {
                    max-height: 250px;
                    overflow-y: auto;
                    padding: 8px 0;
                }

                .fancy-dropdown-state .dropdown-item {
                    display: flex;
                    align-items: center;
                    padding: 8px 16px;
                    cursor: pointer;
                    transition: background 0.15s;
                    color: var(--text-main);
                    font-size: 0.9rem;
                    gap: 12px;
                }

                .fancy-dropdown-state .dropdown-item:hover {
                    background: rgba(255,255,255,0.05);
                }

                /* Custom Checkbox */
                .fancy-dropdown-state .custom-checkbox {
                    width: 18px;
                    height: 18px;
                    border: 2px solid var(--border-light);
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                .fancy-dropdown-state .dropdown-item.selected .custom-checkbox {
                    background: var(--accent-color, #3b82f6);
                    border-color: var(--accent-color, #3b82f6);
                }

                .fancy-dropdown-state .dropdown-item.selected .custom-checkbox::after {
                    content: '✓';
                    font-size: 12px;
                    color: white;
                    font-weight: bold;
                }

                .fancy-dropdown-state .dropdown-footer {
                    padding: 12px;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    background: rgba(0,0,0,0.2);
                    display: flex;
                    justify-content: flex-end;
                }

                .fancy-dropdown-state .apply-btn {
                    background: var(--accent-color, #3b82f6);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    cursor: pointer;
                    width: 100%;
                    transition: opacity 0.2s;
                }

                .fancy-dropdown-state .apply-btn:hover {
                    opacity: 0.9;
                }

                /* Scrollbar */
                .fancy-dropdown-state .dropdown-list::-webkit-scrollbar {
                    width: 6px;
                }
                .fancy-dropdown-state .dropdown-list::-webkit-scrollbar-track {
                    background: transparent;
                }
                .fancy-dropdown-state .dropdown-list::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                }
            </style>
        `;

        // Bind Elements
        this.triggerBtn = document.getElementById('state-trigger');
        this.dropdown = document.getElementById('state-dropdown');
        this.listContainer = document.getElementById('state-list');
        this.applyBtn = document.getElementById('state-apply-btn');
        this.triggerText = document.getElementById('state-trigger-text');

        // Event Listeners
        this.triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        this.applyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.applyChanges();
        });

        this.dropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    setStates(states) {
        this.allStates = states.sort();
        this.renderList();
    }

    setValue(selectedStates) {
        // Support both array and single value for backward compatibility
        if (Array.isArray(selectedStates)) {
            this.selectedStates = new Set(selectedStates);
        } else if (selectedStates && selectedStates !== 'all') {
            this.selectedStates = new Set([selectedStates]);
        } else {
            this.selectedStates = new Set();
        }
        this.renderList();
        this.updateTriggerText();
    }

    renderList() {
        this.listContainer.innerHTML = '';

        if (this.allStates.length === 0) {
            this.listContainer.innerHTML = '<div style="padding: 12px 16px; color: var(--text-muted); font-size: 0.85rem;">No states found</div>';
            return;
        }

        this.allStates.forEach(state => {
            const isSelected = this.selectedStates.has(state);
            const item = document.createElement('div');
            item.className = `dropdown-item ${isSelected ? 'selected' : ''}`;
            item.innerHTML = `
                <div class="custom-checkbox"></div>
                <span>${state}</span>
            `;

            item.addEventListener('click', () => {
                this.toggleSelection(state, item);
            });

            this.listContainer.appendChild(item);
        });
    }

    toggleSelection(state, element) {
        if (this.selectedStates.has(state)) {
            this.selectedStates.delete(state);
            element.classList.remove('selected');
        } else {
            this.selectedStates.add(state);
            element.classList.add('selected');
        }
    }

    toggleDropdown() {
        this.isOpen = !this.isOpen;
        this.dropdown.style.display = this.isOpen ? 'flex' : 'none';

        if (this.isOpen) {
            this.triggerBtn.style.borderColor = 'var(--accent-color)';
            // Notify other popups to close
            document.dispatchEvent(new CustomEvent('filter-popup-opened', {
                detail: { id: this.containerId }
            }));
        } else {
            this.triggerBtn.style.borderColor = 'var(--border-strong)';
        }
    }

    closeDropdown() {
        this.isOpen = false;
        this.dropdown.style.display = 'none';
        this.triggerBtn.style.borderColor = 'var(--border-strong)';
    }

    applyChanges() {
        this.onChange(Array.from(this.selectedStates));
        this.closeDropdown();
        this.updateTriggerText();
    }

    updateTriggerText() {
        const count = this.selectedStates.size;
        if (count === 0) {
            this.triggerText.textContent = 'States';
        } else if (count === 1) {
            this.triggerText.textContent = `States (${count})`;
        } else {
            this.triggerText.textContent = `States (${count})`;
        }
    }

    attachGlobalListeners() {
        document.addEventListener('click', () => {
            if (this.isOpen) {
                this.closeDropdown();
            }
        });

        // Listen for other popups opening
        document.addEventListener('filter-popup-opened', (e) => {
            if (this.isOpen && e.detail.id !== this.containerId) {
                this.closeDropdown();
            }
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeDropdown();
            }
        });
    }

    // Reset method for clear filters
    reset() {
        this.selectedStates.clear();
        this.renderList(); // Re-render to clear checkboxes
        this.updateTriggerText();
        this.closeDropdown();
    }
}
