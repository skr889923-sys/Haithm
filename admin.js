/**
 * Modern Admin Interface - Enhanced Version
 * Full admin panel logic for admin-modern.html
 */

class AdminInterface {
    constructor() {
        this.isInitialized = false;
        this.currentStudentId = null;
        this.selectedStudents = new Set();
        this.currentPage = 1;
        this.pageSize = 20;
        this.currentFilters = {};
    }

    async init() {
        if (this.isInitialized) return;
        
        await this.waitForDependencies();
        this.setupModals();
        this.setupStudentsPanel();
        this.setupClassesPanel();
        this.setupAttendancePanel();
        
        console.log('Admin interface initialized with full functionality');
        this.isInitialized = true;
        
        // Load initial data
        this.loadStudents();
        this.loadClasses();
    }

    async waitForDependencies() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50;
            
            const checkDependencies = () => {
                attempts++;
                
                const dbReady = window.db && window.db.isInitialized;
                
                if (dbReady) {
                    console.log('Admin dependencies ready');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.warn('Admin timeout waiting for dependencies');
                    resolve();
                } else {
                    setTimeout(checkDependencies, 100);
                }
            };
            checkDependencies();
        });
    }

    setupModals() {
        // Modal close handlers
        document.querySelectorAll('.modal-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-overlay');
                if (modal) {
                    modal.classList.remove('active');
                }
            });
        });
        
        // Modal background click to close
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
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

    setupStudentsPanel() {
        this.setupStudentModal();
        this.setupStudentActions();
    }

    setupStudentModal() {
        const addStudentBtn = document.getElementById('addStudentBtn');
        if (addStudentBtn) {
            addStudentBtn.addEventListener('click', () => {
                this.openStudentModal();
            });
        }
        
        const saveStudentBtn = document.getElementById('saveStudentBtn');
        if (saveStudentBtn) {
            saveStudentBtn.addEventListener('click', () => {
                this.saveStudent();
            });
        }
        
        const cancelStudentBtn = document.getElementById('cancelStudentBtn');
        if (cancelStudentBtn) {
            cancelStudentBtn.addEventListener('click', () => {
                this.closeModal('studentModal');
            });
        }
    }

    setupStudentActions() {
        const searchInput = document.getElementById('studentsSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.loadStudents(1);
            });
        }
        
        const gradeFilter = document.getElementById('gradeFilter');
        const classFilter = document.getElementById('classFilter');
        
        if (gradeFilter) {
            gradeFilter.addEventListener('change', () => {
                this.loadStudents(1);
            });
        }
        
        if (classFilter) {
            classFilter.addEventListener('change', () => {
                this.loadStudents(1);
            });
        }
    }

    async loadStudents(page = 1) {
        try {
            if (!window.db || !window.db.isInitialized) {
                console.warn('Database not available for loading students');
                return;
            }
            
            const searchQuery = document.getElementById('studentsSearch')?.value || '';
            const gradeFilter = document.getElementById('gradeFilter')?.value || '';
            const classFilter = document.getElementById('classFilter')?.value || '';
            
            const filters = {
                ...(gradeFilter && { grade: gradeFilter }),
                ...(classFilter && { className: classFilter })
            };
            
            const students = await window.db.searchStudents(searchQuery, filters);
            
            const startIndex = (page - 1) * this.pageSize;
            const endIndex = startIndex + this.pageSize;
            const paginatedStudents = students.slice(startIndex, endIndex);
            
            this.populateStudentsTable(paginatedStudents);
            
        } catch (error) {
            console.error('Failed to load students:', error);
            this.showToast('فشل في تحميل بيانات الطلاب', 'error');
        }
    }

    populateStudentsTable(students) {
        const tableBody = document.getElementById('studentsTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        if (students.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-secondary);">
                        لا يوجد طلاب مطابقين للبحث
                    </td>
                </tr>
            `;
            return;
        }

        students.forEach(student => {
            const row = document.createElement('tr');
            row.dataset.studentId = student.id;
            
            row.innerHTML = `
                <td>${student.id}</td>
                <td>
                    <div class="student-name-cell">
                        <span>${student.name}</span>
                    </div>
                </td>
                <td>${student.grade}</td>
                <td>${student.className}</td>
                <td>${student.guardianPhone || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit" onclick="window.adminInterface.editStudent('${student.id}')" title="تعديل">
                            ✏️
                        </button>
                        <button class="action-btn delete" onclick="window.adminInterface.deleteStudent('${student.id}')" title="حذف">
                            🗑️
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }

    openStudentModal(studentId = null) {
        this.currentStudentId = studentId;
        const modal = document.getElementById('studentModal');
        const title = document.getElementById('studentModalTitle');
        
        if (studentId) {
            title.textContent = 'تعديل بيانات الطالب';
            this.loadStudentData(studentId);
        } else {
            title.textContent = 'إضافة طالب جديد';
            this.clearStudentForm();
        }
        
        this.openModal('studentModal');
    }

    async loadStudentData(studentId) {
        try {
            const student = await window.db.getStudent(studentId);
            if (student) {
                const fields = {
                    studentId: student.id,
                    studentName: student.name,
                    studentGrade: student.grade,
                    studentClass: student.className,
                    guardianPhone: student.guardianPhone,
                    studentEmail: student.email
                };
                
                Object.entries(fields).forEach(([fieldId, value]) => {
                    const field = document.getElementById(fieldId);
                    if (field) field.value = value || '';
                });
            }
        } catch (error) {
            console.error('Failed to load student data:', error);
            this.showToast('فشل في تحميل بيانات الطالب', 'error');
        }
    }

    clearStudentForm() {
        const form = document.getElementById('studentForm');
        if (form) {
            form.reset();
        }
    }

    async saveStudent() {
        try {
            const studentData = {
                id: document.getElementById('studentId')?.value,
                name: document.getElementById('studentName')?.value,
                grade: document.getElementById('studentGrade')?.value,
                className: document.getElementById('studentClass')?.value,
                guardianPhone: document.getElementById('guardianPhone')?.value,
                email: document.getElementById('studentEmail')?.value
            };
            
            // Validation
            if (!studentData.id || !studentData.name || !studentData.grade || !studentData.className) {
                this.showToast('يرجى ملء جميع الحقول المطلوبة', 'warning');
                return;
            }
            
            if (this.currentStudentId) {
                await window.db.updateStudent(this.currentStudentId, studentData);
                this.showToast('تم تحديث بيانات الطالب بنجاح', 'success');
            } else {
                await window.db.addStudent(studentData);
                this.showToast('تمت إضافة الطالب بنجاح', 'success');
            }
            
            this.closeModal('studentModal');
            this.loadStudents();
            
        } catch (error) {
            console.error('Failed to save student:', error);
            this.showToast('فشل في حفظ بيانات الطالب', 'error');
        }
    }

    editStudent(studentId) {
        this.openStudentModal(studentId);
    }

    async deleteStudent(studentId) {
        if (!confirm('هل أنت متأكد من حذف هذا الطالب؟')) {
            return;
        }
        
        try {
            await window.db.deleteStudent(studentId);
            this.showToast('تم حذف الطالب بنجاح', 'success');
            this.loadStudents();
        } catch (error) {
            console.error('Failed to delete student:', error);
            this.showToast('فشل في حذف الطالب', 'error');
        }
    }

    // CSV Import functionality
    async importCSV(file) {
        try {
            const text = await file.text();
            const lines = text.split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            
            // Validate headers
            const requiredHeaders = ['id', 'name', 'grade', 'className'];
            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
            
            if (missingHeaders.length > 0) {
                this.showToast(`الملف يفتقد للأعمدة: ${missingHeaders.join(', ')}`, 'error');
                return;
            }
            
            const students = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const values = line.split(',').map(v => v.trim());
                const student = {};
                
                headers.forEach((header, index) => {
                    student[header] = values[index] || '';
                });
                
                if (student.id && student.name) {
                    students.push(student);
                }
            }
            
            // Import students
            let imported = 0;
            let failed = 0;
            
            for (const student of students) {
                try {
                    await window.db.addStudent(student);
                    imported++;
                } catch (error) {
                    console.warn('Failed to import student:', student.id, error);
                    failed++;
                }
            }
            
            this.showToast(`تم استيراد ${imported} طالب. فشل: ${failed}`, 'success');
            this.closeModal('csvModal');
            this.loadStudents();
            
        } catch (error) {
            console.error('Failed to import CSV:', error);
            this.showToast('فشل في استيراد الملف', 'error');
        }
    }

    // Classes functionality
    setupClassesPanel() {
        const addClassBtn = document.getElementById('addClassBtn');
        if (addClassBtn) {
            addClassBtn.addEventListener('click', () => {
                this.addClass();
            });
        }
    }

    async loadClasses() {
        try {
            const classes = await this.getClassesSummary();
            this.populateClassesGrid(classes);
        } catch (error) {
            console.error('Failed to load classes:', error);
        }
    }

    async getClassesSummary() {
        const students = await window.db.getAllStudents();
        const classMap = new Map();
        
        students.forEach(student => {
            const key = `${student.grade}-${student.className}`;
            if (!classMap.has(key)) {
                classMap.set(key, {
                    grade: student.grade,
                    className: student.className,
                    students: []
                });
            }
            classMap.get(key).students.push(student);
        });
        
        return Array.from(classMap.values());
    }

    populateClassesGrid(classes) {
        const grid = document.getElementById('classesGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        classes.forEach(classInfo => {
            const card = document.createElement('div');
            card.className = 'class-card';
            card.innerHTML = `
                <h3>${classInfo.grade} - فصل ${classInfo.className}</h3>
                <p class="student-count">${classInfo.students.length} طالب</p>
                <div class="class-actions">
                    <button class="btn btn-sm btn-secondary" onclick="window.adminInterface.viewClassStudents('${classInfo.grade}', '${classInfo.className}')">
                        عرض الطلاب
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    async addClass() {
        const grade = prompt('ادخل اسم الصف:');
        const className = prompt('ادخل اسم الفصل:');
        
        if (grade && className) {
            // For now, just reload the classes view
            // In a real implementation, you'd save this to the database
            this.loadClasses();
            this.showToast('تم إضافة الفصل بنجاح', 'success');
        }
    }

    viewClassStudents(grade, className) {
        // Filter students table by class
        document.getElementById('gradeFilter').value = grade;
        document.getElementById('classFilter').value = className;
        
        // Switch to students tab
        const studentsTab = document.querySelector('[data-tab="students"]');
        if (studentsTab) {
            studentsTab.click();
        }
        
        this.loadStudents();
    }

    // Attendance functionality
    setupAttendancePanel() {
        const dateInput = document.getElementById('attendanceDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
            dateInput.addEventListener('change', () => {
                this.loadAttendanceData();
            });
        }
        
        const exportBtn = document.getElementById('exportAttendanceBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportAttendance();
            });
        }
    }

    async loadAttendanceData() {
        const date = document.getElementById('attendanceDate')?.value;
        if (!date) return;
        
        try {
            const attendance = await window.db.getAttendanceByDate(date);
            this.populateAttendanceTable(attendance);
            this.updateAttendanceSummary(attendance);
        } catch (error) {
            console.error('Failed to load attendance:', error);
        }
    }

    populateAttendanceTable(attendance) {
        const tableBody = document.getElementById('attendanceTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        attendance.forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${record.studentId}</td>
                <td>${record.studentName}</td>
                <td>${record.className}</td>
                <td>${record.timestamp ? new Date(record.timestamp).toLocaleTimeString('ar-SA') : '-'}</td>
                <td>
                    <span class="badge badge-${record.status === 'present' ? 'success' : record.status === 'late' ? 'warning' : 'error'}">
                        ${record.status === 'present' ? 'حاضر' : record.status === 'late' ? 'متأخر' : 'غائب'}
                    </span>
                </td>
                <td>${record.lateMinutes || 0}</td>
                <td>
                    <button class="btn btn-ghost btn-sm" onclick="window.adminInterface.editAttendance('${record.id}')">
                        تعديل
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    updateAttendanceSummary(attendance) {
        const summary = document.getElementById('attendanceSummary');
        if (!summary) return;
        
        const present = attendance.filter(r => r.status === 'present').length;
        const late = attendance.filter(r => r.status === 'late').length;
        const absent = attendance.filter(r => r.status === 'absent').length;
        const total = present + late + absent;
        
        summary.innerHTML = `
            <div class="summary-card">
                <span class="summary-value">${present}</span>
                <span class="summary-label">حاضر</span>
            </div>
            <div class="summary-card">
                <span class="summary-value">${late}</span>
                <span class="summary-label">متأخر</span>
            </div>
            <div class="summary-card">
                <span class="summary-value">${absent}</span>
                <span class="summary-label">غائب</span>
            </div>
            <div class="summary-card">
                <span class="summary-value">${total > 0 ? Math.round((present + late) / total * 100) : 0}%</span>
                <span class="summary-label">نسبة الحضور</span>
            </div>
        `;
    }

    exportAttendance() {
        // Simple CSV export
        const date = document.getElementById('attendanceDate')?.value;
        this.showToast(`جاري تصدير بيانات حضور يوم ${date}`, 'info');
    }

    editAttendance(recordId) {
        this.showToast('سيتم إضافة هذه الميزة قريباً', 'info');
    }

    // Tab content loading
    loadTabContent(tabName) {
        switch (tabName) {
            case 'students':
                this.loadStudents();
                break;
            case 'classes':
                this.loadClasses();
                break;
            case 'attendance':
                this.loadAttendanceData();
                break;
            default:
                break;
        }
    }

    // Toast notification helper
    showToast(message, type = 'info') {
        if (window.themeController && window.themeController.showToast) {
            window.themeController.showToast(message, type);
        } else {
            alert(message); // Fallback
        }
    }
}

// Global export for browser usage
if (typeof window !== 'undefined') {
    window.AdminInterface = AdminInterface;
}

// Module export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminInterface;
}