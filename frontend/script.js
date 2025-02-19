let mediaRecorder;
const audioChunks = [];

document.getElementById('startRecord').addEventListener('click', async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = function(event) {
        if (event.data.size > 0) {
            audioChunks.push(event.data); // Coletar dados de áudio
        }
    };

    mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Criar um Blob do áudio

        const formData = new FormData();
        formData.append("audio", audioBlob, 'recording.webm'); // Nome do arquivo

        // Enviar a gravação para o servidor
        await fetch('http://localhost:8080/transcribe', { // Chamada ao endpoint
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            document.getElementById('transcription').textContent = `Transcrição: ${data.transcription}`;
            console.log('Transcrição:', data.transcription);
        })
        .catch(error => {
            console.error('Erro:', error);
        });
    };

    mediaRecorder.start();
    document.getElementById('stopRecord').disabled = false;
    document.getElementById('startRecord').disabled = true;
});

document.getElementById('stopRecord').addEventListener('click', () => {
    mediaRecorder.stop();
    document.getElementById('stopRecord').disabled = true;
    document.getElementById('startRecord').disabled = false;
});
