/**
 * Wave Doctor Audio Manager
 * 
 * Handles audio loading, playback, and crossfading between raw and processed audio.
 * Simplified from your existing audio.js
 */

class WaveDoctorAudioManager {
    constructor() {
        // Initialize audio context
        this.audioContext = null;
        this.initializeAudioContext();
        
        // Audio nodes
        this.masterGain = null;
        this.analyser = null;
        this.rawGain = null;
        this.processedGain = null;
        
        // Audio sources
        this.rawSource = null;
        this.processedSource = null;
        
        // Audio buffers
        this.rawBuffer = null;
        this.processedBuffer = null;
        
        // Playback state
        this.isPlaying = false;
        this.isWaveDoctorEnabled = false;
        this.startTime = 0;
        this.pauseTime = 0;
        
        // Waveform data array
        this.waveformDataArray = null;
        
        // Initialize audio nodes if context exists
        if (this.audioContext) {
            this.setupAudioNodes();
        }
    }
    
    /**
     * Initialize the Web Audio API context
     */
    initializeAudioContext() {
        try {
            // Create audio context with autoplay policy handling
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            
            // Handle autoplay policy (suspended state)
            if (this.audioContext.state === 'suspended') {
                const resumeAudio = () => {
                    this.audioContext.resume();
                    
                    // Remove event listeners once audio is resumed
                    document.removeEventListener('click', resumeAudio);
                    document.removeEventListener('touchstart', resumeAudio);
                    document.removeEventListener('keydown', resumeAudio);
                };
                
                // Add event listeners to resume audio context on user interaction
                document.addEventListener('click', resumeAudio);
                document.addEventListener('touchstart', resumeAudio);
                document.addEventListener('keydown', resumeAudio);
            }
            
            console.log('Audio context initialized successfully.');
            return true;
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            return false;
        }
    }
    
    /**
     * Set up audio processing nodes
     */
    setupAudioNodes() {
        // Create master gain node
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 1.0;
        
        // Create gain nodes for crossfading
        this.rawGain = this.audioContext.createGain();
        this.processedGain = this.audioContext.createGain();
        
        // Set initial gain values based on Wave Doctor state
        this.rawGain.gain.value = this.isWaveDoctorEnabled ? 0 : 1;
        this.processedGain.gain.value = this.isWaveDoctorEnabled ? 1 : 0;
        
        // Connect gain nodes to master
        this.rawGain.connect(this.masterGain);
        this.processedGain.connect(this.masterGain);
        
        // Create analyzer for visualization
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048; // Large FFT for detailed waveform
        this.analyser.smoothingTimeConstant = 0.3;
        
        // Connect master to analyzer and destination
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        
        // Initialize data array for waveform visualization
        this.waveformDataArray = new Uint8Array(this.analyser.fftSize);
    }
    
    /**
     * Load a pair of raw and processed audio files
     */
    async loadAudioPair(rawUrl, processedUrl) {
        try {
            // Ensure audio context is initialized
            if (!this.audioContext) {
                const success = this.initializeAudioContext();
                if (!success) throw new Error('Could not initialize audio context');
                this.setupAudioNodes();
            }
            
            // Fetch both audio files
            const [rawResponse, processedResponse] = await Promise.all([
                fetch(rawUrl),
                fetch(processedUrl)
            ]);
            
            if (!rawResponse.ok || !processedResponse.ok) {
                throw new Error('Failed to fetch audio files');
            }
            
            // Get array buffers from responses
            const [rawData, processedData] = await Promise.all([
                rawResponse.arrayBuffer(),
                processedResponse.arrayBuffer()
            ]);
            
            // Decode audio data
            const [rawBuffer, processedBuffer] = await Promise.all([
                this.audioContext.decodeAudioData(rawData),
                this.audioContext.decodeAudioData(processedData)
            ]);
            
            // Store buffers
            this.rawBuffer = rawBuffer;
            this.processedBuffer = processedBuffer;
            
            console.log('Audio files loaded successfully.');
            return true;
        } catch (error) {
            console.error('Error loading audio files:', error);
            throw error;
        }
    }
    
