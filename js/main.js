/**
 * Wave Doctor Demo - Main Application
 * 
 * This script initializes the demo and coordinates the audio and visualization components.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Select all example sections
    const exampleSections = document.querySelectorAll('.wave-doctor-example');

    // Initialize audio context and analyzer
    const audioManager = new WaveDoctorAudioManager();
    
    // Track currently playing example
    let currentlyPlayingSection = null;

    // Initialize each example section
    exampleSections.forEach((section) => {
        // Get UI elements within this section
        const playButton = section.querySelector('.play-button');
        const waveDoctorToggle = section.querySelector('.wave-doctor-toggle');
        const waveformCanvas = section.querySelector('.waveform-canvas');
        const timeDisplay = section.querySelector('.time-display');
        const loadingOverlay = section.querySelector('.waveform-overlay');
        
        // Get audio file basename from data attribute
        const audioBasename = section.dataset.audioBasename;
        
        // Get section theme color
        const sectionColor = section.dataset.color || 'blue';
        
        // Ensure canvas dimensions match its display size
        resizeCanvas(waveformCanvas);
        
        // Create a player for this section
        const player = {
            section,
            playButton,
            waveDoctorToggle,
            timeDisplay,
            waveformCanvas,
            loadingOverlay,
            isPlaying: false,
            isLoaded: false,
            animationId: null,
            colorTheme: getColorTheme(sectionColor),
        };

        // Function to load and initialize audio for a player
        function loadAndSetupAudio(currentAudioBasename, startPlaying = false) {
            player.isLoaded = false;
            playButton.disabled = true;
            waveDoctorToggle.disabled = true;
            loadingOverlay.classList.remove('hidden');
            if (loadingOverlay.querySelector('.loading-indicator div[style*="color: red"]')) {
                loadingOverlay.querySelector('.loading-indicator').innerHTML = '<div class="loading-spinner"></div><span>Loading audio...</span>';
            }
            // If any audio is playing, stop it and reset its UI
            if (currentlyPlayingSection) {
                if (currentlyPlayingSection.isPlaying) {
                    audioManager.stopPlayback(true); // Stop and reset position
                    currentlyPlayingSection.isPlaying = false;
                    currentlyPlayingSection.playButton.textContent = 'Play';
                    if (currentlyPlayingSection.animationId) {
                        cancelAnimationFrame(currentlyPlayingSection.animationId);
                        currentlyPlayingSection.animationId = null;
                    }
                    drawStaticWaveform(currentlyPlayingSection.waveformCanvas, currentlyPlayingSection.colorTheme.light, currentlyPlayingSection.colorTheme.mid);
                }
                if (currentlyPlayingSection !== player) { // Only reset if it wasn't this player
                    currentlyPlayingSection.timeDisplay.textContent = `0:00 / ${formatTime(audioManager.getDuration() || 0)}`;
                }
            }
            currentlyPlayingSection = null; // Reset global playing section tracker

            const newRawPath = `audio/${currentAudioBasename}.mp3`;
            const newProcessedPath = `audio/${currentAudioBasename}-wd.mp3`;

            audioManager.loadAudioPair(newRawPath, newProcessedPath)
                .then(() => {
                    player.isLoaded = true;
                    playButton.disabled = false;
                    waveDoctorToggle.disabled = false;
                    loadingOverlay.classList.add('hidden');
                    const duration = audioManager.getDuration();
                    timeDisplay.textContent = `0:00 / ${formatTime(duration)}`;
                    drawStaticWaveform(waveformCanvas, player.colorTheme.light, player.colorTheme.mid);

                    if (startPlaying) {
                        // Ensure audio context is running if previously suspended
                        if (audioManager.audioContext && audioManager.audioContext.state === 'suspended') {
                            audioManager.audioContext.resume();
                        }
                        audioManager.startPlayback(waveDoctorToggle.checked, 0); // Start from beginning
                        player.isPlaying = true;
                        playButton.textContent = 'Pause';
                        startWaveformAnimation(player, audioManager);
                        currentlyPlayingSection = player;
                    }
                })
                .catch(error => {
                    console.error('Error loading audio:', error);
                    loadingOverlay.querySelector('.loading-indicator').innerHTML =
                        '<div style="color: red;">Error loading audio</div>';
                    timeDisplay.textContent = '0:00 / 0:00';
                    drawStaticWaveform(waveformCanvas, player.colorTheme.light, player.colorTheme.mid); // Show static on error
                });
        }

        // Initial load for the section
        loadAndSetupAudio(audioBasename);

        // Specific logic for drum examples if they exist in this section
        const drumExampleToggles = section.querySelector('.drum-example-toggles');
        if (drumExampleToggles) {
            const drumButtons = drumExampleToggles.querySelectorAll('.drum-example-btn');
            drumButtons.forEach(button => {
                button.addEventListener('click', () => {
                    if (button.classList.contains('active')) return; // Do nothing if already active

                    drumButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');

                    const exampleIndex = button.dataset.exampleIndex;
                    const newDrumBasename = `drums_${exampleIndex}`;
                    
                    // Set this new basename on the section's dataset for consistency if needed elsewhere
                    section.dataset.audioBasename = newDrumBasename;

                    // Load the new drum audio and start playing it
                    loadAndSetupAudio(newDrumBasename, true);
                });
            });
        }

        // Set up play/pause button
        playButton.addEventListener('click', () => {
            if (player.isPlaying) {
                // Stop playback
                audioManager.stopPlayback();
                player.isPlaying = false;
                playButton.textContent = 'Play';
                
                // Stop animation
                if (player.animationId) {
                    cancelAnimationFrame(player.animationId);
                    player.animationId = null;
                }
                
                // Draw static waveform
                drawStaticWaveform(waveformCanvas, player.colorTheme.light, player.colorTheme.mid);
                
                currentlyPlayingSection = null;
            } else {
                // If another section is playing, stop it first
                if (currentlyPlayingSection && currentlyPlayingSection !== player) {
                    currentlyPlayingSection.isPlaying = false;
                    currentlyPlayingSection.playButton.textContent = 'Play';
                    
                    if (currentlyPlayingSection.animationId) {
                        cancelAnimationFrame(currentlyPlayingSection.animationId);
                        currentlyPlayingSection.animationId = null;
                    }
                    
                    // Draw static waveform for the previously playing section
                    drawStaticWaveform(
                        currentlyPlayingSection.waveformCanvas, 
                        currentlyPlayingSection.colorTheme.light,
                        currentlyPlayingSection.colorTheme.mid
                    );
                }
                
                // Start playback with current Wave Doctor state
                audioManager.startPlayback(waveDoctorToggle.checked);
                player.isPlaying = true;
                playButton.textContent = 'Pause';
                
                // Start animation loop
                startWaveformAnimation(player, audioManager);
                
                // Track currently playing section
                currentlyPlayingSection = player;
            }
        });

        // Set up Wave Doctor toggle
        waveDoctorToggle.addEventListener('change', () => {
            const isEnabled = waveDoctorToggle.checked;
            audioManager.setWaveDoctorEnabled(isEnabled);
        });
        
        // Make waveform clickable for seeking
        waveformCanvas.addEventListener('click', (event) => {
            if (!player.isLoaded) return;
            
            const rect = waveformCanvas.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const seekPosition = clickX / rect.width;
            
            // Seek to position (0-1)
            audioManager.seekTo(seekPosition);
            
            // Update time display
            const duration = audioManager.getDuration();
            const currentTime = duration * seekPosition;
            timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
            
            // If not playing, start playback
            if (!player.isPlaying) {
                playButton.click();
            }
        });
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        exampleSections.forEach(section => {
            const canvas = section.querySelector('.waveform-canvas');
            resizeCanvas(canvas);
        });
    });
});

/**
 * Initialize canvas dimensions to match display size
 */
