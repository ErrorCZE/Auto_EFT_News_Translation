const fetchLatestMessage = require('./scripts/getLatestNews');

function getRandomInterval() {
    const min = 2 * 60 * 1000;
    const max = 6 * 60 * 1000; 
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function runAtRandomIntervals() {
    const interval = getRandomInterval();
    console.log(`[INFO] Next fetch in ${(interval / 1000).toFixed(1)} seconds.`);
    
    setTimeout(() => {
        console.log(`[INFO] Running fetchLatestMessage...`);
        fetchLatestMessage().then(runAtRandomIntervals);
    }, interval);
}

// Initial run
fetchLatestMessage().then(runAtRandomIntervals);
