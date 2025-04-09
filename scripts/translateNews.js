const fs = require('fs');
const axios = require('axios');
const path = require('path');
const sendToDiscord = require('./sendToDiscord');
const { DateTime } = require('luxon');
require('dotenv').config();

function getPragueTime() {
    return DateTime.now().setZone('Europe/Prague').toFormat('yyyy-MM-dd HH:mm:ss');
}

// Define file paths
const textFilePath = path.resolve(__dirname, '../data/text.txt');
const imageFilePath = path.resolve(__dirname, '../data/news-img.jpg');

// OpenRouter API details
const API_KEY = process.env.API_KEY;

async function translateAndSendNews() {
    try {
        console.log(`[${getPragueTime()}] Starting translation process...`);

        if (!API_KEY) {
            throw new Error("Missing environment variable: API_KEY");
        }

        if (!fs.existsSync(textFilePath)) {
            throw new Error("Text file for translation does not exist.");
        }

        const textForTranslation = fs.readFileSync(textFilePath, 'utf8');
        console.log(`[${getPragueTime()}] Text for translation loaded:\n${textForTranslation}`);

        // Detect game
        let detectedGame = 'default';
        const lowerCaseText = textForTranslation.toLowerCase();

        if (lowerCaseText.includes('#tarkovarena') && lowerCaseText.includes('#escapefromtarkov')) {
            detectedGame = 'default';
        } else if (lowerCaseText.includes('#tarkovarena')) {
            detectedGame = 'arena';
        } else if (lowerCaseText.includes('#escapefromtarkov')) {
            detectedGame = 'tarkov';
        }

        console.log(`[${getPragueTime()}] Detected game: ${detectedGame}`);

        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'deepseek/deepseek-chat-v3-0324:free',
            messages: [
                {
                    role: 'user',
                    content: `Translate the following text into Czech using informal tone suitable for a group of people, not just one person.
                    
- If the text contains a time, convert it to CET and remove the time zone abbreviation.
- Keep map names, item names, and game mode names unchanged.
- Translate quest/task goals to czech too, but using the base verb form if it is (Eliminate, Capture, etc...), not the imperative. Do not translate quest/task names.
- Format the output:
  - #, ##, or ### for main info from the message.
  - [text](<link>) for links - replace text with actual text and link with actual link for example like "[Patchnotes pro EFT](<https://www.escapefromtarkov.com/news/id/340>)"
  - *italic*, **bold**, and **underline** where appropriate.
  - Alwys use # for the first line of the message as title of message.
- Remove all hashtags unless they are the only text in a line.
- The text may relate to *Escape from Tarkov* or *Escape from Tarkov Arena*, so you can use these names as they are.
- Try to split it into more lines giving some sense and meaning to the text.

Provide only the raw Czech translation:

${textForTranslation}`
                }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            }
        });

        if (!response.data.choices || response.data.choices.length === 0) {
            throw new Error("Translation API did not return a valid response.");
        }

        const translatedText = response.data.choices[0].message.content;
        console.log(`[${getPragueTime()}] Translation received:\n${translatedText}`);

        const hasNewImage = fs.existsSync(imageFilePath);
        console.log(`[${getPragueTime()}] Image file exists: ${hasNewImage}`);

        await sendToDiscord(translatedText, hasNewImage, detectedGame);
        console.log(`[${getPragueTime()}] Translation sent to Discord successfully.`);

    } catch (error) {
        console.error(`[${getPragueTime()}] Error in translation process:`, error.response ? error.response.data : error.message);
    }
}

module.exports = translateAndSendNews;
