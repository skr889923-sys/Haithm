/**
 * Hader Database Manager
 * IndexedDB wrapper for offline-first attendance system
 */

class HaderDB {
    constructor() {
        this.dbName = 'haderDB';
        this.version = 1;
        this.db = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the database
     */
    async init() {
        if (this.isInitialized) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Database failed to open');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;
                console.log('Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (e) => {
                this.db = e.target.result;
                this.createStores();
            };
        });
    }

    /**
     * Create all object stores
     */
    createStores() {
        console.log('Creating object stores...');

        // Students store
        if (!this.db.objectStoreNames.contains('students')) {
            const studentsStore = this.db.createObjectStore('students', { keyPath: 'id' });
            studentsStore.createIndex('name', 'name', { unique: false });
            studentsStore.createIndex('grade', 'grade', { unique: false });
            studentsStore.createIndex('className', 'className', { unique: false });
        }

        // Classes store
        if (!this.db.objectStoreNames.contains('classes')) {
            const classesStore = this.db.createObjectStore('classes', { keyPath: 'id' });
            classesStore.createIndex('name', 'name', { unique: false });
            classesStore.createIndex('grade', 'grade', { unique: false });
        }

        // Grades store
        if (!this.db.objectStoreNames.contains('grades')) {
            const gradesStore = this.db.createObjectStore('grades', { keyPath: 'id' });
            gradesStore.createIndex('name', 'name', { unique: false });
            gradesStore.createIndex('order', 'order', { unique: false });
        }

        // Attendance store
        if (!this.db.objectStoreNames.contains('attendance')) {
            const attendanceStore = this.db.createObjectStore('attendance', { keyPath: 'id', autoIncrement: true });
            attendanceStore.createIndex('studentId', 'studentId', { unique: false });
            attendanceStore.createIndex('dateISO', 'dateISO', { unique: false });
            attendanceStore.createIndex('studentDate', ['studentId', 'dateISO'], { unique: false });
        }

        // Sessions store
        if (!this.db.objectStoreNames.contains('sessions')) {
            const sessionsStore = this.db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
            sessionsStore.createIndex('active', 'active', { unique: false });
        }

        // Messages store
        if (!this.db.objectStoreNames.contains('messages')) {
            const messagesStore = this.db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
            messagesStore.createIndex('active', 'active', { unique: false });
        }

        // Announcements store
        if (!this.db.objectStoreNames.contains('announcements')) {
            const announcementsStore = this.db.createObjectStore('announcements', { keyPath: 'id', autoIncrement: true });
            announcementsStore.createIndex('active', 'active', { unique: false });
            announcementsStore.createIndex('order', 'order', { unique: false });
        }

        // Sounds store
        if (!this.db.objectStoreNames.contains('sounds')) {
            const soundsStore = this.db.createObjectStore('sounds', { keyPath: 'id' });
        }

        // Settings store
        if (!this.db.objectStoreNames.contains('settings')) {
            this.db.createObjectStore('settings', { keyPath: 'id' });
        }

        // Sync queue store
        if (!this.db.objectStoreNames.contains('syncQueue')) {
            const syncStore = this.db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
            syncStore.createIndex('status', 'status', { unique: false });
            syncStore.createIndex('ts', 'ts', { unique: false });
        }

        // Audit log store
        if (!this.db.objectStoreNames.contains('audit')) {
            const auditStore = this.db.createObjectStore('audit', { keyPath: 'id', autoIncrement: true });
            auditStore.createIndex('user', 'user', { unique: false });
            auditStore.createIndex('action', 'action', { unique: false });
            auditStore.createIndex('ts', 'ts', { unique: false });
        }
    }

    /**
     * Generic method to add/update records
     */
    async put(storeName, data) {
        await this.ensureInit();
        
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        // Add timestamps
        const now = new Date().toISOString();
        if (!data.createdAt) data.createdAt = now;
        data.updatedAt = now;

        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Generic method to get record by key
     */
    async get(storeName, key) {
        await this.ensureInit();
        
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Generic method to get all records
     */
    async getAll(storeName, indexName = null, query = null) {
        await this.ensureInit();
        
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        const source = indexName ? store.index(indexName) : store;
        
        return new Promise((resolve, reject) => {
            const request = query ? source.getAll(query) : source.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Generic method to delete record
     */
    async delete(storeName, key) {
        await this.ensureInit();
        
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Ensure database is initialized
     */
    async ensureInit() {
        if (!this.isInitialized) {
            await this.init();
            
            // Initialize with some default data if empty
            await this.initializeDefaultData();
        }
    }

    // ============ STUDENT METHODS ============

    async addStudent(student) {
        // Validate required fields
        if (!student.id || !student.name || !student.grade || !student.className) {
            throw new Error('جميع البيانات مطلوبة: الرقم، الاسم، الصف، الفصل');
        }
        
        // Check if student ID already exists
        const existing = await this.getStudent(student.id);
        if (existing) {
            throw new Error('رقم الطالب موجود مسبقاً');
        }
        
        const studentData = {
            id: student.id.toString().trim(),
            name: student.name.trim(),
            grade: student.grade.trim(),
            className: student.className.trim(),
            guardianPhone: (student.guardianPhone || '').trim(),
            lateDays: 0,
            lateMinutesTotal: 0,
            qrCode: this.generateQRData(student.id),
            barcode: this.generateBarcodeData(student.id),
            ...student
        };
        
        await this.logAudit('system', 'CREATE_STUDENT', 'students', null, studentData);
        return await this.put('students', studentData);
    }

    async getStudent(id) {
        return await this.get('students', id);
    }

    async getAllStudents() {
        return await this.getAll('students');
    }

    async updateStudent(id, updates) {
        const existing = await this.getStudent(id);
        if (!existing) throw new Error('الطالب غير موجود');
        
        // Validate critical updates
        if (updates.id && updates.id !== id) {
            const existingWithNewId = await this.getStudent(updates.id);
            if (existingWithNewId) {
                throw new Error('رقم الطالب الجديد موجود مسبقاً');
            }
        }
        
        const updated = { ...existing, ...updates };
        
        // If ID changed, we need to handle attendance records
        if (updates.id && updates.id !== id) {
            await this.transferStudentData(id, updates.id);
            await this.delete('students', id);
            updated.id = updates.id;
        }
        
        await this.logAudit('system', 'UPDATE_STUDENT', 'students', existing, updated);
        return await this.put('students', updated);
    }

    async transferStudentData(oldId, newId) {
        // Transfer attendance records
        const attendanceRecords = await this.getAll('attendance', 'studentId', oldId);
        for (const record of attendanceRecords) {
            const updated = { ...record, studentId: newId };
            await this.put('attendance', updated);
        }
    }

    async deleteStudent(id) {
        const existing = await this.getStudent(id);
        if (existing) {
            await this.logAudit('system', 'DELETE_STUDENT', 'students', existing, null);
            return await this.delete('students', id);
        }
    }

    // ============ BULK STUDENT OPERATIONS ============

    async bulkAddStudents(students) {
        const results = [];
        const errors = [];
        
        for (let i = 0; i < students.length; i++) {
            try {
                const result = await this.addStudent(students[i]);
                results.push({ index: i, success: true, student: students[i], result });
            } catch (error) {
                errors.push({ index: i, student: students[i], error: error.message });
                results.push({ index: i, success: false, student: students[i], error: error.message });
            }
        }
        
        return { results, errors, successCount: results.filter(r => r.success).length };
    }

    async bulkUpdateStudents(updates) {
        const results = [];
        const errors = [];
        
        for (const update of updates) {
            try {
                const result = await this.updateStudent(update.id, update.data);
                results.push({ id: update.id, success: true, result });
            } catch (error) {
                errors.push({ id: update.id, error: error.message });
                results.push({ id: update.id, success: false, error: error.message });
            }
        }
        
        return { results, errors, successCount: results.filter(r => r.success).length };
    }

    async bulkDeleteStudents(ids) {
        const results = [];
        const errors = [];
        
        for (const id of ids) {
            try {
                await this.deleteStudent(id);
                results.push({ id, success: true });
            } catch (error) {
                errors.push({ id, error: error.message });
                results.push({ id, success: false, error: error.message });
            }
        }
        
        return { results, errors, successCount: results.filter(r => r.success).length };
    }

    // ============ STUDENT SEARCH AND FILTERING ============

    async searchStudents(query, filters = {}) {
        const allStudents = await this.getAllStudents();
        
        let filtered = allStudents;
        
        // Apply text search
        if (query && query.trim()) {
            const searchTerm = query.toLowerCase().trim();
            filtered = filtered.filter(student => 
                student.name.toLowerCase().includes(searchTerm) ||
                student.id.toLowerCase().includes(searchTerm) ||
                (student.guardianPhone && student.guardianPhone.includes(searchTerm))
            );
        }
        
        // Apply filters
        if (filters.grade) {
            filtered = filtered.filter(student => student.grade === filters.grade);
        }
        
        if (filters.className) {
            filtered = filtered.filter(student => student.className === filters.className);
        }
        
        if (filters.minLateDays !== undefined) {
            filtered = filtered.filter(student => (student.lateDays || 0) >= filters.minLateDays);
        }
        
        if (filters.maxLateDays !== undefined) {
            filtered = filtered.filter(student => (student.lateDays || 0) <= filters.maxLateDays);
        }
        
        return filtered;
    }

    async getStudentsByGrade(grade) {
        const allStudents = await this.getAllStudents();
        return allStudents.filter(student => student.grade === grade);
    }

    async getStudentsByClass(className) {
        const allStudents = await this.getAllStudents();
        return allStudents.filter(student => student.className === className);
    }

    // ============ CLASS MANAGEMENT METHODS ============

    async addClass(classData) {
        // Validate required fields
        if (!classData.name || !classData.grade) {
            throw new Error('اسم الفصل والصف مطلوبان');
        }
        
        // Check if class already exists
        const existing = await this.getClassByNameAndGrade(classData.name, classData.grade);
        if (existing) {
            throw new Error('فصل بنفس الاسم والصف موجود مسبقاً');
        }
        
        const newClass = {
            id: classData.id || this.generateId(),
            name: classData.name.trim(),
            grade: classData.grade.trim(),
            description: classData.description || '',
            maxStudents: classData.maxStudents || 30,
            studentIds: [],
            teacherId: classData.teacherId || null,
            room: classData.room || '',
            schedule: classData.schedule || {},
            isActive: true,
            ...classData
        };
        
        await this.logAudit('system', 'CREATE_CLASS', 'classes', null, newClass);
        return await this.put('classes', newClass);
    }

    async getClass(id) {
        return await this.get('classes', id);
    }

    async getAllClasses() {
        return await this.getAll('classes');
    }

    async getActiveClasses() {
        const allClasses = await this.getAllClasses();
        return allClasses.filter(cls => cls.isActive !== false);
    }

    async getClassByNameAndGrade(name, grade) {
        const allClasses = await this.getAllClasses();
        return allClasses.find(cls => 
            cls.name === name && cls.grade === grade
        );
    }

    async updateClass(id, updates) {
        const existing = await this.getClass(id);
        if (!existing) throw new Error('الفصل غير موجود');
        
        const updated = { ...existing, ...updates };
        await this.logAudit('system', 'UPDATE_CLASS', 'classes', existing, updated);
        return await this.put('classes', updated);
    }

    async deleteClass(id) {
        const existing = await this.getClass(id);
        if (existing) {
            // Check if class has students
            if (existing.studentIds && existing.studentIds.length > 0) {
                throw new Error('لا يمكن حذف فصل يحتوي على طلاب');
            }
            
            await this.logAudit('system', 'DELETE_CLASS', 'classes', existing, null);
            return await this.delete('classes', id);
        }
    }

    async assignStudentToClass(studentId, classId) {
        const student = await this.getStudent(studentId);
        const targetClass = await this.getClass(classId);
        
        if (!student) throw new Error('الطالب غير موجود');
        if (!targetClass) throw new Error('الفصل غير موجود');
        
        // Check capacity
        if (targetClass.studentIds.length >= targetClass.maxStudents) {
            throw new Error('الفصل ممتلئ');
        }
        
        // Remove from current class if any
        await this.removeStudentFromAllClasses(studentId);
        
        // Add to new class
        if (!targetClass.studentIds.includes(studentId)) {
            targetClass.studentIds.push(studentId);
            await this.updateClass(classId, { studentIds: targetClass.studentIds });
        }
        
        // Update student's class info
        await this.updateStudent(studentId, {
            grade: targetClass.grade,
            className: targetClass.name
        });
        
        await this.logAudit('system', 'ASSIGN_STUDENT_CLASS', 'classes', 
            { studentId, fromClass: student.className, toClass: targetClass.name });
    }

    async removeStudentFromClass(studentId, classId) {
        const targetClass = await this.getClass(classId);
        if (!targetClass) throw new Error('الفصل غير موجود');
        
        const index = targetClass.studentIds.indexOf(studentId);
        if (index > -1) {
            targetClass.studentIds.splice(index, 1);
            await this.updateClass(classId, { studentIds: targetClass.studentIds });
        }
        
        await this.logAudit('system', 'REMOVE_STUDENT_CLASS', 'classes', 
            { studentId, classId });
    }

    async removeStudentFromAllClasses(studentId) {
        const allClasses = await this.getAllClasses();
        for (const cls of allClasses) {
            if (cls.studentIds && cls.studentIds.includes(studentId)) {
                await this.removeStudentFromClass(studentId, cls.id);
            }
        }
    }

    async getClassStudents(classId) {
        const targetClass = await this.getClass(classId);
        if (!targetClass) return [];
        
        const students = [];
        for (const studentId of targetClass.studentIds || []) {
            const student = await this.getStudent(studentId);
            if (student) {
                students.push(student);
            }
        }
        
        return students.sort((a, b) => a.name.localeCompare(b.name));
    }

    async getUnassignedStudents() {
        const allStudents = await this.getAllStudents();
        const allClasses = await this.getAllClasses();
        
        const assignedStudentIds = new Set();
        allClasses.forEach(cls => {
            if (cls.studentIds) {
                cls.studentIds.forEach(id => assignedStudentIds.add(id));
            }
        });
        
        return allStudents.filter(student => !assignedStudentIds.has(student.id));
    }

    async getClassStatistics(classId) {
        const targetClass = await this.getClass(classId);
        if (!targetClass) return null;
        
        const students = await this.getClassStudents(classId);
        const today = new Date().toISOString().split('T')[0];
        const todayAttendance = await this.getDayAttendance(today);
        
        const classAttendance = todayAttendance.filter(record => 
            targetClass.studentIds.includes(record.studentId)
        );
        
        const presentCount = classAttendance.filter(a => a.status === 'present').length;
        const lateCount = classAttendance.filter(a => a.status === 'late').length;
        const totalPresent = presentCount + lateCount;
        const absentCount = students.length - totalPresent;
        
        return {
            classId,
            className: targetClass.name,
            grade: targetClass.grade,
            totalStudents: students.length,
            maxStudents: targetClass.maxStudents,
            presentToday: totalPresent,
            absentToday: absentCount,
            lateToday: lateCount,
            attendanceRate: students.length > 0 ? Math.round((totalPresent / students.length) * 100) : 0
        };
    }

    // ============ ATTENDANCE METHODS ============

    async recordAttendance(studentId, status = 'present', lateMinutes = 0) {
        const now = new Date();
        const dateISO = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeISO = now.toISOString();

        // Check if student exists
        const student = await this.getStudent(studentId);
        if (!student) {
            throw new Error('الطالب غير موجود');
        }

        // Get settings for work start time and late threshold
        const settings = await this.getSettings();
        const workStartTime = settings.workStartHHmm || '07:00';
        const lateThresholdMin = settings.lateThresholdMin || 15;
        
        // Calculate if student is late
        const { actualStatus, calculatedLateMinutes } = this.calculateAttendanceStatus(
            now, workStartTime, lateThresholdMin
        );

        // Check if already recorded today
        const existingRecord = await this.getTodayAttendance(studentId);
        if (existingRecord) {
            // Update existing record for repeat attendance
            const updated = {
                ...existingRecord,
                timeISO,
                status: actualStatus === 'late' ? 'late' : existingRecord.status,
                lateMinutes: Math.max(existingRecord.lateMinutes, calculatedLateMinutes),
                updatedAt: timeISO,
                isRepeat: true
            };
            
            await this.put('attendance', updated);
            await this.logAudit('system', 'UPDATE_ATTENDANCE', 'attendance', existingRecord, updated);
            return { record: updated, isRepeat: true, student };
        }

        // Create new attendance record
        const attendanceRecord = {
            studentId,
            dateISO,
            timeISO,
            status: actualStatus,
            lateMinutes: calculatedLateMinutes,
            sessionId: await this.getCurrentSessionId(),
            isRepeat: false
        };

        const recordId = await this.put('attendance', attendanceRecord);
        attendanceRecord.id = recordId;

        // Update student late statistics if late
        if (actualStatus === 'late' && calculatedLateMinutes > 0) {
            const currentLateDays = student.lateDays || 0;
            const currentLateMinutesTotal = student.lateMinutesTotal || 0;
            
            await this.updateStudent(studentId, {
                lateDays: currentLateDays + 1,
                lateMinutesTotal: currentLateMinutesTotal + calculatedLateMinutes
            });
        }

        await this.logAudit('system', 'CREATE_ATTENDANCE', 'attendance', null, attendanceRecord);
        return { record: attendanceRecord, isRepeat: false, student };
    }

    calculateAttendanceStatus(currentTime, workStartTime, lateThresholdMin) {
        // Parse work start time
        const [workHour, workMinute] = workStartTime.split(':').map(Number);
        
        // Create work start datetime for today
        const workStart = new Date(currentTime);
        workStart.setHours(workHour, workMinute, 0, 0);
        
        // Calculate difference in minutes
        const diffMinutes = Math.max(0, (currentTime - workStart) / (1000 * 60));
        
        let status = 'present';
        let lateMinutes = 0;
        
        if (diffMinutes > lateThresholdMin) {
            status = 'late';
            lateMinutes = Math.round(diffMinutes);
        }
        
        return {
            actualStatus: status,
            calculatedLateMinutes: lateMinutes
        };
    }

    async getTodayAttendance(studentId) {
        const today = new Date().toISOString().split('T')[0];
        const attendanceRecords = await this.getAll('attendance', 'studentDate', [studentId, today]);
        return attendanceRecords.length > 0 ? attendanceRecords[0] : null;
    }

    async getDayAttendance(dateISO) {
        return await this.getAll('attendance', 'dateISO', dateISO);
    }

    async getStudentAttendanceHistory(studentId, limit = 30) {
        const allRecords = await this.getAll('attendance', 'studentId', studentId);
        return allRecords
            .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
            .slice(0, limit);
    }

    // ============ SETTINGS METHODS ============

    async getSettings() {
        const settings = await this.get('settings', 'global');
        return settings || this.getDefaultSettings();
    }

    async updateSettings(updates) {
        const existing = await this.getSettings();
        const updated = { ...existing, ...updates, id: 'global' };
        await this.logAudit('system', 'UPDATE_SETTINGS', 'settings', existing, updated);
        return await this.put('settings', updated);
    }

    getDefaultSettings() {
        return {
            id: 'global',
            schoolName: 'مدرسة النموذجية',
            principalName: 'الأستاذ أحمد محمد',
            workStartHHmm: '07:00',
            lateThresholdMin: 15,
            theme: 'light',
            syncProvider: 'websocket'
        };
    }

    // ============ BARCODE GENERATION METHODS ============

    generateQRData(studentId) {
        return {
            data: `HADER:${studentId}`,
            format: 'QR',
            generated: new Date().toISOString()
        };
    }

    generateBarcodeData(studentId) {
        return {
            data: studentId.padStart(8, '0'), // Ensure 8 digits for Code128
            format: 'CODE128',
            generated: new Date().toISOString()
        };
    }

    async getStudentByCode(code) {
        // Handle both QR and barcode formats
        let studentId = code;
        
        // If it's a QR code format
        if (code.startsWith('HADER:')) {
            studentId = code.replace('HADER:', '');
        }
        
        // Remove leading zeros for lookup
        studentId = studentId.replace(/^0+/, '') || '0';
        
        return await this.getStudent(studentId);
    }

    // ============ UTILITY METHODS ============

    generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    async getCurrentSessionId() {
        const activeSessions = await this.getAll('sessions', 'active', true);
        return activeSessions.length > 0 ? activeSessions[0].id : null;
    }

    async logAudit(user, action, entity, before, after) {
        const auditRecord = {
            user,
            action,
            entity,
            before: before ? JSON.stringify(before) : null,
            after: after ? JSON.stringify(after) : null,
            ts: new Date().toISOString()
        };
        
        try {
            await this.put('audit', auditRecord);
        } catch (error) {
            console.warn('Failed to log audit:', error);
        }
    }

    // ============ STATISTICS METHODS ============

    async getTodayStats() {
        const today = new Date().toISOString().split('T')[0];
        const todayAttendance = await this.getDayAttendance(today);
        const allStudents = await this.getAllStudents();
        
        const presentCount = todayAttendance.filter(a => a.status === 'present').length;
        const lateCount = todayAttendance.filter(a => a.status === 'late').length;
        const totalPresent = presentCount + lateCount;
        const absentCount = allStudents.length - totalPresent;
        const attendanceRatio = allStudents.length > 0 ? 
            Math.round((totalPresent / allStudents.length) * 100) : 0;

        // Get first and last student today
        const sortedAttendance = todayAttendance
            .sort((a, b) => a.timeISO.localeCompare(b.timeISO));
        
        const firstStudentRecord = sortedAttendance[0];
        const lastStudentRecord = sortedAttendance[sortedAttendance.length - 1];
        
        let firstStudent = null;
        let lastStudent = null;
        
        if (firstStudentRecord) {
            const student = await this.getStudent(firstStudentRecord.studentId);
            firstStudent = {
                name: student?.name || 'غير محدد',
                time: new Date(firstStudentRecord.timeISO).toLocaleTimeString('ar-SA', {
                    hour: '2-digit',
                    minute: '2-digit'
                })
            };
        }
        
        if (lastStudentRecord && lastStudentRecord.id !== firstStudentRecord?.id) {
            const student = await this.getStudent(lastStudentRecord.studentId);
            lastStudent = {
                name: student?.name || 'غير محدد',
                time: new Date(lastStudentRecord.timeISO).toLocaleTimeString('ar-SA', {
                    hour: '2-digit',
                    minute: '2-digit'
                })
            };
        }

        return {
            presentCount,
            lateCount,
            absentCount,
            attendanceRatio,
            firstStudent,
            lastStudent,
            totalStudents: allStudents.length
        };
    }

    // ============ INITIALIZATION METHODS ============

    async initializeDefaultData() {
        try {
            // Initialize default settings
            await this.updateSettings(this.getDefaultSettings());
            
            // Add sample students if none exist
            const students = await this.getAllStudents();
            if (students.length === 0) {
                await this.addSampleStudents();
            }
            
            // Add default messages and sounds
            await this.initializeDefaultMessages();
            await this.initializeDefaultSounds();
            
            console.log('Default data initialized successfully');
        } catch (error) {
            console.error('Failed to initialize default data:', error);
        }
    }

    async addSampleStudents() {
        const sampleStudents = [
            { id: '1001', name: 'أحمد محمد علي السالم', grade: 'الأول الثانوي', className: 'أ', guardianPhone: '0501234567' },
            { id: '1002', name: 'فاطمة عبدالله محمد', grade: 'الأول الثانوي', className: 'أ', guardianPhone: '0509876543' },
            { id: '1003', name: 'محمد أحمد عبدالرحمن', grade: 'الأول الثانوي', className: 'ب', guardianPhone: '0507654321' },
            { id: '1004', name: 'عائشة سالم خالد', grade: 'الأول الثانوي', className: 'ب', guardianPhone: '0503456789' },
            { id: '2001', name: 'عبدالرحمن خالد أحمد', grade: 'الثاني الثانوي', className: 'أ', guardianPhone: '0502345678' },
            { id: '2002', name: 'مريم محمد عبدالله', grade: 'الثاني الثانوي', className: 'أ', guardianPhone: '0508765432' },
            { id: '2003', name: 'يوسف أحمد سالم', grade: 'الثاني الثانوي', className: 'ب', guardianPhone: '0506543210' },
            { id: '3001', name: 'زينب عبدالرحمن محمد', grade: 'الثالث الثانوي', className: 'أ', guardianPhone: '0504321098' },
            { id: '3002', name: 'عمر محمد خالد', grade: 'الثالث الثانوي', className: 'أ', guardianPhone: '0505432109' },
            { id: '3003', name: 'نورا أحمد عبدالله', grade: 'الثالث الثانوي', className: 'ب', guardianPhone: '0507890123' }
        ];

        for (const student of sampleStudents) {
            await this.addStudent(student);
        }
    }

    async initializeDefaultMessages() {
        const messages = await this.getAll('messages');
        if (messages.length === 0) {
            await this.put('messages', {
                text: 'مرحباً بكم في نظام الحضور الذكي',
                icon: '📚',
                active: true
            });
        }
    }

    async initializeDefaultSounds() {
        const sounds = await this.getAll('sounds');
        if (sounds.length === 0) {
            const defaultSounds = [
                { id: 'early', fileName: 'early.mp3', url: null },
                { id: 'late', fileName: 'late.mp3', url: null },
                { id: 'repeat', fileName: 'repeat.mp3', url: null },
                { id: 'error', fileName: 'error.mp3', url: null }
            ];
            
            for (const sound of defaultSounds) {
                await this.put('sounds', sound);
            }
        }
    }
}

// Create global database instance
const db = new HaderDB();

// Initialize database when DOM is loaded
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await db.init();
            await db.initializeDefaultData();
            console.log('Hader database initialized successfully');
            
            // Dispatch custom event for other modules
            window.dispatchEvent(new CustomEvent('hader:db:ready'));
        } catch (error) {
            console.error('Failed to initialize database:', error);
            window.dispatchEvent(new CustomEvent('hader:db:error', { detail: error }));
        }
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HaderDB;
} else {
    window.HaderDB = HaderDB;
    window.db = db;
}

// ============ GRADES METHODS ============

window.db.addGrade = async function(gradeData) {
    if (!gradeData.name) {
        throw new Error('اسم الصف مطلوب');
    }
    
    const existing = await this.getGradeByName(gradeData.name);
    if (existing) {
        return { success: false, message: 'صف بنفس الاسم موجود مسبقاً' };
    }
    
    const newGrade = {
        id: gradeData.id || this.generateId(),
        name: gradeData.name.trim(),
        level: gradeData.level || '',
        year: gradeData.year || '',
        order: gradeData.order || 1,
        maxClasses: gradeData.maxClasses || 4,
        coordinator: gradeData.coordinator || '',
        description: gradeData.description || '',
        isActive: true,
        createdAt: new Date().toISOString()
    };
    
    await this.logAudit('system', 'CREATE_GRADE', 'grades', null, newGrade);
    const result = await this.put('grades', newGrade);
    return { success: true, data: result };
};

window.db.getGrade = async function(id) {
    return await this.get('grades', id);
};

window.db.getAllGrades = async function() {
    const grades = await this.getAll('grades') || [];
    return grades.filter(g => g.isActive !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
};

window.db.getGradeByName = async function(name) {
    const grades = await this.getAllGrades();
    return grades.find(g => g.name === name);
};

window.db.updateGrade = async function(gradeData) {
    const existing = await this.getGrade(gradeData.id);
    if (!existing) {
        return { success: false, message: 'الصف غير موجود' };
    }
    
    const updated = { ...existing, ...gradeData, updatedAt: new Date().toISOString() };
    await this.logAudit('system', 'UPDATE_GRADE', 'grades', existing, updated);
    const result = await this.put('grades', updated);
    return { success: true, data: result };
};

window.db.deleteGrade = async function(id) {
    const existing = await this.getGrade(id);
    if (!existing) {
        return { success: false, message: 'الصف غير موجود' };
    }
    
    // Check if grade has classes
    const gradeClasses = await this.getGradeClasses(id);
    if (gradeClasses.length > 0) {
        return { success: false, message: 'لا يمكن حذف صف يحتوي على فصول' };
    }
    
    await this.logAudit('system', 'DELETE_GRADE', 'grades', existing, null);
    await this.delete('grades', id);
    return { success: true };
};

window.db.getGradeClasses = async function(gradeId) {
    const grade = await this.getGrade(gradeId);
    if (!grade) return [];
    
    const allClasses = await this.getAllClasses();
    return allClasses.filter(cls => cls.grade === grade.name);
};

// ============ SESSIONS METHODS ============

window.db.addSession = async function(sessionData) {
    if (!sessionData.name || !sessionData.startTime || !sessionData.endTime) {
        throw new Error('اسم الحصة ووقت البداية والنهاية مطلوبة');
    }
    
    const newSession = {
        id: sessionData.id || this.generateId(),
        name: sessionData.name.trim(),
        description: sessionData.description || '',
        startTime: sessionData.startTime, // HH:MM format
        endTime: sessionData.endTime,     // HH:MM format
        days: sessionData.days || [], // Array of weekdays
        isActive: sessionData.isActive !== false,
        allowLateEntry: sessionData.allowLateEntry !== false,
        lateThresholdMin: sessionData.lateThresholdMin || 15,
        autoClose: sessionData.autoClose !== false,
        closeAfterMin: sessionData.closeAfterMin || 30,
        createdAt: new Date().toISOString(),
        ...sessionData
    };
    
    await this.logAudit('system', 'CREATE_SESSION', 'sessions', null, newSession);
    const result = await this.put('sessions', newSession);
    return { success: true, data: result };
};

window.db.getSession = async function(id) {
    return await this.get('sessions', id);
};

window.db.getAllSessions = async function() {
    const sessions = await this.getAll('sessions') || [];
    return sessions.filter(s => s.isActive !== false).sort((a, b) => {
        return a.startTime.localeCompare(b.startTime);
    });
};

window.db.getActiveSessions = async function() {
    const allSessions = await this.getAllSessions();
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, etc.
    
    return allSessions.filter(session => {
        // Check if session is for current day
        if (session.days && session.days.length > 0 && !session.days.includes(currentDay)) {
            return false;
        }
        
        // Check if current time is within session time
        return currentTime >= session.startTime && currentTime <= session.endTime;
    });
};

window.db.getCurrentSession = async function() {
    const activeSessions = await this.getActiveSessions();
    return activeSessions.length > 0 ? activeSessions[0] : null;
};

window.db.updateSession = async function(sessionData) {
    const existing = await this.getSession(sessionData.id);
    if (!existing) {
        return { success: false, message: 'الحصة غير موجودة' };
    }
    
    const updated = { ...existing, ...sessionData, updatedAt: new Date().toISOString() };
    await this.logAudit('system', 'UPDATE_SESSION', 'sessions', existing, updated);
    const result = await this.put('sessions', updated);
    return { success: true, data: result };
};

window.db.deleteSession = async function(id) {
    const existing = await this.getSession(id);
    if (!existing) {
        return { success: false, message: 'الحصة غير موجودة' };
    }
    
    await this.logAudit('system', 'DELETE_SESSION', 'sessions', existing, null);
    await this.delete('sessions', id);
    return { success: true };
};

window.db.getSessionAttendance = async function(sessionId, dateISO) {
    const attendanceRecords = await this.getAll('attendance');
    return attendanceRecords.filter(record => 
        record.sessionId === sessionId && record.dateISO === dateISO
    );
};

window.db.getSessionStatistics = async function(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) return null;
    
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = await this.getSessionAttendance(sessionId, today);
    const allStudents = await this.getAllStudents();
    
    const presentCount = todayAttendance.filter(a => a.status === 'present').length;
    const lateCount = todayAttendance.filter(a => a.status === 'late').length;
    const totalPresent = presentCount + lateCount;
    const absentCount = allStudents.length - totalPresent;
    
    return {
        sessionId,
        sessionName: session.name,
        totalStudents: allStudents.length,
        presentToday: totalPresent,
        absentToday: absentCount,
        lateToday: lateCount,
        attendanceRate: allStudents.length > 0 ? Math.round((totalPresent / allStudents.length) * 100) : 0
    };
};

window.db.getWeeklySessionSchedule = async function() {
    const sessions = await this.getAllSessions();
    const schedule = {
        0: [], // Sunday
        1: [], // Monday  
        2: [], // Tuesday
        3: [], // Wednesday
        4: [], // Thursday
        5: [], // Friday
        6: []  // Saturday
    };
    
    sessions.forEach(session => {
        if (session.days && session.days.length > 0) {
            session.days.forEach(day => {
                schedule[day].push(session);
            });
        } else {
            // If no specific days, add to all days
            Object.keys(schedule).forEach(day => {
                schedule[day].push(session);
            });
        }
    });
    
    // Sort sessions by start time for each day
    Object.keys(schedule).forEach(day => {
        schedule[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    
    return schedule;
};

// ============ ADVANCED ATTENDANCE METHODS ============

window.db.correctAttendance = async function(attendanceId, newStatus, newLateMinutes = 0, reason = '') {
    const existing = await this.get('attendance', attendanceId);
    if (!existing) {
        return { success: false, message: 'سجل الحضور غير موجود' };
    }
    
    const correction = {
        id: this.generateId(),
        attendanceId,
        originalStatus: existing.status,
        originalLateMinutes: existing.lateMinutes,
        newStatus,
        newLateMinutes,
        reason,
        correctedBy: 'admin',
        correctedAt: new Date().toISOString()
    };
    
    // Save correction record
    await this.put('attendance_corrections', correction);
    
    // Update the attendance record
    const updated = {
        ...existing,
        status: newStatus,
        lateMinutes: newLateMinutes,
        isCorrected: true,
        correctedAt: correction.correctedAt,
        correctionReason: reason
    };
    
    await this.put('attendance', updated);
    await this.logAudit('admin', 'CORRECT_ATTENDANCE', 'attendance', existing, updated);
    
    return { success: true, data: updated, correction };
};

window.db.getAttendanceCorrections = async function(attendanceId) {
    const corrections = await this.getAll('attendance_corrections');
    return corrections.filter(c => c.attendanceId === attendanceId)
        .sort((a, b) => b.correctedAt.localeCompare(a.correctedAt));
};

window.db.bulkUpdateAttendance = async function(updates) {
    const results = [];
    
    for (const update of updates) {
        try {
            const result = await this.correctAttendance(
                update.attendanceId,
                update.status,
                update.lateMinutes,
                update.reason || 'تعديل جماعي'
            );
            results.push({ ...result, studentId: update.studentId });
        } catch (error) {
            results.push({ 
                success: false, 
                message: error.message, 
                studentId: update.studentId 
            });
        }
    }
    
    return results;
};

window.db.getAttendanceByDateRange = async function(startDate, endDate, filters = {}) {
    const allAttendance = await this.getAll('attendance');
    
    let filtered = allAttendance.filter(record => {
        const recordDate = record.dateISO;
        return recordDate >= startDate && recordDate <= endDate;
    });
    
    // Apply additional filters
    if (filters.studentId) {
        filtered = filtered.filter(r => r.studentId === filters.studentId);
    }
    
    if (filters.classId) {
        // Get students in the class
        const classStudents = await this.getClassStudents(filters.classId);
        const studentIds = new Set(classStudents.map(s => s.id));
        filtered = filtered.filter(r => studentIds.has(r.studentId));
    }
    
    if (filters.grade) {
        const allStudents = await this.getAllStudents();
        const gradeStudents = allStudents.filter(s => s.grade === filters.grade);
        const studentIds = new Set(gradeStudents.map(s => s.id));
        filtered = filtered.filter(r => studentIds.has(r.studentId));
    }
    
    if (filters.status) {
        filtered = filtered.filter(r => r.status === filters.status);
    }
    
    if (filters.sessionId) {
        filtered = filtered.filter(r => r.sessionId === filters.sessionId);
    }
    
    return filtered.sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.timeISO.localeCompare(a.timeISO));
};

window.db.getAttendanceSummary = async function(startDate, endDate, groupBy = 'student') {
    const attendance = await this.getAttendanceByDateRange(startDate, endDate);
    const summary = {};
    
    for (const record of attendance) {
        let key;
        
        if (groupBy === 'student') {
            key = record.studentId;
        } else if (groupBy === 'date') {
            key = record.dateISO;
        } else if (groupBy === 'session') {
            key = record.sessionId || 'no-session';
        }
        
        if (!summary[key]) {
            summary[key] = {
                total: 0,
                present: 0,
                late: 0,
                absent: 0,
                totalLateMinutes: 0
            };
        }
        
        summary[key].total++;
        
        if (record.status === 'present') {
            summary[key].present++;
        } else if (record.status === 'late') {
            summary[key].late++;
            summary[key].totalLateMinutes += record.lateMinutes || 0;
        }
    }
    
    // Calculate absent days (for student grouping)
    if (groupBy === 'student') {
        const dateRange = this.getDateRange(startDate, endDate);
        const allStudents = await this.getAllStudents();
        
        for (const student of allStudents) {
            if (!summary[student.id]) {
                summary[student.id] = {
                    total: 0,
                    present: 0,
                    late: 0,
                    absent: dateRange.length,
                    totalLateMinutes: 0
                };
            } else {
                summary[student.id].absent = dateRange.length - summary[student.id].total;
            }
        }
    }
    
    return summary;
};

window.db.getDateRange = function(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    
    return dates;
};

window.db.markAbsent = async function(studentId, dateISO, sessionId = null, reason = '') {
    // Check if attendance already exists
    const existing = await this.getAll('attendance')
        .then(records => records.find(r => r.studentId === studentId && r.dateISO === dateISO));
    
    if (existing) {
        return { success: false, message: 'سجل الحضور موجود مسبقاً' };
    }
    
    const absentRecord = {
        studentId,
        dateISO,
        timeISO: new Date().toISOString(),
        status: 'absent',
        lateMinutes: 0,
        sessionId,
        reason,
        markedBy: 'admin',
        isManual: true
    };
    
    const recordId = await this.put('attendance', absentRecord);
    absentRecord.id = recordId;
    
    await this.logAudit('admin', 'MARK_ABSENT', 'attendance', null, absentRecord);
    
    return { success: true, data: absentRecord };
};

window.db.bulkMarkAbsent = async function(studentIds, dateISO, sessionId = null, reason = '') {
    const results = [];
    
    for (const studentId of studentIds) {
        try {
            const result = await this.markAbsent(studentId, dateISO, sessionId, reason);
            results.push({ ...result, studentId });
        } catch (error) {
            results.push({ 
                success: false, 
                message: error.message, 
                studentId 
            });
        }
    }
    
    return results;
};

window.db.getAttendanceHistory = async function(studentId, limit = 30) {
    const records = await this.getAll('attendance');
    const studentRecords = records
        .filter(r => r.studentId === studentId)
        .sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.timeISO.localeCompare(a.timeISO))
        .slice(0, limit);
    
    // Get corrections for each record
    const recordsWithCorrections = [];
    for (const record of studentRecords) {
        const corrections = await this.getAttendanceCorrections(record.id);
        recordsWithCorrections.push({
            ...record,
            corrections
        });
    }
    
    return recordsWithCorrections;
};

window.db.deleteAttendanceRecord = async function(attendanceId, reason = '') {
    const existing = await this.get('attendance', attendanceId);
    if (!existing) {
        return { success: false, message: 'سجل الحضور غير موجود' };
    }
    
    // Log the deletion
    await this.logAudit('admin', 'DELETE_ATTENDANCE', 'attendance', existing, { reason });
    
    // Delete the record
    await this.delete('attendance', attendanceId);
    
    return { success: true };
};

// ============ MESSAGES AND ANNOUNCEMENTS METHODS ============

window.db.addMessage = async function(messageData) {
    if (!messageData.title || !messageData.content) {
        throw new Error('عنوان الرسالة والمحتوى مطلوبان');
    }
    
    const newMessage = {
        id: messageData.id || this.generateId(),
        title: messageData.title.trim(),
        content: messageData.content.trim(),
        type: messageData.type || 'info', // info, warning, success, error
        priority: messageData.priority || 'normal', // low, normal, high, urgent
        targetAudience: messageData.targetAudience || 'all', // all, students, parents, teachers, specific
        targetGroups: messageData.targetGroups || [], // class IDs, grade names, etc.
        targetUsers: messageData.targetUsers || [], // specific user IDs
        scheduledAt: messageData.scheduledAt || null,
        expiresAt: messageData.expiresAt || null,
        isActive: messageData.isActive !== false,
        isPinned: messageData.isPinned === true,
        allowComments: messageData.allowComments !== false,
        requireAcknowledgment: messageData.requireAcknowledgment === true,
        attachments: messageData.attachments || [],
        tags: messageData.tags || [],
        createdBy: messageData.createdBy || 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    await this.logAudit('admin', 'CREATE_MESSAGE', 'messages', null, newMessage);
    const result = await this.put('messages', newMessage);
    return { success: true, data: result };
};

window.db.getMessage = async function(id) {
    return await this.get('messages', id);
};

window.db.getAllMessages = async function() {
    const messages = await this.getAll('messages') || [];
    return messages.filter(m => m.isActive !== false)
        .sort((a, b) => {
            // Sort by priority first, then by creation date
            const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
            const aPriority = priorityOrder[a.priority] || 2;
            const bPriority = priorityOrder[b.priority] || 2;
            
            if (aPriority !== bPriority) {
                return bPriority - aPriority;
            }
            
            return b.createdAt.localeCompare(a.createdAt);
        });
};

window.db.getActiveMessages = async function(targetAudience = 'all') {
    const allMessages = await this.getAllMessages();
    const now = new Date().toISOString();
    
    return allMessages.filter(message => {
        // Check if message is currently active
        if (!message.isActive) return false;
        
        // Check if message is scheduled for future
        if (message.scheduledAt && message.scheduledAt > now) return false;
        
        // Check if message has expired
        if (message.expiresAt && message.expiresAt < now) return false;
        
        // Check target audience
        if (message.targetAudience === 'all') return true;
        if (message.targetAudience === targetAudience) return true;
        
        return false;
    });
};

window.db.updateMessage = async function(messageData) {
    const existing = await this.getMessage(messageData.id);
    if (!existing) {
        return { success: false, message: 'الرسالة غير موجودة' };
    }
    
    const updated = { 
        ...existing, 
        ...messageData, 
        updatedAt: new Date().toISOString() 
    };
    
    await this.logAudit('admin', 'UPDATE_MESSAGE', 'messages', existing, updated);
    const result = await this.put('messages', updated);
    return { success: true, data: result };
};

window.db.deleteMessage = async function(id) {
    const existing = await this.getMessage(id);
    if (!existing) {
        return { success: false, message: 'الرسالة غير موجودة' };
    }
    
    await this.logAudit('admin', 'DELETE_MESSAGE', 'messages', existing, null);
    await this.delete('messages', id);
    return { success: true };
};

window.db.addAnnouncement = async function(announcementData) {
    if (!announcementData.title || !announcementData.content) {
        throw new Error('عنوان الإعلان والمحتوى مطلوبان');
    }
    
    const newAnnouncement = {
        id: announcementData.id || this.generateId(),
        title: announcementData.title.trim(),
        content: announcementData.content.trim(),
        type: announcementData.type || 'general', // general, urgent, event, academic
        priority: announcementData.priority || 'normal',
        targetAudience: announcementData.targetAudience || 'all',
        targetGroups: announcementData.targetGroups || [],
        displayLocation: announcementData.displayLocation || ['dashboard'], // dashboard, login, student_interface
        startDate: announcementData.startDate || new Date().toISOString().split('T')[0],
        endDate: announcementData.endDate || null,
        isActive: announcementData.isActive !== false,
        isPinned: announcementData.isPinned === true,
        showPopup: announcementData.showPopup === true,
        autoHide: announcementData.autoHide === true,
        hideAfterSeconds: announcementData.hideAfterSeconds || 10,
        backgroundColor: announcementData.backgroundColor || '#2563eb',
        textColor: announcementData.textColor || '#ffffff',
        icon: announcementData.icon || '📢',
        attachments: announcementData.attachments || [],
        createdBy: announcementData.createdBy || 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    await this.logAudit('admin', 'CREATE_ANNOUNCEMENT', 'announcements', null, newAnnouncement);
    const result = await this.put('announcements', newAnnouncement);
    return { success: true, data: result };
};

window.db.getAnnouncement = async function(id) {
    return await this.get('announcements', id);
};

window.db.getAllAnnouncements = async function() {
    const announcements = await this.getAll('announcements') || [];
    return announcements.filter(a => a.isActive !== false)
        .sort((a, b) => {
            // Pinned announcements first
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            
            // Then by priority
            const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
            const aPriority = priorityOrder[a.priority] || 2;
            const bPriority = priorityOrder[b.priority] || 2;
            
            if (aPriority !== bPriority) {
                return bPriority - aPriority;
            }
            
            return b.createdAt.localeCompare(a.createdAt);
        });
};

window.db.getActiveAnnouncements = async function(location = 'dashboard', targetAudience = 'all') {
    const allAnnouncements = await this.getAllAnnouncements();
    const today = new Date().toISOString().split('T')[0];
    
    return allAnnouncements.filter(announcement => {
        // Check if announcement is currently active
        if (!announcement.isActive) return false;
        
        // Check date range
        if (announcement.startDate && announcement.startDate > today) return false;
        if (announcement.endDate && announcement.endDate < today) return false;
        
        // Check display location
        if (!announcement.displayLocation.includes(location)) return false;
        
        // Check target audience
        if (announcement.targetAudience === 'all') return true;
        if (announcement.targetAudience === targetAudience) return true;
        
        return false;
    });
};

window.db.updateAnnouncement = async function(announcementData) {
    const existing = await this.getAnnouncement(announcementData.id);
    if (!existing) {
        return { success: false, message: 'الإعلان غير موجود' };
    }
    
    const updated = { 
        ...existing, 
        ...announcementData, 
        updatedAt: new Date().toISOString() 
    };
    
    await this.logAudit('admin', 'UPDATE_ANNOUNCEMENT', 'announcements', existing, updated);
    const result = await this.put('announcements', updated);
    return { success: true, data: result };
};

window.db.deleteAnnouncement = async function(id) {
    const existing = await this.getAnnouncement(id);
    if (!existing) {
        return { success: false, message: 'الإعلان غير موجود' };
    }
    
    await this.logAudit('admin', 'DELETE_ANNOUNCEMENT', 'announcements', existing, null);
    await this.delete('announcements', id);
    return { success: true };
};

window.db.getMessagesStatistics = async function() {
    const messages = await this.getAllMessages();
    const announcements = await this.getAllAnnouncements();
    const now = new Date().toISOString();
    
    const activeMessages = messages.filter(m => {
        if (!m.isActive) return false;
        if (m.scheduledAt && m.scheduledAt > now) return false;
        if (m.expiresAt && m.expiresAt < now) return false;
        return true;
    });
    
    const activeAnnouncements = announcements.filter(a => {
        if (!a.isActive) return false;
        const today = new Date().toISOString().split('T')[0];
        if (a.startDate && a.startDate > today) return false;
        if (a.endDate && a.endDate < today) return false;
        return true;
    });
    
    return {
        totalMessages: messages.length,
        activeMessages: activeMessages.length,
        scheduledMessages: messages.filter(m => m.scheduledAt && m.scheduledAt > now).length,
        expiredMessages: messages.filter(m => m.expiresAt && m.expiresAt < now).length,
        totalAnnouncements: announcements.length,
        activeAnnouncements: activeAnnouncements.length,
        pinnedAnnouncements: announcements.filter(a => a.isPinned).length,
        urgentMessages: messages.filter(m => m.priority === 'urgent').length
    };
};

// ============ SOUND MANAGEMENT METHODS ============

window.db.addSound = async function(soundData) {
    if (!soundData.name || !soundData.audioData) {
        throw new Error('اسم الصوت والبيانات الصوتية مطلوبان');
    }
    
    const newSound = {
        id: soundData.id || this.generateId(),
        name: soundData.name.trim(),
        description: soundData.description || '',
        audioData: soundData.audioData, // Base64 encoded audio
        mimeType: soundData.mimeType || 'audio/wav',
        fileSize: soundData.fileSize || 0,
        duration: soundData.duration || 0,
        category: soundData.category || 'general', // success, warning, error, general
        eventType: soundData.eventType || 'manual', // present, late, absent, manual
        volume: soundData.volume || 1.0,
        isDefault: soundData.isDefault === true,
        isActive: soundData.isActive !== false,
        tags: soundData.tags || [],
        createdBy: soundData.createdBy || 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // If this sound is set as default, unset other defaults for the same event type
    if (newSound.isDefault) {
        await this.unsetDefaultSounds(newSound.eventType);
    }
    
    await this.logAudit('admin', 'CREATE_SOUND', 'sounds', null, { ...newSound, audioData: '[AUDIO_DATA]' });
    const result = await this.put('sounds', newSound);
    return { success: true, data: result };
};

window.db.getSound = async function(id) {
    return await this.get('sounds', id);
};

window.db.getAllSounds = async function() {
    const sounds = await this.getAll('sounds') || [];
    return sounds.filter(s => s.isActive !== false)
        .sort((a, b) => {
            // Default sounds first, then by name
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.name.localeCompare(b.name);
        });
};

window.db.getSoundsByCategory = async function(category) {
    const allSounds = await this.getAllSounds();
    return allSounds.filter(sound => sound.category === category);
};

window.db.getSoundsByEventType = async function(eventType) {
    const allSounds = await this.getAllSounds();
    return allSounds.filter(sound => sound.eventType === eventType);
};

window.db.getDefaultSound = async function(eventType) {
    const allSounds = await this.getAllSounds();
    return allSounds.find(sound => sound.eventType === eventType && sound.isDefault) || null;
};

window.db.updateSound = async function(soundData) {
    const existing = await this.getSound(soundData.id);
    if (!existing) {
        return { success: false, message: 'الملف الصوتي غير موجود' };
    }
    
    const updated = { 
        ...existing, 
        ...soundData, 
        updatedAt: new Date().toISOString() 
    };
    
    // If this sound is set as default, unset other defaults for the same event type
    if (updated.isDefault && updated.eventType) {
        await this.unsetDefaultSounds(updated.eventType, updated.id);
    }
    
    await this.logAudit('admin', 'UPDATE_SOUND', 'sounds', 
        { ...existing, audioData: '[AUDIO_DATA]' }, 
        { ...updated, audioData: '[AUDIO_DATA]' }
    );
    const result = await this.put('sounds', updated);
    return { success: true, data: result };
};

window.db.deleteSound = async function(id) {
    const existing = await this.getSound(id);
    if (!existing) {
        return { success: false, message: 'الملف الصوتي غير موجود' };
    }
    
    await this.logAudit('admin', 'DELETE_SOUND', 'sounds', { ...existing, audioData: '[AUDIO_DATA]' }, null);
    await this.delete('sounds', id);
    return { success: true };
};

window.db.unsetDefaultSounds = async function(eventType, excludeId = null) {
    const sounds = await this.getSoundsByEventType(eventType);
    
    for (const sound of sounds) {
        if (sound.id !== excludeId && sound.isDefault) {
            await this.updateSound({ 
                id: sound.id, 
                isDefault: false 
            });
        }
    }
};

window.db.setSoundConfiguration = async function(config) {
    const soundConfig = {
        id: 'sound_config',
        enableSounds: config.enableSounds !== false,
        masterVolume: config.masterVolume || 1.0,
        presentSoundId: config.presentSoundId || null,
        lateSoundId: config.lateSoundId || null,
        absentSoundId: config.absentSoundId || null,
        errorSoundId: config.errorSoundId || null,
        successSoundId: config.successSoundId || null,
        warningSoundId: config.warningSoundId || null,
        playOnPresent: config.playOnPresent !== false,
        playOnLate: config.playOnLate !== false,
        playOnAbsent: config.playOnAbsent === true,
        playOnError: config.playOnError !== false,
        playOnSuccess: config.playOnSuccess !== false,
        playOnWarning: config.playOnWarning !== false,
        updatedAt: new Date().toISOString()
    };
    
    await this.logAudit('admin', 'UPDATE_SOUND_CONFIG', 'settings', null, soundConfig);
    return await this.put('settings', soundConfig);
};

window.db.getSoundConfiguration = async function() {
    const config = await this.get('settings', 'sound_config');
    return config || {
        id: 'sound_config',
        enableSounds: true,
        masterVolume: 1.0,
        presentSoundId: null,
        lateSoundId: null,
        absentSoundId: null,
        errorSoundId: null,
        successSoundId: null,
        warningSoundId: null,
        playOnPresent: true,
        playOnLate: true,
        playOnAbsent: false,
        playOnError: true,
        playOnSuccess: true,
        playOnWarning: true
    };
};

window.db.createAudioBlob = function(audioData, mimeType = 'audio/wav') {
    try {
        // Convert base64 to blob
        const byteCharacters = atob(audioData);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    } catch (error) {
        console.error('Failed to create audio blob:', error);
        return null;
    }
};

window.db.getSoundsStatistics = async function() {
    const sounds = await this.getAllSounds();
    
    const byCategory = sounds.reduce((acc, sound) => {
        acc[sound.category] = (acc[sound.category] || 0) + 1;
        return acc;
    }, {});
    
    const byEventType = sounds.reduce((acc, sound) => {
        acc[sound.eventType] = (acc[sound.eventType] || 0) + 1;
        return acc;
    }, {});
    
    const totalSize = sounds.reduce((acc, sound) => acc + (sound.fileSize || 0), 0);
    const totalDuration = sounds.reduce((acc, sound) => acc + (sound.duration || 0), 0);
    
    return {
        totalSounds: sounds.length,
        activeSounds: sounds.filter(s => s.isActive).length,
        defaultSounds: sounds.filter(s => s.isDefault).length,
        totalSize: Math.round(totalSize / 1024), // KB
        totalDuration: Math.round(totalDuration), // seconds
        byCategory,
        byEventType,
        averageSize: sounds.length > 0 ? Math.round(totalSize / sounds.length / 1024) : 0,
        averageDuration: sounds.length > 0 ? Math.round(totalDuration / sounds.length) : 0
    };
};

// ==================== IMPORT/EXPORT SYSTEM ====================

// Export data to various formats
window.db.exportData = async function(dataType, format = 'csv', options = {}) {
    try {
        let data = [];
        let filename = '';
        
        switch (dataType) {
            case 'students':
                data = await this.getAllStudents();
                filename = `students_${new Date().toISOString().split('T')[0]}`;
                break;
            case 'attendance':
                data = await this.getAttendanceRecords(options.startDate, options.endDate);
                filename = `attendance_${options.startDate || 'all'}_${options.endDate || 'all'}`;
                break;
            case 'classes':
                data = await this.getAllClasses();
                filename = `classes_${new Date().toISOString().split('T')[0]}`;
                break;
            case 'grades':
                data = await this.getAllGrades();
                filename = `grades_${new Date().toISOString().split('T')[0]}`;
                break;
            case 'sessions':
                data = await this.getAllSessions();
                filename = `sessions_${new Date().toISOString().split('T')[0]}`;
                break;
            case 'messages':
                data = await this.getAllMessages();
                filename = `messages_${new Date().toISOString().split('T')[0]}`;
                break;
            case 'announcements':
                data = await this.getAllAnnouncements();
                filename = `announcements_${new Date().toISOString().split('T')[0]}`;
                break;
            case 'backup':
                return await this.exportFullBackup(format, options);
            default:
                throw new Error(`نوع البيانات غير مدعوم: ${dataType}`);
        }
        
        if (format === 'csv') {
            return this.convertToCSV(data, filename, dataType);
        } else if (format === 'excel') {
            return this.convertToExcel(data, filename, dataType);
        } else if (format === 'json') {
            return this.convertToJSON(data, filename, dataType);
        }
        
        throw new Error(`تنسيق التصدير غير مدعوم: ${format}`);
        
    } catch (error) {
        console.error('Export failed:', error);
        throw error;
    }
};

// Import data from various formats
window.db.importData = async function(file, dataType, options = {}) {
    try {
        const fileContent = await this.readFileContent(file);
        let parsedData = [];
        
        if (file.name.endsWith('.csv')) {
            parsedData = this.parseCSV(fileContent, dataType);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            parsedData = await this.parseExcel(file, dataType);
        } else if (file.name.endsWith('.json')) {
            parsedData = JSON.parse(fileContent);
        } else {
            throw new Error('تنسيق الملف غير مدعوم');
        }
        
        // Validate data before import
        const validationResult = await this.validateImportData(parsedData, dataType);
        if (!validationResult.valid) {
            return {
                success: false,
                errors: validationResult.errors,
                validRecords: validationResult.validRecords,
                invalidRecords: validationResult.invalidRecords
            };
        }
        
        // Process import based on data type
        const importResult = await this.processImport(parsedData, dataType, options);
        
        await this.logAudit('admin', 'IMPORT_DATA', dataType, null, {
            dataType,
            recordCount: parsedData.length,
            successCount: importResult.successCount,
            errorCount: importResult.errorCount,
            filename: file.name
        });
        
        return importResult;
        
    } catch (error) {
        console.error('Import failed:', error);
        throw error;
    }
};

// Process import data based on type
window.db.processImport = async function(data, dataType, options) {
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < data.length; i++) {
        try {
            const record = data[i];
            
            switch (dataType) {
                case 'students':
                    if (options.updateExisting && record.id) {
                        await this.updateStudent(record);
                    } else {
                        await this.addStudent(record);
                    }
                    break;
                case 'attendance':
                    await this.recordAttendance(record.studentId, record.status, {
                        timestamp: record.timestamp,
                        sessionId: record.sessionId,
                        notes: record.notes
                    });
                    break;
                case 'classes':
                    if (options.updateExisting && record.id) {
                        await this.updateClass(record);
                    } else {
                        await this.addClass(record);
                    }
                    break;
                case 'grades':
                    if (options.updateExisting && record.id) {
                        await this.updateGrade(record);
                    } else {
                        await this.addGrade(record);
                    }
                    break;
                default:
                    throw new Error(`نوع البيانات غير مدعوم للاستيراد: ${dataType}`);
            }
            
            successCount++;
        } catch (error) {
            errorCount++;
            errors.push({
                row: i + 1,
                data: data[i],
                error: error.message
            });
        }
    }
    
    return {
        success: errorCount === 0,
        successCount,
        errorCount,
        totalCount: data.length,
        errors
    };
};

// Validate import data
window.db.validateImportData = async function(data, dataType) {
    const errors = [];
    const validRecords = [];
    const invalidRecords = [];
    
    for (let i = 0; i < data.length; i++) {
        const record = data[i];
        const rowErrors = [];
        
        switch (dataType) {
            case 'students':
                if (!record.name || record.name.trim().length === 0) {
                    rowErrors.push('اسم الطالب مطلوب');
                }
                if (!record.id || record.id.trim().length === 0) {
                    rowErrors.push('رقم الطالب مطلوب');
                }
                if (record.email && !this.isValidEmail(record.email)) {
                    rowErrors.push('البريد الإلكتروني غير صحيح');
                }
                if (record.guardianPhone && !this.isValidPhone(record.guardianPhone)) {
                    rowErrors.push('رقم هاتف ولي الأمر غير صحيح');
                }
                break;
                
            case 'attendance':
                if (!record.studentId) {
                    rowErrors.push('رقم الطالب مطلوب');
                }
                if (!['present', 'absent', 'late'].includes(record.status)) {
                    rowErrors.push('حالة الحضور غير صحيحة');
                }
                if (record.timestamp && !this.isValidDate(record.timestamp)) {
                    rowErrors.push('تاريخ ووقت غير صحيح');
                }
                break;
                
            case 'classes':
                if (!record.name || record.name.trim().length === 0) {
                    rowErrors.push('اسم الفصل مطلوب');
                }
                if (!record.grade || record.grade.trim().length === 0) {
                    rowErrors.push('الصف مطلوب');
                }
                break;
        }
        
        if (rowErrors.length > 0) {
            invalidRecords.push({ row: i + 1, data: record, errors: rowErrors });
            errors.push(...rowErrors.map(error => `السطر ${i + 1}: ${error}`));
        } else {
            validRecords.push(record);
        }
    }
    
    return {
        valid: errors.length === 0,
        errors,
        validRecords,
        invalidRecords
    };
};

// CSV conversion functions
window.db.convertToCSV = function(data, filename, dataType) {
    if (!data || data.length === 0) {
        throw new Error('لا توجد بيانات للتصدير');
    }
    
    const headers = this.getCSVHeaders(dataType);
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    data.forEach(item => {
        const row = headers.map(header => {
            const value = this.getFieldValue(item, header, dataType);
            // Escape CSV values
            return `"${String(value || '').replace(/"/g, '""')}"`;
        });
        csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    return {
        blob,
        filename: `${filename}.csv`,
        type: 'csv'
    };
};

// Get CSV headers for different data types
window.db.getCSVHeaders = function(dataType) {
    switch (dataType) {
        case 'students':
            return ['id', 'name', 'grade', 'className', 'email', 'guardianName', 'guardianPhone', 'address', 'birthDate', 'enrollmentDate'];
        case 'attendance':
            return ['studentId', 'studentName', 'status', 'timestamp', 'sessionId', 'lateMinutes', 'notes'];
        case 'classes':
            return ['id', 'name', 'grade', 'capacity', 'room', 'teacher', 'notes'];
        case 'grades':
            return ['id', 'name', 'level', 'year', 'order', 'coordinator', 'maxClasses', 'description'];
        case 'sessions':
            return ['id', 'name', 'startTime', 'endTime', 'date', 'type', 'grade', 'className', 'isActive'];
        case 'messages':
            return ['id', 'title', 'content', 'type', 'priority', 'targetType', 'targets', 'scheduledAt', 'createdAt'];
        case 'announcements':
            return ['id', 'title', 'content', 'type', 'priority', 'isPublic', 'expiresAt', 'createdAt'];
        default:
            return Object.keys(data[0] || {});
    }
};

// Get field value for CSV export
window.db.getFieldValue = function(item, field, dataType) {
    const value = item[field];
    
    if (value === null || value === undefined) {
        return '';
    }
    
    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            return value.join(';');
        }
        return JSON.stringify(value);
    }
    
    if (typeof value === 'boolean') {
        return value ? 'نعم' : 'لا';
    }
    
    return String(value);
};

// Parse CSV content
window.db.parseCSV = function(content, dataType) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        throw new Error('ملف CSV فارغ أو لا يحتوي على بيانات');
    }
    
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length !== headers.length) {
            console.warn(`تحذير: السطر ${i + 1} يحتوي على عدد أعمدة مختلف`);
            continue;
        }
        
        const record = {};
        headers.forEach((header, index) => {
            record[header] = this.parseCSVValue(values[index], header, dataType);
        });
        
        data.push(record);
    }
    
    return data;
};

// Parse a single CSV line handling quoted values
window.db.parseCSVLine = function(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    values.push(current.trim());
    return values;
};

// Parse CSV value based on field type
window.db.parseCSVValue = function(value, field, dataType) {
    if (!value || value === '') {
        return null;
    }
    
    // Remove quotes
    value = value.replace(/^"(.*)"$/, '$1');
    
    // Boolean fields
    if (['isActive', 'isPublic', 'isDefault'].includes(field)) {
        return value === 'نعم' || value === 'true' || value === '1';
    }
    
    // Number fields
    if (['capacity', 'order', 'maxClasses', 'lateMinutes', 'priority'].includes(field)) {
        const num = parseInt(value);
        return isNaN(num) ? 0 : num;
    }
    
    // Date fields
    if (['birthDate', 'enrollmentDate', 'timestamp', 'scheduledAt', 'createdAt', 'expiresAt'].includes(field)) {
        return value; // Keep as string, will be validated later
    }
    
    // Array fields
    if (['targets', 'tags'].includes(field)) {
        return value.split(';').filter(v => v.trim());
    }
    
    return value;
};

// File reading utility
window.db.readFileContent = function(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('فشل في قراءة الملف'));
        reader.readAsText(file, 'UTF-8');
    });
};

