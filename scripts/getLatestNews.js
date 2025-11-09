// getLatestNews.js
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

function extractTextWithLineBreaks($, element) {
    let result = '';
    
    element.contents().each((i, node) => {
        if (node.type === 'text') {
            result += $(node).text();
        } else if (node.name === 'br') {
            result += '\n';
        } else if (node.name === 'a') {
            const href = $(node).attr('href');
            const text = $(node).text();
            const isVersionNumber = href && (href.match(/^http:\/\/\d+\.\d+\.\d+\.\d+\/?$/) || href.match(/^http:\/\/\d+\.\d+\.\d+\/?$/));
            const isHashtag = href && href.startsWith('?q=%23');

            if (href && (href.includes('escapefromtarkov.com') || href.includes('arena.tarkov.com'))) {
                result += `${text} (${href})`;
            } else if (isVersionNumber || isHashtag) {
                result += text;
            } else if (href && (href.startsWith('https://') || href.startsWith('http://'))) {
                result += `${text} (${href})`;
            } else {
                result += text;
            }
        } else if (node.name === 'b' || node.name === 'strong' || node.name === 'i' || node.name === 'em') {
            // Recursively process bold/italic tags
            result += extractTextWithLineBreaks($, $(node));
        } else {
            result += $(node).text();
        }
    });
    
    return result;
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
        
        // Use the new extraction function that preserves line breaks
        let latestMessage = extractTextWithLineBreaks($, messageTextElement);
        
        // Clean up: remove excessive whitespace but preserve newlines
        latestMessage = latestMessage
            .replace(/[ \t]+/g, ' ')  // Multiple spaces/tabs -> single space
            .replace(/\n{3,}/g, '\n\n')  // Max 2 newlines in a row
            .trim();
        
        console.log(`[${getPragueTime()}] Extracted message:`);
        console.log('---START---');
        console.log(latestMessage);
        console.log('---END---');

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