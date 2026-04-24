/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: ping.js
** --------
** System health checks, MQTT pole ping, and status indicator rendering.
** Depends on: globals.js
**
** Two distinct ping paths:
**   checkSystemHealth() — DB-only, used by the 10-second automatic interval.
**                         Never sends an MQTT request to the poles.
**   pingPoles()         — Full active MQTT ping, used ONLY by the Ping button.
**
** Functions defined here:
**   parsePoleStatus(raw)
**   setIndicatorState(indicatorId, textElId, state, text)
**   updateHealthDisplay(status)
**   checkSystemHealth()
**   pingPoles()
**   initializePingButton()
*/

// ── Ping state persistence ────────────────────────────────────────────────────
// The last known health status is stored in localStorage so the ping card
// shows the previous result immediately on reload instead of staying blank
// until the first heartbeat fires.
const PING_STATE_KEY = 'ripple_last_ping_state';
const PING_BTN_STATE_KEY = 'ripple_ping_btn_disabled';
const PING_BTN_STATE_TIME_KEY = 'ripple_ping_btn_disabled_time';

/* Saves the current health status to localStorage so it survives page reloads.
** Stored as a JSON object with the same shape as the status parameter passed
** to updateHealthDisplay().
** Parameters:
**     object status  { mysql, mqtt, mainPole, secPole, warnPole }
** Return:
**     None
*/
function savePingState(status) {
    try {
        localStorage.setItem(PING_STATE_KEY, JSON.stringify({
            ...status,
            savedAt: new Date().toISOString(),
        }));
    } catch (err) {
        console.warn('[Health] Could not persist ping state:', err.message);
    }
}/* savePingState() */


/* Loads the most recently saved health status from localStorage and applies
** it to the ping-card indicators.  Called once on dashboard init so the card
** shows last-known state before the first heartbeat fires.
** Parameters:
**     None
** Return:
**     None
*/
function restoreLastPingState() {
    try {
        const raw = localStorage.getItem(PING_STATE_KEY);
        if (!raw) {
            console.info('[Health] No saved ping state found');
            return;
        }

        const saved = JSON.parse(raw);
        console.info(`[Health] Restoring last ping state from ${saved.savedAt}`);

        // Apply without triggering the debounce so the card renders immediately
        const { state, overallText, poleText } = resolveHealthDisplayState(saved);
        setIndicatorState('overall-indicator',      'systemStatus',   state, overallText);
        setIndicatorState('pole-status-indicator',  'poleStatusText', state, poleText);

    } catch (err) {
        console.warn('[Health] Could not restore ping state:', err.message);
    }
}/* restoreLastPingState() */


/* Converts a 3-character binary string into individual pole status booleans.
** Format: "XYZ"  X=main pole  Y=secondary pole  Z=warning pole
** '1' = active, '0' = inactive.
**
** Known values:
**   "000" — no pole responding
**   "100" — main pole only
**   "101" — main + warning pole
**   "110" — main + secondary pole
**   "111" — all poles responding
** Parameters:
**     string raw  e.g. "110"
** Return:
**     { mainPole: bool, secPole: bool, warnPole: bool }
*/
function parsePoleStatus(raw) {
    if (!raw || raw.length < 3) return { mainPole: false, secPole: false, warnPole: false };
    return {
        mainPole: raw[0] === '1',
        secPole:  raw[1] === '1',
        warnPole: raw[2] === '1',
    };
}/* parsePoleStatus() */


/* Sets a status-indicator element to one of four visual states:
** 'online' (green), 'warning' (amber), 'offline' (red), 'checking' (grey).
** Parameters:
**     string indicatorId  id of the .status-indicator <div>
**     string textElId     id of the status-text <span>
**     string state        'online' | 'warning' | 'offline' | 'checking'
**     string text         label to display
** Return:
**     None
*/
function setIndicatorState(indicatorId, textElId, state, text) {
    const indicator = document.getElementById(indicatorId);
    const textEl = document.getElementById(textElId);

    const dotColors = {
        online: '#22c55e',
        warning: '#f59e0b',
        offline: '#ef4444',
        checking: '#a3a3a3',
    };

    if (indicator) {
        indicator.classList.remove('online', 'warning', 'offline', 'checking');
        indicator.classList.add(state);
        const dot = indicator.querySelector('.status-dot');
        if (dot) dot.style.backgroundColor = dotColors[state] ?? '#a3a3a3';
    }

    if (textEl) textEl.textContent = text;
}/* setIndicatorState() */


