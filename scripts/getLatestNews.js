const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const sendToDiscord = require('./sendToDiscord');
const translateAndSendNews = require('./translateNews');
const { DateTime } = require('luxon');
require('dotenv').config();

function getPragueTime() {
    return DateTime.now().setZone('Europe/Prague').toFormat('yyyy-MM-dd HH:mm:ss');
}

async function fetchLatestMessage() {
    try {
        console.log(`[${getPragueTime()}] Starting to fetch latest message...`);

        const { data } = await axios.get(process.env.SCRAPE_URL);
        console.log(`[${getPragueTime()}] Successfully fetched data from URL.`);

        const $ = cheerio.load(data);
        const latestMessageElement = $('.tgme_widget_message').last();

        const latestMessage = latestMessageElement.find('.tgme_widget_message_text').text().trim();
        console.log(`[${getPragueTime()}] Extracted message: "${latestMessage}"`);

        const latestImageWrap = latestMessageElement.find('.tgme_widget_message_photo_wrap').first();
        const imageUrl = latestImageWrap.length > 0 ? latestImageWrap.attr('style') : null;
        const matchedUrl = imageUrl ? imageUrl.match(/url\(['"]?(.*?)['"]?\)/) : null;
        const latestImageUrl = matchedUrl ? matchedUrl[1] : null;

        console.log(`[${getPragueTime()}] Extracted image URL: ${latestImageUrl || 'None'}`);

        const dataFilePath = path.resolve(__dirname, '../data/text.txt');
        const imageFilePath = path.resolve(__dirname, '../data/news-img.jpg');
        const lastMessageFilePath = path.resolve(__dirname, '../data/last_processed_message.txt');

        if (!fs.existsSync(path.dirname(dataFilePath))) {
            fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
            console.log(`[${getPragueTime()}] Created data directory.`);
        }

        const lastProcessedMessage = fs.existsSync(lastMessageFilePath)
            ? fs.readFileSync(lastMessageFilePath, 'utf8').trim()
            : '';

        console.log(`[${getPragueTime()}] Last processed message: "${lastProcessedMessage}"`);

        if (latestMessage !== lastProcessedMessage) {
            console.log(`[${getPragueTime()}] New message detected.`);

            fs.writeFileSync(lastMessageFilePath, latestMessage, 'utf8');
            fs.writeFileSync(dataFilePath, latestMessage, 'utf8');

            if (latestImageUrl) {
                try {
                    console.log(`[${getPragueTime()}] Image found. Downloading...`);
                    const response = await axios.get(latestImageUrl, { responseType: 'arraybuffer' });
                    fs.writeFileSync(imageFilePath, response.data);
                    console.log(`[${getPragueTime()}] Image saved to news-img.jpg`);
                } catch (imgError) {
                    console.error(`[${getPragueTime()}] Failed to download image: ${imgError.message}`);
                }
            } else if (fs.existsSync(imageFilePath)) {
                fs.unlinkSync(imageFilePath);
                console.log(`[${getPragueTime()}] Old image removed (no image in new message).`);
            }

            const isSimpleLinkOrHashtag = /^https?:\/\/\S+$/i.test(latestMessage) ||
                /^#\w+$/i.test(latestMessage) ||
                /^(#\w+\s*)?(https?:\/\/\S+)(\s*#\w+)?$/i.test(latestMessage);

            if (isSimpleLinkOrHashtag) {
                console.log(`[${getPragueTime()}] Simple message format detected.`);

                let detectedGame = 'default';
                const lowerCaseText = latestMessage.toLowerCase();

                if (lowerCaseText.includes('#tarkovarena') && lowerCaseText.includes('#escapefromtarkov')) {
                    detectedGame = 'default';
                } else if (lowerCaseText.includes('#tarkovarena')) {
                    detectedGame = 'arena';
                } else if (lowerCaseText.includes('#escapefromtarkov')) {
                    detectedGame = 'tarkov';
                }

                console.log(`[${getPragueTime()}] Detected game: ${detectedGame}`);

                let cleanMessage = latestMessage
                    .replace(/#(?:EscapefromTarkov|TarkovArena)(?=\S)/gi, '')
                    .replace(/#(?:EscapefromTarkov|TarkovArena)\b/gi, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                console.log(`[${getPragueTime()}] Cleaned message: "${cleanMessage}"`);

                await sendToDiscord(cleanMessage, fs.existsSync(imageFilePath), detectedGame);
                console.log(`[${getPragueTime()}] Sent simple message to Discord.`);
            } else {
                console.log(`[${getPragueTime()}] Complex message. Passing to translation...`);
                await translateAndSendNews();
            }

        } else {
            console.log(`[${getPragueTime()}] No new messages. Skipping.`);
        }

    } catch (error) {
        console.error(`[${getPragueTime()}] Error during fetch or processing: ${error.message}`);
    }
}

module.exports = fetchLatestMessage;
