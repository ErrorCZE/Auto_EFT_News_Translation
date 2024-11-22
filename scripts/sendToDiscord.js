require('dotenv').config();
const request = require('request');

async function sendToDiscord(translatedText) {
	try {
		const message = {
			content: translatedText + ``,
		};

		request.post(
			{
				url: process.env.DISCORD_WEBHOOK_URL,
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(message),
			},
			(error, response, body) => {
				if (error) {
					console.error(
						`[${new Date().toLocaleString('en-GB', {timeZone: 'UTC', dateStyle: 'short', timeStyle: 'medium',})}] Error sending webhook message:`, error);
				} else {
					console.log(`[INFO] Message sent`);
				}
			}
		);
	} catch (error) {
		console.error(
			`[${new Date().toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'medium',})}] Unexpected error:`, error);
	}
}

module.exports = sendToDiscord;
