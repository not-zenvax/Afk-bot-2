function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function setupLeaveRejoin(bot, createBot) {
    // Timers
    let leaveTimer = null;
    let jumpTimer = null;
    let jumpOffTimer = null;
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

    // Clears active movement/leave timers without permanently locking the reconnect state
    function clearActiveTimers() {
        if (leaveTimer) clearTimeout(leaveTimer);
        if (jumpTimer) clearTimeout(jumpTimer);
        if (jumpOffTimer) clearTimeout(jumpOffTimer);
        leaveTimer = jumpTimer = jumpOffTimer = null;
    }

    function scheduleNextJump() {
        if (stopped || !bot.entity) return;

        bot.setControlState('jump', true);
        jumpOffTimer = setTimeout(() => {
            if (bot && bot.setControlState) {
                bot.setControlState('jump', false);
            }
        }, 300);

        // random jump 20s -> 5m
        const nextJump = randomMs(20000, 5 * 60 * 1000);
        jumpTimer = setTimeout(scheduleNextJump, nextJump);
    }

    function scheduleReconnect(reason = 'end') {
        if (stopped) return;

        // Seedloaf takes time to restart. Keep a safe backoff window.
        let delay = randomMs(5000, 15000);

        reconnectAttempts++;
        if (reconnectAttempts > 3) {
            delay += 10000; // Add 10s backoff if the server is offline taking time to boot
        }

        // Cap at 30s max so it doesn't wait forever
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
        // reset attempt counter on successful connect
        reconnectAttempts = 0;
        stopped = false;
        clearActiveTimers();

        // Stay connected 1-5 minutes before a scheduled leave/rejoin cycle.
        const stayTime = randomMs(60000, 300000);
        logThrottled(`[AFK] Will leave in ${Math.round(stayTime / 1000)} seconds`);

        scheduleNextJump();

        leaveTimer = setTimeout(() => {
            if (stopped) return;
            logThrottled('[AFK] Leaving server (scheduled cycle)');
            clearActiveTimers();
            try {
                bot.quit(); 
                // Notice we DO NOT call fullShutdown() here, 
                // because the 'end' event below will naturally trigger scheduleReconnect()
            } catch (e) {
                // ignore if already closed
            }
        }, stayTime);
    });

    // Clean up active listeners safely on disconnect and trigger reconnection
    bot.on('end', (reason) => {
        clearActiveTimers();
        bot.removeAllListeners(); // Prevent memory leaks
        scheduleReconnect(`end-${reason}`);
    });

    bot.on('kicked', (reason) => {
        clearActiveTimers();
        bot.removeAllListeners();
        scheduleReconnect(`kicked-${reason}`);
    });

    bot.on('error', (err) => {
        console.log(`[AFK Error] network issue: ${err.message}`);
        
        // If it hangs or times out, manually force close the socket 
        try {
            if (bot && bot.end) bot.end();
        } catch(e) {}

        clearActiveTimers();
        bot.removeAllListeners();
        scheduleReconnect('error-event');
    });
}

module.exports = setupLeaveRejoin;