function resizeCanvas(canvas) {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    
    // Scale canvas context to account for device pixel ratio
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

/**
 * Start the waveform animation for a player
 */
function startWaveformAnimation(player, audioManager) {
    // Stop any existing animation
    if (player.animationId) {
        cancelAnimationFrame(player.animationId);
    }
    
    // Animation loop
    function animate() {
        if (!player.isPlaying) return;
        
        // Get current playback time and duration
        const currentTime = audioManager.getCurrentTime();
        const duration = audioManager.getDuration();
        
        // Update time display
        player.timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
        
        // Draw waveform frame
        drawWaveform(
            player.waveformCanvas, 
            audioManager.getWaveformData(),
            currentTime / duration, // Playback position as 0-1
            player.waveDoctorToggle.checked,
            player.colorTheme
        );
        
        // Continue animation
        player.animationId = requestAnimationFrame(animate);
    }
    
    // Start animation loop
    animate();
}

/**
 * Draw a static placeholder waveform when not playing
 */
function drawStaticWaveform(canvas, bgColor, strokeColor) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    
    // Clear canvas
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
    
    // Draw center line
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw example waveform shape (sine wave)
    ctx.beginPath();
    const amplitude = height * 0.3;
    const frequency = 0.01;
    
    for (let x = 0; x < width; x++) {
        const y = (height / 2) + Math.sin(x * frequency) * amplitude;
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();
}

/**
 * Get color theme based on section color
 */
function getColorTheme(color) {
    const themes = {
        blue: {
            light: '#dbeafe',
            mid: '#3b82f6',
            dark: '#1d4ed8'
        },
        purple: {
            light: '#e9d5ff',
            mid: '#a855f7',
            dark: '#7e22ce'
        },
        teal: {
            light: '#ccfbf1',
            mid: '#14b8a6',
            dark: '#0f766e'
        },
        amber: {
            light: '#fef3c7',
            mid: '#f59e0b',
            dark: '#b45309'
        }
    };
    
    return themes[color] || themes.blue;
}

/**
 * Format time in seconds to MM:SS format
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
