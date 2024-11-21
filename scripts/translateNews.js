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
                "content": `Translate to Czech, convert time to CET (remove time zone name/shortcut CET too):\n${textForTranslation}`,
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
		console.log(response);
        const result = response.data.choices[0]?.message?.content;
        console.log('Translation Result:', result);
    })
    .catch(error => {
        console.error('Error:', error.response ? error.response.data : error.message);
    });
});
