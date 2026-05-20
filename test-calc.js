const bitRate = 900;
const suffix = "flac";
function getAudioInfo(bitRate, suffix) {
    if (!bitRate) return "Unknown";
    
    // Simple logic based on kbps
    let bitDepth = 16;
    let sampleRate = 44.1;
    
    if (bitRate > 1500) {
        bitDepth = 24;
        sampleRate = bitRate > 3000 ? 192 : 96;
    } else if (bitRate > 1100 && suffix !== 'flac') {
       sampleRate = 48;
    }
    
    return `${bitDepth}bit ${sampleRate}kHz (${suffix.toUpperCase()})`;
}
console.log(getAudioInfo(bitRate, suffix));
