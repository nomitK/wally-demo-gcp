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
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Create a Blob from the audio data
            console.log("Audio Blob created, Size:", audioBlob.size); // Log the size of the Blob
            
            const formData = new FormData();
            formData.append("audio", audioBlob, 'recording.webm'); // Add audio file to FormData

            // Log FormData content for debugging
            console.log("FormData Contents:", ...formData.entries());

            // Send audio to the Cloud Run URL
            try {
                const response = await fetch('https://wally-cloud-run-602876633752.europe-west2.run.app/api/convert-speech', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error("Network response was not ok: " + response.statusText);
                }

                const data = await response.json();
                document.getElementById('transcription').textContent = `Transcription: ${data.transcription}`;
                console.log('Transcription:', data.transcription);
            } catch (error) {
                console.error('Error during transcription:', error);
                alert('Error during transcription: ' + error.message); // User-friendly error message
            } finally {
                // Clear audio chunks after processing
                audioChunks.length = 0; // Clear audio chunks for the next recording session
                document.getElementById('recordingStatus').textContent = ""; // Reset status message
            }
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
