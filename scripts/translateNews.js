// translateNews.js
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

    const prompt = `You will translate the following text into Czech AND create a catchy title for it.

**STEP 1: CREATE A TITLE**
Generate a SHORT and CATCHY title in Czech (max 8-15 words) that captures the main topic of the message.
- Use Discord markdown: # for the title
- Do not add any emoji at the start
- Examples:
  * "# Twitch Rivals se vrací do Escape from Tarkov"
  * "# Vydání Tarkova již za pár dní!"
  * "# Nový event v Tarkov Arena"

**STEP 2: TRANSLATE THE CONTENT**

STRICT TRANSLATION RULES:
- **CRITICAL: Translate EXACTLY what is written. Do NOT paraphrase, summarize, or change the meaning in ANY way.**
- **CRITICAL: "less than a week away" means "za méně než týden" - translate time expressions literally and accurately.**
- **Only translate what is in the original text. Do NOT add, change, or assume anything.**

TRANSLATION RULES:
- **Remove hashtags completely (if it makes sense) or replace them with text**:
  - #EscapefromTarkov -> Escape from Tarkov
  - #TarkovArena -> Tarkov Arena
  - #TwitchRivals -> Twitch Rivals
  - Other hashtags -> Convert to readable format (remove # and add spaces where appropriate, if it would be weird - keep hashtags as is) or remove them completely, they are not important.
- Translate time expressions literally and accurately (e.g., "less than a week away" = "za méně než týden", "in 3 days" = "za 3 dny").
- Maintain the exact sentence structure and meaning - do NOT paraphrase or simplify - we need to keep same meaning.
- Translate quest/task goals using the base verb form (e.g., Eliminate = Eliminovat), not imperative.
- Do NOT translate quest/task names or game names (e.g., Escape from Tarkov, Tarkov Arena).
- Keep proper nouns like map names, game modes, and item names in English unless they have a known Czech translation.
- If the text includes a time, convert it to CET and remove time zone abbreviations.
- Translate in a way that sounds natural for the Czech gaming community, not overly literal or formal.
- Keep common gaming terms in English (e.g., armor, quest, loot, spawn, raid), even if a Czech equivalent exists.
- If a Czech translation is uncommon or sounds unnatural, keep the original English term.
- Use common gaming slang if it is understandable to the target audience.

FORMATTING RULES FOR DISCORD:
- **CRITICAL: PRESERVE ALL LINE BREAKS from the original text. Each paragraph break must be preserved.**
- Use Discord markdown headers: # for main title, ## for subtitle, ### for smaller headers.
- Preserve the bullet symbol (●) and place each bullet point on a separate new line.
- Keep spacing exactly one space after the bullet symbol.
- For links, use Discord format: [Link Text](<URL>) for embedded links (preserve <> characters, IMPORTANT: DONT PUT <> HERE IF ITS YOUTUBE URL).
- If a sentence has the same link written twice, like "text (url) (url)", remove the second occurrence and keep only: "text (url)"
- Put bullet points into column on a single paragraph, but each bullet point has to have be on new line.
- Break long content into meaningful, readable lines without altering meaning.
- Use **bold** for emphasis on important words or phrases (not for titles), you can also use *italic* for some text.
- Always insert a blank line:
  - Between the title and the translated content.
  - Between every paragraph.
  - Before and after section headers (e.g., "In Escape from Tarkov:") if they exist.
  - After each paragraph of text if there is more than one.
  - Between the last bullet of one section and the next section header or paragraph.

**OUTPUT FORMAT:**
First line: The title with # markdown and hashtags
Blank line
Then: The translated content with preserved line breaks

Your output should ONLY contain the title and Czech translation with Discord markdown formatting. No comments, explanations, or markdown code blocks.

--- TEXT STARTS BELOW ---
${textForTranslation}
--- TEXT ENDS ABOVE ---`;

    while (attempt < maxAttempts) {
        attempt++;
        try {
            console.log(`[${getPragueTime()}] Translation attempt ${attempt}/${maxAttempts}`);

            const response = await axios.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
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

            let translatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!translatedText) throw new Error("Gemini API returned empty translation.");

            // Remove markdown code blocks if present
            translatedText = translatedText.replace(/```[\s\S]*?```/g, '').trim();

            // Fix duplicate links: "text (url) (url)" -> "text (url)"
            translatedText = translatedText.replace(/(\([^)]+\))\s*\1/g, '$1');


            console.log(`[${getPragueTime()}] ✅ Translation with title received:`);
            console.log('---START---');
            console.log(translatedText);
            console.log('---END---');
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