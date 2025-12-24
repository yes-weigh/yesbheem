export class StageSelector {
    constructor(options = {}) {
        this.containerId = options.containerId || 'stage-selector-container';
        this.onChange = options.onChange || (() => { });
        this.getStageImage = options.getStageImage || (() => null); // Callback to get image URL
        this.currentStage = 'all';
        this.allStages = [];
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
            <div class="stage-selector-wrapper" style="position: relative;">
                <button id="stage-trigger" class="filter-select" style="display: flex; align-items: center; justify-content: space-between; min-width: 160px; cursor: pointer; height: 38px;">
                     <div id="stage-trigger-content" style="display: flex; align-items: center; gap: 8px;">
                        <span id="stage-trigger-text">All Stages</span>
                     </div>
                    <span style="font-size: 0.7rem; opacity: 0.7; margin-left:8px;">▼</span>
                </button>
                
                <!-- Dropdown -->
                <div id="stage-dropdown" class="fancy-dropdown-stage" style="display: none;">
                    <div class="dropdown-header">
                        SELECT STAGE
                    </div>
                    <div class="dropdown-list" id="stage-list">
                        <!-- Options injected here -->
                    </div>
                </div>
            </div>
            
            <style>
                .fancy-dropdown-stage {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    margin-top: 8px;
                    width: 220px;
                    background: #1e293b; /* Dark slate */
                    border: 1px solid var(--border-light);
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                    z-index: 100;
                    overflow: hidden;
                    animation: slideDownStage 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    display: flex;
                    flex-direction: column;
                }

                @keyframes slideDownStage {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .fancy-dropdown-stage .dropdown-header {
                    padding: 12px 16px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    background: rgba(0,0,0,0.2);
                }

                .fancy-dropdown-stage .dropdown-list {
                    max-height: 250px;
                    overflow-y: auto;
                    padding: 4px 0;
                }

                .fancy-dropdown-stage .dropdown-item {
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

                .fancy-dropdown-stage .dropdown-item:hover {
                    background: rgba(255,255,255,0.05);
                }

                .fancy-dropdown-stage .dropdown-item.selected {
                    background: rgba(59, 130, 246, 0.1);
                    border-left-color: var(--accent-color);
                    color: white;
                }

                 /* Scrollbar */
                .fancy-dropdown-stage .dropdown-list::-webkit-scrollbar {
                    width: 6px;
                }
                .fancy-dropdown-stage .dropdown-list::-webkit-scrollbar-track {
                    background: transparent;
                }
                .fancy-dropdown-stage .dropdown-list::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                }
            </style>
        `;

        // Bind Elements
        this.triggerBtn = document.getElementById('stage-trigger');
        this.dropdown = document.getElementById('stage-dropdown');
        this.listContainer = document.getElementById('stage-list');
        this.triggerContent = document.getElementById('stage-trigger-content');

        // Event Listeners
        this.triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        this.dropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    setStages(stages) {
        this.allStages = stages.sort();
        this.renderList();
    }

    setValue(value) {
        this.currentStage = value || 'all';
        this.renderList(); // Re-render to show selection state
        this.updateTrigger();
    }

    renderList() {
        this.listContainer.innerHTML = '';

        // Add "All Stages" option
        this.renderOption('all', 'All Stages');

        if (this.allStages.length > 0) {
            this.allStages.forEach(stage => {
                this.renderOption(stage, stage);
            });
        }
    }

    renderOption(value, label) {
        const isSelected = this.currentStage === value;
        const item = document.createElement('div');
        item.className = `dropdown-item ${isSelected ? 'selected' : ''}`;

        let iconHtml = '';
        if (value !== 'all') {
            const imgUrl = this.getStageImage(value);
            if (imgUrl) {
                iconHtml = `<img src="${imgUrl}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">`;
            } else {
                // Fallback circle if no image
                iconHtml = `<span style="width: 10px; height: 10px; border-radius: 50%; background: var(--text-muted); opacity: 0.5; margin-left: 5px; margin-right: 5px;"></span>`;
            }
        }

        item.innerHTML = `
            ${iconHtml}
            <span>${label}</span>
        `;

        item.addEventListener('click', () => {
            this.select(value);
        });

        this.listContainer.appendChild(item);
    }

    select(value) {
        this.currentStage = value;
        this.updateTrigger();
        this.closeDropdown();
        this.onChange(value);
    }

    updateTrigger() {
        let contentHtml = '';
        if (this.currentStage === 'all') {
            contentHtml = `<span id="stage-trigger-text">All Stages</span>`;
        } else {
            const imgUrl = this.getStageImage(this.currentStage);
            if (imgUrl) {
                contentHtml = `<img src="${imgUrl}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;"> <span>${this.currentStage}</span>`;
            } else {
                contentHtml = `<span>${this.currentStage}</span>`;
            }
        }
        this.triggerContent.innerHTML = contentHtml;
    }

    toggleDropdown() {
        this.isOpen = !this.isOpen;
        this.dropdown.style.display = this.isOpen ? 'flex' : 'none';

        if (this.isOpen) {
            this.triggerBtn.style.borderColor = 'var(--accent-color)';
        } else {
            this.triggerBtn.style.borderColor = 'var(--border-strong)'; // Or whatever default was
            // Check style of other filters? They use 'border: 1px solid var(--modal-border);'
            // Reset effectively
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
    }
}
