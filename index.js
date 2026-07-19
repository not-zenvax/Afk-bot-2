const mineflayer = require('mineflayer');
const http = require('http');
// FIXED: Capitalized 'R' to match your exact file name 'leaveRejoin.js'
const setupLeaveRejoin = require('./leaveRejoin');

// ==========================================
// RAILWAY HEALTH CHECK WEB SERVER
// ==========================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Mineflayer AFK bot process is active and running!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Railway] Health check server listening on port ${PORT}`);
});

// ==========================================
// MINEFLAYER BOT CONFIGURATION
// ==========================================
const botOptions = {
    host: 'zenmc.seedloaf.gg', // Your Seedloaf server address
    username: 'AFK_Bot',

    // CRITICAL FOR SEEDLOAF: Do NOT include 'port: 25565'. 
    // Omitting it forces Mineflayer to resolve your new SRV port on every restart.

    // CRITICAL FOR TIMEOUTS: Prevents the "no spawn received" hanging bug
    connectTimeout: 25000,          // Abort connection if login takes over 25 seconds
    checkTimeoutInterval: 30000,    // Force close socket if server goes silent for 30 seconds
    version: false                  // Auto-detect server version
};

let bot = null;

// ==========================================
// CORE BOT INITIALIZATION LOOP
// ==========================================
function createBotInstance() {
    console.log(`[Index] Initializing fresh connection to ${botOptions.host}...`);
    
    // Safety check: Clean up any lingering old bot instances before creating a new one
    if (bot) {
        try {
            bot.quit();
        } catch (e) {
            // Ignore if already dead
        }
        bot.removeAllListeners();
    }

    // Spawn the new Mineflayer bot instance
    bot = mineflayer.createBot(botOptions);

    // Pass the bot and this creation function over to your leaveRejoin script
    setupLeaveRejoin(bot, createBotInstance);

    // ==========================================
    // NETWORKING AND LIFECYCLE EVENTS
    // ==========================================
    bot.on('login', () => {
        console.log('[Index] Logged into server. Awaiting world spawn packet...');
    });

    bot.on('spawn', () => {
        console.log('[Index] Success! Bot has spawned into the Minecraft world.');
    });

    // Catch early network/handshake errors before leaveRejoin can handle them
    bot.on('error', (err) => {
        console.log(`[Index Network Error] ${err.message}`);
        
        // If it gets caught in a login hang or timeout, force-kill the connection socket
        if (err.message.includes('timeout') || err.message.includes('spawn')) {
            console.log('[Index] Catching connection hang. Forcing socket closure...');
            try {
                if (bot && bot.end) bot.end();
            } catch (e) {
                // Ignore failure
            }
        }
    });
}

// Start the automation loop
createBotInstance();
