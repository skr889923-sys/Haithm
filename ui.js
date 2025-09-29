/**
 * Hader UI Manager
 * Handles theme switching, toasts, modals, and general UI interactions
 */

class UIManager {
    constructor() {
        this.currentTheme = 'light';
        this.isInitialized = false;
        this.connectionStatus = 'offline';
        this.schoolInfo = null;
        this.toastContainer = null;
    }

    /**
     * Initialize UI Manager
     */
    async init() {
        if (this.isInitialized) return;
        
        // Initialize theme from storage
        const savedTheme = this.getStoredTheme() || 'light';
        this.currentTheme = savedTheme;
        
        this.setupThemeSystem();
        this.setupConnectionIndicator();
        this.setupToastSystem();
        this.setupEventListeners();
        this.updateSchoolInfo();
        
        this.isInitialized = true;
        console.log('UI Manager initialized');
        
        // Dispatch ready event
        this.dispatch('ui:ready');
    }

    /**
     * Setup theme system
     */
    setupThemeSystem() {
        // Apply current theme
        this.applyTheme(this.currentTheme);
        
        // Setup theme toggle buttons
        const themeToggleButtons = document.querySelectorAll('.theme-toggle');
        themeToggleButtons.forEach(button => {
            button.addEventListener('click', () => this.toggleTheme());
            this.updateThemeToggleIcon(button);
        });
    }

    /**
     * Apply theme to document
     */
    applyTheme(theme) {
        const body = document.body;
        
        // Remove existing theme classes
        body.classList.remove('theme-light', 'theme-dark');
        
        // Apply new theme
        body.classList.add(`theme-${theme}`);
        this.currentTheme = theme;
        
        // Force repaint to ensure theme is applied
        body.offsetHeight;
        
        // Update theme toggle icons
        const themeToggleButtons = document.querySelectorAll('.theme-toggle');
        themeToggleButtons.forEach(button => this.updateThemeToggleIcon(button));
        
        // Store theme preference
        localStorage.setItem('hader-theme', theme);
        
        // Update in database if available
        if (window.db && this.isInitialized) {
            window.db.updateSettings({ theme }).catch(error => {
                console.warn('Failed to save theme to database:', error);
            });
        }
        
        console.log(`Theme applied: ${theme}`);
        
        // Dispatch theme change event
        this.dispatch('ui:theme:changed', { theme });
    }

    /**
     * Toggle between light and dark theme
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        
        // Show feedback
        this.showToast(
            newTheme === 'light' ? 'تم التحويل إلى النمط الفاتح' : 'تم التحويل إلى النمط الداكن', 
            'success'
        );
    }

    /**
     * Update theme toggle button icon
     */
    updateThemeToggleIcon(button) {
        button.textContent = this.currentTheme === 'light' ? '🌙' : '☀️';
        button.title = this.currentTheme === 'light' ? 'تبديل إلى النمط الداكن' : 'تبديل إلى النمط الفاتح';
    }

    /**
     * Get stored theme from localStorage
     */
    getStoredTheme() {
        return localStorage.getItem('hader-theme');
    }

