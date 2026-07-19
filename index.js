const mineflayer = require('mineflayer');
const http = require('http');
const setupLeaveRejoin = require('./leaveRejoin');

// ==========================================
// RAILWAY HEALTH CHECK PORT BINDING
// ==========================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Mineflayer Survival AFK Bot is running!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Railway] Health check listening on port ${PORT}`);
});

// ==========================================
// MINEFLAYER CONFIGURATION
// ==========================================
const botOptions = {
    host: 'zenmc.seedloaf.gg', 
    username: 'AFK_Bot',      // Replace with your exact bot username

    // Explicitly declaring version stops early ping desyncs
    version: '1.20.1',        // Change this if your server uses a different version

    connectTimeout: 30000,          
    checkTimeoutInterval: 35000    
};

let bot = null;

// ==========================================
// CORE INITIALIZATION
// ==========================================
function createBotInstance() {
    console.log(`[Index] Launching connection to ${botOptions.host}...`);
    
    if (bot) {
        try {
            bot.quit();
        } catch (e) {}
        bot.removeAllListeners();
    }

    bot = mineflayer.createBot(botOptions);
    
    // Mount the structural protection loop immediately
    setupLeaveRejoin(bot, createBotInstance);

    bot.on('login', () => {
        console.log('[Index] Logged in. Synchronizing terrain chunks...');
    });

    bot.on('spawn', () => {
        console.log('[Index] Spawned successfully inside the world grid.');
        
        // Change to survival safely 3 seconds after complete world placement
        setTimeout(() => {
            if (bot && bot.chat) {
                console.log('[Index] Setting survival gamemode state...');
                bot.chat('/gamemode survival');
            }
        }, 3000);
    });

    bot.on('error', (err) => {
        console.log(`[Index Error] ${err.message}`);
        if (err.message.includes('timeout') || err.message.includes('spawn')) {
            try {
                if (bot && bot.end) bot.end();
            } catch (e) {}
        }
    });
}

createBotInstance();