/* Updates both ping-card indicators to reflect the current system status.
** Debounced by 500 ms to prevent flickering on rapid updates.
** Parameters:
**     object status  { mysql, mqtt, mainPole, secPole, warnPole }
** Return:
**     None
*/
function updateHealthDisplay(status) {
    if (healthUpdateTimeout) clearTimeout(healthUpdateTimeout);

    // Debounce: wait 500 ms before applying so rapid successive calls
    // (e.g. during startup) only render the final state once
    healthUpdateTimeout = setTimeout(() => {
        const { state, overallText, poleText } = resolveHealthDisplayState(status);
        setIndicatorState('overall-indicator',     'systemStatus',  state, overallText);
        setIndicatorState('pole-status-indicator', 'poleStatusText', state, poleText);
        // Persist so the card shows the correct state on next reload
        savePingState(status);
    }, 500);
}/* updateHealthDisplay() */


/* Maps a health status object to the visual state and label strings for
** the two ping-card status indicators.
** Keeps the branching logic in one place, separate from DOM manipulation.
** Parameters:
**     object status  { mysql, mqtt, mainPole, secPole, warnPole }
** Return:
**     { state: string, overallText: string, poleText: string }
*/
function resolveHealthDisplayState(status) {
    const allOnline  = status.mysql && status.mqtt && status.mainPole && status.secPole && status.warnPole;
    const allOffline = !status.mysql && !status.mqtt;

    if (allOnline) {
        return { state: 'online', overallText: 'System Online', poleText: 'Live' };
    }

    if (allOffline) {
        console.error('[Health] All systems offline — dashboard running without live data');
        return { state: 'offline', overallText: 'Systems Offline', poleText: 'Offline' };
    }

    if (!status.mysql) {
        console.warn('[Health] MySQL database is offline');
        return { state: 'warning', overallText: 'MySQL Unreachable', poleText: 'Degraded' };
    }

    if (!status.mqtt) {
        console.error('[Health] MQTT broker is offline');
        return { state: 'warning', overallText: 'MQTT Unreachable', poleText: 'Degraded' };
    }

    if (!status.mainPole) {
        console.error('[Health] Main sensor pole is offline');
        return { state: 'offline', overallText: 'Main Pole Unreachable', poleText: 'Offline' };
    }

    if (!status.secPole && !status.warnPole) {
        console.error('[Health] Secondary and warning poles are offline');
        return { state: 'warning', overallText: 'Secondary & Warning Pole Unreachable', poleText: 'Degraded' };
    }

    if (!status.secPole) {
        console.warn('[Health] Secondary pole is offline');
        return { state: 'warning', overallText: 'Secondary Pole Unreachable', poleText: 'Degraded' };
    }

    // Only remaining case: warnPole is false
    console.warn('[Health] Warning pole is offline');
    return { state: 'warning', overallText: 'Warning Pole Unreachable', poleText: 'Degraded' };
}/* resolveHealthDisplayState() */


/* DB-only health check. Calls /api/ping/status which verifies MySQL and MQTT
** liveness then returns the latest pole status row from the database.
** Never sends an MQTT ping request to the poles.
** Used by the automatic 10-second interval.
** Parameters:
**     None
** Return:
**     None (async)
*/
async function checkSystemHealth() {
    try {
        const softPingTimeout = remoteConfig.SOFT_PING_TIMEOUT;
        // AbortController lets us cancel the fetch if the server doesn't respond
        // within the timeout window rather than waiting indefinitely
        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), softPingTimeout + 1000);

        const response = await fetch('/api/ping/status', { signal: controller.signal });
        clearTimeout(timeout);

        const result = await response.json();
        // Default to false if the server omits a field — safer than treating undefined as truthy
        const mysql  = result.mysql ?? false;
        const mqtt   = result.mqtt  ?? false;

        if (!mysql) console.error('[Health] MySQL is unreachable');
        if (!mqtt)  console.error('[Health] MQTT broker is unreachable');

        // If either core service is down, mark poles as unknown and bail early
        if (!mysql || !mqtt) {
            updateHealthDisplay({ mysql, mqtt, mainPole: false, secPole: null, warnPole: null });
            return;
        }

        if (!result.poleStatus) {
            // Infrastructure is healthy but no pole has reported yet (e.g. fresh deploy)
            console.info('[Health] MySQL and MQTT online — no pole status on record yet');
            updateHealthDisplay({ mysql: true, mqtt: true, mainPole: null, secPole: null, warnPole: null });
            return;
        }

        // Parse the 3-character binary string into individual pole booleans
        const { mainPole, secPole, warnPole } = parsePoleStatus(result.poleStatus);

        console.info(
            `[Health] DB status — "${result.poleStatus}" (${result.updated_at}) ` +
            `Main: ${mainPole}, Sec: ${secPole}, Warn: ${warnPole}`
        );

        if (!mainPole) console.error('[Health] Main pole last recorded as offline');
        if (!secPole)  console.warn('[Health] Secondary pole last recorded as offline');
        if (!warnPole) console.warn('[Health] Warning pole last recorded as offline');

        updateHealthDisplay({ mysql: true, mqtt: true, mainPole, secPole, warnPole });

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('[Health] Status check timed out — server may be unreachable');
        } else {
            console.error('[Health] Status check failed:', error);
        }
        // Treat any failure as fully offline so the indicators reflect reality
        updateHealthDisplay({ mysql: false, mqtt: false, mainPole: false, secPole: null, warnPole: null });
    }
}/* checkSystemHealth() */


