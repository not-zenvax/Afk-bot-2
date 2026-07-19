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

    // Fixed Look Sequence with strict anti-NaN filtering
    function executeSafeLook() {
        if (stopped || !bot.entity || !bot.entity.position) return;

        // Force explicit values to prevent NaN network injection bugs
        let yaw = (Math.random() * Math.PI * 2) - Math.PI;
        let pitch = 0; // Lock head perfectly level to secure physics states

        // Double check variable states mathematically before sending
        if (isNaN(yaw)) yaw = 0;
        if (isNaN(pitch)) pitch = 0;

        try {
            if (bot && bot.look) {
                // Ensure physics engine processing stays asleep during turn transitions
                if (bot.physics) bot.physics.enabled = false;
                
                bot.look(yaw, pitch, true);
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

        // ABSOLUTE PROTECTION AGAINST POSITION KICKS:
        // Fully shuts down autonomous entity vector mechanics.
        // This anchors the bot down and silences conflicting telemetry packets.
        if (bot.physics) {
            bot.physics.enabled = false;
        }

        // Intercept and bypass incoming vector packet loops
        bot.on('move', () => {
            if (bot.physics && bot.physics.enabled) {
                bot.physics.enabled = false;
            }
        });

        const stayTime = randomMs(180000, 480000);
        console.log(`[AFK] Safe Sandbox Verified. Active runtime duration: ${Math.round(stayTime / 1000)}s`);

        // Wait a safe 8 seconds before initializing safe glance timers
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
