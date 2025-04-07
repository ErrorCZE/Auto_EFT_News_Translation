const fs = require('fs');
const path = require('path');
const request = require('request');
const { DateTime } = require('luxon');
require('dotenv').config();

const imageFilePath = path.resolve(__dirname, '../data/news-img.jpg');
const MAX_MESSAGE_LENGTH = 1999;

function getPragueTime() {
    return DateTime.now().setZone('Europe/Prague').toFormat('yyyy-MM-dd HH:mm:ss');
}

async function sendToDiscord(translatedText, hasNewImage, detectedGame) {
    try {
        console.log(`[${getPragueTime()}] Preparing to send message to Discord...`);
        console.log(`[${getPragueTime()}] Detected Game: ${detectedGame}`);
        console.log(`[${getPragueTime()}] Message Image: ${hasNewImage ? 'Yes' : 'No'}`);

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

        if (!webhookUrl) {
            throw new Error("Webhook URL is missing for the detected game.");
        }

        console.log(`[${getPragueTime()}] Using webhook URL: ${webhookUrl}`);
        console.log(`[${getPragueTime()}] Role tag to include: ${roleTag}`);

        const paragraphs = translatedText.split(/\n(?=[\s\S])/);
        const chunks = [];
        let currentChunk = '';

        for (let paragraph of paragraphs) {
            paragraph = paragraph.trim();
            if (!paragraph) continue;

            if ((currentChunk + (currentChunk ? '\n' : '') + paragraph).length > MAX_MESSAGE_LENGTH) {
                if (paragraph.length > MAX_MESSAGE_LENGTH) {
                    if (currentChunk) {
                        chunks.push(currentChunk);
                        currentChunk = '';
                    }

                    let remainingText = paragraph;
                    while (remainingText.length > 0) {
                        let splitIndex = remainingText.length <= MAX_MESSAGE_LENGTH
                            ? remainingText.length
                            : remainingText.lastIndexOf(' ', MAX_MESSAGE_LENGTH);

                        if (splitIndex === -1 || splitIndex > MAX_MESSAGE_LENGTH) {
                            splitIndex = MAX_MESSAGE_LENGTH;
                        }

                        chunks.push(remainingText.substring(0, splitIndex));
                        remainingText = remainingText.substring(splitIndex).trim();
                    }
                } else {
                    if (currentChunk) {
                        chunks.push(currentChunk);
                    }
                    currentChunk = paragraph;
                }
            } else {
                currentChunk += (currentChunk ? '\n' : '') + paragraph;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        if (chunks.length === 0) {
            chunks.push(' ');
        }              

        console.log(`[${getPragueTime()}] Message will be split into ${chunks.length} part(s).`);

        for (let i = 0; i < chunks.length; i++) {
            const isLastChunk = i === chunks.length - 1;
            const formData = {
                content: isLastChunk
                    ? chunks[i] + `\n-# Překlad byl automaticky vygenerován pomocí AI\n${roleTag}`
                    : chunks[i]
            };

            if (isLastChunk && hasNewImage && fs.existsSync(imageFilePath)) {
                formData.file = {
                    value: fs.createReadStream(imageFilePath),
                    options: {
                        filename: 'news-img.jpg',
                        contentType: 'image/jpeg',
                    },
                };
                console.log(`[${getPragueTime()}] Attaching image to final chunk.`);
            }

            await new Promise((resolve, reject) => {
                request.post(
                    {
                        url: webhookUrl,
                        headers: {
                            'Content-Type': 'multipart/form-data',
                        },
                        formData: formData,
                    },
                    (error, response, body) => {
                        if (error) {
                            console.error(`[${getPragueTime()}] ❌ Error sending chunk ${i + 1}/${chunks.length}:`, error);
                            reject(error);
                        } else {
                            console.log(`[${getPragueTime()}] ✅ Chunk ${i + 1}/${chunks.length} sent successfully${isLastChunk && hasNewImage ? ' (with image).' : '.'}`);
                            resolve();
                        }
                    }
                );
            });

            if (!isLastChunk) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`[${getPragueTime()}] All message chunks sent successfully.`);

    } catch (error) {
        console.error(`[${getPragueTime()}] ❌ Unexpected error while sending to Discord:`, error.message || error);
    }
}

module.exports = sendToDiscord;
