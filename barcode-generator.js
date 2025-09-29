/**
 * Hader Barcode Generator
 * QR Code and Code128 barcode generation without external libraries
 */

class BarcodeGenerator {
    constructor() {
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        console.log('Barcode generator initialized');
    }

    /**
     * Generate QR Code as SVG
     */
    generateQRCode(data, size = 200) {
        try {
            const modules = this.createQRMatrix(data);
            return this.createQRSVG(modules, size);
        } catch (error) {
            console.error('QR Code generation failed:', error);
            return this.createErrorSVG(size, 'QR Error');
        }
    }

    /**
     * Generate Code128 barcode as SVG
     */
    generateCode128(data, width = 300, height = 80) {
        try {
            const pattern = this.createCode128Pattern(data);
            return this.createCode128SVG(pattern, data, width, height);
        } catch (error) {
            console.error('Code128 generation failed:', error);
            return this.createErrorSVG(width, 'Barcode Error', height);
        }
    }

    /**
     * Create QR matrix (simplified implementation)
     */
    createQRMatrix(data) {
        const size = 21;
        const matrix = Array(size).fill().map(() => Array(size).fill(0));
        
        this.addFinderPattern(matrix, 0, 0);
        this.addFinderPattern(matrix, size - 7, 0);
        this.addFinderPattern(matrix, 0, size - 7);
        
        const dataString = data.toString();
        let dataIndex = 0;
        
        for (let i = 8; i < size - 8; i++) {
            for (let j = 8; j < size - 8; j++) {
                if (dataIndex < dataString.length) {
                    matrix[i][j] = dataString.charCodeAt(dataIndex) % 2;
                    dataIndex++;
                } else {
                    matrix[i][j] = (i + j) % 2;
                }
            }
        }
        
        return matrix;
    }

    /**
     * Add finder pattern to QR matrix
     */
    addFinderPattern(matrix, startX, startY) {
        const pattern = [
            [1,1,1,1,1,1,1],
            [1,0,0,0,0,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,0,0,0,0,1],
            [1,1,1,1,1,1,1]
        ];
        
        for (let i = 0; i < 7; i++) {
            for (let j = 0; j < 7; j++) {
                if (startX + i < matrix.length && startY + j < matrix[0].length) {
                    matrix[startX + i][startY + j] = pattern[i][j];
                }
            }
        }
    }

    /**
     * Create QR SVG from matrix
     */
    createQRSVG(matrix, size) {
        const moduleSize = size / matrix.length;
        let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<rect width="${size}" height="${size}" fill="white"/>`;
        
        for (let i = 0; i < matrix.length; i++) {
            for (let j = 0; j < matrix[i].length; j++) {
                if (matrix[i][j] === 1) {
                    const x = j * moduleSize;
                    const y = i * moduleSize;
                    svg += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
                }
            }
        }
        
        svg += '</svg>';
        return svg;
    }

    /**
     * Create Code128 pattern (simplified)
     */
    createCode128Pattern(data) {
        let pattern = [2,1,2,2,2,2];
        const digits = data.toString().replace(/\D/g, '');
        
        for (let i = 0; i < digits.length; i++) {
            const digit = parseInt(digits[i]);
            pattern = pattern.concat(this.getCode128DigitPattern(digit));
        }
        
        const checksum = digits.split('').reduce((sum, digit) => sum + parseInt(digit), 0) % 10;
        pattern = pattern.concat(this.getCode128DigitPattern(checksum));
        pattern = pattern.concat([2,3,3,1,1,1,2]);
        
        return pattern;
    }

    /**
     * Get Code128 pattern for digit
     */
    getCode128DigitPattern(digit) {
        const patterns = {
            0: [2,1,2,2,2,2], 1: [2,2,2,1,2,2], 2: [2,2,2,2,2,1], 3: [1,2,1,2,2,3], 4: [1,2,1,3,2,2],
            5: [1,3,1,2,2,2], 6: [1,2,2,2,1,3], 7: [1,2,2,3,1,2], 8: [1,3,2,2,1,2], 9: [2,2,1,2,1,3]
        };
        return patterns[digit] || patterns[0];
    }

    /**
     * Create Code128 SVG
     */
    createCode128SVG(pattern, data, width, height) {
        const totalBars = pattern.reduce((sum, bar) => sum + bar, 0);
        const barWidth = width / totalBars;
        
        let svg = `<svg width="${width}" height="${height + 30}" viewBox="0 0 ${width} ${height + 30}" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<rect width="${width}" height="${height + 30}" fill="white"/>`;
        
        let x = 0;
        let isBlack = true;
        
        for (const barSize of pattern) {
            if (isBlack) {
                svg += `<rect x="${x}" y="0" width="${barSize * barWidth}" height="${height}" fill="black"/>`;
            }
            x += barSize * barWidth;
            isBlack = !isBlack;
        }
        
        svg += `<text x="${width/2}" y="${height + 20}" text-anchor="middle" font-family="monospace" font-size="14" fill="black">${data}</text>`;
        svg += '</svg>';
        
        return svg;
    }

    /**
     * Create error SVG
     */
    createErrorSVG(width, text, height = null) {
        if (!height) height = width;
        
        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${width}" height="${height}" fill="#f8f8f8" stroke="#ddd"/>
            <text x="${width/2}" y="${height/2}" text-anchor="middle" dominant-baseline="middle" 
                  font-family="Arial, sans-serif" font-size="12" fill="#666">${text}</text>
        </svg>`;
    }

