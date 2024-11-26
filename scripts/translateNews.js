require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sendToDiscord = require('./sendToDiscord');

const textFilePath = path.join(__dirname, '../data/text.txt');
const imageFilePath = path.join(__dirname, '../data/news-img.jpg');

async function translateAndSendNews() {
    try {
        const textForTranslation = fs.readFileSync(textFilePath, 'utf8');

        let detectedGame = null;
        if (textForTranslation.includes('#TarkovArena') && textForTranslation.includes('#EscapeFromTarkov')) {
            detectedGame = 'default';
        } else if (textForTranslation.includes('#TarkovArena')) {
            detectedGame = 'arena';
        } else if (textForTranslation.includes('#EscapefromTarkov')) {
            detectedGame = 'tarkov';
        } else {
            detectedGame = 'default';
        }

        const jsonPayload = {
            model: "mistral-large-latest",
            messages: [
                {
                    role: "user",
                    content: `Translate this text related to game Escape from Tarkov from English to Czech, if there is time convert it to CET (remove time zone name/shortcut CET too), keep map names etc in English if it is patch notes. You can also give it little formatting like titles etc using its markdown (Discord), remove all hashtags if any, GIVE ME JUST RAW RESULT:\n${textForTranslation}`,
                },
            ],
            n: 1,
        };

        const response = await axios.post(process.env.API_URL, jsonPayload, {
            headers: {
                Authorization: `Bearer ${process.env.API_TOKEN}`,
                "Content-Type": "application/json",
            },
        });

        const hasNewImage = fs.existsSync(imageFilePath);

        const translatedText = response.data.choices[0]?.message?.content;

        await sendToDiscord(translatedText, hasNewImage, detectedGame);

        console.log(`[INFO] Translation cost: ${response.data.usage.total_tokens} (P: ${response.data.usage.prompt_tokens} C: ${response.data.usage.completion_tokens})`);
        console.log('[INFO] Translation result:', translatedText);
    } catch (error) {
        console.error('Error in translation process:', error.response ? error.response.data : error.message);
    }
}

module.exports = translateAndSendNews;

if (require.main === module) {
    translateAndSendNews();
}