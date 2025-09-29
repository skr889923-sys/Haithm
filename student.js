/**
 * Hader Student Interface
 * Student attendance input and display logic
 */

class StudentInterface {
    constructor() {
        this.isInitialized = false;
        this.currentStudent = null;
    }

    async init() {
        if (this.isInitialized) return;
        
        await this.waitForDependencies();
        this.setupEventListeners();
        this.loadMessages();
        this.loadAnnouncements();
        
        this.isInitialized = true;
        console.log('Student interface initialized');
    }

    async waitForDependencies() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds timeout
            
            const checkDependencies = () => {
                attempts++;
                
                // Check required dependencies
                const dbReady = window.db && window.db.isInitialized;
                const uiReady = window.ui && window.ui.isInitialized;
                
                if (dbReady && uiReady) {
                    console.log('Student interface dependencies ready');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.warn('Student interface timeout waiting for dependencies');
                    console.log('DB ready:', dbReady, 'UI ready:', uiReady);
                    resolve(); // Continue anyway
                } else {
                    setTimeout(checkDependencies, 100);
                }
            };
            checkDependencies();
        });
    }

    setupEventListeners() {
        // Student ID input
        const studentInput = document.getElementById('studentId');
        const submitBtn = document.getElementById('submitBtn');
        const scannerBtn = document.getElementById('scannerBtn');
        const newStudentBtn = document.getElementById('newStudentBtn');

        if (studentInput) {
            studentInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.processAttendance();
                }
            });
            
            studentInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                if (submitBtn) {
                    submitBtn.disabled = !value;
                }
            });
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                this.processAttendance();
            });
        }

        if (scannerBtn) {
            scannerBtn.addEventListener('click', () => {
                this.openScanner();
            });
        }

        if (newStudentBtn) {
            newStudentBtn.addEventListener('click', () => {
                this.resetInterface();
            });
        }

        // Test button for debugging
        const testBtn = document.getElementById('testBtn');
        if (testBtn) {
            testBtn.addEventListener('click', () => {
                this.runSystemTest();
            });
        }

        // Listen for scanner results
        window.addEventListener('hader:scanner:result', (event) => {
            const code = event.detail.code;
            if (code && studentInput) {
                studentInput.value = code;
                this.processAttendance();
            }
        });

        // Request audio permission on first interaction
        document.addEventListener('click', () => {
            if (window.soundsManager) {
                window.soundsManager.requestAudioPermission();
            }
        }, { once: true });
    }

    async processAttendance() {
        const studentInput = document.getElementById('studentId');
        const studentId = studentInput?.value.trim();

        console.log('Processing attendance for student ID:', studentId);

        if (!studentId) {
            this.showToast('يرجى إدخال رقم الطالب', 'warning');
            return;
        }

        try {
            // Check if database is available
            console.log('Checking database availability...');
            if (!window.db) {
                throw new Error('قاعدة البيانات غير متاحة');
            }
            
            if (!window.db.isInitialized) {
                console.log('Database not initialized, attempting to initialize...');
                await window.db.init();
                await window.db.initializeDefaultData();
            }
            
            console.log('Database ready, recording attendance...');
            
            // Show loading
            const submitBtn = document.getElementById('submitAttendance');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<svg class="icon-md animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> جاري التحقق...';
            }

            // Record attendance
            const result = await window.db.recordAttendance(studentId);
            console.log('Attendance recorded successfully:', result);
            
            // Display result
            await this.displayAttendanceResult(result);

            // Play appropriate sound
            await this.playAttendanceSound(result);

            // Update supervisor dashboard
            window.dispatchEvent(new CustomEvent('hader:attendance:updated', {
                detail: result
            }));

            // Show success message
            const { record, isRepeat } = result;
            let successMessage = isRepeat ? 'تم تحديث سجل الحضور' : 'تم تسجيل الحضور بنجاح';
            if (record.status === 'late') {
                successMessage += ` (متأخر ${record.lateMinutes} دقيقة)`;
            }
            this.showToast(successMessage, 'success');

            // Clear input for next student
            setTimeout(() => {
                if (studentInput) {
                    studentInput.value = '';
                    studentInput.focus();
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<svg class="icon-md" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg> تسجيل الحضور';
                }
            }, 2000);

        } catch (error) {
            // Reset button state
            const submitBtn = document.getElementById('submitAttendance');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<svg class="icon-md" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg> تسجيل الحضور';
            }
            
            console.error('Attendance processing failed:', error);
            
            let errorMessage = 'حدث خطأ في تسجيل الحضور';
            
            if (error.message.includes('غير موجود') || error.message.includes('not found')) {
                errorMessage = 'رقم الطالب غير موجود في النظام';
            } else if (error.message.includes('قاعدة البيانات')) {
                errorMessage = 'قاعدة البيانات غير متاحة. يرجى إعادة تحميل الصفحة.';
            }
            
            this.showToast(errorMessage, 'error');
        }
    }
    
    // Helper method for toast notifications
    showToast(message, type = 'info') {
        if (window.themeController && window.themeController.showToast) {
            window.themeController.showToast(message, type);
        } else {
            // Fallback to alert if theme controller not available
            alert(message);
        }
    }

    async displayAttendanceResult(result) {
        const { record, isRepeat, student } = result;
        const studentInfoSection = document.getElementById('studentInfoSection');
        
        if (!studentInfoSection || !student) return;

        // Update student information
        this.updateStudentInfo(student, record, isRepeat);
        
        // Show student info section
        studentInfoSection.style.display = 'block';
        
        // Scroll to student info
        studentInfoSection.scrollIntoView({ behavior: 'smooth' });
        
        this.currentStudent = student;
    }

    updateStudentInfo(student, record, isRepeat) {
        // Student basic info
        const studentName = document.getElementById('studentName');
        const studentGrade = document.getElementById('studentGrade');
        const studentClass = document.getElementById('studentClass');
        
        if (studentName) studentName.textContent = student.name;
        if (studentGrade) studentGrade.textContent = student.grade;
        if (studentClass) studentClass.textContent = student.className;

        // Attendance status
        const statusBadge = document.querySelector('.status-badge');
        const attendanceTime = document.getElementById('attendanceTime');
        const todayLateMinutes = document.getElementById('todayLateMinutes');
        const totalLateDays = document.getElementById('totalLateDays');
        const totalLateMinutes = document.getElementById('totalLateMinutes');

        if (statusBadge) {
            statusBadge.className = `status-badge ${record.status}`;
            let statusText = '';
            
            if (isRepeat) {
                statusText = record.status === 'late' ? 'متأخر (تكرار)' : 'حاضر (تكرار)';
            } else {
                statusText = record.status === 'late' ? 'متأخر' : 
                           record.status === 'present' ? 'حاضر' : 'غائب';
            }
            
            statusBadge.textContent = statusText;
        }

        if (attendanceTime) {
            const time = new Date(record.timeISO);
            attendanceTime.textContent = time.toLocaleTimeString('ar-SA', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        if (todayLateMinutes) {
            todayLateMinutes.textContent = record.lateMinutes || 0;
        }

        if (totalLateDays) {
            totalLateDays.textContent = student.lateDays || 0;
        }

        if (totalLateMinutes) {
            totalLateMinutes.textContent = student.lateMinutesTotal || 0;
        }
    }

    async playAttendanceSound(result) {
        const { record, isRepeat } = result;
        
        try {
            let soundId = 'early'; // Default
            
            if (isRepeat) {
                soundId = 'repeat';
            } else if (record.status === 'late') {
                soundId = 'late';
            } else if (record.status === 'present') {
                soundId = 'early';
            }
            
            await window.soundsManager?.playSound(soundId);
            
        } catch (error) {
            console.warn('Failed to play attendance sound:', error);
        }
    }

    openScanner() {
        try {
            if (window.scanner && window.scanner.startScanner) {
                window.scanner.startScanner();
            } else {
                window.ui?.showToast('الماسح الضوئي غير متاح', 'warning');
            }
        } catch (error) {
            console.error('Failed to open scanner:', error);
            window.ui?.showToast('فشل في فتح الماسح الضوئي', 'error');
        }
    }

    resetInterface() {
        // Hide student info section
        const studentInfoSection = document.getElementById('studentInfoSection');
        if (studentInfoSection) {
            studentInfoSection.style.display = 'none';
        }

        // Clear and focus input
        const studentInput = document.getElementById('studentId');
        if (studentInput) {
            studentInput.value = '';
            studentInput.focus();
        }

        this.currentStudent = null;
    }

    async loadMessages() {
        try {
            const messages = await window.db.getAll('messages', 'active', true);
            const currentMessage = document.getElementById('currentMessage');
            
            if (messages.length > 0 && currentMessage) {
                const message = messages[0];
                const icon = currentMessage.querySelector('.message-icon');
                const text = currentMessage.querySelector('.message-text');
                
                if (icon) icon.textContent = message.icon || '📚';
                if (text) text.textContent = message.text || 'مرحباً بكم في نظام الحضور الذكي';
            }
        } catch (error) {
            console.warn('Failed to load messages:', error);
        }
    }

    async loadAnnouncements() {
        try {
            const announcements = await window.db.getAll('announcements', 'active', true);
            const currentAnnouncement = document.getElementById('currentAnnouncement');
            
            if (announcements.length > 0 && currentAnnouncement) {
                const announcement = announcements[0];
                const image = currentAnnouncement.querySelector('.announcement-image');
                const title = currentAnnouncement.querySelector('.announcement-title');
                const link = currentAnnouncement.querySelector('.announcement-link');
                
                if (image && announcement.imageUrl) {
                    image.src = announcement.imageUrl;
                    image.style.display = 'block';
                }
                
                if (title) title.textContent = announcement.title || 'أهلاً وسهلاً';
                if (link && announcement.link) {
                    link.href = announcement.link;
                    link.style.display = 'inline';
                }
            }
        } catch (error) {
            console.warn('Failed to load announcements:', error);
        }
    }

    getCurrentStudent() {
        return this.currentStudent;
    }

    // Method to handle barcode input
    handleBarcodeInput(code) {
        const studentInput = document.getElementById('studentId');
        if (studentInput) {
            studentInput.value = code;
            this.processAttendance();
        }
    }

    async playAttendanceSound(result) {
        try {
            if (!window.soundsManager || !window.soundsManager.playSound) {
                return; // No sound manager available
            }
            
            const { record, isRepeat } = result;
            
            if (isRepeat) {
                await window.soundsManager.playSound('warning');
            } else if (record.status === 'late') {
                await window.soundsManager.playSound('late');
            } else if (record.status === 'present') {
                await window.soundsManager.playSound('success');
            }
        } catch (error) {
            console.warn('Failed to play attendance sound:', error);
        }
    }

    resetInterface() {
        const studentInput = document.getElementById('studentId');
        const studentInfoSection = document.getElementById('studentInfoSection');
        
        if (studentInput) {
            studentInput.value = '';
            studentInput.focus();
        }
        
        if (studentInfoSection) {
            studentInfoSection.style.display = 'none';
        }
        
        this.currentStudent = null;
    }

    async runSystemTest() {
        console.log('Running system test...');
        
        try {
            // Test 1: Check if all required objects are available
            const tests = [
                { name: 'Database', check: () => window.db },
                { name: 'UI Manager', check: () => window.ui },
                { name: 'Database Initialized', check: () => window.db?.isInitialized },
                { name: 'UI Initialized', check: () => window.ui?.isInitialized }
            ];
            
            const results = tests.map(test => ({
                name: test.name,
                passed: test.check(),
                status: test.check() ? '✅' : '❌'
            }));
            
            console.table(results);
            
            // Test 2: Try to get settings
            if (window.db?.isInitialized) {
                const settings = await window.db.getSettings();
                console.log('Settings:', settings);
                
                // Test 3: Try to get all students
                const students = await window.db.getAllStudents();
                console.log('Students in database:', students.length, students);
                
                if (students.length === 0) {
                    console.log('No students found, initializing default data...');
                    await window.db.initializeDefaultData();
                    const newStudents = await window.db.getAllStudents();
                    console.log('After initialization:', newStudents.length, newStudents);
                }
            }
            
            const message = results.every(r => r.passed) ? 'جميع الاختبارات نجحت' : 'بعض الاختبارات فشلت';
            const type = results.every(r => r.passed) ? 'success' : 'warning';
            
            window.ui?.showToast(message, type);
            
        } catch (error) {
            console.error('System test failed:', error);
            window.ui?.showToast('فشل في اختبار النظام', 'error');
        }
    }

    openScanner() {
        try {
            if (window.scanner && window.scanner.open) {
                window.scanner.open();
            } else {
                window.ui?.showToast('الماسح الضوئي غير متاح', 'warning');
            }
        } catch (error) {
            console.error('Failed to open scanner:', error);
            window.ui?.showToast('فشل في فتح الماسح الضوئي', 'error');
        }
    }
}

// Global export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StudentInterface;
}