    /**
     * Start playback of both raw and processed audio
     * @param {boolean} waveDoctorEnabled - Whether Wave Doctor processing is active
     * @param {number} [startOffset=-1] - Specific time in seconds to start from. -1 means use pause/resume logic.
     */
    startPlayback(waveDoctorEnabled = true, startOffset = -1) {
        if (!this.audioContext || !this.rawBuffer || !this.processedBuffer) {
            console.error('Cannot start playback: audio not loaded');
            return false;
        }

        this.stopPlayback(false);

        this.isWaveDoctorEnabled = waveDoctorEnabled;

        let offset = 0;
        if (startOffset >= 0) { 
            offset = startOffset;
        } else if (this.pauseTime > 0 && this.startTime > 0) { 
            offset = this.pauseTime - this.startTime;
        }
        offset = Math.max(0, offset % this.rawBuffer.duration);


        this.rawSource = this.audioContext.createBufferSource();
        this.rawSource.buffer = this.rawBuffer;
        this.rawSource.connect(this.rawGain);
        this.rawSource.loop = true;

        this.processedSource = this.audioContext.createBufferSource();
        this.processedSource.buffer = this.processedBuffer;
        this.processedSource.connect(this.processedGain);
        this.processedSource.loop = true;

        this.updateCrossfade(this.isWaveDoctorEnabled);

        const now = this.audioContext.currentTime;
        this.rawSource.start(now, offset);
        this.processedSource.start(now, offset);

        this.startTime = now - offset;
        this.pauseTime = 0;

        this.isPlaying = true;
        return true;
    }
    
    /**
     * Stop playback and optionally reset playback position
     */
    stopPlayback(resetPosition = true) {
        if (!this.isPlaying && !this.rawSource && !this.processedSource) return;

        if (this.isPlaying) {
            this.pauseTime = this.audioContext.currentTime;
        }
        
        if (this.rawSource) {
            try {
                this.rawSource.stop();
                this.rawSource.disconnect();
            } catch (e) { /* Ignore */ }
            this.rawSource = null;
        }

        if (this.processedSource) {
            try {
                this.processedSource.stop();
                this.processedSource.disconnect();
            } catch (e) { /* Ignore */ }
            this.processedSource = null;
        }

        if (resetPosition) {
            this.startTime = 0;
            this.pauseTime = 0;
        }
        
        this.isPlaying = false;
    }
    
    /**
     * Set Wave Doctor enabled/disabled state with crossfade
     */
    setWaveDoctorEnabled(enabled) {
        this.isWaveDoctorEnabled = enabled;
        this.updateCrossfade(enabled);
    }
    
    /**
     * Update crossfade between raw and processed audio
     */
    updateCrossfade(useProcessed, fadeTime = 0.1) {
        if (!this.rawGain || !this.processedGain) return;
        
        const now = this.audioContext.currentTime;
        
        // Cancel any scheduled changes
        this.rawGain.gain.cancelScheduledValues(now);
        this.processedGain.gain.cancelScheduledValues(now);
        
        // Set current values
        this.rawGain.gain.setValueAtTime(this.rawGain.gain.value, now);
        this.processedGain.gain.setValueAtTime(this.processedGain.gain.value, now);
        
        // Schedule crossfade
        if (useProcessed) {
            // Fade out raw, fade in processed
            this.rawGain.gain.linearRampToValueAtTime(0, now + fadeTime);
            this.processedGain.gain.linearRampToValueAtTime(1, now + fadeTime);
        } else {
            // Fade in raw, fade out processed
            this.rawGain.gain.linearRampToValueAtTime(1, now + fadeTime);
            this.processedGain.gain.linearRampToValueAtTime(0, now + fadeTime);
        }
    }
    
    /**
     * Seek to a specific position in the audio (0-1 range for full duration)
     */
    seekTo(positionFraction) {
        if (!this.audioContext || !this.rawBuffer) {
            console.warn('Cannot seek: audio not loaded.');
            return false;
        }

        const seekTime = Math.max(0, Math.min(positionFraction, 1)) * this.rawBuffer.duration;

        this.startPlayback(this.isWaveDoctorEnabled, seekTime);
        
        return true;
    }
    
    /**
     * Get the current playback time, wrapped for looping
     */
    getCurrentTime() {
        if (!this.rawBuffer || !this.audioContext) return 0;

        if (this.isPlaying) {
            let currentTime = this.audioContext.currentTime - this.startTime;
            return currentTime % this.rawBuffer.duration;
        } else if (this.pauseTime > 0 && this.startTime > 0) {
            let pausedTime = this.pauseTime - this.startTime;
            return pausedTime % this.rawBuffer.duration;
        }
        return 0;
    }
    
    /**
     * Get the total duration of the loaded audio
     */
    getDuration() {
        return this.rawBuffer ? this.rawBuffer.duration : 0;
    }
    
    /**
     * Get waveform data for visualization
     */
    getWaveformData() {
        if (!this.analyser || !this.waveformDataArray) return null;
        
        // Get time domain data (waveform)
        this.analyser.getByteTimeDomainData(this.waveformDataArray);
        return this.waveformDataArray;
    }
}
