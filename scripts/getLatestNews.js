const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const sendToDiscord = require('./sendToDiscord');
const translateAndSendNews = require('./translateNews');
require('dotenv').config();

async function fetchLatestMessage() {
    let hasNewMessage = false;
    try {
        const { data } = await axios.get(process.env.SCRAPE_URL);
        const $ = cheerio.load(data);

        const latestMessageElement = $('.tgme_widget_message').last();
        const latestMessage = latestMessageElement.find('.tgme_widget_message_text').text().trim();

        const latestImageWrap = latestMessageElement.find('.tgme_widget_message_photo_wrap').first();
        const imageUrl = latestImageWrap.length > 0 ? latestImageWrap.attr('style') : null;
        const matchedUrl = imageUrl ? imageUrl.match(/url\(['"]?(.*?)['"]?\)/) : null;
        const latestImageUrl = matchedUrl ? matchedUrl[1] : null;

        const dataFilePath = path.resolve(__dirname, '../data/text.txt');
        const imageFilePath = path.resolve(__dirname, '../data/news-img.jpg');

        // Ensure data directory exists
        if (!fs.existsSync(path.dirname(dataFilePath))) {
            fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
        }

        // Check for new message
        const currentText = fs.existsSync(dataFilePath) ? fs.readFileSync(dataFilePath, 'utf8') : '';

        if (latestMessage !== currentText) {
            console.log(`[INFO] New message detected.`);
            console.log(`[INFO] Message: ${latestMessage}`);
            fs.writeFileSync(dataFilePath, latestMessage, 'utf8');
            hasNewMessage = true;
        } else {
            console.log(`[INFO] No new messages.`);
        }

        // Handle image
        if (latestImageUrl && hasNewMessage) {
            try {
                console.log("[INFO] New image detected in latest message. Downloading...");
                const response = await axios.get(latestImageUrl, { responseType: 'arraybuffer' });
                fs.writeFileSync(imageFilePath, response.data);
                console.log("[INFO] Image saved as news-img.jpg");
            } catch (imgError) {
                console.error("[ERROR] Failed to download the image:", imgError.message);
            }
        } else if (hasNewMessage && fs.existsSync(imageFilePath)) {
            fs.unlinkSync(imageFilePath);
            console.log("[INFO] Removed old image file since new message has no image.");
        }

        // Detect simple links or hashtags first
        const isSimpleLinkOrHashtag = /^https?:\/\/\S+$/i.test(latestMessage) ||
            /^#\w+$/i.test(latestMessage) ||
            /^(#\w+\s*)?(https?:\/\/\S+)(\s*#\w+)?$/i.test(latestMessage);

        if (isSimpleLinkOrHashtag) {
            // Detect the game first before cleaning the message
            let detectedGame = 'default'; // Default game

            // Check if hashtags are present to detect the game
            const lowerCaseText = latestMessage.toLowerCase();

            if (lowerCaseText.includes('#tarkovarena') && lowerCaseText.includes('#escapefromtarkov')) {
                detectedGame = 'default'; // Both games detected
            } else if (lowerCaseText.includes('#tarkovarena')) {
                detectedGame = 'arena'; // Arena game detected
            } else if (lowerCaseText.includes('#escapefromtarkov')) {
                detectedGame = 'tarkov'; // Tarkov game detected
            }

            // Clean the hashtags if they exist
            let cleanMessage = latestMessage.replace(/#(EscapefromTarkov|TarkovArena)\b/gi, '').trim();

            console.log("[INFO] Simple message detected. Sending directly to Discord.");
            await sendToDiscord(cleanMessage, fs.existsSync(imageFilePath), detectedGame);
        } else {
            await translateAndSendNews();
        }


    } catch (error) {
        console.error(`[ERROR] Failed to fetch channel messages:`, error);
    }
}

module.exports = fetchLatestMessage;
