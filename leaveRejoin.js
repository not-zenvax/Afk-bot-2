function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function setupLeaveRejoin(bot, createBot) {
    let leaveTimer = null;
    let lookTimer = null;
    let reconnectTimer = null;

    let stopped = false;
    let reconnectAttempts = 0;

    function clearActiveTimers() {
        if (leaveTimer) clearTimeout(leaveTimer);
        if (lookTimer) clearTimeout(lookTimer);
        leaveTimer = lookTimer = null;
    }

    function executeSafeLook() {
        if (stopped || !bot.entity) return;

        const yaw = (Math.random() * Math.PI * 2) - Math.PI;
        try {
            if (bot && bot.look) {
                // Keep look vector locked level to protect vanilla positioning packets
                bot.look(yaw, 0, true);
            }
        } catch (e) {}

        const nextLookInterval = randomMs(60000, 150000);
        lookTimer = setTimeout(executeSafeLook, nextLookInterval);
    }

    function scheduleReconnect(reason = 'end') {
        if (stopped) return;

        let delay = randomMs(8000, 15000);
        reconnectAttempts++;
        if (reconnectAttempts > 3) delay += 10000; 
        delay = Math.min(delay, 30000);

        console.log(`[AFK] Reconnect sequence mapped in ${Math.round(delay / 1000)}s (${reason})`);

        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
            if (stopped) return;
            try {
                if (typeof createBot === 'function') createBot();
            } catch (e) {
                scheduleReconnect('retry-error');
            }
        }, delay);
    }

    // ==========================================
    // CRITICAL SPEC PACKET WORKAROUND
    // ==========================================
    // Intercept physics clock steps and feed back standard protocol updates 
    // to stop Paper/Purpur servers from flagging network desync errors.
    bot.on('physicTick', () => {
        if (stopped) return;
        
        // Keep tracking components offline to block automated falling calculations
        if (bot.physics) bot.physics.enabled = false;
        
        try {
            if (bot._client && bot._client.writable) {
                // Forces client_tick_end updates to align high-speed cloud packets
                bot._client.write('tick_end', {});
            }
        } catch (err) {}
    });

    bot.once('spawn', () => {
        reconnectAttempts = 0;
        stopped = false;
        clearActiveTimers();

        if (bot.physics) {
            bot.physics.enabled = false;
        }

        const stayTime = randomMs(180000, 480000);
        console.log(`[AFK] Network Alignment Safeguard Active. Session: ${Math.round(stayTime / 1000)}s`);

        lookTimer = setTimeout(executeSafeLook, 8000);

        leaveTimer = setTimeout(() => {
            if (stopped) return;
            clearActiveTimers();
            try { 
                bot.quit(); 
            } catch (e) {}
        }, stayTime);
    });

    bot.on('end', (reason) => {
        clearActiveTimers();
        bot.removeAllListeners();
        scheduleReconnect(`end-${reason}`);
    });

    bot.on('kicked', (reason) => {
        console.log(`[Kicked Details] Server disconnected handle: ${reason}`);
        clearActiveTimers();
        bot.removeAllListeners();
        scheduleReconnect('kicked-event');
    });

    bot.on('error', (err) => {
        try { if (bot && bot.end) bot.end(); } catch(e) {}
        clearActiveTimers();
        bot.removeAllListeners();
        scheduleReconnect('error-event');
    });
}

module.exports = setupLeaveRejoin;
