export class KAMSelector {
    constructor(options = {}) {
        this.containerId = options.containerId || 'kam-selector-container';
        this.onChange = options.onChange || (() => { });
        this.getKAMImage = options.getKAMImage || (() => null); // Callback to get image URL
        this.currentKAM = 'all';
        this.allKAMs = [];
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
            <div class="kam-selector-wrapper" style="position: relative;">
                <button id="kam-trigger" class="filter-select" style="display: flex; align-items: center; justify-content: space-between; min-width: 160px; cursor: pointer; height: 38px;">
                     <div id="kam-trigger-content" style="display: flex; align-items: center; gap: 8px;">
                        <span id="kam-trigger-text">All KAMs</span>
                     </div>
                    <span style="font-size: 0.7rem; opacity: 0.7; margin-left:8px;">▼</span>
                </button>
                
                <!-- Dropdown -->
                <div id="kam-dropdown" class="fancy-dropdown-kam" style="display: none;">
                    <div class="dropdown-header">
                        SELECT KAM
                    </div>
                    <div class="dropdown-list" id="kam-list">
                        <!-- Options injected here -->
                    </div>
                </div>
            </div>
            
            <style>
                .fancy-dropdown-kam {
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
                    animation: slideDownKAM 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    display: flex;
                    flex-direction: column;
                }

                @keyframes slideDownKAM {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .fancy-dropdown-kam .dropdown-header {
                    padding: 12px 16px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    background: rgba(0,0,0,0.2);
                }

                .fancy-dropdown-kam .dropdown-list {
                    max-height: 250px;
                    overflow-y: auto;
                    padding: 4px 0;
                }

                .fancy-dropdown-kam .dropdown-item {
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

                .fancy-dropdown-kam .dropdown-item:hover {
                    background: rgba(255,255,255,0.05);
                }

                .fancy-dropdown-kam .dropdown-item.selected {
                    background: rgba(59, 130, 246, 0.1);
                    border-left-color: var(--accent-color);
                    color: white;
                }

                 /* Scrollbar */
                .fancy-dropdown-kam .dropdown-list::-webkit-scrollbar {
                    width: 6px;
                }
                .fancy-dropdown-kam .dropdown-list::-webkit-scrollbar-track {
                    background: transparent;
                }
                .fancy-dropdown-kam .dropdown-list::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                }
            </style>
        `;

        // Bind Elements
        this.triggerBtn = document.getElementById('kam-trigger');
        this.dropdown = document.getElementById('kam-dropdown');
        this.listContainer = document.getElementById('kam-list');
        this.triggerContent = document.getElementById('kam-trigger-content');

        // Event Listeners
        this.triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        this.dropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    setKAMs(kams) {
        this.allKAMs = kams; // Expecting array of strings
        this.renderList();
    }

    setValue(value) {
        this.currentKAM = value || 'all';
        this.renderList(); // Re-render to show selection state
        this.updateTrigger();
    }

    renderList() {
        this.listContainer.innerHTML = '';

        // Add "All KAMs" option
        this.renderOption('all', 'All KAMs');

        // Add "Not Assigned" option
        this.renderOption('not_assigned', 'Not Assigned');

        if (this.allKAMs.length > 0) {
            this.allKAMs.forEach(kam => {
                this.renderOption(kam, kam);
            });
        }
    }

    renderOption(value, label) {
        const isSelected = this.currentKAM === value;
        const item = document.createElement('div');
        item.className = `dropdown-item ${isSelected ? 'selected' : ''}`;

        let iconHtml = '';
        if (value !== 'all' && value !== 'not_assigned') {
            const imgUrl = this.getKAMImage(value);
            if (imgUrl) {
                iconHtml = `<img src="${imgUrl}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">`;
            } else {
                // Fallback avatar if no image
                iconHtml = `<div style="width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-muted);">${label.charAt(0)}</div>`;
            }
        } else if (value === 'not_assigned') {
            iconHtml = `<div style="width: 24px; height: 24px; border-radius: 50%; background: rgba(239, 68, 68, 0.1); display: flex; align-items: center; justify-content: center; font-size: 12px; color: #f87171;">!</div>`;
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
        this.currentKAM = value;
        this.updateTrigger();
        this.closeDropdown();
        this.onChange(value);
    }

    updateTrigger() {
        let contentHtml = '';
        if (this.currentKAM === 'all') {
            contentHtml = `<span id="kam-trigger-text">All KAMs</span>`;
        } else if (this.currentKAM === 'not_assigned') {
            contentHtml = `<span style="color: #fca5a5;">Not Assigned</span>`;
        } else {
            const imgUrl = this.getKAMImage(this.currentKAM);
            if (imgUrl) {
                contentHtml = `<img src="${imgUrl}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;"> <span>${this.currentKAM}</span>`;
            } else {
                contentHtml = `<span>${this.currentKAM}</span>`;
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
