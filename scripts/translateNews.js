require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const textFilePath = path.join(__dirname, '../data/text.txt');

fs.readFile(textFilePath, 'utf8', (err, textForTranslation) => {
    if (err) {
        console.error('Error reading the file:', err);
        return;
    }

    const jsonPayload = {
        "model": "mistral-large-latest",
        "messages": [
            {
                "role": "user",
                "content": `Translate this text related to game Escape from Tarkov from English to Czech, if there is time convert itto CET (remove time zone name/shortcut CET too), keep map names etc in English if it is patchnotes. GIVE ME JUST RAW RESULT:\n${textForTranslation}`,
            }
        ],
        "n": 1
    };

    axios.post(process.env.API_URL, jsonPayload, {
        headers: {
            "Authorization": `Bearer ${process.env.API_TOKEN}`,
            "Content-Type": "application/json"
        }
    })
    .then(response => {
		console.log(`[INFO] Translation cost: ${response.data.usage.total_tokens} (P: ${response.data.usage.prompt_tokens} C: ${response.data.usage.completion_tokens})`);
        const result = response.data.choices[0]?.message?.content;
        console.log('[INFO] Translation result:', result);
    })
    .catch(error => {
        console.error('Error:', error.response ? error.response.data : error.message);
    });
});
