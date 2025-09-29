/**
 * Hader Admin Simple - Supervisor Interface Logic
 * Handles the main supervisor dashboard (index.html)
 */

class AdminSimple {
    constructor() {
        this.currentTab = 'present';
        this.attendanceData = [];
        this.studentsData = [];
        this.isInitialized = false;
    }

    /**
     * Initialize the admin simple interface
     */
    async init() {
        if (this.isInitialized) return;

        await this.waitForDatabase();
        this.setupEventListeners();
        this.setupTabs();
        await this.loadData();
        await this.updateDashboard();
        
        this.isInitialized = true;
        console.log('Admin Simple interface initialized');
    }

    /**
     * Wait for database to be ready
     */
    async waitForDatabase() {
        return new Promise((resolve) => {
            if (window.db && window.db.isInitialized) {
                resolve();
                return;
            }
            
            window.addEventListener('hader:db:ready', () => {
                resolve();
            });
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterAttendanceTable(e.target.value);
            });
        }

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportCurrentView();
            });
        }

        // Print button
        const printBtn = document.getElementById('printBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                this.printCurrentView();
            });
        }

        // Listen for attendance updates
        window.addEventListener('hader:attendance:updated', () => {
            this.refreshData();
        });

        // Listen for settings updates
        window.addEventListener('hader:settings:updated', () => {
            this.refreshData();
        });

        // Auto-refresh every 30 seconds
        setInterval(() => {
            this.refreshData();
        }, 30000);

        // Listen for database ready
        window.addEventListener('hader:db:ready', () => {
            this.refreshData();
        });
    }

    /**
     * Setup tabs functionality
     */
    setupTabs() {
        const tabsContainer = document.getElementById('attendanceTabs');
        if (tabsContainer && window.ui) {
            window.ui.setupTabs(tabsContainer);
            
            // Listen for tab changes
            window.addEventListener('ui:tab:changed', (event) => {
                this.currentTab = event.detail.tab;
                this.updateAttendanceTable();
            });
        }
    }

    /**
     * Load initial data
     */
    async loadData() {
        try {
            // Load students data
            this.studentsData = await window.db.getAllStudents();
            
            // Load today's attendance
            const today = new Date().toISOString().split('T')[0];
            this.attendanceData = await window.db.getDayAttendance(today);
            
            console.log('Data loaded:', {
                students: this.studentsData.length,
                attendance: this.attendanceData.length
            });
            
        } catch (error) {
            console.error('Failed to load data:', error);
            window.ui?.showToast('فشل في تحميل البيانات', 'error');
        }
    }

    /**
     * Refresh data and update dashboard
     */
    async refreshData() {
        await this.loadData();
        await this.updateDashboard();
    }

    /**
     * Update the entire dashboard
     */
    async updateDashboard() {
        await this.updateCounters();
        await this.updateStudentHighlights();
        this.updateAttendanceTable();
    }

    /**
     * Update counter cards
     */
    async updateCounters() {
        try {
            const stats = await window.db.getTodayStats();
            
            // Update counter values
            const presentCount = document.getElementById('presentCount');
            const absentCount = document.getElementById('absentCount');
            const lateCount = document.getElementById('lateCount');
            const attendanceRatio = document.getElementById('attendanceRatio');
            
            if (presentCount) presentCount.textContent = stats.presentCount;
            if (absentCount) absentCount.textContent = stats.absentCount;
            if (lateCount) lateCount.textContent = stats.lateCount;
            if (attendanceRatio) attendanceRatio.textContent = `${stats.attendanceRatio}%`;
            
        } catch (error) {
            console.error('Failed to update counters:', error);
        }
    }

    /**
     * Update first/last student highlights
     */
    async updateStudentHighlights() {
        try {
            const stats = await window.db.getTodayStats();
            
            const firstStudentEl = document.getElementById('firstStudent');
            const lastStudentEl = document.getElementById('lastStudent');
            
            if (firstStudentEl) {
                if (stats.firstStudent) {
                    firstStudentEl.innerHTML = `
                        <div><strong>${stats.firstStudent.name}</strong></div>
                        <div>${stats.firstStudent.time}</div>
                    `;
                } else {
                    firstStudentEl.textContent = 'لا يوجد';
                }
            }
            
            if (lastStudentEl) {
                if (stats.lastStudent) {
                    lastStudentEl.innerHTML = `
                        <div><strong>${stats.lastStudent.name}</strong></div>
                        <div>${stats.lastStudent.time}</div>
                    `;
                } else if (stats.firstStudent) {
                    lastStudentEl.innerHTML = `
                        <div><strong>${stats.firstStudent.name}</strong></div>
                        <div>${stats.firstStudent.time}</div>
                    `;
                } else {
                    lastStudentEl.textContent = 'لا يوجد';
                }
            }
            
        } catch (error) {
            console.error('Failed to update student highlights:', error);
        }
    }

    /**
     * Update attendance table based on current tab
     */
    updateAttendanceTable() {
        const tableBody = document.getElementById('attendanceTableBody');
        if (!tableBody) return;

        // Get filtered data based on current tab
        let filteredData = this.getFilteredAttendanceData();
        
        // Clear existing content
        tableBody.innerHTML = '';
        
        if (filteredData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-secondary);">
                        لا توجد بيانات للعرض
                    </td>
                </tr>
            `;
            return;
        }

        // Populate table
        filteredData.forEach(record => {
            const row = this.createAttendanceRow(record);
            tableBody.appendChild(row);
        });
    }

    /**
     * Get filtered attendance data based on current tab
     */
    getFilteredAttendanceData() {
        let filtered = [];

        switch (this.currentTab) {
            case 'present':
                // Present students (present + late)
                filtered = this.attendanceData.filter(record => 
                    record.status === 'present' || record.status === 'late'
                );
                break;
                
            case 'late':
                // Only late students
                filtered = this.attendanceData.filter(record => 
                    record.status === 'late'
                );
                break;
                
            case 'absent':
                // Absent students (students not in attendance)
                const presentStudentIds = new Set(this.attendanceData.map(r => r.studentId));
                const absentStudents = this.studentsData.filter(student => 
                    !presentStudentIds.has(student.id)
                );
                
                // Convert to attendance-like records
                filtered = absentStudents.map(student => ({
                    studentId: student.id,
                    student: student,
                    status: 'absent',
                    timeISO: null,
                    lateMinutes: 0
                }));
                break;
        }

        // Sort by time (latest first) for present/late, by name for absent
        if (this.currentTab === 'absent') {
            filtered.sort((a, b) => a.student.name.localeCompare(b.student.name));
        } else {
            filtered.sort((a, b) => b.timeISO?.localeCompare(a.timeISO) || 0);
        }

        return filtered;
    }

    /**
     * Create table row for attendance record
     */
    createAttendanceRow(record) {
        const row = document.createElement('tr');
        
        // Get student info
        let student = record.student;
        if (!student) {
            student = this.studentsData.find(s => s.id === record.studentId);
        }
        
        if (!student) {
            student = { id: record.studentId, name: 'غير محدد', grade: '-', className: '-' };
        }

        // Format time
        let timeDisplay = '-';
        if (record.timeISO) {
            const time = new Date(record.timeISO);
            timeDisplay = time.toLocaleTimeString('ar-SA', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        // Status badge
        const statusBadge = this.createStatusBadge(record.status);
        
        // Late minutes
        const lateMinutes = record.lateMinutes || 0;

        row.innerHTML = `
            <td>${student.id}</td>
            <td>${student.name}</td>
            <td>${student.grade} - ${student.className}</td>
            <td>${timeDisplay}</td>
            <td>${statusBadge}</td>
            <td>${lateMinutes > 0 ? `${lateMinutes} دقيقة` : '-'}</td>
        `;

        return row;
    }

    /**
     * Create status badge element
     */
    createStatusBadge(status) {
        const badges = {
            present: '<span class="status-badge present">حاضر</span>',
            late: '<span class="status-badge late">متأخر</span>',
            absent: '<span class="status-badge absent">غائب</span>'
        };
        
        return badges[status] || '<span class="status-badge">غير محدد</span>';
    }

    /**
     * Filter attendance table based on search term
     */
    filterAttendanceTable(searchTerm) {
        const tableBody = document.getElementById('attendanceTableBody');
        if (!tableBody) return;

        const rows = tableBody.querySelectorAll('tr');
        const term = searchTerm.toLowerCase().trim();

        rows.forEach(row => {
            if (term === '') {
                row.style.display = '';
                return;
            }

            const cells = row.querySelectorAll('td');
            let found = false;
            
            // Search in ID, name, and grade columns
            for (let i = 0; i < 3; i++) {
                if (cells[i] && cells[i].textContent.toLowerCase().includes(term)) {
                    found = true;
                    break;
                }
            }

            row.style.display = found ? '' : 'none';
        });
    }

    /**
     * Export current view to CSV
     */
    exportCurrentView() {
        try {
            const data = this.getFilteredAttendanceData();
            const csvData = data.map(record => {
                const student = record.student || this.studentsData.find(s => s.id === record.studentId) || {};
                
                return {
                    'رقم الطالب': student.id || record.studentId,
                    'الاسم': student.name || 'غير محدد',
                    'الصف': student.grade || '-',
                    'الفصل': student.className || '-',
                    'الوقت': record.timeISO ? window.ui.formatTime(record.timeISO) : '-',
                    'الحالة': this.getStatusText(record.status),
                    'دقائق التأخر': record.lateMinutes || 0
                };
            });

            const today = new Date().toLocaleDateString('ar-SA');
            const filename = `حضور_${this.getTabText(this.currentTab)}_${today}.csv`;
            
            if (window.ui) {
                window.ui.downloadCSV(csvData, filename);
                window.ui.showToast('تم تصدير البيانات بنجاح', 'success');
            }
            
        } catch (error) {
            console.error('Export failed:', error);
            window.ui?.showToast('فشل في تصدير البيانات', 'error');
        }
    }

    /**
     * Print current view
     */
    printCurrentView() {
        try {
            // Add print-specific styles
            const printStyles = `
                <style>
                    @media print {
                        body * { visibility: hidden; }
                        .attendance-section, .attendance-section * { visibility: visible; }
                        .attendance-section { position: absolute; top: 0; left: 0; width: 100%; }
                        .actions, .nav-buttons { display: none !important; }
                        .card-header h3::after { 
                            content: " - ${this.getTabText(this.currentTab)}";
                        }
                    }
                </style>
            `;
            
            document.head.insertAdjacentHTML('beforeend', printStyles);
            
            // Print
            window.print();
            
            window.ui?.showToast('تم إعداد الطباعة', 'info');
            
        } catch (error) {
            console.error('Print failed:', error);
            window.ui?.showToast('فشل في الطباعة', 'error');
        }
    }

    /**
     * Get status text in Arabic
     */
    getStatusText(status) {
        const statusTexts = {
            present: 'حاضر',
            late: 'متأخر',
            absent: 'غائب'
        };
        return statusTexts[status] || 'غير محدد';
    }

    /**
     * Get tab text in Arabic
     */
    getTabText(tab) {
        const tabTexts = {
            present: 'الحاضرين',
            late: 'المتأخرين',
            absent: 'الغائبين'
        };
        return tabTexts[tab] || 'الكل';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const adminSimple = new AdminSimple();
        await adminSimple.init();
        
        // Make available globally for debugging
        window.adminSimple = adminSimple;
        
    } catch (error) {
        console.error('Failed to initialize admin simple:', error);
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminSimple;
}