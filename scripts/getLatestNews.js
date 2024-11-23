const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { exec } = require('child_process');
require('dotenv').config();

const dataFilePath = path.resolve(__dirname, '../data/text.txt');
const imageFilePath = path.resolve(__dirname, '../data/news-img.jpg');

async function fetchLatestMessage() {
    try {
        const { data } = await axios.get(process.env.SCRAPE_URL);
        const $ = cheerio.load(data);

        // Extract the latest message text
        const latestMessage = $('.tgme_widget_message_text').last().text().trim();

        // Extract the latest image URL (if available)
        const imageUrl = $('.tgme_widget_message_photo_wrap').last().attr('style');
        const matchedUrl = imageUrl ? imageUrl.match(/url\(['"]?(.*?)['"]?\)/) : null;
        const latestImageUrl = matchedUrl ? matchedUrl[1] : null;

        // Ensure the data folder exists
        if (!fs.existsSync(path.dirname(dataFilePath))) {
            fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
        }

        const currentText = fs.existsSync(dataFilePath) ? fs.readFileSync(dataFilePath, 'utf8') : '';
        let isNewMessage = false;

        // Process the text file
        if (latestMessage !== currentText) {
            console.log(`[INFO] New message detected.`);
            console.log("[DEBUG] Message content: " + latestMessage);
            fs.writeFileSync(dataFilePath, latestMessage, 'utf8');
            isNewMessage = true;
        } else {
            console.log(`[INFO] No new messages.`);
        }

        // Process the image file if available
        if (latestImageUrl) {
            try {
                console.log("[INFO] New image detected. Downloading...");
                const response = await axios.get(latestImageUrl, { responseType: 'arraybuffer' });
                fs.writeFileSync(imageFilePath, response.data);
                console.log("[INFO] Image saved as news-img.jpg.");
            } catch (imgError) {
                console.error("[ERROR] Failed to download the image:", imgError.message);
            }
        } else {
            console.log("[INFO] No image detected for the latest message.");
        }

        // Execute translation script (regardless of image presence)
        if (isNewMessage) {
            exec('node ./scripts/translateNews.js', (error, stdout, stderr) => {
                if (error) {
                    console.error(`[ERROR] Failed to run translation script: ${error.message}`);
                    return;
                }
                console.log(`=============================\nTranslation script output:\n${stdout}`);
                if (stderr) console.error(`[ERROR] Translation script stderr:\n${stderr}`);
            });
        }
    } catch (error) {
        console.error(`[ERROR] Failed to fetch channel messages:`, error);
    }
}

module.exports = fetchLatestMessage;
