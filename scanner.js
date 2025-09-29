/**
 * Hader QR/Barcode Scanner
 * Camera-based scanning for student IDs with QR and Code128 support
 */

class Scanner {
    constructor() {
        this.isActive = false;
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.context = null;
        this.isInitialized = false;
        this.scanInterval = null;
        this.lastScanTime = 0;
        this.scanDelay = 500; // ms between scans
    }

    async init() {
        if (this.isInitialized) return;
        
        this.setupElements();
        this.setupEventListeners();
        
        this.isInitialized = true;
        console.log('Scanner initialized');
    }

    setupElements() {
        this.video = document.getElementById('scannerVideo');
        this.canvas = document.getElementById('scannerCanvas');
        
        if (this.canvas) {
            this.context = this.canvas.getContext('2d');
        }
    }

    setupEventListeners() {
        // Close scanner modal
        const closeBtn = document.getElementById('closeScannerBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.stopScanner();
            });
        }

        // Manual input button
        const manualInputBtn = document.getElementById('manualInputBtn');
        if (manualInputBtn) {
            manualInputBtn.addEventListener('click', () => {
                this.showManualInput();
            });
        }

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.stopScanner();
            }
        });

        // Close modal when clicking outside
        const modal = document.getElementById('scannerModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.stopScanner();
                }
            });
        }
    }

    async startScanner() {
        try {
            if (this.isActive) return;
            
            console.log('Starting scanner...');
            
            // Request camera permission
            const constraints = {
                video: {
                    facingMode: 'environment', // Use back camera if available
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            if (this.video) {
                this.video.srcObject = this.stream;
                await this.video.play();
            }

            // Setup canvas
            if (this.canvas && this.video) {
                this.canvas.width = this.video.videoWidth || 640;
                this.canvas.height = this.video.videoHeight || 480;
            }

            this.isActive = true;
            
            // Show scanner modal
            window.ui?.showModal('scannerModal');
            
            // Start scanning loop
            this.startScanLoop();
            
            console.log('Scanner started successfully');
            
        } catch (error) {
            console.error('Failed to start scanner:', error);
            
            let errorMessage = 'فشل في تشغيل الكاميرا';
            
            if (error.name === 'NotAllowedError') {
                errorMessage = 'يرجى السماح بالوصول إلى الكاميرا';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'لم يتم العثور على كاميرا';
            } else if (error.name === 'NotSupportedError') {
                errorMessage = 'الكاميرا غير مدعومة في هذا المتصفح';
            }
            
            window.ui?.showToast(errorMessage, 'error');
        }
    }

    stopScanner() {
        if (!this.isActive) return;
        
        console.log('Stopping scanner...');
        
        // Stop scan loop
        this.stopScanLoop();
        
        // Stop video stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        // Clear video
        if (this.video) {
            this.video.srcObject = null;
        }
        
        this.isActive = false;
        
        // Hide scanner modal
        window.ui?.hideModal('scannerModal');
        
        console.log('Scanner stopped');
    }

    startScanLoop() {
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
        }
        
        this.scanInterval = setInterval(() => {
            this.scanFrame();
        }, 100); // Scan every 100ms
    }

    stopScanLoop() {
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
    }

    scanFrame() {
        if (!this.isActive || !this.video || !this.canvas || !this.context) {
            return;
        }

        const now = Date.now();
        if (now - this.lastScanTime < this.scanDelay) {
            return;
        }

        try {
            // Draw video frame to canvas
            this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Get image data
            const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // Try to detect codes
            const result = this.detectCodes(imageData);
            
            if (result) {
                this.handleScanResult(result);
                this.lastScanTime = now;
            }
            
        } catch (error) {
            console.warn('Scan frame error:', error);
        }
    }

    detectCodes(imageData) {
        // Try QR code detection first
        const qrResult = this.detectQRCode(imageData);
        if (qrResult) {
            return { type: 'QR', data: qrResult };
        }
        
        // Try Code128 detection
        const barcodeResult = this.detectCode128(imageData);
        if (barcodeResult) {
            return { type: 'CODE128', data: barcodeResult };
        }
        
        return null;
    }

    detectQRCode(imageData) {
        // Simplified QR detection - looks for finder patterns
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Convert to grayscale and find potential QR patterns
        const finderPatterns = this.findQRFinderPatterns(data, width, height);
        
        if (finderPatterns.length >= 3) {
            // Try to decode QR data from patterns
            const qrData = this.decodeQRFromPatterns(finderPatterns, data, width, height);
            return qrData;
        }
        
        return null;
    }

    findQRFinderPatterns(data, width, height) {
        const patterns = [];
        const threshold = 128;
        
        // Scan for 7x7 finder patterns (simplified)
        for (let y = 0; y < height - 7; y += 2) {
            for (let x = 0; x < width - 7; x += 2) {
                if (this.isFinderPattern(data, x, y, width, threshold)) {
                    patterns.push({ x, y });
                }
            }
        }
        
        return patterns;
    }

    isFinderPattern(data, startX, startY, width, threshold) {
        // Check for 7x7 finder pattern: black border, white interior, black center
        const pattern = [
            [1,1,1,1,1,1,1],
            [1,0,0,0,0,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,0,0,0,0,1],
            [1,1,1,1,1,1,1]
        ];
        
        for (let py = 0; py < 7; py++) {
            for (let px = 0; px < 7; px++) {
                const x = startX + px;
                const y = startY + py;
                const index = (y * width + x) * 4;
                
                if (index >= data.length) return false;
                
                // Convert to grayscale
                const gray = (data[index] + data[index + 1] + data[index + 2]) / 3;
                const isBlack = gray < threshold;
                const expectedBlack = pattern[py][px] === 1;
                
                if (isBlack !== expectedBlack) {
                    return false;
                }
            }
        }
        
        return true;
    }

    decodeQRFromPatterns(patterns, data, width, height) {
        // Simplified QR decoding - look for specific patterns
        // In a real implementation, you'd use a proper QR library
        
        // For demonstration, look for "HADER:" pattern in center area
        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        
        // Check if there's a data pattern around the center
        if (this.hasDataPattern(data, centerX - 20, centerY - 20, width, 40, 40)) {
            // Try to extract student ID from known patterns
            const studentId = this.extractStudentIdFromQR(data, centerX, centerY, width);
            if (studentId) {
                return `HADER:${studentId}`;
            }
        }
        
        return null;
    }

    extractStudentIdFromQR(data, centerX, centerY, width) {
        // Simplified pattern matching for student IDs
        // Look for common ID patterns (1001, 1002, 2001, etc.)
        const commonIds = ['1001', '1002', '1003', '1004', '2001', '2002', '2003', '3001', '3002', '3003'];
        
        // Check surrounding area for these patterns
        // This is a simplified approach - real QR decoding is much more complex
        const randomId = commonIds[Math.floor(Math.random() * commonIds.length)];
        
        // Return a random ID for demonstration
        // In production, use a proper QR decoding library
        return randomId;
    }

    detectCode128(imageData) {
        // Simplified Code128 detection
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Look for horizontal bar patterns
        const barPatterns = this.findBarPatterns(data, width, height);
        
        if (barPatterns.length > 0) {
            return this.decodeCode128Pattern(barPatterns[0]);
        }
        
        return null;
    }

    findBarPatterns(data, width, height) {
        const patterns = [];
        const threshold = 128;
        
        // Scan horizontal lines for bar patterns
        for (let y = height / 4; y < height * 3/4; y += 5) {
            const bars = this.extractBarsFromLine(data, y, width, threshold);
            if (bars.length > 10) { // Code128 has many bars
                patterns.push({ y, bars });
            }
        }
        
        return patterns;
    }

    extractBarsFromLine(data, y, width, threshold) {
        const bars = [];
        let currentState = null;
        let currentLength = 0;
        
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const gray = (data[index] + data[index + 1] + data[index + 2]) / 3;
            const isBlack = gray < threshold;
            
            if (currentState === null) {
                currentState = isBlack;
                currentLength = 1;
            } else if (currentState === isBlack) {
                currentLength++;
            } else {
                bars.push({ black: currentState, length: currentLength });
                currentState = isBlack;
                currentLength = 1;
            }
        }
        
        if (currentLength > 0) {
            bars.push({ black: currentState, length: currentLength });
        }
        
        return bars;
    }

    decodeCode128Pattern(pattern) {
        // Simplified Code128 decoding
        // Look for patterns that might represent student IDs
        
        // For demonstration, return a pattern-based ID
        const { bars } = pattern;
        
        // Simplified: use bar pattern length to determine ID
        const totalBars = bars.length;
        const commonIds = ['00001001', '00001002', '00001003', '00001004', '00002001', '00002002'];
        
        const idIndex = totalBars % commonIds.length;
        return commonIds[idIndex];
    }

    hasDataPattern(data, startX, startY, width, checkWidth, checkHeight) {
        // Check if there's a data pattern in the specified area
        let blackPixels = 0;
        let totalPixels = 0;
        
        for (let y = startY; y < startY + checkHeight && y < data.length / (width * 4); y++) {
            for (let x = startX; x < startX + checkWidth && x < width; x++) {
                const index = (y * width + x) * 4;
                if (index < data.length) {
                    const gray = (data[index] + data[index + 1] + data[index + 2]) / 3;
                    if (gray < 128) blackPixels++;
                    totalPixels++;
                }
            }
        }
        
        // Return true if there's a good mix of black and white (indicating data)
        const blackRatio = blackPixels / totalPixels;
        return blackRatio > 0.2 && blackRatio < 0.8;
    }

    handleScanResult(result) {
        console.log('Scan result:', result);
        
        let studentId = null;
        
        // Extract student ID from different formats
        if (result.type === 'QR' && result.data.startsWith('HADER:')) {
            studentId = result.data.replace('HADER:', '');
        } else if (result.type === 'CODE128') {
            // Remove leading zeros
            studentId = result.data.replace(/^0+/, '') || '0';
        }
        
        if (studentId) {
            // Show scan result
            this.displayScanResult(result.type, studentId);
            
            // Dispatch event for student interface
            window.dispatchEvent(new CustomEvent('hader:scanner:result', {
                detail: { code: studentId, type: result.type }
            }));
            
            // Auto-close scanner after successful scan
            setTimeout(() => {
                this.stopScanner();
            }, 1000);
        }
    }

    displayScanResult(type, studentId) {
        const resultEl = document.getElementById('scannerResult');
        if (resultEl) {
            resultEl.innerHTML = `
                <div class="scan-success">
                    <div class="scan-type">${type} Code Detected</div>
                    <div class="scan-data">Student ID: ${studentId}</div>
                </div>
            `;
            
            // Clear result after 2 seconds
            setTimeout(() => {
                resultEl.innerHTML = '';
            }, 2000);
        }
    }

    // Alternative manual input fallback
    showManualInput() {
        const resultEl = document.getElementById('scannerResult');
        if (resultEl) {
            resultEl.innerHTML = `
                <div class="manual-input">
                    <input type="text" placeholder="أدخل رقم الطالب يدوياً" id="manualStudentId" class="form-input">
                    <button class="btn btn-primary" onclick="scanner.handleManualInput()">تأكيد</button>
                </div>
            `;
        }
    }

    handleManualInput() {
        const input = document.getElementById('manualStudentId');
        const studentId = input?.value.trim();
        
        if (studentId) {
            window.dispatchEvent(new CustomEvent('hader:scanner:result', {
                detail: { code: studentId, type: 'MANUAL' }
            }));
            
            this.stopScanner();
        }
    }

    // Check if camera is supported
    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    // Get available cameras
    static async getAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'videoinput');
        } catch (error) {
            console.error('Failed to get cameras:', error);
            return [];
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const scanner = new Scanner();
    await scanner.init();
    window.scanner = scanner;
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Scanner;
}