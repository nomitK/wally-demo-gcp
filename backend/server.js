const express = require('express');
const fs = require('fs');
const speech = require('@google-cloud/speech');
const multer = require('multer');

// Crie um cliente de reconhecimento de fala
const client = new speech.SpeechClient();

// Configurar o middleware multer
const upload = multer({ dest: 'uploads/' });

const app = express();
const PORT = process.env.PORT || 8080;

// Endpoint para receber o áudio gravado
app.post('/transcribe', upload.single('audio'), async (req, res) => {
    try {
        const fileName = req.file.path; // Obtém o caminho do arquivo enviado
        const file = fs.readFileSync(fileName);
        const audioBytes = file.toString('base64');

        const audio = {
            content: audioBytes,
        };

        const config = {
            encoding: 'WEBM', // Ajuste conforme o tipo de arquivo recebido
            sampleRateHertz: 16000,
            languageCode: 'en-US', // Código do idioma desejado para inglês
        };

        const request = {
            audio: audio,
            config: config,
        };

        const [response] = await client.recognize(request);
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');

        res.send({ transcription });

        // Limpar o arquivo de áudio após o processamento
        fs.unlinkSync(fileName);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao transcrever áudio');
    }
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
