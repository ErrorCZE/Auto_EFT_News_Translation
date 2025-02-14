const fs = require('fs');
const path = require('path');
const request = require('request');
require('dotenv').config();

const imageFilePath = path.resolve(__dirname, '../data/news-img.jpg');
const MAX_MESSAGE_LENGTH = 1999;

async function sendToDiscord(translatedText, hasNewImage, detectedGame) {
    try {
        // Determine webhook URL and role tag based on game
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

        // Split text into paragraphs by line breaks first
        const paragraphs = translatedText.split(/\n(?=[\s\S])/);
        
        // Prepare chunks while keeping paragraphs intact
        const chunks = [];
        let currentChunk = '';

        for (let paragraph of paragraphs) {
            paragraph = paragraph.trim();
            if (!paragraph) continue;

            // If adding this paragraph would exceed the limit
            if ((currentChunk + (currentChunk ? '\n' : '') + paragraph).length > MAX_MESSAGE_LENGTH) {
                // If the paragraph itself is longer than MAX_MESSAGE_LENGTH
                if (paragraph.length > MAX_MESSAGE_LENGTH) {
                    // If we have content in currentChunk, save it first
                    if (currentChunk) {
                        chunks.push(currentChunk);
                        currentChunk = '';
                    }
                    
                    // Split long paragraph at the last space before MAX_MESSAGE_LENGTH
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
                    // Save current chunk and start new one with this paragraph
                    if (currentChunk) {
                        chunks.push(currentChunk);
                    }
                    currentChunk = paragraph;
                }
            } else {
                // Add paragraph to current chunk
                currentChunk += (currentChunk ? '\n' : '') + paragraph;
            }
        }

        // Add the last chunk if not empty
        if (currentChunk) {
            chunks.push(currentChunk);
        }

        // Send each chunk sequentially
        for (let i = 0; i < chunks.length; i++) {
            const isLastChunk = i === chunks.length - 1;
            const formData = {
                content: isLastChunk 
                    ? chunks[i] + `\n-# Překlad byl automaticky vygenerován pomocí AI\n${roleTag}`
                    : chunks[i]
            };

            // Only attach image to the last chunk
            if (isLastChunk && hasNewImage && fs.existsSync(imageFilePath)) {
                formData.file = {
                    value: fs.createReadStream(imageFilePath),
                    options: {
                        filename: 'news-img.jpg',
                        contentType: 'image/jpeg',
                    },
                };
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
                            console.error(
                                `[${new Date().toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'medium', })}] Error sending webhook message for ${detectedGame || 'unknown game'}:`, error
                            );
                            reject(error);
                        } else {
                            console.log(`[INFO] Message part ${i + 1}/${chunks.length} sent for ${detectedGame || 'unknown game'}${isLastChunk && hasNewImage ? ' with image.' : '.'}`);
                            resolve();
                        }
                    }
                );
            });

            // Add a small delay between messages to avoid rate limiting
            if (!isLastChunk) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (error) {
        console.error(
            `[${new Date().toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'medium', })}] Unexpected error for ${detectedGame || 'unknown game'}:`, error
        );
    }
}

module.exports = sendToDiscord;