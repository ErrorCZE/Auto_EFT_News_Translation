const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const sendToDiscord = require('./sendToDiscord');
const translateAndSendNews = require('./translateNews');
require('dotenv').config();

async function fetchLatestMessage() {
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
        const lastMessageFilePath = path.resolve(__dirname, '../data/last_processed_message.txt');

        // Ensure data directory exists
        if (!fs.existsSync(path.dirname(dataFilePath))) {
            fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
        }

        // Read last processed message
        const lastProcessedMessage = fs.existsSync(lastMessageFilePath)
            ? fs.readFileSync(lastMessageFilePath, 'utf8').trim()
            : '';

        // Check if message is truly new
        if (latestMessage !== lastProcessedMessage) {
            console.log(`[INFO] New message detected.`);
            console.log(`[INFO] Message: ${latestMessage}`);

            // Write current message as last processed message
            fs.writeFileSync(lastMessageFilePath, latestMessage, 'utf8');
            fs.writeFileSync(dataFilePath, latestMessage, 'utf8');

            // Handle image
            if (latestImageUrl) {
                try {
                    console.log("[INFO] New image detected in latest message. Downloading...");
                    const response = await axios.get(latestImageUrl, { responseType: 'arraybuffer' });
                    fs.writeFileSync(imageFilePath, response.data);
                    console.log("[INFO] Image saved as news-img.jpg");
                } catch (imgError) {
                    console.error("[ERROR] Failed to download the image:", imgError.message);
                }
            } else if (fs.existsSync(imageFilePath)) {
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

                console.log("[DEBUG] Before cleaning:", latestMessage);

                // Remove hashtags like '#EscapefromTarkov' or '#TarkovArena' even if followed by a URL
                let cleanMessage = latestMessage
                    .replace(/#(?:EscapefromTarkov|TarkovArena)(?=\S)/gi, '') // Remove hashtags that are followed directly by non-space characters
                    .replace(/#(?:EscapefromTarkov|TarkovArena)\b/gi, '') // Remove hashtags with spaces after them or at the end
                    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
                    .trim(); // Remove leading/trailing whitespace

                console.log("[DEBUG] After cleaning:", cleanMessage);

                console.log("[INFO] Simple message detected. Sending directly to Discord.");
                await sendToDiscord(cleanMessage, fs.existsSync(imageFilePath), detectedGame);
            } else {
                await translateAndSendNews();
            }

        } else {
            console.log(`[INFO] No new messages. Skipping processing.`);
        }

    } catch (error) {
        console.error(`[ERROR] Failed to fetch channel messages:`, error);
    }
}

module.exports = fetchLatestMessage;