/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: globals.js
** --------
** Declares all shared mutable state used across dashboard modules.
** Load this file first — every other script depends on these variables.
** Analogous to a C header that holds extern declarations.
**
** Rule: nothing in this file executes side effects.
** It only declares variables and their initial values.
*/


// ── Pole data buffers ─────────────────────────────────────────────────────────
// Ring buffers of water-level records fetched from the server.
// Each entry is a row from the `users` table: { id, pole_id, waterlevel, created_at }
let pole1Data = [];
let pole2Data = [];

// Tracks the most-recently seen row ID for each pole so getNewData() can
// detect new records without re-fetching the full history.
let lastIDPole1;
let lastIDPole2;


//  Update intervals 
// Handle returned by setInterval for the main data poll loop.
// Kept here so initializeDashboard can clear it if settings change.
let chartUpdateInterval = null;


//  Alarm state 
// Tracks whether each pole is currently flooding and whether the audio alarm
// is playing. All alarm functions read and write this object.
let alarmState = {
    pole1Flooding: false,
    pole2Flooding: false,
    alarmPlaying:  false,
    alarmInterval: null
};

//  Health display debounce 
// Prevents the ping card from flickering when rapid status updates arrive.
let healthUpdateTimeout = null;


//  Heartbeat interval handle 
// setInterval handle for the automatic DB health check loop.
// Stored here so dashboard.main.js can clear and restart it if settings change.
let heartbeatIntervalHandle = null;

//  Remote config (values from server .env) 
// Populated once by loadRemoteConfig() before the dashboard starts.
// Fallback defaults are used if the fetch fails.
let remoteConfig = {
    SOFT_PING_TIMEOUT:     10000,
    HARD_PING_TIMEOUT:     45000,
    LOAD_IMAGE_TIMEOUT:    30000,
    IMAGE_REQUEST_TIMEOUT: 120000,
};

async function loadRemoteConfig() {
    try {
        const res  = await fetch('/api/config');
        const data = await res.json();
        remoteConfig = { ...remoteConfig, ...data };
        console.info('[Config] Remote config loaded:', remoteConfig);
    } catch (err) {
        console.warn('[Config] Failed to load remote config — using defaults:', err.message);
    }
}

// ── Action Button Lock ────────────────────────────────────────────────────────
// Persists disabled state across iframe reloads so a user cannot re-trigger
// a long-running request (image capture, pole ping) by navigating away and back.
// A timestamp is stored alongside the flag so stale locks (older than the
// longest possible operation) are automatically cleared on restore.

const BTN_LOCK_KEY = 'ripple_buttons_disabled';
const BTN_LOCK_TIME_KEY = 'ripple_buttons_disabled_time';

// Must be longer than the longest possible operation (image request = 2 min).
// Set to 3 minutes to give a safe margin.
const BTN_LOCK_MAX_AGE_MS = 3 * 60 * 1000;

/* Disables both action buttons and writes the lock + timestamp to localStorage.
** Parameters:
**     HTMLButtonElement pingButton
**     HTMLButtonElement imageButton
** Return:
**     None
*/
function _disableActionButtons(pingButton, imageButton) {
    if (pingButton) {
        pingButton.disabled = true;
        pingButton.classList.add('btn-disabled');
    }
    if (imageButton) {
        imageButton.disabled = true;
        imageButton.classList.add('btn-disabled');
    }
    localStorage.setItem(BTN_LOCK_KEY,      'true');
    localStorage.setItem(BTN_LOCK_TIME_KEY, Date.now().toString());
    console.info('[ButtonLock] Buttons locked');
}

/* Re-enables both action buttons and clears the lock from localStorage.
** Parameters:
**     HTMLButtonElement pingButton
**     HTMLButtonElement imageButton
** Return:
**     None
*/
function _enableActionButtons(pingButton, imageButton) {
    if (pingButton) {
        pingButton.disabled = false;
        pingButton.classList.remove('btn-disabled');
    }
    if (imageButton) {
        imageButton.disabled = false;
        imageButton.classList.remove('btn-disabled');
    }
    localStorage.removeItem(BTN_LOCK_KEY);
    localStorage.removeItem(BTN_LOCK_TIME_KEY);
    console.info('[ButtonLock] Buttons unlocked');
}

/* Called on dashboard init. Restores the disabled state if a valid (non-stale)
** lock exists in localStorage. Clears stale locks automatically.
** Parameters:
**     HTMLButtonElement pingButton
**     HTMLButtonElement imageButton
** Return:
**     None
*/
function _restoreButtonDisabledState(pingButton, imageButton) {
    const locked    = localStorage.getItem(BTN_LOCK_KEY) === 'true';
    const lockedAt  = parseInt(localStorage.getItem(BTN_LOCK_TIME_KEY) || '0', 10);
    const age       = Date.now() - lockedAt;

    if (!locked) return;

    if (age > BTN_LOCK_MAX_AGE_MS) {
        // Lock is stale — the request definitely finished or timed out.
        // Clear it so the buttons are usable again.
        console.warn(`[ButtonLock] Stale lock detected (age: ${Math.round(age / 1000)}s) — clearing`);
        _enableActionButtons(pingButton, imageButton);
        return;
    }

    // Lock is fresh — keep buttons disabled
    console.info(`[ButtonLock] Active lock restored (age: ${Math.round(age / 1000)}s) — buttons remain disabled`);
    if (pingButton) {
        pingButton.disabled = true;
        pingButton.classList.add('btn-disabled');
    }
    if (imageButton) {
        imageButton.disabled = true;
        imageButton.classList.add('btn-disabled');
    }
}