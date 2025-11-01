const fs = require('fs');
const axios = require('axios');
const path = require('path');
const sendToDiscord = require('./sendToDiscord');
const { DateTime } = require('luxon');
require('dotenv').config();

function getPragueTime() {
    return DateTime.now().setZone('Europe/Prague').toFormat('yyyy-MM-dd HH:mm:ss');
}

// File paths
const textFilePath = path.resolve(__dirname, '../data/text.txt');
const imagesDir = path.resolve(__dirname, '../data/images');

// Gemini API key from .env
const GEMINI_KEY = process.env.GEMINI_KEY;

async function translateTextWithRetry(textForTranslation, maxAttempts = 3) {
    let attempt = 0;
    let lastError = null;

    const prompt = `Translate the following text into Czech using a neutral tone appropriate for a group of people (not overly formal or informal).

STRICT RULES:
- **Only translate what is in the original text. Do NOT add, change, or assume anything.**
- Do NOT include any extra text, suggestions, notes, warnings, or context that is not in the original.

TRANSLATION RULES:
- Translate quest/task goals using the base verb form (e.g., Eliminate = Eliminovat), not imperative.
- Do NOT translate quest/task names or game names (e.g., Escape from Tarkov, Tarkov Arena).
- Keep proper nouns like map names, game modes, and item names in English unless they have a known Czech translation.
- If the text includes a time, convert it to CET and remove time zone abbreviations.
- Translate in a way that sounds natural for the Czech gaming community, not overly literal or formal.
- Keep common gaming terms in English (e.g., armor, quest, loot, spawn, raid), even if a Czech equivalent exists.
- If a Czech translation is uncommon or sounds unnatural, keep the original English term.
- Use common gaming slang if it is understandable to the target audience.

FORMATTING RULES:
- The first line must be a title starting with "# " followed by the translated title.
- Preserve the bullet symbol (●) and place each bullet point on a separate new line.
- Keep spacing exactly one space after the bullet symbol.
- If a sentence has the same link written twice, like {link} ({link again}), remove the second link and its brackets.
- Do not merge bullet points into a single paragraph.
- Break long content into meaningful, readable lines without altering meaning.
- Always insert a blank line:
  - Between every paragraph.
  - Before and after section headers (e.g., "In Escape from Tarkov:") if they exist.
  - After each paragraph of text if there is more than one.
  - Between the last bullet of one section and the next section header or paragraph.

Your output should ONLY be the raw Czech translation. Not any comments, just translation with formatting.

--- TEXT STARTS BELOW ---
${textForTranslation}
--- TEXT ENDS ABOVE ---`;

    while (attempt < maxAttempts) {
        attempt++;
        try {
            console.log(`[${getPragueTime()}] Translation attempt ${attempt}/${maxAttempts}`);

            const response = await axios.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
                {
                    contents: [{ parts: [{ text: prompt }] }]
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-goog-api-key": GEMINI_KEY,
                    }
                }
            );

            const translatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!translatedText) throw new Error("Gemini API returned empty translation.");

            console.log(`[${getPragueTime()}] ✅ Translation received`);
            return translatedText;

        } catch (error) {
            lastError = error;
            console.error(`[${getPragueTime()}] ❌ Translation attempt ${attempt} failed:`, error.message);

            if (attempt < maxAttempts) {
                const waitTime = 60000 + Math.random() * 30000;
                console.log(`[${getPragueTime()}] Waiting ${Math.round(waitTime / 1000)} seconds before retry...`);
                await new Promise(res => setTimeout(res, waitTime));
            }
        }
    }

    throw lastError || new Error("Translation failed after maximum attempts");
}

async function translateAndSendNews(downloadedImages = [], maxAttempts = 3) {
    try {
        console.log(`[${getPragueTime()}] Starting translation process...`);

        if (!GEMINI_KEY) throw new Error("Missing Gemini API Key!");

        const originalText = fs.readFileSync(textFilePath, 'utf8');

        let detectedGame = 'default';
        const t = originalText.toLowerCase();
        if (t.includes('#tarkovarena') && t.includes('#escapefromtarkov')) detectedGame = 'default';
        else if (t.includes('#tarkovarena')) detectedGame = 'arena';
        else if (t.includes('#escapefromtarkov')) detectedGame = 'tarkov';

        const translated = await translateTextWithRetry(originalText, maxAttempts);

        await sendToDiscord(translated, downloadedImages, detectedGame);
        console.log(`[${getPragueTime()}] ✅ Translation sent to Discord.`);

    } catch (e) {
        console.error(`[${getPragueTime()}] ❌ Error:`, e.message);
    }
}


module.exports = translateAndSendNews;