// Excel functions (simplified - would need SheetJS library for full implementation)
window.db.convertToExcel = function(data, filename, dataType) {
    // For now, convert to CSV and suggest using SheetJS for real Excel support
    console.warn('Excel export requires SheetJS library. Converting to CSV instead.');
    return this.convertToCSV(data, filename, dataType);
};

window.db.parseExcel = async function(file, dataType) {
    // For now, throw error suggesting CSV import
    throw new Error('استيراد ملفات Excel يتطلب مكتبة SheetJS. يرجى استخدام ملفات CSV.');
};

// JSON conversion
window.db.convertToJSON = function(data, filename, dataType) {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    
    return {
        blob,
        filename: `${filename}.json`,
        type: 'json'
    };
};

// Full backup export
window.db.exportFullBackup = async function(format = 'json', options = {}) {
    try {
        const backup = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            data: {
                students: await this.getAllStudents(),
                classes: await this.getAllClasses(),
                grades: await this.getAllGrades(),
                sessions: await this.getAllSessions(),
                attendance: await this.getAllAttendanceRecords(),
                messages: await this.getAllMessages(),
                announcements: await this.getAllAnnouncements(),
                settings: await this.getSettings()
            },
            statistics: {
                totalStudents: (await this.getAllStudents()).length,
                totalClasses: (await this.getAllClasses()).length,
                totalAttendanceRecords: (await this.getAllAttendanceRecords()).length
            }
        };
        
        if (options.includeSounds) {
            backup.data.sounds = await this.getAllSounds();
            backup.data.soundConfig = await this.getSoundConfiguration();
        }
        
        const filename = `hader_backup_${new Date().toISOString().split('T')[0]}`;
        
        if (format === 'json') {
            return this.convertToJSON(backup, filename, 'backup');
        } else {
            throw new Error('تنسيق النسخة الاحتياطية غير مدعوم');
        }
        
    } catch (error) {
        console.error('Backup export failed:', error);
        throw error;
    }
};