    /**
     * Setup connection status indicator
     */
    setupConnectionIndicator() {
        this.updateConnectionStatus('offline'); // Start offline
        
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.updateConnectionStatus('online');
        });
        
        window.addEventListener('offline', () => {
            this.updateConnectionStatus('offline');
        });
        
        // Check initial connection status
        if (navigator.onLine) {
            this.updateConnectionStatus('online');
        }
    }

    /**
     * Update connection status indicator
     */
    updateConnectionStatus(status, queueCount = 0) {
        this.connectionStatus = status;
        
        const indicators = document.querySelectorAll('.connection-status');
        indicators.forEach(indicator => {
            const dot = indicator.querySelector('.status-dot');
            const text = indicator.querySelector('.status-text');
            
            if (dot) {
                dot.className = 'status-dot';
                dot.classList.add(status);
            }
            
            if (text) {
                let statusText = '';
                switch (status) {
                    case 'online':
                        statusText = 'متصل';
                        break;
                    case 'offline':
                        statusText = 'غير متصل';
                        break;
                    case 'pending':
                        statusText = queueCount > 0 ? `طابور: ${queueCount}` : 'في الانتظار';
                        break;
                    default:
                        statusText = 'غير محدد';
                }
                text.textContent = statusText;
            }
        });
        
        this.dispatch('ui:connection:changed', { status, queueCount });
    }

    /**
     * Update school information in UI
     */
    async updateSchoolInfo() {
        try {
            let settings;
            if (window.db) {
                settings = await window.db.getSettings();
            } else {
                // Fallback to defaults
                settings = {
                    schoolName: 'مدرسة النموذجية',
                    principalName: 'الأستاذ أحمد محمد'
                };
            }
            
            // Update school name elements
            const schoolNameElements = document.querySelectorAll('#schoolName');
            schoolNameElements.forEach(element => {
                element.textContent = settings.schoolName;
            });
            
            // Update principal name elements
            const principalNameElements = document.querySelectorAll('#principalName');
            principalNameElements.forEach(element => {
                element.textContent = settings.principalName;
            });
            
            this.schoolInfo = settings;
            this.dispatch('ui:school-info:updated', settings);
            
        } catch (error) {
            console.warn('Failed to update school info:', error);
        }
    }

    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Listen for database ready event
        window.addEventListener('hader:db:ready', () => {
            this.updateSchoolInfo();
        });
        
        // Listen for settings updates
        window.addEventListener('hader:settings:updated', (event) => {
            this.updateSchoolInfo();
            if (event.detail.theme && event.detail.theme !== this.currentTheme) {
                this.applyTheme(event.detail.theme);
            }
        });
        
        // Listen for sync status updates
        window.addEventListener('hader:sync:status', (event) => {
            const { status, queueCount } = event.detail;
            this.updateConnectionStatus(status, queueCount);
        });

        // Setup escape key handler for modals
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    /**
     * Setup toast notification system
     */
    setupToastSystem() {
        // Create toast container if it doesn't exist
        if (!document.querySelector('.toast-container')) {
            const container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        this.toastContainer = document.querySelector('.toast-container');
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        if (!this.toastContainer) {
            this.setupToastSystem();
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add toast to container
        this.toastContainer.appendChild(toast);
        
        // Trigger entrance animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Auto remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
        
        // Click to dismiss
        toast.addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        });
    }

    /**
     * Setup tabs functionality
     */
    setupTabs(container) {
        const tabs = container.querySelectorAll('.tab');
        const tabPanes = document.querySelectorAll('.tab-pane');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                
                // Remove active class from all tabs
                tabs.forEach(t => t.classList.remove('active'));
                tabPanes.forEach(pane => pane.classList.remove('active'));
                
                // Add active class to clicked tab
                tab.classList.add('active');
                
                // Show corresponding pane
                const targetPane = document.getElementById(`${targetTab}-tab`);
                if (targetPane) {
                    targetPane.classList.add('active');
                }
                
                // Dispatch tab change event
                this.dispatch('ui:tab:changed', { tab: targetTab });
            });
        });
        
        // Initialize first tab as active if none are active
        const activeTabs = container.querySelectorAll('.tab.active');
        if (activeTabs.length === 0 && tabs.length > 0) {
            tabs[0].click();
        }
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        const modals = document.querySelectorAll('.modal.active');
        modals.forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }

    /**
     * Dispatch custom event
     */
    dispatch(eventName, detail = {}) {
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    /**
     * Show confirmation dialog
     */
    showConfirm(message, callback) {
        if (confirm(message)) {
            callback();
        }
    }

    /**
     * Show loading indicator
     */
    showLoading(element) {
        if (element) {
            element.classList.add('loading');
        }
    }

    /**
     * Hide loading indicator
     */
    hideLoading(element) {
        if (element) {
            element.classList.remove('loading');
        }
    }
}

// Initialize UI Manager
if (typeof window !== 'undefined') {
    window.ui = new UIManager();
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.ui.init();
        });
    } else {
        window.ui.init();
    }
}