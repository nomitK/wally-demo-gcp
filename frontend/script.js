let mediaRecorder;
const audioChunks = [];

async function convertWebmToWav(webmBlob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const arrayBuffer = reader.result;

            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Ensure the sample rate is either adjusted here or in the subsequent step
            const offlineContext = new OfflineAudioContext(1, audioBuffer.length, 16000); // setting to 16000 or your desired rate
            const source = offlineContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(offlineContext.destination);
            source.start();
            
            offlineContext.startRendering().then(wavBuffer => {
                const wavBlob = new Blob([new DataView(wavBuffer)], { type: 'audio/wav' });
                resolve(wavBlob);
            }).catch(reject);
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(webmBlob);
    });
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
