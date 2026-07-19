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
        // Keep head perfectly level to avoid pitch velocity calculation glitches
        try {
            if (bot && bot.look) {
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

        console.log(`[AFK] Rejoin loop in ${Math.round(delay / 1000)}s (${reason})`);

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

    bot.once('spawn', () => {
        reconnectAttempts = 0;
        stopped = false;
        clearActiveTimers();

        // FULL ENGINE INTERPOLATION LOCKOUT:
        // Stops Mineflayer from emitting position updates entirely. 
        // The server will handle all grounding calculations naturally.
        if (bot.physics) {
            bot.physics.enabled = false;
        }

        const stayTime = randomMs(180000, 480000);
        console.log(`[AFK] Static Ground Bounds Locked. Duration: ${Math.round(stayTime / 1000)}s`);

        // Wait a generous 8 seconds before touching look orientations
        lookTimer = setTimeout(executeSafeLook, 8000);

        leaveTimer = setTimeout(() => {
            if (stopped) return;
            clearActiveTimers();
            try { bot.quit(); } catch (e) {}
        }, stayTime);
    });

    bot.on('end', (reason) => {
        clearActiveTimers();
        bot.removeAllListeners();
        scheduleReconnect(`end-${reason}`);
    });

    bot.on('kicked', (reason) => {
        console.log(`[Kicked Details] ${reason}`);
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
