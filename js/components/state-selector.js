export class StateSelector {
    constructor(options = {}) {
        this.containerId = options.containerId || 'state-selector-container';
        this.onChange = options.onChange || (() => { });
        this.currentState = 'all';
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
                <button id="state-trigger" class="filter-select" style="display: flex; align-items: center; justify-content: space-between; min-width: 160px; cursor: pointer; height: 38px;">
                     <div id="state-trigger-content" style="display: flex; align-items: center; gap: 8px;">
                        <span id="state-trigger-text">All States</span>
                     </div>
                    <span style="font-size: 0.7rem; opacity: 0.7; margin-left:8px;">▼</span>
                </button>
                
                <!-- Dropdown -->
                <div id="state-dropdown" class="fancy-dropdown-state" style="display: none;">
                    <div class="dropdown-header">
                        SELECT STATE
                    </div>
                    <div class="dropdown-list" id="state-list">
                        <!-- Options injected here -->
                    </div>
                </div>
            </div>
            
            <style>
                .fancy-dropdown-state {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    margin-top: 8px;
                    width: 240px;
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
                    padding: 4px 0;
                }

                .fancy-dropdown-state .dropdown-item {
                    display: flex;
                    align-items: center;
                    padding: 10px 16px;
                    cursor: pointer;
                    transition: background 0.15s;
                    color: var(--text-main);
                    font-size: 0.9rem;
                    gap: 12px;
                    border-left: 3px solid transparent;
                }

                .fancy-dropdown-state .dropdown-item:hover {
                    background: rgba(255,255,255,0.05);
                }

                .fancy-dropdown-state .dropdown-item.selected {
                    background: rgba(59, 130, 246, 0.1);
                    border-left-color: var(--accent-color);
                    color: white;
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
        this.triggerContent = document.getElementById('state-trigger-content');

        // Event Listeners
        this.triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        this.dropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    setStates(states) {
        this.allStates = states.sort();
        this.renderList();
    }

    setValue(value) {
        this.currentState = value || 'all';
        this.renderList(); // Re-render to show selection state
        this.updateTrigger();
    }

    renderList() {
        this.listContainer.innerHTML = '';

        // Add "All States" option
        this.renderOption('all', 'All States');

        if (this.allStates.length > 0) {
            this.allStates.forEach(state => {
                this.renderOption(state, state);
            });
        }
    }

    renderOption(value, label) {
        const isSelected = this.currentState === value;
        const item = document.createElement('div');
        item.className = `dropdown-item ${isSelected ? 'selected' : ''}`;

        // Just text for state, no image for now
        item.innerHTML = `<span>${label}</span>`;

        item.addEventListener('click', () => {
            this.select(value);
        });

        this.listContainer.appendChild(item);
    }

    select(value) {
        this.currentState = value;
        this.updateTrigger();
        this.closeDropdown();
        this.onChange(value);
    }

    updateTrigger() {
        let contentHtml = '';
        if (this.currentState === 'all') {
            contentHtml = `<span id="state-trigger-text">All States</span>`;
        } else {
            contentHtml = `<span>${this.currentState}</span>`;
        }
        this.triggerContent.innerHTML = contentHtml;
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
            this.triggerBtn.style.borderColor = '';
        }
    }

    closeDropdown() {
        this.isOpen = false;
        this.dropdown.style.display = 'none';
        this.triggerBtn.style.borderColor = '';
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
}
