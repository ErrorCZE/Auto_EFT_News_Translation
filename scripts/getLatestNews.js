const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { exec } = require('child_process');
require('dotenv').config();

const dataFilePath = path.resolve(__dirname, '../data/text.txt');
const imageFilePath = path.resolve(__dirname, '../data/news-img.jpg');

async function fetchLatestMessage() {
    let hasNewImage = false;
    try {
        const { data } = await axios.get(process.env.SCRAPE_URL);
        const $ = cheerio.load(data);

        const latestMessageElement = $('.tgme_widget_message').last();
        const latestMessage = latestMessageElement.find('.tgme_widget_message_text').text().trim();

        const latestImageWrap = latestMessageElement.find('.tgme_widget_message_photo_wrap').first();
        const imageUrl = latestImageWrap.length > 0 ? latestImageWrap.attr('style') : null;
        const matchedUrl = imageUrl ? imageUrl.match(/url\(['"]?(.*?)['"]?\)/) : null;
        const latestImageUrl = matchedUrl ? matchedUrl[1] : null;

        if (!fs.existsSync(path.dirname(dataFilePath))) {
            fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
        }

        const currentText = fs.existsSync(dataFilePath) ? fs.readFileSync(dataFilePath, 'utf8') : '';
        let isNewMessage = false;

        if (latestMessage !== currentText) {
            console.log(`[INFO] New message detected.`);
            fs.writeFileSync(dataFilePath, latestMessage, 'utf8');
            isNewMessage = true;
        } else {
            console.log(`[INFO] No new messages.`);
        }

        if (latestImageUrl && isNewMessage) {
            try {
                console.log("[INFO] New image detected in latest message. Downloading...");
                const response = await axios.get(latestImageUrl, { responseType: 'arraybuffer' });
                fs.writeFileSync(imageFilePath, response.data);
                console.log("[INFO] Image saved as news-img.jpg");
                hasNewImage = true;
            } catch (imgError) {
                console.error("[ERROR] Failed to download the image:", imgError.message);
            }
        } else if (isNewMessage && fs.existsSync(imageFilePath)) {
            fs.unlinkSync(imageFilePath);
            console.log("[INFO] Removed old image file since new message has no image.");
        }

        if (isNewMessage) {
            exec('node ./scripts/translateNews.js', (error, stdout, stderr) => {
                if (error) {
                    console.error(`[ERROR] Failed to run translation script: ${error.message}`);
                    return;
                }
                console.log(`=============================\nTranslation script output:\n${stdout}`);
                if (stderr) console.error(`[ERROR] Translation script stderr:\n${stderr}`);
                const translatedText = stdout.trim();
                require('./sendToDiscord')(translatedText, hasNewImage);
            });
        }
    } catch (error) {
        console.error(`[ERROR] Failed to fetch channel messages:`, error);
    }
}

module.exports = fetchLatestMessage;