// Utility validation functions
window.db.isValidEmail = function(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

window.db.isValidPhone = function(phone) {
    const phoneRegex = /^[+]?[0-9\s\-()]{7,}$/;
    return phoneRegex.test(phone);
};

window.db.isValidDate = function(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
};

// Initialize default data for first run
window.db.initializeDefaultData = async function() {
    try {
        // Check if already initialized
        const settings = await this.getSettings();
        if (settings.initialized) {
            return;
        }
        
        console.log('Initializing default data...');
        
        // Add default settings
        await this.updateSettings({
            schoolName: 'مدرسة النموذجية',
            principalName: 'الأستاذ أحمد محمد',
            workStartHHmm: '07:00',
            lateThresholdMin: 15,
            theme: 'light',
            syncProvider: 'websocket',
            initialized: true
        });
        
        // Add default message
        await this.put('messages', {
            id: 1,
            text: 'مرحباً بكم في نظام الحضور الذكي',
            icon: '📚',
            active: true
        });
        
        // Add sample students for testing (following student data completeness rule)
        const sampleStudents = [
            {
                id: '12345',
                name: 'محمد أحمد علي',
                grade: 'الأول الثانوي',
                className: 'أ',
                guardianPhone: '0501234567'
            },
            {
                id: '12346',
                name: 'فاطمة محمد الزهراني',
                grade: 'الأول الثانوي',
                className: 'أ',
                guardianPhone: '0501234568'
            },
            {
                id: '12347',
                name: 'عبدالله سعد الغامدي',
                grade: 'الثاني الثانوي',
                className: 'ب',
                guardianPhone: '0501234569'
            }
        ];
        
        for (const student of sampleStudents) {
            try {
                await this.addStudent(student);
                console.log(`Added sample student: ${student.name}`);
            } catch (error) {
                console.warn(`Failed to add sample student ${student.name}:`, error);
            }
        }
        
        // Add default session
        await this.put('sessions', {
            id: 1,
            name: 'حصة الصباح',
            description: 'حصة الحضور الصباحية',
            startTime: '07:00',
            endTime: '07:30',
            days: [0, 1, 2, 3, 4], // Sunday to Thursday
            isActive: true,
            allowLateEntry: true,
            lateThresholdMin: 15,
            autoClose: true,
            closeAfterMin: 30
        });
        
        console.log('Default data initialized successfully');
    } catch (error) {
        console.error('Failed to initialize default data:', error);
    }
};

// Get active messages
window.db.getActiveMessages = async function() {
    try {
        return await this.getAll('messages', 'active', true);
    } catch (error) {
        console.warn('Failed to get active messages:', error);
        return [];
    }
};

// Get active announcements
window.db.getActiveAnnouncements = async function() {
    try {
        return await this.getAll('announcements', 'active', true);
    } catch (error) {
        console.warn('Failed to get active announcements:', error);
        return [];
    }
};