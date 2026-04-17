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


// ── Update intervals ──────────────────────────────────────────────────────────
// Handle returned by setInterval for the main data poll loop.
// Kept here so initializeDashboard can clear it if settings change.
let chartUpdateInterval = null;


// ── Alarm state ───────────────────────────────────────────────────────────────
// Tracks whether each pole is currently flooding and whether the audio alarm
// is playing. All alarm functions read and write this object.
let alarmState = {
    pole1Flooding: false,
    pole2Flooding: false,
    alarmPlaying:  false,
    alarmInterval: null
};


// ── Health display debounce ───────────────────────────────────────────────────
// Prevents the ping card from flickering when rapid status updates arrive.
let healthUpdateTimeout = null;


// ── Heartbeat interval handle ─────────────────────────────────────────────────
// setInterval handle for the automatic DB health check loop.
// Stored here so dashboard.main.js can clear and restart it if settings change.
let heartbeatIntervalHandle = null;
