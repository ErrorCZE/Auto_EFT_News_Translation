const fs = require('fs');
const axios = require('axios');
const path = require('path');
const sendToDiscord = require('./sendToDiscord');
require('dotenv').config();

// Define file paths
const textFilePath = path.resolve(__dirname, '../data/text.txt');
const imageFilePath = path.resolve(__dirname, '../data/news-img.jpg');

async function translateAndSendNews() {
    try {
        // Validate environment variables
        if (!process.env.API_URL || !process.env.API_TOKEN) {
            throw new Error("Missing environment variables: API_URL or API_TOKEN.");
        }

        // Read the text for translation
        if (!fs.existsSync(textFilePath)) {
            throw new Error("Text file for translation does not exist.");
        }
        const textForTranslation = fs.readFileSync(textFilePath, 'utf8');

        // Detect the game based on hashtags
        let detectedGame = null;
        const lowerCaseText = textForTranslation.toLowerCase();

        if (lowerCaseText.includes('#tarkovarena') && lowerCaseText.includes('#escapefromtarkov')) {
            detectedGame = 'default';
        } else if (lowerCaseText.includes('#tarkovarena')) {
            detectedGame = 'arena';
        } else if (lowerCaseText.includes('#escapefromtarkov')) {
            detectedGame = 'tarkov';
        } else {
            detectedGame = 'default';
        }

        // Construct the translation request payload
        const jsonPayload = {
            model: "mistral-large-latest",
            messages: [
                {
                    "role": "user",
                    "content": `Translate this text to Czech language, USE FRIENDLY WORDING (informal/casual) but for more people, not one! Text can be related to game "Escape from Tarkov" or "Escape from Tarkov Arena". If there is time convert it to CET (remove time zone name/shortcut CET too), keep map & item & gamemode names as they are. Use discord markdown formatting style (#, ##, ### for headings, **text** for bold, [text other than link](<link>) for hidden links etc.) Remove all hashtags if present (keep them if they are the only text here and nothing else), i wrote you game names you can use them. TRANSLATE TEXT TO CZECH LANGUAGE FROM ENGLISH, USE FRIENDLY WORDING (informal/casual) but for more people, not one. GIVE ME JUST RAW CZECH TRANSLATED RESULT:\n${textForTranslation}`
                }
            ],
            n: 1,
        };

        // Send the translation request
        const response = await axios.post(process.env.API_URL, jsonPayload, {
            headers: {
                Authorization: `Bearer ${process.env.API_TOKEN}`,
                "Content-Type": "application/json",
            },
        });

        // Check for translated text and prepare to send to Discord
        const hasNewImage = fs.existsSync(imageFilePath);
        const translatedText = response.data.choices[0]?.message?.content;

        if (!translatedText) {
            throw new Error("Translation API did not return a valid response.");
        }

        // Send translated message to Discord
        await sendToDiscord(translatedText, hasNewImage, detectedGame);

        console.log(`[INFO] Translation cost: ${response.data.usage.total_tokens} (P: ${response.data.usage.prompt_tokens} C: ${response.data.usage.completion_tokens})`);
        console.log('[INFO] Translation result:', translatedText);

    } catch (error) {
        console.error('Error in translation process:', error.response ? error.response.data : error.message);
    }
}

module.exports = translateAndSendNews;
