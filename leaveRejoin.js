function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function setupLeaveRejoin(bot, createBot) {
    let leaveTimer = null;
    let reconnectTimer = null;

    let stopped = false;
    let reconnectAttempts = 0;

    function clearActiveTimers() {
        if (leaveTimer) clearTimeout(leaveTimer);
        leaveTimer = null;
    }

    function scheduleReconnect(reason = 'end') {
        if (stopped) return;

        let delay = randomMs(10000, 20000);
        reconnectAttempts++;
        if (reconnectAttempts > 3) delay += 10000; 
        delay = Math.min(delay, 30000);

        console.log(`[AFK] Rejoining in ${Math.round(delay / 1000)}s (${reason})`);

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

    // ==========================================================
    // CRITICAL PATCH: SILENCE ALL POSITION & FLYING PACKETS
    // ==========================================================
    bot.on('inject_allowed', () => {
        // Intercept raw network output before Mineflayer sends it to the server
        const oldWrite = bot._client.write.bind(bot._client);
        
        bot._client.write = function (name, params) {
            // Block 'position' and 'position_look' packets which cause the server desync kick
            if (name === 'position' || name === 'position_look' || name === 'flying') {
                // Instead, send a safe, unmoving on-ground packet verification signature
                return oldWrite('flying', { onGround: true });
            }
            // Let all other packets (chat, look changes, inventories) pass through normally
            return oldWrite(name, params);
        };
    });

    bot.once('spawn', () => {
        reconnectAttempts = 0;
        stopped = false;
        clearActiveTimers();

        // Lock physics simulator down permanently
        if (bot.physics) {
            bot.physics.enabled = false;
        }

        const stayTime = randomMs(180000, 480000);
        console.log(`[AFK] Pure Network Shield Implemented. Staying still for: ${Math.round(stayTime / 1000)}s`);

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
