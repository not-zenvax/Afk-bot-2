const mineflayer = require('mineflayer');
const http = require('http');
const setupLeaveRejoin = require('./leaveRejoin');

// Railway Keep-Alive Port Binding
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Survival Bot Active\n');
});
server.listen(process.env.PORT || 3000);

const botOptions = {
    host: 'zenmc.seedloaf.gg', 
    username: 'piekake', // Change this to your exact bot username
    version: '1.20.1',   // Make sure this matches your exact server version!
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
        console.log('[Index] Spawned successfully. Aligning survival bounds...');
        
        // Survival assurance packet trigger
        setTimeout(() => {
            if (bot && bot.chat) {
                bot.chat('/gamemode survival');
            }
        }, 3000);
    });

    bot.on('error', (err) => {
        console.log(`[Network Error] ${err.message}`);
        if (err.message.includes('timeout') || err.message.includes('spawn')) {
            try { if (bot && bot.end) bot.end(); } catch (e) {}
        }
    });
}

createBotInstance();
