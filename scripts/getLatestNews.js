const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { exec } = require('child_process');
require('dotenv').config();

const dataFilePath = path.resolve(__dirname, '../data/text.txt');

async function fetchLatestMessage() {
    try {
        const { data } = await axios.get(process.env.SCRAPE_URL);
        const $ = cheerio.load(data);

        const latestMessage = $('.tgme_widget_message_text').last().text().trim();

        if (!fs.existsSync(dataFilePath)) {
            fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
            fs.writeFileSync(dataFilePath, '', 'utf8');
        }

        const currentText = fs.readFileSync(dataFilePath, 'utf8');

        if (latestMessage !== currentText) {
            console.log(`[INFO] New message detected.`);
			console.log("[DEBUG] Message content: " + latestMessage)
            fs.writeFileSync(dataFilePath, latestMessage, 'utf8');

            exec('node ./scripts/translateNews.js', (error, stdout, stderr) => {
                if (error) {
                    console.error(`[ERROR] Failed to run translation script: ${error.message}`);
                    return;
                }
                console.log(`=============================\nTranslation script output:\n${stdout}`);
                if (stderr) console.error(`[ERROR] Translation script stderr:\n${stderr}`);
            });
        } else {
            console.log(`[INFO] No new messages.`);
        }
    } catch (error) {
        console.error(`[ERROR] Failed to fetch channel messages:`, error);
    }
}

fetchLatestMessage();
