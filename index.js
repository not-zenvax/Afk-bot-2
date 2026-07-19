const mineflayer = require('mineflayer');
const http = require('http');
const setupLeaveRejoin = require('./leavejoin');

// ==========================================
// 1. RAILWAY HEALTH CHECK WEB SERVER
// ==========================================
// Railway requires an active HTTP server. If your app doesn't bind 
// to process.env.PORT, Railway will think it crashed and kill it.
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Mineflayer AFK bot process is active and running!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Railway] Health check server listening on port ${PORT}`);
});

// ==========================================
// 2. MINEFLAYER BOT CONFIGURATION
// ==========================================
const botOptions = {
    // Replace this with your exact Seedloaf subdomain
    host: 'zenmc.seedloaf.gg', 
    
    // The username for your bot
    username: 'devz',

    // CRITICAL FOR SEEDLOAF: Do NOT define 'port: 25565'. 
    // Omitting it forces Mineflayer to look up the new SRV port on every restart.

    // CRITICAL FOR TIMEOUTS: Prevents the "no spawn received" hanging bug
    connectTimeout: 25000,          // Abort connection if login takes over 25 seconds
    checkTimeoutInterval: 30000,    // Force close socket if server goes silent for 30 seconds
    
    // Optional: Set your server version explicitly (e.g., '1.20.1') to skip the initial ping
    version: false                  
};

let bot = null;

// ==========================================
// 3. CORE BOT INITIALIZATION LOOP
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

    // Pass the bot and this creation function over to your leavejoin.js script
    setupLeaveRejoin(bot, createBotInstance);

    // ==========================================
    // 4. NETWORKING AND LIFECYCLE EVENTS
    // ==========================================
    bot.on('login', () => {
        console.log('[Index] Logged into server. Awaiting world spawn packet...');
    });

    bot.on('spawn', () => {
        console.log('[Index] Success! Bot has spawned into the Minecraft world.');
    });

    // Catch early network/handshake errors before leavejoin.js can handle them
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
