/**
 * Modern Theme Controller
 * Handles theme switching and component initialization
 */

class ModernThemeController {
    constructor() {
        this.currentTheme = 'light';
        this.sidebarOpen = false;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        
        this.loadTheme();
        this.setupThemeToggle();
        this.setupSidebar();
        this.setupResponsive();
        this.setupComponents();
        
        this.isInitialized = true;
        console.log('Modern theme controller initialized');
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('modern-theme') || 'light';
        this.applyTheme(savedTheme);
    }

    applyTheme(theme) {
        document.body.className = document.body.className.replace(/theme-\w+/g, '');
        document.body.classList.add(`theme-${theme}`);
        this.currentTheme = theme;
        
        // Update theme toggle icons
        this.updateThemeToggleIcons();
        
        // Save to localStorage
        localStorage.setItem('modern-theme', theme);
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('theme:changed', { 
            detail: { theme } 
        }));
        
        console.log(`Theme applied: ${theme}`);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        
        // Show feedback
        this.showToast(
            newTheme === 'light' 
                ? 'تم التبديل إلى النمط الفاتح' 
                : 'تم التبديل إلى النمط الداكن',
            'success'
        );
    }

    setupThemeToggle() {
        const toggleButtons = document.querySelectorAll('.theme-toggle');
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => this.toggleTheme());
        });
        
        this.updateThemeToggleIcons();
    }

    updateThemeToggleIcons() {
        const toggleButtons = document.querySelectorAll('.theme-toggle');
        toggleButtons.forEach(button => {
            const icon = this.currentTheme === 'light' ? '🌙' : '☀️';
            const title = this.currentTheme === 'light' 
                ? 'تبديل إلى النمط الداكن' 
                : 'تبديل إلى النمط الفاتح';
            
            button.innerHTML = icon;
            button.title = title;
        });
    }

    setupSidebar() {
        const sidebar = document.querySelector('.app-sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        const toggleBtn = document.querySelector('.mobile-menu-btn');
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleSidebar());
        }
        
        if (overlay) {
            overlay.addEventListener('click', () => this.closeSidebar());
        }
        
        // Setup navigation active states
        this.setupNavigation();
    }

    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        const sidebar = document.querySelector('.app-sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (sidebar) {
            sidebar.classList.toggle('open', this.sidebarOpen);
        }
        
        if (overlay) {
            overlay.classList.toggle('active', this.sidebarOpen);
        }
    }

    closeSidebar() {
        this.sidebarOpen = false;
        const sidebar = document.querySelector('.app-sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (sidebar) {
            sidebar.classList.remove('open');
        }
        
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const currentPath = window.location.pathname;
        
        navItems.forEach(item => {
            const href = item.getAttribute('href');
            if (href && currentPath.includes(href.replace('./', ''))) {
                item.classList.add('active');
            }
            
            item.addEventListener('click', () => {
                // Close sidebar on mobile after navigation
                if (window.innerWidth <= 1024) {
                    this.closeSidebar();
                }
            });
        });
    }

    setupResponsive() {
        const handleResize = () => {
            if (window.innerWidth > 1024) {
                this.closeSidebar();
            }
        };
        
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial call
    }

    setupComponents() {
        this.setupTabs();
        this.setupModals();
        this.setupTooltips();
        this.setupForms();
    }

    setupTabs() {
        const tabContainers = document.querySelectorAll('.tabs');
        
        tabContainers.forEach(container => {
            const tabs = container.querySelectorAll('.tab');
            const contents = document.querySelectorAll('.tab-content');
            
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetId = tab.dataset.tab;
                    
                    // Remove active from all tabs and contents
                    tabs.forEach(t => t.classList.remove('active'));
                    contents.forEach(c => c.classList.remove('active'));
                    
                    // Add active to clicked tab
                    tab.classList.add('active');
                    
                    // Show corresponding content
                    const targetContent = document.getElementById(`${targetId}-content`);
                    if (targetContent) {
                        targetContent.classList.add('active');
                    }
                });
            });
        });
    }

    setupModals() {
        // Modal open/close functionality
        const openButtons = document.querySelectorAll('[data-modal-target]');
        const closeButtons = document.querySelectorAll('[data-modal-close]');
        const modals = document.querySelectorAll('.modal');
        
        openButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.modalTarget;
                this.openModal(targetId);
            });
        });
        
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const modal = button.closest('.modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
            });
        });
        
        // Close on overlay click
        modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    closeAllModals() {
        const activeModals = document.querySelectorAll('.modal.active');
        activeModals.forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }

    setupTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                this.showTooltip(e.target, e.target.dataset.tooltip);
            });
            
            element.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }

    showTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = text;
        document.body.appendChild(tooltip);
        
        const rect = element.getBoundingClientRect();
        tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
        tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
        
        setTimeout(() => tooltip.classList.add('visible'), 10);
    }

    hideTooltip() {
        const tooltip = document.querySelector('.tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    setupForms() {
        // Enhanced form interactions
        const inputs = document.querySelectorAll('.form-input');
        
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                input.parentElement?.classList.add('focused');
            });
            
            input.addEventListener('blur', () => {
                input.parentElement?.classList.remove('focused');
            });
        });
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    // Toast notification system
    showToast(message, type = 'info', duration = 3000) {
        const toastContainer = document.getElementById('toastContainer') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                ${this.getToastIcon(type)}
            </div>
            <div class="toast-message">${message}</div>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-100%)';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }
    
    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }
    
    getToastIcon(type) {
        const icons = {
            success: '<svg class="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>',
            error: '<svg class="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>',
            warning: '<svg class="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>',
            info: '<svg class="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
        };
        return icons[type] || icons.info;
    }

    // Utility methods for component updates
    updateStats(stats) {
        Object.entries(stats).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = value;
            }
        });
    }

    updateTable(tableId, data) {
        const tbody = document.querySelector(`#${tableId} tbody`);
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = row.map(cell => `<td>${cell}</td>`).join('');
            tbody.appendChild(tr);
        });
    }

    showEmptyState(container, message) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="empty-state-icon">📊</div>
            <div class="empty-state-message">${message}</div>
        `;
        container.innerHTML = '';
        container.appendChild(emptyState);
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.modernTheme = new ModernThemeController();
    window.modernTheme.init();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModernThemeController;
}