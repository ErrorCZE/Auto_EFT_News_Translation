const fs = require('fs');
const path = require('path');
const request = require('request');

const imageFilePath = path.resolve(__dirname, '../data/news-img.jpg');

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

        const formData = {
            content: translatedText + `\n${roleTag}`,
        };

        if (hasNewImage && fs.existsSync(imageFilePath)) {
            formData.file = {
                value: fs.createReadStream(imageFilePath),
                options: {
                    filename: 'news-img.jpg',
                    contentType: 'image/jpeg',
                },
            };
        } else {
            console.log("[INFO] No image file found to send.");
        }        

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
                } else {
                    console.log(`[INFO] Message sent for ${detectedGame || 'unknown game'}${hasNewImage ? ' with image.' : '.'}`);
                }
            }
        );
    } catch (error) {
        console.error(
            `[${new Date().toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'medium', })}] Unexpected error for ${detectedGame || 'unknown game'}:`, error
        );
    }
}

module.exports = sendToDiscord;