let mediaRecorder;
const audioChunks = [];

async function convertWebmToWav(webmBlob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const arrayBuffer = reader.result;

                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                // Create an OfflineAudioContext with the desired sample rate
                const offlineContext = new OfflineAudioContext({
                    numberOfChannels: 1,
                    length: audioBuffer.length,
                    sampleRate: 16000 // Desired sample rate
                });

                const source = offlineContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(offlineContext.destination);
                source.start();

                offlineContext.startRendering().then(renderedBuffer => {
                    // Convert rendered audio buffer to a WAV file
                    const wavArrayBuffer = audioBufferToWav(renderedBuffer); // Function that converts audio buffer to WAV
                    const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
                    resolve(wavBlob);
                }).catch(renderingError => {
                    reject(new Error("Rendering failed: " + renderingError.message));
                });
            } catch (error) {
                reject(new Error("Conversion failed: " + error.message));
            }
        };

        reader.onerror = error => reject(new Error("FileReader error: " + error.message));
        reader.readAsArrayBuffer(webmBlob);
    });
}

function audioBufferToWav(audioBuffer) {
    // Utility function to convert an AudioBuffer to a WAV ArrayBuffer
    var numOfChan = audioBuffer.numberOfChannels,
        length = audioBuffer.length * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    // Write WAV header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this demo)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (i = 0; i < audioBuffer.numberOfChannels; i++) channels.push(audioBuffer.getChannelData(i));

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) { // interleave channels
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
            view.setInt16(pos, sample, true); // write 16-bit sample
            pos += 2;
        }
        offset++; // next source sample
    }

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }

    return buffer;
}


// Event listener to start recording
document.getElementById('startRecord').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks.length = 0; // Ensure the audioChunks array is cleared before starting the recording

        mediaRecorder.ondataavailable = function(event) {
            if (event.data.size > 0) {
                audioChunks.push(event.data); // Collect audio data
            }
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            console.log("Audio Blob created, Size:", audioBlob.size);

            const audioUrl = URL.createObjectURL(audioBlob);
            const audioPlayer = new Audio(audioUrl);
            audioPlayer.play().then(async () => {
                console.log('Playback started');

                // Convert the WEBM audio blob to WAV format
                const wavBlob = await convertWebmToWav(audioBlob);
                
                const formData = new FormData();
                formData.append("audio", wavBlob, 'recording.wav');

                // Send audio to the Cloud Run URL for transcription
                const transcriptionResponse = await fetch('https://wally-cloud-run-602876633752.europe-west2.run.app/api/convert-speech', {
                    method: 'POST',
                    body: formData
                });

                if (!transcriptionResponse.ok) {
                    throw new Error("Network response was not ok: " + transcriptionResponse.statusText);
                }

                const transcriptionData = await transcriptionResponse.json();
                document.getElementById('transcription').textContent = `Transcription: ${transcriptionData.transcription}`;
                console.log('Transcription:', transcriptionData.transcription);

                // Send transcription to Generative AI for further processing
                await sendToGenerativeAI(transcriptionData.transcription);
            }).catch(error => {
                console.error('Playback failed:', error);
            });
        };

        mediaRecorder.start(); // Start recording
        document.getElementById('stopRecord').disabled = false;
        document.getElementById('startRecord').disabled = true;

        console.log('Recording now');
        document.getElementById('recordingStatus').textContent = "Recording...";
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

    console.log('Recording stopped');
});

// Function to send transcription directly to Generative AI
async function sendToGenerativeAI(transcription) {
    const apiKey = "AIzaSyCdrUb7yvO2XHAfM1IoQWFcOthyAqKZLyg"; // Use your actual API key

    console.log('Transcription being sent to AI:', transcription); // Log the transcription being sent

    // Prepare the request payload
    const requestData = {
        contents: [{
            parts: [{
                text: transcription // Set transcription as the text part
            }]
        }]
    };

    try {
        // Sending POST request to the Generative Language API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json' // Indicate the request body type
            },
            body: JSON.stringify(requestData) // Convert the request data to JSON format
        });

        // Check if the response is ok (status in the range 200-299)
        if (!response.ok) {
            const errorResponse = await response.json(); // Get the error details
            throw new Error("Network response was not ok: " + errorResponse.error);
        }

        // Parse the JSON response from the AI service
        const responseData = await response.json();
        console.log('Complete Response Data:', responseData); // Log complete response data

        // Access the first candidate, assuming it's structured correctly
        if (responseData.candidates && responseData.candidates.length > 0) {
            const generatedText = responseData.candidates[0].text; // Adjust based on the actual structure of the candidates
            document.getElementById('aiResponse').textContent = `Generative AI Response: ${generatedText}`; // Display the generated response
            console.log('Generative AI Response:', generatedText); // Log the response
        } else {
            console.error('Unexpected response structure:', responseData);
            alert('Unexpected response from AI service. Prompt might not have generated content.');
        }

    } catch (error) {
        // Handle any errors that occur during the fetch or processing
        console.error('Error sending to Generative AI:', error);
        alert('Error during AI request: ' + error.message); // User-friendly error message
    }
}
