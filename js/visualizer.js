/**
 * Wave Doctor Visualizer
 * 
 * Handles waveform visualization on canvas elements.
 * Simplified from your existing visualizer.js
 */

/**
 * Draw waveform visualization with playback position indicator
 */
function drawWaveform(canvas, dataArray, playbackPosition, isWaveDoctorEnabled, colorTheme) {
    if (!canvas || !dataArray) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    
    // Clear canvas with theme background color
    ctx.fillStyle = colorTheme.light;
    ctx.fillRect(0, 0, width, height);
    
    // Draw center line
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw playback position line
    const positionX = Math.max(0, Math.min(1, playbackPosition)) * width;
    ctx.beginPath();
    ctx.moveTo(positionX, 0);
    ctx.lineTo(positionX, height);
    ctx.strokeStyle = colorTheme.dark;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Draw waveform
    ctx.beginPath();
    
    // Select color based on Wave Doctor state
    ctx.strokeStyle = isWaveDoctorEnabled ? colorTheme.mid : '#718096';
    ctx.lineWidth = 2;
    
    // Calculate how many points to skip for performance
    const skipFactor = Math.ceil(dataArray.length / width);
    const verticalScale = isWaveDoctorEnabled ? 1.2 : 1.0; // Make processed waveform slightly larger
    
    for (let i = 0; i < dataArray.length; i += skipFactor) {
        const x = (i / dataArray.length) * width;
        
        // Normalize data from 0-255 to -1 to 1
        const normalizedData = ((dataArray[i] / 128.0) - 1.0) * verticalScale;
        
        // Calculate y position (center + offset)
        const y = (height / 2) + normalizedData * (height / 2) * 0.9;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    ctx.stroke();
    
    // Add visual effect for past vs future audio
    // Draw semi-transparent overlay over the "future" part of the waveform
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(positionX, 0, width - positionX, height);
}

/**
 * Generate a fake waveform when actual data isn't available
 * (Used for initial display and when audio isn't playing)
 */
function generateFakeWaveformData(length, complexity = 3) {
    const data = new Uint8Array(length);
    
    // Fill with a sine wave approximation
    for (let i = 0; i < length; i++) {
        let value = 128; // Center value
        
        // Add several sine waves at different frequencies for a more complex waveform
        for (let j = 1; j <= complexity; j++) {
            const amplitude = 40 / j; // Diminishing amplitude for higher harmonics
            const frequency = j * (Math.PI * 2) / length;
            value += Math.sin(i * frequency * j) * amplitude;
        }
        
        // Add some random noise
        value += (Math.random() - 0.5) * 10;
        
        // Clamp to 0-255
        data[i] = Math.max(0, Math.min(255, Math.round(value)));
    }
    
    return data;
}
