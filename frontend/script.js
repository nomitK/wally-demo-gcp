let mediaRecorder;
const audioChunks = [];

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
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append("audio", audioBlob, 'recording.webm');

            // Log formData content for debugging
            console.log(...formData.entries());

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
                alert('Error during transcription: ' + error.message); // User-friendly error
            });
        };

        mediaRecorder.start(); // Start recording
        document.getElementById('stopRecord').disabled = false;
        document.getElementById('startRecord').disabled = true;

        // Optional: Update button text or status message
        document.getElementById('recordingStatus').textContent = "Recording..."; // Update a status message

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
    audioChunks.length = 0; // Clear audio chunks for the next recording session

    // Optional: Reset status message
    document.getElementById('recordingStatus').textContent = ""; // Reset status message
});
