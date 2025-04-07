const fs = require('fs');
const axios = require('axios');
const path = require('path');
const sendToDiscord = require('./sendToDiscord');
require('dotenv').config();

// Define file paths
const textFilePath = path.resolve(__dirname, '../data/text.txt');
const imageFilePath = path.resolve(__dirname, '../data/news-img.jpg');

// OpenRouter API details
const API_KEY = process.env.API_KEY; // Store this in your .env file

async function translateAndSendNews() {
    try {
        // Validate environment variables
        if (!API_KEY) {
            throw new Error("Missing environment variable: API_KEY");
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

        // Send translation request using OpenRouter API with axios
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'deepseek/deepseek-chat-v3-0324:free',
            messages: [
                {
                    role: 'user',
                    content: `Translate the following text into Czech using informal tone suitable for a group of people, not just one person.
                    
- If the text contains a time, convert it to CET and remove the time zone abbreviation.
- Keep map names, item names, and game mode names unchanged.
- Translate quest/task goals to czech too, but using the base verb form if it is (Eliminate, Capture, etc...), not the imperative. Do not translate quest/task names.
- Format the output using Discord markdown:
  - #, ##, or ### for main info from the message.
  - [hidden text](<link>) for hidden links.
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
        
        // Extract translated text
        if (!response.data.choices || response.data.choices.length === 0) {
            throw new Error("Translation API did not return a valid response.");
        }
        
        const translatedText = response.data.choices[0].message.content;
        
        // Check for image and send to Discord
        const hasNewImage = fs.existsSync(imageFilePath);
        await sendToDiscord(translatedText, hasNewImage, detectedGame);

        console.log('[INFO] Translation completed successfully');
        console.log('[INFO] Translation result:', translatedText);

    } catch (error) {
        console.error('Error in translation process:', error.response ? error.response.data : error.message);
    }
}

module.exports = translateAndSendNews;