    /**
     * Generate student barcode card
     */
    generateStudentCard(student, cardWidth = 350, cardHeight = 200) {
        const qrSize = 80;
        const barcodeWidth = 200;
        const barcodeHeight = 40;
        
        const qrCode = this.generateQRCode(`HADER:${student.id}`, qrSize);
        const barcode = this.generateCode128(student.id.padStart(8, '0'), barcodeWidth, barcodeHeight);
        
        let svg = `<svg width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<rect width="${cardWidth}" height="${cardHeight}" fill="white" stroke="#2563eb" stroke-width="2" rx="10"/>`;
        svg += `<rect x="0" y="0" width="${cardWidth}" height="30" fill="#2563eb" rx="10 10 0 0"/>`;
        svg += `<text x="${cardWidth/2}" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white">بطاقة طالب</text>`;
        
        const infoY = 50;
        svg += `<text x="20" y="${infoY}" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#333">${student.name}</text>`;
        svg += `<text x="20" y="${infoY + 20}" font-family="Arial, sans-serif" font-size="12" fill="#666">الرقم: ${student.id}</text>`;
        svg += `<text x="20" y="${infoY + 35}" font-family="Arial, sans-serif" font-size="12" fill="#666">الصف: ${student.grade} - ${student.className}</text>`;
        
        const qrX = cardWidth - qrSize - 20;
        svg += `<g transform="translate(${qrX}, 45)">${qrCode}</g>`;
        
        const barcodeX = (cardWidth - barcodeWidth) / 2;
        const barcodeY = cardHeight - barcodeHeight - 30;
        svg += `<g transform="translate(${barcodeX}, ${barcodeY})">${barcode}</g>`;
        
        svg += '</svg>';
        return svg;
    }

    /**
     * Print student cards
     */
    printStudentCards(students) {
        const printWindow = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><title>بطاقات الطلاب</title>`;
        html += `<style>body { font-family: Arial, sans-serif; margin: 20px; }`;
        html += `.card { page-break-inside: avoid; margin-bottom: 20px; display: inline-block; }`;
        html += `@media print { .card { page-break-inside: avoid; } }</style></head><body>`;
        
        students.forEach(student => {
            const cardSVG = this.generateStudentCard(student);
            html += `<div class="card">${cardSVG}</div>`;
        });
        
        html += '</body></html>';
        
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }
}

// Create global instance
const barcodeGenerator = new BarcodeGenerator();

// Initialize when DOM is ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        await barcodeGenerator.init();
        console.log('Barcode generator ready');
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BarcodeGenerator;
} else {
    window.BarcodeGenerator = BarcodeGenerator;
    window.barcodeGenerator = barcodeGenerator;
}