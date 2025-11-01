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
        const $ = cheerio.load(data);

        const latestMessageElement = $('.tgme_widget_message').last();

        const messageFooter = latestMessageElement.find('.tgme_widget_message_footer');
        const isEdited = messageFooter.find('.tgme_widget_message_meta').text().includes('edited');
        if (isEdited) {
            console.log(`[${getPragueTime()}] Message is edited. Skipping.`);
            return;
        }

        const messageTextElement = latestMessageElement.find('.tgme_widget_message_text');
        let latestMessage = '';

        messageTextElement.contents().each((i, elem) => {
            if (elem.type === 'text') {
                latestMessage += $(elem).text();
            } else if (elem.name === 'a') {
                const href = $(elem).attr('href');
                const text = $(elem).text();
                const isVersionNumber = href && (href.match(/^http:\/\/\d+\.\d+\.\d+\.\d+\/?$/) || href.match(/^http:\/\/\d+\.\d+\.\d+\/?$/));
                const isHashtag = href && href.startsWith('?q=%23');

                if (href && (href.includes('escapefromtarkov.com') || href.includes('arena.tarkov.com'))) {
                    latestMessage += `${text} (${href})`;
                } else if (isVersionNumber || isHashtag) {
                    latestMessage += text;
                } else if (href && (href.startsWith('https://') || href.startsWith('http://'))) {
                    latestMessage += `${text} (${href})`;
                } else {
                    latestMessage += text;
                }
            } else {
                latestMessage += $(elem).text();
            }
        });

        latestMessage = latestMessage.trim();
        console.log(`[${getPragueTime()}] Extracted message: "${latestMessage}"`);

        // ✅ Extract ALL images
        const imageWraps = latestMessageElement.find('.tgme_widget_message_photo_wrap');
        let imageUrls = [];

        imageWraps.each((i, elem) => {
            const style = $(elem).attr('style');
            const match = style ? style.match(/url\(['"]?(.*?)['"]?\)/) : null;
            if (match && match[1]) {
                imageUrls.push(match[1]);
            }
        });

        console.log(`[${getPragueTime()}] Found ${imageUrls.length} image URLs`);

        const dataDir = path.resolve(__dirname, '../data');
        const imagesDir = path.resolve(__dirname, '../data/images');

        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

        const textFilePath = path.resolve(dataDir, 'text.txt');
        const lastMessageFilePath = path.resolve(dataDir, 'last_processed_message.txt');

        const lastProcessedMessage = fs.existsSync(lastMessageFilePath) ? fs.readFileSync(lastMessageFilePath, 'utf8').trim() : '';

        if (latestMessage === lastProcessedMessage) {
            console.log(`[${getPragueTime()}] No new messages.`);
            return;
        }

        console.log(`[${getPragueTime()}] New message detected.`);
        fs.writeFileSync(lastMessageFilePath, latestMessage, 'utf8');
        fs.writeFileSync(textFilePath, latestMessage, 'utf8');

        // ✅ Remove old images
        fs.readdirSync(imagesDir).forEach(file => fs.unlinkSync(path.join(imagesDir, file)));

        // ✅ Download all images
        let downloadedImages = [];
        for (let i = 0; i < imageUrls.length; i++) {
            try {
                console.log(`[${getPragueTime()}] Downloading image ${i + 1}`);
                const res = await axios.get(imageUrls[i], { responseType: 'arraybuffer' });
                const filePath = path.join(imagesDir, `image_${i + 1}.jpg`);
                fs.writeFileSync(filePath, res.data);
                downloadedImages.push(filePath);
            } catch (e) {
                console.error(`Failed image ${i + 1}: ${e.message}`);
            }
        }

        console.log(`[${getPragueTime()}] ✅ Downloaded ${downloadedImages.length} images`);

        const normalized = latestMessage.replace(/\s+/g, ' ').trim();
        const simpleCheck =
            /^https?:\/\/\S+$/i.test(normalized) ||
            /^#\w+$/i.test(normalized) ||
            /^(#\w+\s*)?(https?:\/\/\S+)(\s*#\w+)?$/i.test(normalized);

        if (simpleCheck) {
            console.log(`[${getPragueTime()}] Simple message. Sending directly.`);
            let detectedGame = 'default';
            const text = latestMessage.toLowerCase();

            if (text.includes('#tarkovarena') && text.includes('#escapefromtarkov')) detectedGame = 'default';
            else if (text.includes('#tarkovarena')) detectedGame = 'arena';
            else if (text.includes('#escapefromtarkov')) detectedGame = 'tarkov';

            let cleanMessage = latestMessage.replace(/#\w+/g, '').trim();
            await sendToDiscord(cleanMessage, downloadedImages, detectedGame);
        } else {
            console.log(`[${getPragueTime()}] Complex message. Sending to translation.`);
            await translateAndSendNews(downloadedImages);
        }
    } catch (e) {
        console.error(`[${getPragueTime()}] Error:`, e.message);
    }
}

module.exports = fetchLatestMessage;
