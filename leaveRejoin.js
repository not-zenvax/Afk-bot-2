function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function setupLeaveRejoin(bot, createBot) {
    // Timers
    let leaveTimer = null;
    let lookTimer = null;
    let reconnectTimer = null;

    // State
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

    // Safely looks around to update packets without changing physical coordinates
    function executeSafeLook() {
        if (stopped || !bot.entity) return;

        // Generate a random human head angle (Yaw and Pitch)
        const yaw = (Math.random() * Math.PI * 2) - Math.PI;
        const pitch = (Math.random() * Math.PI / 2) - (Math.PI / 4);

        // Turn the head smoothly without moving blocks
        try {
            if (bot && bot.look) {
                bot.look(yaw, pitch, true);
            }
        } catch (e) {}

        // Schedule the next look interval safely away from packet thresholds (1 to 3 minutes)
        const nextLookInterval = randomMs(60000, 180000);
        lookTimer = setTimeout(executeSafeLook, nextLookInterval);
    }

    function scheduleReconnect(reason = 'end') {
        if (stopped) return;

        let delay = randomMs(5000, 12000);
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

        const stayTime = randomMs(120000, 420000);
        logThrottled(`[AFK] Bot spawned successfully. Session duration: ${Math.round(stayTime / 1000)}s`);

        // Wait 5 seconds after spawn before doing anything
        lookTimer = setTimeout(executeSafeLook, 5000);

        leaveTimer = setTimeout(() => {
            if (stopped) return;
            logThrottled('[AFK] Disconnecting for scheduled cycle...');
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
