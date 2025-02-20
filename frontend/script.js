let mediaRecorder;
const audioChunks = [];

async function convertWebmToWav(webmBlob) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await webmBlob.arrayBuffer(); // Convert Blob to ArrayBuffer
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer); // Decode audio data

    // Create a buffer source and render
    const wavBlob = await new Promise((resolve) => {
        const wavData = audioBufferToWav(audioBuffer); // Convert to WAV format using a helper function
        const blob = new Blob([wavData], { type: 'audio/wav' });
        resolve(blob);
    });

    return wavBlob;
}

// Helper function for converting audio buffer to WAV format
function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM format

    const result = new Uint8Array(44 + buffer.length * 2); // WAV file header + audio data
    const view = new DataView(result.buffer);

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // file length
    view.setUint32(4, 36 + buffer.length * 2, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (PCM)
    view.setUint16(20, format, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * numChannels * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, numChannels * 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, buffer.length * 2, true);

    // Write PCM samples
    floatTo16BitPCM(view, 44, buffer.getChannelData(0));

    return result;
}

// String writing helper function
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Write samples to PCM
function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i])); // clamp value between -1 and 1
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true); // convert to 16-bit PCM
    }
}


// Event listener to start recording
document.getElementById('startRecord').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = function(event) {
            if (event.data.size > 0) {
                audioChunks.push(event.data); // Collect audio data
            }
        };

mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Create a Blob from the audio data
    console.log("Audio Blob created, Size:", audioBlob.size); // Log the size of the Blob

    // Create an Audio object for playback
    const audioUrl = URL.createObjectURL(audioBlob);
    const audioPlayer = new Audio(audioUrl); // Create a new Audio instance

    // Play the audio automatically
    audioPlayer.play().then(async () => {
        console.log('Playback started');
        
        // Convert the WEBM audio blob to WAV format
        const wavBlob = await convertWebmToWav(audioBlob);
        
        const formData = new FormData();
        formData.append("audio", wavBlob, 'recording.wav'); // Add WAV file to FormData

        // Log FormData content for debugging
        console.log("FormData Contents:", ...formData.entries());

        // Send audio to the Cloud Run URL
        await fetch('https://wally-cloud-run-602876633752.europe-west2.run.app/api/convert-speech', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            document.getElementById('transcription').textContent = `Transcription: ${data.transcription}`;
            console.log('Transcription:', data.transcription);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error during transcription: ' + error.message); // User-friendly error message
        });
    }).catch(error => {
        console.error('Playback failed:', error);
    });
};

        mediaRecorder.start(); // Start recording
        document.getElementById('stopRecord').disabled = false;
        document.getElementById('startRecord').disabled = true;

        console.log('Recording now');
        document.getElementById('recordingStatus').textContent = "Recording..."; // Show recording status

    } catch (error) {
        console.error("Could not start recording:", error);
        alert("Recording permissions denied. Please check your microphone settings.");
    }
});

// Event listener to stop recording
document.getElementById('stopRecord').addEventListener('click', () => {
    mediaRecorder.stop(); // Stop recording
    document.getElementById('stopRecord').disabled = true;
    document.getElementById('startRecord').disabled = false;

    // Optional: You can display a message here indicating that recording has stopped
    console.log('Recording stopped');
});
