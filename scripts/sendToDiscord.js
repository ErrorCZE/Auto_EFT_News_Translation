// sendToDiscord.js
const fs = require('fs');
const path = require('path');
const request = require('request');
const { DateTime } = require('luxon');
require('dotenv').config();

const MAX_MESSAGE_LENGTH = 1999;

function getPragueTime() {
    return DateTime.now().setZone('Europe/Prague').toFormat('yyyy-MM-dd HH:mm:ss');
}

function formatDiscordMessage(text) {
    // Clean up excessive newlines (max 2 in a row)
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Trim and ensure clean start/end
    text = text.trim();
    
    return text;
}

async function sendToDiscord(translatedText, images = [], detectedGame = 'default') {
    try {
        console.log(`[${getPragueTime()}] Preparing message for Discord...`);

        let webhookUrl, roleTag;
        switch (detectedGame) {
            case 'arena':
                webhookUrl = process.env.ARENA_DISCORD_WEBHOOK_URL;
                roleTag = '<@&1031660384731529377>';
                break;
            case 'tarkov':
                webhookUrl = process.env.EFT_DISCORD_WEBHOOK_URL;
                roleTag = '<@&607881904645210122>';
                break;
            default:
                webhookUrl = process.env.EFT_DISCORD_WEBHOOK_URL;
                roleTag = '<@&607881904645210122> <@&1031660384731529377>';
        }

        // Format the message for Discord
        translatedText = formatDiscordMessage(translatedText);

        const paragraphs = translatedText.split(/\n\s*\n/);
        const chunks = [];
        let currentChunk = '';

        for (let p of paragraphs) {
            p = p.trim();
            if (!p) continue;

            if ((currentChunk + '\n\n' + p).length > MAX_MESSAGE_LENGTH) {
                chunks.push(currentChunk);
                currentChunk = p;
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + p;
            }
        }

        if (currentChunk) chunks.push(currentChunk);
        if (chunks.length === 0) chunks.push(" ");

        console.log(`[${getPragueTime()}] Sending ${chunks.length} part(s)...`);

        for (let i = 0; i < chunks.length; i++) {
            const isLast = i === chunks.length - 1;

            // Add footer only to the last chunk
            let content = chunks[i];
            if (isLast) {
                content += '\n\n-# Překlad byl automaticky vygenerován pomocí AI\n' + roleTag;
            }

            const formData = {
                content: content
            };

            if (isLast && images.length > 0) {
                console.log(`[${getPragueTime()}] Attaching ${images.length} image(s)`);

                images.forEach((file, idx) => {
                    formData[`file${idx}`] = {
                        value: fs.createReadStream(file),
                        options: {
                            filename: path.basename(file),
                            contentType: 'image/jpeg'
                        }
                    };
                });
            }

            await new Promise((resolve, reject) => {
                request.post({
                    url: webhookUrl,
                    headers: { 'Content-Type': 'multipart/form-data' },
                    formData
                }, (err) => {
                    if (err) {
                        console.error(`❌ Failed chunk ${i + 1}:`, err.message);
                        reject(err);
                    } else {
                        console.log(`✅ Sent chunk ${i + 1}${isLast && images.length ? ' (with images)' : ''}`);
                        resolve();
                    }
                });
            });

            if (!isLast) await new Promise(res => setTimeout(res, 1000));
        }

        console.log(`[${getPragueTime()}] ✅ Message successfully sent to Discord!`);
    } catch (error) {
        console.error(`[${getPragueTime()}] ❌ Error sending to Discord:`, error);
    }
}

module.exports = sendToDiscord;