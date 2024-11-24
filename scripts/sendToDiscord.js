const fs = require('fs');
const path = require('path');
const request = require('request');

const imageFilePath = path.resolve(__dirname, '../data/news-img.jpg');

async function sendToDiscord(translatedText, hasNewImage) {
    try {
        const formData = {
            content: translatedText + `\n<@&607881904645210122>`,
        };

        if (hasNewImage && fs.existsSync(imageFilePath)) {
            formData.file = {
                value: fs.createReadStream(imageFilePath),
                options: {
                    filename: 'news-img.jpg',
                    contentType: 'image/jpeg',
                },
            };
        }

        request.post(
            {
                url: process.env.DISCORD_WEBHOOK_URL,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                formData: formData,
            },
            (error, response, body) => {
                if (error) {
                    console.error(
                        `[${new Date().toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'medium', })}] Error sending webhook message:`, error
                    );
                } else {
                    console.log(`[INFO] Message sent${hasNewImage ? ' with image.' : '.'}`);
                }
            }
        );
    } catch (error) {
        console.error(
            `[${new Date().toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'medium', })}] Unexpected error:`, error
        );
    }
}

module.exports = sendToDiscord;
