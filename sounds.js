/**
 * Hader Sounds Manager
 * Audio management for attendance status feedback
 */

class SoundsManager {
    constructor() {
        this.sounds = new Map();
        this.audioContext = null;
        this.isInitialized = false;
        this.volume = 0.7;
        this.isEnabled = true;
    }

    async init() {
        if (this.isInitialized) return;
        
        await this.loadSoundsFromDB();
        this.createDefaultSounds();
        this.setupAudioContext();
        
        this.isInitialized = true;
        console.log('Sounds manager initialized');
    }

    setupAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Audio context not supported:', error);
        }
    }

    async loadSoundsFromDB() {
        try {
            if (window.db) {
                const soundsData = await window.db.getAll('sounds');
                soundsData.forEach(sound => {
                    if (sound.url || sound.blobRef) {
                        this.sounds.set(sound.id, {
                            url: sound.url,
                            blob: sound.blobRef,
                            audio: null
                        });
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to load sounds from database:', error);
        }
    }

    createDefaultSounds() {
        // Create default sounds using Web Audio API
        const defaultSounds = {
            early: this.createTone(800, 0.2, 'sine'), // High pleasant tone
            late: this.createTone(300, 0.5, 'square'), // Lower warning tone
            repeat: this.createTone(600, 0.3, 'triangle'), // Medium neutral tone
            error: this.createTone(200, 0.4, 'sawtooth') // Low error tone
        };

        Object.entries(defaultSounds).forEach(([id, audioBuffer]) => {
            if (!this.sounds.has(id)) {
                this.sounds.set(id, {
                    audioBuffer,
                    audio: null
                });
            }
        });
    }

    createTone(frequency, duration, waveType = 'sine') {
        if (!this.audioContext) return null;

        const sampleRate = this.audioContext.sampleRate;
        const numSamples = duration * sampleRate;
        const audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
        const channelData = audioBuffer.getChannelData(0);

        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            let sample = 0;

            switch (waveType) {
                case 'sine':
                    sample = Math.sin(2 * Math.PI * frequency * t);
                    break;
                case 'square':
                    sample = Math.sign(Math.sin(2 * Math.PI * frequency * t));
                    break;
                case 'triangle':
                    sample = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * frequency * t));
                    break;
                case 'sawtooth':
                    sample = 2 * (t * frequency - Math.floor(t * frequency + 0.5));
                    break;
            }

            // Apply envelope for smoother sound
            const envelope = Math.sin((Math.PI * i) / numSamples);
            channelData[i] = sample * envelope * 0.3;
        }

        return audioBuffer;
    }

    async playSound(soundId, options = {}) {
        if (!this.isEnabled) return;
        
        try {
            const sound = this.sounds.get(soundId);
            if (!sound) {
                console.warn(`Sound not found: ${soundId}`);
                return;
            }

            // Resume audio context if suspended
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            if (sound.audioBuffer) {
                // Play generated tone
                this.playAudioBuffer(sound.audioBuffer, options);
            } else if (sound.url || sound.blob) {
                // Play uploaded audio file
                await this.playAudioFile(sound, options);
            }

            console.log(`Played sound: ${soundId}`);

        } catch (error) {
            console.error(`Failed to play sound ${soundId}:`, error);
        }
    }

    playAudioBuffer(audioBuffer, options = {}) {
        if (!this.audioContext || !audioBuffer) return;

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = audioBuffer;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        gainNode.gain.value = (options.volume || this.volume) * 0.5;
        source.start(0);
    }

    async playAudioFile(sound, options = {}) {
        let audio = sound.audio;
        
        if (!audio) {
            audio = new Audio();
            if (sound.blob) {
                audio.src = URL.createObjectURL(sound.blob);
            } else if (sound.url) {
                audio.src = sound.url;
            }
            sound.audio = audio;
        }

        audio.volume = options.volume || this.volume;
        audio.currentTime = 0;
        
        try {
            await audio.play();
        } catch (error) {
            // Fallback for browsers that require user interaction
            console.warn('Audio play failed, may require user interaction:', error);
        }
    }

    async uploadSound(soundId, file) {
        try {
            if (!file || !file.type.startsWith('audio/')) {
                throw new Error('يجب أن يكون الملف من نوع الصوت');
            }

            // Convert file to blob and store
            const blob = new Blob([file], { type: file.type });
            const url = URL.createObjectURL(blob);

            // Update sound in memory
            this.sounds.set(soundId, {
                blob,
                url,
                audio: null
            });

            // Save to database
            if (window.db) {
                await window.db.put('sounds', {
                    id: soundId,
                    fileName: file.name,
                    blobRef: blob,
                    url: url,
                    uploadedAt: new Date().toISOString()
                });
            }

            console.log(`Sound uploaded: ${soundId}`);
            return true;

        } catch (error) {
            console.error(`Failed to upload sound ${soundId}:`, error);
            throw error;
        }
    }

    async previewSound(soundId) {
        await this.playSound(soundId, { volume: 0.5 });
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    getVolume() {
        return this.volume;
    }

    isAudioEnabled() {
        return this.isEnabled;
    }

    getSoundIds() {
        return Array.from(this.sounds.keys());
    }

    hasSound(soundId) {
        return this.sounds.has(soundId);
    }

    // Method to request audio permission (for mobile browsers)
    async requestAudioPermission() {
        try {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Try to play a silent sound to unlock audio
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBT2JzvLZfS4IJG/A69uOPAgITKXa7qhVFApKn9/y');
            audio.volume = 0;
            await audio.play();
            
            return true;
        } catch (error) {
            console.warn('Audio permission request failed:', error);
            return false;
        }
    }

    // Cleanup method
    cleanup() {
        // Clean up audio objects
        this.sounds.forEach(sound => {
            if (sound.audio) {
                sound.audio.pause();
                sound.audio = null;
            }
            if (sound.url && sound.url.startsWith('blob:')) {
                URL.revokeObjectURL(sound.url);
            }
        });
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        this.sounds.clear();
        this.isInitialized = false;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const soundsManager = new SoundsManager();
    await soundsManager.init();
    window.soundsManager = soundsManager;
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoundsManager;
}