/* Full active pole ping. Calls /api/ping/full which publishes an MQTT request
** and waits up to 45 seconds for a response from the poles.
** Called ONLY from the Ping button — never on any automatic interval.
** Parameters:
**     None
** Return:
**     None (async)
*/
async function pingPoles() {
    try {
        const hardPingTimeout = remoteConfig.HARD_PING_TIMEOUT;
        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), hardPingTimeout + 1000);

        const response = await fetch('/api/ping/full', { signal: controller.signal });
        clearTimeout(timeout);

        const result = await response.json();
        const mysql  = result.mysql ?? false;
        const mqtt   = result.mqtt  ?? false;

        if (!mysql) console.error('[Ping] MySQL is unreachable');
        if (!mqtt)  console.error('[Ping] MQTT broker is unreachable');

        if (!mysql || !mqtt) {
            updateHealthDisplay({ mysql, mqtt, mainPole: false, secPole: null, warnPole: null });
            return;
        }

        const { mainPole, secPole, warnPole } = parsePoleStatus(result.poleStatus ?? '000');

        console.info(
            `[Ping] Full ping result — "${result.poleStatus}" ` +
            `Main: ${mainPole}, Sec: ${secPole}, Warn: ${warnPole}`
        );

        if (mainPole && secPole && warnPole) {
            console.info('[Ping] All poles responding');
        } else {
            if (!mainPole) console.error('[Ping] Main pole did not respond');
            if (!secPole)  console.error('[Ping] Secondary pole did not respond');
            if (!warnPole) console.error('[Ping] Warning pole did not respond');
        }

        updateHealthDisplay({ mysql: true, mqtt: true, mainPole, secPole, warnPole });

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('[Ping] Full ping timed out — poles may be unreachable');
        } else {
            console.error('[Ping] Full ping failed:', error);
        }
        updateHealthDisplay({ mysql: false, mqtt: false, mainPole: false, secPole: null, warnPole: null });
    }
}/* pingPoles() */


/* Wires the Ping button to pingPoles().
** The button is the ONLY trigger for a live MQTT ping.
** The automatic 10-second interval uses checkSystemHealth() (DB-only).
** Parameters:
**     None
** Return:
**     None
*/
function initializePingButton() {
    const pingButton  = document.querySelector('.ping-button');
    const imageButton = document.getElementById('image-request-button');
    if (!pingButton) return;

    // ── Restore button state on load ──────────────────────────────────────────
    _restoreButtonDisabledState(pingButton, imageButton);

    pingButton.addEventListener('click', async () => {
        // Lock both action buttons for the duration of the ping
        _disableActionButtons(pingButton, imageButton);

        try {
            // Show a neutral "checking" state on both indicators while the request is in flight
            setIndicatorState('overall-indicator',     'systemStatus',   'checking', 'Checking...');
            setIndicatorState('pole-status-indicator', 'poleStatusText', 'checking', 'Checking...');
            await pingPoles();

            // Re-enable only on clean completion — error paths in pingPoles()
            // call updateHealthDisplay which handles its own UI update
            _enableActionButtons(pingButton, imageButton);

        } catch (err) {
            // BUG FIX: buttons were never re-enabled if pingPoles() threw unexpectedly
            console.error('[Ping] Button handler error:', err);
            _enableActionButtons(pingButton, imageButton);
        }
    });
}/* initializePingButton() */