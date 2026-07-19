function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function setupLeaveRejoin(bot, createBot) {
    let leaveTimer = null;
    let lookTimer = null;
    let reconnectTimer = null;

    let stopped = false;
    let reconnectAttempts = 0;
    let lastLogAt = 0;

    function logThrottled(msg, minGapMs = 2000) {
        const now = Date.now();
        if (now - lastLogAt >= minGapMs) {
            lastLogAt = now;
            console.log(msg);
        }
    }

    function clearActiveTimers() {
        if (leaveTimer) clearTimeout(leaveTimer);
        if (lookTimer) clearTimeout(lookTimer);
        leaveTimer = lookTimer = null;
    }

    // Slowly glancers around to update activity without moving physical blocks
    function executeSafeLook() {
        if (stopped || !bot.entity) return;

        const yaw = (Math.random() * Math.PI * 2) - Math.PI;
        const pitch = (Math.random() * Math.PI / 6) - (Math.PI / 12); // subtle head nod

        try {
            if (bot && bot.look) {
                bot.look(yaw, pitch, true);
            }
        } catch (e) {}

        const nextLookInterval = randomMs(45000, 120000);
        lookTimer = setTimeout(executeSafeLook, nextLookInterval);
    }

    function scheduleReconnect(reason = 'end') {
        if (stopped) return;

        let delay = randomMs(6000, 15000);
        reconnectAttempts++;
        if (reconnectAttempts > 3) {
            delay += 10000; 
        }
        delay = Math.min(delay, 30000);

        logThrottled(`[AFK] Rejoin scheduled in ${Math.round(delay / 1000)}s (reason: ${reason}, attempt: ${reconnectAttempts})`);

        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
            if (stopped) return;
            try {
                if (typeof createBot === 'function') {
                    createBot();
                }
            } catch (e) {
                console.log('[AFK] createBot error:', e?.message || e);
                scheduleReconnect('createBot-error');
            }
        }, delay);
    }

    bot.once('spawn', () => {
        reconnectAttempts = 0;
        stopped = false;
        clearActiveTimers();

        // 1. SURVIVAL PHYSICS FIX: Enable engine, but slow it down!
        if (bot.physics) {
            bot.physics.enabled = true; // Bot stays on the ground, falls, and obeys gravity
            
            // Slow down internal physics ticks slightly to survive cloud connection lag spikes
            // Default Minecraft tick is 50ms. Setting this to 55-60ms prevents packet burst kicks.
            bot.physics.mshMaxTickTime = 60; 
        }

        const stayTime = randomMs(120000, 420000);
        logThrottled(`[AFK] Survival Ground Mode active. Session: ${Math.round(stayTime / 1000)}s`);

        // Wait 5 seconds for land blocks to completely load around the bot before moving head
        lookTimer = setTimeout(executeSafeLook, 5000);

        leaveTimer = setTimeout(() => {
            if (stopped) return;
            logThrottled('[AFK] Executing scheduled rotation leave...');
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
        console.log(`[Kicked] Server disconnected bot: ${reason}`);
        clearActiveTimers();
        bot.removeAllListeners();
        scheduleReconnect('kicked-event');
    });

    bot.on('error', (err) => {
        console.log(`[AFK Error] Network issue: ${err.message}`);
        try {
            if (bot && bot.end) bot.end();
        } catch(e) {}
        clearActiveTimers();
        bot.removeAllListeners();
        scheduleReconnect('error-event');
    });
}

module.exports = setupLeaveRejoin;
