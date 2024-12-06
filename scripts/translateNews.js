async function translateAndSendNews() {
    try {
        const textForTranslation = fs.readFileSync(textFilePath, 'utf8');

        let detectedGame = null;
        const lowerCaseText = textForTranslation.toLowerCase();

        if (lowerCaseText.includes('#tarkovarena') && lowerCaseText.includes('#escapefromtarkov')) {
            detectedGame = 'default';
        } else if (lowerCaseText.includes('#tarkovarena')) {
            detectedGame = 'arena';
        } else if (lowerCaseText.includes('#escapefromtarkov')) {
            detectedGame = 'tarkov';
        } else {
            detectedGame = 'default';
        }

        const jsonPayload = {
            model: "mistral-large-latest",
            messages: [
                {
                    "role": "user",
                    "content": `Translate this text to Czech language, USE FRIENDLY WORDING (informal/casual) but for more people, not one! Text can be related to game "Escape from Tarkov" or "Escape from Tarkov Arena". If there is time convert it to CET (remove time zone name/shortcut CET too), keep map & item & gamemode names as they are. Use discord markdown formatting style (#, ##, ### for headings, **text** for bold, [text other than link](<link>) for hidden links etc.) Remove all hashtags if present (keep them if they are the only text here and nothing else), i wrote you game names you can use them. TRANSLATE TEXT TO CZECH LANGUAGE FROM ENGLISH, USE FRIENDLY WORDING (informal/casual) but for more people, not one. GIVE ME JUST RAW CZECH TRANSLATED RESULT:\n${textForTranslation}`
                }
            ],
            n: 1,
        };

        const response = await axios.post(process.env.API_URL, jsonPayload, {
            headers: {
                Authorization: `Bearer ${process.env.API_TOKEN}`,
                "Content-Type": "application/json",
            },
        });

        const hasNewImage = fs.existsSync(imageFilePath);

        const translatedText = response.data.choices[0]?.message?.content;

        await sendToDiscord(translatedText, hasNewImage, detectedGame);

        console.log(`[INFO] Translation cost: ${response.data.usage.total_tokens} (P: ${response.data.usage.prompt_tokens} C: ${response.data.usage.completion_tokens})`);
        console.log('[INFO] Translation result:', translatedText);
    } catch (error) {
        console.error('Error in translation process:', error.response ? error.response.data : error.message);
    }
}
