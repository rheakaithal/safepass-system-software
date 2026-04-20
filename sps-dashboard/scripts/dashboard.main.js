/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: dashboard.main.js
** --------
** Dashboard entry point — analogous to main() in C.
** Contains only the initialization sequence and interval setup.
** All function definitions live in their respective module files.
**
** Load order (enforced by RossStContent.html / Settings.html):
**   settings.js → globals.js → alarm.js → flood.js → data.js →
**   ping.js → images.js → chart.js → dashboard.main.js → navigation.js
**
** This file intentionally contains no function definitions.
*/


/* Initializes the dashboard. Called by navigation.js via initializeApp()
** when the page is running inside the content iframe.
**
** Sequence:
**   1. Load user settings from localStorage
**   2. Detect settings page and hand off if needed
**   3. Wire all UI button listeners (synchronous, runs before async work)
**   4. Load cached images from localStorage (instant, no network)
**   5. Fetch historical water level data
**   6. Start live data poll loop
**   7. Start DB health poll loop
** Parameters:
**     None
** Return:
**     None (async)
*/
async function initializeDashboard() {
    console.info('[Init] Dashboard initializing...');

    // ── 0. Load remote config FIRST ───────────────────────────────────────────
    await loadRemoteConfig();
    
    // ── 1. Settings ───────────────────────────────────────────────────────────
    loadSettings();
    console.info(
        `[Init] Settings loaded:` + 
        `\n- Frequency: ${settings.updateFrequency}ms` +
        `\n- Units: ${settings.distanceUnits}` +
        `\n- Warning: ${settings.warningThreshold} ${getUnitLabel()}` +
        `\n- Critical: ${settings.criticalThreshold} ${getUnitLabel()}` +
        `\n- Alarm Enable: ${settings.alarmEnabled}` + 
        `\n- Alarm Volume: ${settings.alarmVolume * 100}%` + 
        `\n- Heartbeat Enable: ${settings.heartbeatEnabled}` +
        `\n- Heartbeat Interval: ${settings.heartbeatInterval / 1000} seconds`
    );

    // ── 2. Settings page detection ────────────────────────────────────────────
    if (document.getElementById('saveSettings')) {
        console.info('[Init] Settings page detected — handing off to initializeSettingsPage()');
        initializeSettingsPage();
        return;
    }

    // ── 3. Wire UI listeners (synchronous) ────────────────────────────────────
    // Done before any awaits so buttons are live even while data is loading
    initializeImageButtons();
    initializePingButton();
    initializeImageRequestButton();
    initializeChart();

    // ── 4a. Restore last ping state ───────────────────────────────────────────
    // Shows the previous heartbeat result immediately so the ping card is never
    // blank on reload.  Runs synchronously before any network work begins.
    restoreLastPingState();

    // ── 4b. Load cached images (disk file → DB fallback) ──────────────────────
    loadSavedImages();

    // ── 5. Historical water level data ────────────────────────────────────────
    await initializeData();
    console.info('[Init] Dashboard components initialized');

    // ── 6. Live data poll loop ────────────────────────────────────────────────
    updatePoleData();
    chartUpdateInterval = setInterval(updatePoleData, settings.updateFrequency);
    console.info(`[Init] Data poll interval set to ${settings.updateFrequency}ms`);

    // ── 7. DB health poll loop ────────────────────────────────────────────────
    // Reads the database only — never sends an MQTT ping to the poles.
    // The server's persistent MQTT listener keeps the DB current automatically.
    // Interval and enabled state are read from settings so the user can
    // configure them from the Settings page without reloading the dashboard.
    startHeartbeat();

    console.info('[Init] Dashboard ready');
}/* initializeDashboard() */


/* Starts (or restarts) the DB health-check heartbeat interval.
** Reads heartbeatEnabled and heartbeatInterval from the current settings object.
** Clears any existing interval first so calling this again after a settings
** change immediately applies the new values.
** Parameters:
**     None
** Return:
**     None
*/
function startHeartbeat() {
    // Clear any running interval before creating a new one
    if (heartbeatIntervalHandle) {
        clearInterval(heartbeatIntervalHandle);
        heartbeatIntervalHandle = null;
    }

    // Run once immediately so the indicators show current state on load'
    checkSystemHealth();
    
    if (!settings.heartbeatEnabled) {
        console.info('[Init] Heartbeat disabled — skipping DB health poll interval');
        return;
    }

    heartbeatIntervalHandle = setInterval(checkSystemHealth, settings.heartbeatInterval);
    console.info(`[Init] Heartbeat interval set to ${settings.heartbeatInterval}ms`);
}/* startHeartbeat() */
