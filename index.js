const mineflayer = require('mineflayer');
const http = require('http');
const setupLeaveRejoin = require('./leaveRejoin');

// ==========================================
// RAILWAY HEALTH CHECK PORT BINDING
// ==========================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Survival AFK Bot Online\n');
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
    username: 'AFK_Bot', // Put your bot username here
    version: '1.20.1',   // Set this to your exact server version to block early pings
    connectTimeout: 30000,          
    checkTimeoutInterval: 35000    
};

let bot = null;

function createBotInstance() {
    console.log(`[Index] Connecting to ${botOptions.host}...`);
    
    if (bot) {
        try { bot.quit(); } catch (e) {}
        bot.removeAllListeners();
    }

    bot = mineflayer.createBot(botOptions);
    setupLeaveRejoin(bot, createBotInstance);

    bot.on('spawn', () => {
        console.log('[Index] Spawned successfully. Locking positional coordinates...');
        
        // Change to survival 3 seconds after complete world positioning
        setTimeout(() => {
            if (bot && bot.chat) {
                bot.chat('/gamemode survival');
            }
        }, 3000);
    });

    bot.on('error', (err) => {
        console.log(`[Index Error] ${err.message}`);
        if (err.message.includes('timeout') || err.message.includes('spawn')) {
            try { if (bot && bot.end) bot.end(); } catch (e) {}
        }
    });
}

createBotInstance();
