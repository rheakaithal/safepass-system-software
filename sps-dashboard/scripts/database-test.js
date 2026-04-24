/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: database-test.js
** --------
** Simulation server — mirrors every API endpoint in database.js without
** requiring a real MySQL database or MQTT broker.
**
** Simulation behaviour:
**   - Water level is sampled every 5 minutes when below 2 inches,
**     every 1 minute when at or above 2 inches (matches real hardware).
**   - Historic data is pre-generated for the last 8 days using the same
**     sampling rule, so the chart looks exactly like real field data.
**   - Water level follows a realistic pattern: slow baseline with
**     occasional rain events that cause rapid rises and natural recessions.
**   - Ping endpoints simulate realistic MQTT round-trip delays.
**   - Image request simulates the full MCU capture-and-upload flow with
**     a realistic delay, then returns actual placeholder JPEG images.
**   - /api/config returns the same timeout values the real server uses.
*/

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const ROOT = path.resolve(__dirname, '..');

const cors = require('cors');
app.use(cors());
app.use(express.json({ limit: '20mb' }));
// ── RossStContent.html interception ─────────────────────────────────────────
// Registered BEFORE express.static so this route wins over static file serving.
// Reads the file, injects sim-overlay.js before navigation.js, and serves it.
// The file on disk is never modified.
app.get('/RossStContent.html', (req, res) => {
    const filePath = path.join(ROOT, 'RossStContent.html');
    fs.readFile(filePath, 'utf8', (err, html) => {
        if (err) {
            console.error(' [Sim] Could not read RossStContent.html:', err.message);
            return res.status(500).send('Could not load dashboard page');
        }
        // Inject before navigation.js so the overlay redefines
        // initializeImageRequestButton() before DOMContentLoaded fires it.
        const injected = html.replace(
            '<script src="scripts/navigation.js"></script>',
            '<script src="/sim-overlay.js"></script>\n    <script src="scripts/navigation.js"></script>'
        );
        res.setHeader('Content-Type', 'text/html');
        res.send(injected);
    });
});

app.use(express.static(ROOT));

app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT, 'SafePassSystem.html'));
});


// ── Simulation config ─────────────────────────────────────────────────────────
const SIM_PORT = 80;

// Water level thresholds (inches) — must match dashboard defaults
const FAST_SAMPLE_THRESHOLD = 2.0;   // above this: 1-min interval
const SLOW_INTERVAL_MIN     = 5;     // minutes between samples below threshold
const FAST_INTERVAL_MIN     = 1;     // minutes between samples above threshold
const MIN_READABLE_LEVEL    = 1.0;   // sensor does not report below this depth

// Realistic delays (ms)
const SOFT_PING_DELAY_MS    = 400;   // DB-only health check
const HARD_PING_DELAY_MS    = 1800;  // full active MQTT ping round-trip
const IMAGE_REQUEST_DELAY_MS = 6000; // MCU capture + DB write simulation


// ── Water level model ─────────────────────────────────────────────────────────
// Generates a realistic water level value for a given unix timestamp (ms).
// Uses a combination of:
//   - A slow seasonal baseline (very low frequency sine)
//   - Periodic rain events (narrow gaussian pulses) seeded by the timestamp
//     so every call with the same timestamp returns the same value
//   - A small amount of sensor noise
//
// Returns inches (float, clamped to 0–12).

/* Deterministic pseudo-random number in [0, 1) seeded by an integer.
** Uses a simple xorshift so the same seed always yields the same value.
** Parameters:
**     int seed
** Return:
**     float  [0, 1)
*/
function seededRandom(seed) {
    let s = seed ^ (seed >>> 17);
    s = Math.imul(s, 0x45d9f3b);
    s ^= s >>> 16;
    return (s >>> 0) / 0xffffffff;
}

/* Returns a simulated water level in inches for a given timestamp.
** The pattern is consistent across calls — the same timestamp always
** returns the same level, making historic generation deterministic.
** Parameters:
**     number timestampMs   unix timestamp in milliseconds
**     int    poleId        1 or 2 (slight phase offset between poles)
** Return:
**     float  water level in inches
*/
function simulatedWaterLevel(timestampMs, poleId) {
    const t        = timestampMs / 1000;           // seconds
    const polePhase = poleId === 1 ? 0 : 0.4;     // poles are slightly out of phase

    // ── Slow baseline: gentle 12-hour tide-like cycle, 1.1–1.8 in
    // Kept above MIN_READABLE_LEVEL (1.0 in) at all times so the sensor
    // always has data across the full chart window.
    const baseline = 1.45 + 0.35 * Math.sin((t / (12 * 3600)) * 2 * Math.PI + polePhase);

    // ── Rain events: check nearby "event seeds" in a ±6 hour window
    // Seed rain events to a 6-hour grid so they don't overlap heavily
    const RAIN_GRID_S = 6 * 3600;
    const gridIdx     = Math.floor(t / RAIN_GRID_S);

    let rainLevel = 0;

    // Look at the current grid cell and the two neighbours
    for (let offset = -1; offset <= 1; offset++) {
        const cellIdx    = gridIdx + offset;
        const cellRng    = seededRandom(cellIdx * 7919 + poleId * 31);
        const cellRng2   = seededRandom(cellIdx * 6271 + poleId * 17);

        // ~30% chance of a rain event in any 6-hour cell
        if (cellRng > 0.70) {
            // Event centre: random position within the cell
            const eventCentreS = (cellIdx + cellRng2) * RAIN_GRID_S;

            // Peak height: 1.5 – 8.0 inches above baseline
            const peakRng  = seededRandom(cellIdx * 4999 + poleId * 53);
            const peakHeight = 1.5 + peakRng * 6.5;

            // Rise is fast (sigma ~20 min), recession is slow (sigma ~90 min)
            const dt = t - eventCentreS;
            const sigma = dt < 0 ? (20 * 60) : (90 * 60);
            rainLevel += peakHeight * Math.exp(-(dt * dt) / (2 * sigma * sigma));
        }
    }

    // ── Sensor noise: ±0.05 in, seeded to the nearest minute so readings
    //    taken within the same minute are stable (no jitter on the display)
    const noiseSeed  = Math.floor(t / 60) * 100 + poleId;
    const noise      = (seededRandom(noiseSeed) - 0.5) * 0.1;

    const level = baseline + rainLevel + noise;
    return parseFloat(Math.min(12, Math.max(0, level)).toFixed(3));
}


// ── Historic data generation ──────────────────────────────────────────────────
// Pre-built once at startup using the real sampling rule:
//   < 2 in → one record every 5 minutes
//   ≥ 2 in → one record every 1 minute

/* Builds a full array of historic records for a pole, respecting the
** variable sampling interval rule used by the real hardware.
** Parameters:
**     int poleId   1 or 2
** Return:
**     array of { id, pole_id, waterlevel, created_at }
*/
function generateMockHistory(poleId) {
    const records    = [];
    const now        = Date.now();
    const eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000);

    let t  = eightDaysAgo;
    let id = 1;

    while (t <= now) {
        const level = simulatedWaterLevel(t, poleId);

        // Only emit a record if the level is at or above the sensor's
        // minimum readable depth — below 1 inch the hardware returns nothing
        if (level >= MIN_READABLE_LEVEL) {
            records.push({
                id:         id++,
                pole_id:    poleId,
                waterlevel: level,
                created_at: new Date(t).toISOString(),
            });
        }

        // Next sample time depends on current level
        const intervalMs = level >= FAST_SAMPLE_THRESHOLD
            ? FAST_INTERVAL_MIN  * 60 * 1000
            : SLOW_INTERVAL_MIN  * 60 * 1000;

        t += intervalMs;
    }

    console.log(` [Sim] Generated ${records.length} historic records for Pole ${poleId}`);
    return records;
}

console.log(' [Sim] Generating historic water level data...');
const mockHistory = {
    1: generateMockHistory(1),
    2: generateMockHistory(2),
};


// ── Live data state ───────────────────────────────────────────────────────────
// The live ticker advances the simulation clock every second and decides
// whether to emit a new record based on the current level and the elapsed
// time since the last record, matching the real hardware sampling rule.

const liveState = {
    1: { lastRecordAt: Date.now(), id: 200000, latestRecord: null },
    2: { lastRecordAt: Date.now(), id: 200000, latestRecord: null },
};

// Seed the live state with the most recent historic record for each pole
for (const poleId of [1, 2]) {
    const hist = mockHistory[poleId];
    if (hist.length > 0) {
        const last = hist[hist.length - 1];
        liveState[poleId].latestRecord = { ...last };
        liveState[poleId].id = last.id + 1;
        liveState[poleId].lastRecordAt = new Date(last.created_at).getTime();
    }
}

/* Ticks the live simulation forward every second.
** Emits a new record for a pole only when enough time has elapsed
** based on the current water level (1-min or 5-min interval).
*/
setInterval(() => {
    const now = simNow();   // sim-time — advances faster at speed > 1×

    for (const poleId of [1, 2]) {
        const state       = liveState[poleId];
        const level       = getEffectiveWaterLevel(now, poleId);
        const intervalMs  = level >= FAST_SAMPLE_THRESHOLD
            ? FAST_INTERVAL_MIN * 60 * 1000
            : SLOW_INTERVAL_MIN * 60 * 1000;

        if (now - state.lastRecordAt >= intervalMs) {
            // Only emit a record if the level is at or above the sensor's
            // minimum readable depth — below 1 inch the hardware returns nothing
            if (level >= MIN_READABLE_LEVEL) {
                state.latestRecord = {
                    id:         state.id++,
                    pole_id:    poleId,
                    waterlevel: level,
                    created_at: new Date(now).toISOString(),
                };
            }
            state.lastRecordAt = now;
        }
    }
}, 1000);


// ── Simulation state flags ────────────────────────────────────────────────────
// All flags start enabled. Use terminal commands to toggle them at runtime.
// See the command reference printed on startup for the full list.
let simMysqlConnected = true;
let simMqttConnected  = true;
// Individual pole online/offline flags — 1 = main, 2 = secondary, 3 = warning
let simPoleOnline     = { 1: true, 2: true, 3: true };

// ── Simulation speed ──────────────────────────────────────────────────────────
// simSpeed is a time multiplier. At 1× the clock matches wall time.
// At 60× one real second = one sim minute, so 5-min sample intervals fire
// every 5 real seconds and flood events complete 60× faster.
//
// simClockOriginReal  — wall-clock ms when speed was last changed
// simClockOriginSim   — sim-clock ms at that same moment
// Together they let simNow() reconstruct the current sim time from wall time.
let simSpeed           = 1;
let simClockOriginReal = Date.now();
let simClockOriginSim  = Date.now();

/* Returns the current simulation time in milliseconds.
** At 1× this equals Date.now(). At N× time advances N times faster,
** so durations measured in sim-time (sample intervals, flood phases) all
** compress by factor N without any other code needing to change.
** Parameters:
**     None
** Return:
**     number  sim-time unix ms
*/
function simNow() {
    const wallElapsed = Date.now() - simClockOriginReal;
    return simClockOriginSim + wallElapsed * simSpeed;
}

// ── Water level overrides ─────────────────────────────────────────────────────
// When set, these override the deterministic simulatedWaterLevel() model.
// null = use the normal simulation model.
// number = fixed override value in inches (held until cleared).
let simWaterOverride  = { 1: null, 2: null };

// ── Flood event state ─────────────────────────────────────────────────────────
// A flood event ramps a pole's water level from its current value up to a
// target level over riseMs milliseconds, then holds for holdMs, then recedes
// back to the baseline over recedeMs milliseconds.
// Each entry: { target, peak, startMs, riseMs, holdMs, recedeMs, baselineLevel }
let simFloodEvent     = { 1: null, 2: null };

/* Returns the effective simulated water level for a pole, taking into account
** any active override or flood event.
** Parameters:
**     number nowMs    current unix timestamp in ms
**     int    poleId   1 or 2
** Return:
**     float  water level in inches
*/
function getEffectiveWaterLevel(nowMs, poleId) {
    // Hard override takes priority over everything
    if (simWaterOverride[poleId] !== null) {
        return simWaterOverride[poleId];
    }

    // Flood event: interpolate through rise → hold → recede phases
    const event = simFloodEvent[poleId];
    if (event) {
        const elapsed = nowMs - event.startMs;
        const { baseline, peak, riseMs, holdMs, recedeMs } = event;

        if (elapsed < riseMs) {
            // Rising phase — ease-in curve for realism
            const t = elapsed / riseMs;
            const eased = t * t * (3 - 2 * t);        // smoothstep
            const level = baseline + (peak - baseline) * eased;
            return parseFloat(Math.min(12, Math.max(0, level)).toFixed(3));
        } else if (elapsed < riseMs + holdMs) {
            // Holding at peak
            return parseFloat(Math.min(12, peak).toFixed(3));
        } else if (elapsed < riseMs + holdMs + recedeMs) {
            // Receding phase — exponential decay for realism
            const t = (elapsed - riseMs - holdMs) / recedeMs;
            const eased = 1 - Math.pow(1 - t, 3);     // ease-out cubic
            const level = peak - (peak - baseline) * eased;
            return parseFloat(Math.min(12, Math.max(0, level)).toFixed(3));
        } else {
            // Event complete — clear it
            simFloodEvent[poleId] = null;
            console.log(` [Sim] Flood event on Pole ${poleId} complete — returning to baseline`);
        }
    }

    return simulatedWaterLevel(nowMs, poleId);
}

/* Derives the 3-character binary pole status string from the individual flags.
** '1' = online, '0' = offline.  Format: "[main][secondary][warning]"
** Parameters:
**     None
** Return:
**     string  e.g. '111', '100', '010'
*/
function getSimPoleStatus() {
    return (simPoleOnline[1] ? '1' : '0') +
           (simPoleOnline[2] ? '1' : '0') +
           (simPoleOnline[3] ? '1' : '0');
}


// ── Helpers ───────────────────────────────────────────────────────────────────
/* Returns a promise that resolves after the given number of milliseconds.
** Used throughout to simulate realistic network/hardware delays.
** Parameters:
**     int ms
** Return:
**     Promise<void>
*/
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* Generates a placeholder JPEG data URI for a simulated pole camera image.
** Draws a simple canvas-style SVG with pole info and current water level,
** then converts it to a minimal valid JPEG via a Buffer with real magic bytes.
**
** In a Node.js environment we can't use Canvas, so we return a small
** hand-crafted JPEG (the smallest valid JPEG, 1×1 pixel grey) embedded
** as a Buffer — this passes the front-end's JPEG magic-byte validation.
**
** The real dashboard immediately replaces it with the saved file path anyway,
** so the visual content doesn't matter for sim purposes.
**
** Parameters:
**     int poleId   1 or 2
** Return:
**     string  base64 data URI starting with "data:image/jpeg;base64,..."
*/
function generateSimImage(poleId) {
    // Minimal valid JPEG: SOI + APP0 JFIF header + minimal image data + EOI
    // These are the real magic bytes (FF D8 FF) the front-end checks for
    const jpeg = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0,  // SOI + APP0 marker
        0x00, 0x10,              // APP0 length (16 bytes)
        0x4A, 0x46, 0x49, 0x46, 0x00,  // "JFIF\0"
        0x01, 0x01,              // version 1.1
        0x00,                    // pixel aspect ratio: no units
        0x00, 0x01, 0x00, 0x01, // X/Y density: 1x1
        0x00, 0x00,              // no thumbnail
        // Minimal quantization table (required for valid JPEG)
        0xFF, 0xDB, 0x00, 0x43, 0x00,
        ...Array(64).fill(0x10),
        // Minimal start-of-frame (1x1 grey)
        0xFF, 0xC0, 0x00, 0x0B, 0x08,
        0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
        // Minimal huffman table
        0xFF, 0xC4, 0x00, 0x1F, 0x00,
        0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
        0x08, 0x09, 0x0A, 0x0B,
        // Minimal SOS + image data
        0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00,
        0x3F, 0x00, 0xF8, 0x0A,
        // EOI
        0xFF, 0xD9,
    ]);

    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}


// ── API endpoints ─────────────────────────────────────────────────────────────

/* Mirrors /api/config
** Returns the same timeout values used in the real server so the dashboard
** initialises with correct timeout constants in simulation mode.
*/
app.get('/api/config', (req, res) => {
    res.json({
        SOFT_PING_TIMEOUT:     5000,
        HARD_PING_TIMEOUT:     45000,
        LOAD_IMAGE_TIMEOUT:    5000,
        IMAGE_REQUEST_TIMEOUT: 30000,
    });
});


/* Mirrors /api/initdata
** Returns the pre-generated 8-day history for the requested pole,
** filtered to the last 8 days and ordered ASC — identical shape to
** what the real database returns.
** Returns 500 when MySQL is simulated as offline.
*/
app.get('/api/initdata', (req, res) => {
    if (!simMysqlConnected) {
        return res.status(500).json({ error: 'MySQL is offline (simulated)' });
    }
    const poleId      = parseInt(req.query.poleID);
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const data = (mockHistory[poleId] ?? [])
        .filter(r => new Date(r.created_at) >= eightDaysAgo);
    res.json(data);
});


/* Mirrors /api/data
** Returns the single most recent live record for the requested pole.
** If a water level override or flood event is active the returned record
** reflects the override level so the dashboard updates instantly.
** Returns 500 when MySQL is simulated as offline.
*/
app.get('/api/data', (req, res) => {
    if (!simMysqlConnected) {
        return res.status(500).json({ error: 'MySQL is offline (simulated)' });
    }
    const poleId = parseInt(req.query.poleID);
    const state  = liveState[poleId];

    // If an override is active, synthesise an up-to-date record immediately
    // so the dashboard does not have to wait for the next ticker interval.
    // IMPORTANT: use state.id++ (not state.id) so every synthesised record
    // gets a unique, incrementing ID. data.js gates on record.id > lastIDPole*,
    // so a repeated ID is silently ignored — meaning the display would freeze
    // at the override value even after it was cleared.
    if (simWaterOverride[poleId] !== null || simFloodEvent[poleId] !== null) {
        const now   = simNow();
        const level = getEffectiveWaterLevel(now, poleId);
        const record = {
            id:         state.id++,
            pole_id:    poleId,
            waterlevel: level,
            created_at: new Date(now).toISOString(),
        };
        // Keep latestRecord in sync so the ticker doesn't re-emit a stale
        // record with a lower ID on its next tick
        state.latestRecord = record;
        return res.json([record]);
    }

    if (state.latestRecord) {
        return res.json([state.latestRecord]);
    }

    // Fallback: last historic record
    const hist = mockHistory[poleId] ?? [];
    if (hist.length > 0) return res.json([hist[hist.length - 1]]);

    res.json([]);
});


/* Mirrors /api/ping/status — DB-only health check used by the 10-second interval.
** Simulates the SELECT 1 + MQTT publish round-trip with a short delay.
** Returns a 500 with the appropriate flags when any service is disabled.
*/
app.get('/api/ping/status', async (req, res) => {
    await delay(SOFT_PING_DELAY_MS);

    const mysql      = simMysqlConnected;
    const mqtt       = simMqttConnected;
    const poleStatus = getSimPoleStatus();
    const errors     = [];

    if (!mysql) errors.push('MySQL not connected');
    if (!mqtt)  errors.push('MQTT not connected');

    // If either core service is down, return early without pole status
    if (!mysql || !mqtt) {
        return res.status(500).json({ success: false, mysql, mqtt, errors });
    }

    const mainPole = simPoleOnline[1];
    const secPole  = simPoleOnline[2];
    const warnPole = simPoleOnline[3];

    if (!mainPole) errors.push('Main pole not responding');
    if (!secPole)  errors.push('Secondary pole not responding');
    if (!warnPole) errors.push('Warning pole not responding');

    const allPolesUp = mainPole && secPole && warnPole;

    return res.status(allPolesUp ? 200 : 500).json({
        success:    allPolesUp,
        mysql:      true,
        mqtt:       true,
        mainPole,
        secPole,
        warnPole,
        poleStatus,
        updated_at: new Date().toISOString(),
        errors,
    });
});


/* Mirrors /api/ping/full — active pole ping used by the Ping button only.
** Simulates the full MQTT publish → pole response round-trip delay.
** Returns a 500 with appropriate flags when any service is disabled.
*/
app.get('/api/ping/full', async (req, res) => {
    console.log(' [Sim] Full ping request received — simulating pole round-trip...');
    await delay(HARD_PING_DELAY_MS);

    const mysql      = simMysqlConnected;
    const mqtt       = simMqttConnected;
    const poleStatus = getSimPoleStatus();
    const errors     = [];

    if (!mysql) errors.push('MySQL not connected');
    if (!mqtt)  errors.push('MQTT not connected');

    if (!mysql || !mqtt) {
        return res.status(500).json({ success: false, mysql, mqtt, errors });
    }

    const mainPole = simPoleOnline[1];
    const secPole  = simPoleOnline[2];
    const warnPole = simPoleOnline[3];

    if (!mainPole) errors.push('Main pole did not respond');
    if (!secPole)  errors.push('Secondary pole did not respond');
    if (!warnPole) errors.push('Warning pole did not respond');

    const allPolesUp = mainPole && secPole && warnPole;

    return res.status(allPolesUp ? 200 : 500).json({
        success:    allPolesUp,
        mysql:      true,
        mqtt:       true,
        mainPole,
        secPole,
        warnPole,
        poleStatus,
        updated_at: new Date().toISOString(),
        errors,
    });
});


/* Mirrors /api/polestatus/latest
** Returns the last known pole status — used on dashboard init.
*/
app.get('/api/polestatus/latest', (req, res) => {
    res.json({ poleStatus: getSimPoleStatus(), updated_at: new Date().toISOString() });
});


/* Mirrors /api/imagerequest
** Simulates the full image capture flow:
**   1. MCU receives MQTT publish (instant in sim)
**   2. MCU captures image (~2s)
**   3. MCU writes to DB (~2s)
**   4. Broker signals DB-complete (~1s)
**   5. Server reads images from DB and returns them
** Total: IMAGE_REQUEST_DELAY_MS
*/
app.get('/api/imagerequest', async (req, res) => {
    console.log(' [Sim] Image request received — simulating MCU capture and DB write...');
    await delay(IMAGE_REQUEST_DELAY_MS);

    const images = [
        generateSimImage(1),
        generateSimImage(2),
    ];

    console.log(' [Sim] Image request complete — returning simulated images');
    res.json({ images });
});


/* Mirrors /api/images/latest
** Returns simulated images for both poles (used on dashboard init
** when no cached files exist on disk).
*/
app.get('/api/images/latest', async (req, res) => {
    await delay(300);
    res.json({
        images: [
            generateSimImage(1),
            generateSimImage(2),
        ],
    });
});


/* Mirrors /api/images/save
** Accepts base64 image data and writes it to disk just like the real server.
** This ensures the caching/freshness logic in images.js works correctly
** in simulation mode too.
*/
app.post('/api/images/save', (req, res) => {
    const { images } = req.body;

    if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'images array required' });
    }

    const filenames  = ['Pole1Image.jpg', 'Pole2Image.jpg'];
    const imagesDir  = path.join(ROOT, 'images');
    const saved      = [];

    images.forEach((dataUri, i) => {
        if (!dataUri || typeof dataUri !== 'string') return;
        const filename   = filenames[i];
        if (!filename) return;

        const base64Data = dataUri.replace(/^data:image\/\w+;base64,/, '');
        const buffer     = Buffer.from(base64Data, 'base64');
        const filePath   = path.join(imagesDir, filename);

        try {
            fs.writeFileSync(filePath, buffer);
            saved.push(filename);
            console.log(` [Sim] Saved ${filename} (${buffer.length} bytes)`);
        } catch (err) {
            console.error(` [Sim] Failed to write ${filename}:`, err.message);
        }
    });

    if (saved.length === 0) {
        return res.status(500).json({ error: 'No images could be written to disk' });
    }

    res.json({ saved });
});


// ── Sim overlay script ────────────────────────────────────────────────────────
/* Serves scripts/sim-overlay.js to the browser.
** This route does not exist in database.js, so the injected <script> tag
** simply 404s in production — no effect on the production dashboard.
*/
app.get('/sim-overlay.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'sim-overlay.js'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(SIM_PORT, () => {
    console.log('');
    console.log(' ========================================================== ');
    console.log('  RIPPLE Dashboard — Simulation Mode');
    console.log(' ========================================================== ');
    console.log('');
    console.log(` Server running at http://localhost:${SIM_PORT}`);
    console.log('');
    console.log(' [Sim] All systems simulated — no MySQL or MQTT required');
    console.log(` [Sim] Sampling rule: <${FAST_SAMPLE_THRESHOLD} in → every ${SLOW_INTERVAL_MIN} min | ≥${FAST_SAMPLE_THRESHOLD} in → every ${FAST_INTERVAL_MIN} min`);
    console.log('');
    printCommandHelp();
});


// ── Terminal command interface ─────────────────────────────────────────────────
/* Prints the full command reference to the terminal.
** Called on startup and when the user types 'help'.
** Parameters:
**     None
** Return:
**     None
*/
function printCommandHelp() {
    console.log(' ┌────────────────────────────────────────────────────────────────┐');
    console.log(' │               RIPPLE Sim — Terminal Commands                   │');
    console.log(' ├──────────────────────────────┬─────────────────────────────────┤');
    console.log(' │  SERVICES                    │  WATER LEVEL                    │');
    console.log(' │  mysql off / mysql on        │  set pole1 <inches>             │');
    console.log(' │  mqtt off  / mqtt on         │  set pole2 <inches>             │');
    console.log(' │                              │  set poles <inches>             │');
    console.log(' │  POLES                       │  clear pole1                    │');
    console.log(' │  pole1 off / pole1 on        │  clear pole2                    │');
    console.log(' │  pole2 off / pole2 on        │  clear poles                    │');
    console.log(' │  pole3 off / pole3 on        │                                 │');
    console.log(' │  poles off / poles on        │  FLOOD EVENTS                   │');
    console.log(' │                              │  flood pole1 <target> [opts]    │');
    console.log(' │  SPEED                       │  flood pole2 <target> [opts]    │');
    console.log(' │  speed <N>                   │  flood poles <target> [opts]    │');
    console.log(' │  speed reset                 │  stop flood pole1               │');
    console.log(' │                              │  stop flood pole2               │');
    console.log(' │  GENERAL                     │  stop flood poles               │');
    console.log(' │  status                      │                                 │');
    console.log(' │  help                        │                                 │');
    console.log(' └──────────────────────────────┴─────────────────────────────────┘');
    console.log('');
    console.log('  Water level commands:');
    console.log('    set pole1 4.5          → hold Pole 1 at exactly 4.5 inches');
    console.log('    set poles 0            → hold both poles at 0 (dry)');
    console.log('    clear pole1            → release Pole 1 back to simulation');
    console.log('    clear poles            → release both poles');
    console.log('');
    console.log('  Flood event options (all optional, defaults shown):');
    console.log('    flood pole1 8          → ramp to 8 in, 5 min rise, 10 min hold, 30 min recede');
    console.log('    flood pole2 6 rise=2   → override rise time to 2 minutes');
    console.log('    flood poles 10 hold=5 recede=15');
    console.log('');
    console.log('    Option keys: rise=<min>  hold=<min>  recede=<min>');
    console.log('');
    console.log('  Speed commands (sim time — affects sampling intervals & flood timing):');
    console.log('    speed 60          → 1 real second = 1 sim minute (fast demo)');
    console.log('    speed 300         → 1 real second = 5 sim minutes (very fast)');
    console.log('    speed reset       → return to 1× real-time');
    console.log('');
}

/* Prints the current state of all simulation flags.
** Parameters:
**     None
** Return:
**     None
*/
function printSimStatus() {
    const B   = '\x1b[96m';
    const GRN = '\x1b[32m';
    const RED = '\x1b[31m';
    const YLW = '\x1b[33m';
    const RST = '\x1b[0m';
    const on  = (v) => v ? `${GRN}ONLINE${B}` : `${RED}OFFLINE${B}`;

    const now = simNow();

    // Helper: describe the current effective water level for a pole
    function levelDesc(poleId) {
        if (simWaterOverride[poleId] !== null) {
            return `${YLW}${simWaterOverride[poleId].toFixed(2)} in (FIXED override)${B}`;
        }
        const ev = simFloodEvent[poleId];
        if (ev) {
            const elapsed = now - ev.startMs;
            let phase;
            if      (elapsed < ev.riseMs)                        phase = 'rising';
            else if (elapsed < ev.riseMs + ev.holdMs)            phase = 'at peak';
            else if (elapsed < ev.riseMs + ev.holdMs + ev.recedeMs) phase = 'receding';
            else    phase = 'complete';
            const current = getEffectiveWaterLevel(now, poleId);
            return `${YLW}${current.toFixed(2)} in (flood event — ${phase})${B}`;
        }
        const level = simulatedWaterLevel(now, poleId);
        return `${GRN}${level.toFixed(2)} in (auto)${B}`;
    }

    console.log('');
    console.log(`${B} [Sim] Current simulation state:`);
    console.log(`${B} [Sim]   MySQL          : ${on(simMysqlConnected)}`);
    console.log(`${B} [Sim]   MQTT           : ${on(simMqttConnected)}`);
    console.log(`${B} [Sim]   Pole 1 (main)  : ${on(simPoleOnline[1])}`);
    console.log(`${B} [Sim]   Pole 2 (sec)   : ${on(simPoleOnline[2])}`);
    console.log(`${B} [Sim]   Pole 3 (warn)  : ${on(simPoleOnline[3])}`);
    console.log(`${B} [Sim]   Pole status    : ${getSimPoleStatus()}`);
    console.log(`${B} [Sim]   Water Pole 1   : ${levelDesc(1)}`);
    console.log(`${B} [Sim]   Water Pole 2   : ${levelDesc(2)}`);
    console.log(`${B} [Sim]   Sim speed      : ${simSpeed === 1 ? `${GRN}1× (real-time)${B}` : `${YLW}${simSpeed}× (1 real sec = ${simSpeed} sim sec)${B}`}`);
    console.log(`${RST}`);
}

/* Parses and dispatches a single command string entered in the terminal.
** Parameters:
**     string line  raw input line from stdin
** Return:
**     None
*/
function handleCommand(line) {
    const raw   = line.trim();
    if (!raw) return;
    const cmd   = raw.toLowerCase();
    const parts = raw.split(/\s+/);    // preserve case for numeric args

    // ── Service toggles ────────────────────────────────────────────────────────
    if (cmd === 'mysql off') {
        simMysqlConnected = false;
        console.log(' [Sim] MySQL marked OFFLINE — /api/data and /api/initdata will return 500');
        return;
    }
    if (cmd === 'mysql on') {
        simMysqlConnected = true;
        console.log(' [Sim] MySQL marked ONLINE');
        return;
    }
    if (cmd === 'mqtt off') {
        simMqttConnected = false;
        console.log(' [Sim] MQTT marked OFFLINE — ping endpoints will report MQTT failure');
        return;
    }
    if (cmd === 'mqtt on') {
        simMqttConnected = true;
        console.log(' [Sim] MQTT marked ONLINE');
        return;
    }

    // ── Pole online/offline ────────────────────────────────────────────────────
    if (cmd === 'pole1 off') { simPoleOnline[1] = false; console.log(` [Sim] Main pole (1) OFFLINE — ${getSimPoleStatus()}`); return; }
    if (cmd === 'pole1 on')  { simPoleOnline[1] = true;  console.log(` [Sim] Main pole (1) ONLINE  — ${getSimPoleStatus()}`); return; }
    if (cmd === 'pole2 off') { simPoleOnline[2] = false; console.log(` [Sim] Secondary pole (2) OFFLINE — ${getSimPoleStatus()}`); return; }
    if (cmd === 'pole2 on')  { simPoleOnline[2] = true;  console.log(` [Sim] Secondary pole (2) ONLINE  — ${getSimPoleStatus()}`); return; }
    if (cmd === 'pole3 off') { simPoleOnline[3] = false; console.log(` [Sim] Warning pole (3) OFFLINE — ${getSimPoleStatus()}`); return; }
    if (cmd === 'pole3 on')  { simPoleOnline[3] = true;  console.log(` [Sim] Warning pole (3) ONLINE  — ${getSimPoleStatus()}`); return; }
    if (cmd === 'poles off') { simPoleOnline[1] = simPoleOnline[2] = simPoleOnline[3] = false; console.log(` [Sim] All poles OFFLINE — ${getSimPoleStatus()}`); return; }
    if (cmd === 'poles on')  { simPoleOnline[1] = simPoleOnline[2] = simPoleOnline[3] = true;  console.log(` [Sim] All poles ONLINE  — ${getSimPoleStatus()}`); return; }

    // ── Water level overrides: set pole1/pole2/poles <inches> ─────────────────
    // e.g.  "set pole1 4.5"   "set poles 0"   "set pole2 9"
    if (parts.length >= 3 && parts[0].toLowerCase() === 'set') {
        const target = parts[1].toLowerCase();
        const level  = parseFloat(parts[2]);

        if (isNaN(level) || level < 0 || level > 12) {
            console.log(' [Sim] Invalid level — must be a number between 0 and 12 inches');
            return;
        }

        const ids = target === 'poles' ? [1, 2]
                  : target === 'pole1' ? [1]
                  : target === 'pole2' ? [2]
                  : null;

        if (!ids) {
            console.log(` [Sim] Unknown target "${parts[1]}" — use pole1, pole2, or poles`);
            return;
        }

        for (const id of ids) {
            simWaterOverride[id] = parseFloat(level.toFixed(3));
            simFloodEvent[id]    = null;   // cancel any active flood event
        }
        const names = ids.map(i => `Pole ${i}`).join(' and ');
        console.log(` [Sim] ${names} fixed at ${level.toFixed(2)} in — use 'clear' to release`);
        return;
    }

    // ── Clear overrides: clear pole1/pole2/poles ───────────────────────────────
    if (parts.length >= 2 && parts[0].toLowerCase() === 'clear') {
        const target = parts[1].toLowerCase();

        const ids = target === 'poles' ? [1, 2]
                  : target === 'pole1' ? [1]
                  : target === 'pole2' ? [2]
                  : null;

        if (!ids) {
            console.log(` [Sim] Unknown target "${parts[1]}" — use pole1, pole2, or poles`);
            return;
        }

        for (const id of ids) {
            simWaterOverride[id] = null;
            simFloodEvent[id]    = null;
            // Force the ticker to emit a fresh real record on its very next
            // tick by expiring the sample interval. Without this, the ticker
            // might not fire again for up to 5 minutes, leaving the dashboard
            // stuck on the last override value until the next scheduled sample.
            liveState[id].lastRecordAt = 0;
        }
        const names = ids.map(i => `Pole ${i}`).join(' and ');
        console.log(` [Sim] ${names} released back to automatic simulation`);
        return;
    }

    // ── Flood events: flood pole1/pole2/poles <target> [rise=N] [hold=N] [recede=N]
    // Default timing: 5 min rise, 10 min hold, 30 min recede
    // All times are in minutes.
    if (parts.length >= 3 && parts[0].toLowerCase() === 'flood') {
        const target    = parts[1].toLowerCase();
        const peakLevel = parseFloat(parts[2]);

        if (isNaN(peakLevel) || peakLevel < 0 || peakLevel > 12) {
            console.log(' [Sim] Invalid flood target — must be 0–12 inches');
            return;
        }

        // Parse optional key=value overrides
        let riseMin   = 5;
        let holdMin   = 10;
        let recedeMin = 30;

        for (let i = 3; i < parts.length; i++) {
            const kv = parts[i].toLowerCase().split('=');
            if (kv.length !== 2) continue;
            const val = parseFloat(kv[1]);
            if (isNaN(val) || val < 0) { console.log(` [Sim] Invalid option: ${parts[i]}`); return; }
            if      (kv[0] === 'rise')   riseMin   = val;
            else if (kv[0] === 'hold')   holdMin   = val;
            else if (kv[0] === 'recede') recedeMin = val;
            else { console.log(` [Sim] Unknown option "${kv[0]}" — valid options: rise, hold, recede`); return; }
        }

        const ids = target === 'poles' ? [1, 2]
                  : target === 'pole1' ? [1]
                  : target === 'pole2' ? [2]
                  : null;

        if (!ids) {
            console.log(` [Sim] Unknown target "${parts[1]}" — use pole1, pole2, or poles`);
            return;
        }

        const now = simNow();
        for (const id of ids) {
            simWaterOverride[id] = null;   // clear any hard override
            simFloodEvent[id] = {
                baseline:  simulatedWaterLevel(now, id),   // snapshot current level
                peak:      peakLevel,
                startMs:   now,
                riseMs:    riseMin   * 60 * 1000,
                holdMs:    holdMin   * 60 * 1000,
                recedeMs:  recedeMin * 60 * 1000,
            };
        }

        const names = ids.map(i => `Pole ${i}`).join(' and ');
        console.log(` [Sim] Flood event started on ${names}:`);
        console.log(` [Sim]   Target: ${peakLevel.toFixed(2)} in`);
        console.log(` [Sim]   Rise: ${riseMin} min → Hold: ${holdMin} min → Recede: ${recedeMin} min`);
        console.log(` [Sim]   Total duration: ${(riseMin + holdMin + recedeMin).toFixed(1)} min`);
        return;
    }

    // ── Stop flood: stop flood pole1/pole2/poles ───────────────────────────────
    if (parts.length >= 3 && parts[0].toLowerCase() === 'stop' && parts[1].toLowerCase() === 'flood') {
        const target = parts[2].toLowerCase();

        const ids = target === 'poles' ? [1, 2]
                  : target === 'pole1' ? [1]
                  : target === 'pole2' ? [2]
                  : null;

        if (!ids) {
            console.log(` [Sim] Unknown target "${parts[2]}" — use pole1, pole2, or poles`);
            return;
        }

        for (const id of ids) {
            if (simFloodEvent[id]) {
                simFloodEvent[id]          = null;
                liveState[id].lastRecordAt = 0;   // force immediate real record on next tick
                console.log(` [Sim] Flood event on Pole ${id} cancelled — returning to auto simulation`);
            } else {
                console.log(` [Sim] Pole ${id} has no active flood event`);
            }
        }
        return;
    }

    // ── Speed control: speed <N> | speed reset ────────────────────────────────
    // Adjusts the simulation time multiplier without disrupting flood event
    // progress — the sim clock origin is re-anchored so elapsed time is
    // continuous across speed changes.
    if (parts.length >= 2 && parts[0].toLowerCase() === 'speed') {
        const arg = parts[1].toLowerCase();

        if (arg === 'reset') {
            // Re-anchor the sim clock at current sim time before changing speed
            simClockOriginSim  = simNow();
            simClockOriginReal = Date.now();
            simSpeed = 1;
            console.log(' [Sim] Speed reset to 1× (real-time)');
            return;
        }

        const multiplier = parseFloat(arg);
        if (isNaN(multiplier) || multiplier <= 0) {
            console.log(' [Sim] Invalid speed — must be a positive number (e.g. speed 60)');
            return;
        }
        if (multiplier > 3600) {
            console.log(' [Sim] Speed capped at 3600× (1 real second = 1 sim hour)');
            return;
        }

        // Re-anchor so the clock transition is seamless
        simClockOriginSim  = simNow();
        simClockOriginReal = Date.now();
        simSpeed = multiplier;

        const simSecPerRealSec = multiplier;
        let description;
        if      (simSecPerRealSec < 60)   description = `${simSecPerRealSec}× real-time`;
        else if (simSecPerRealSec < 3600) description = `1 real sec = ${(simSecPerRealSec/60).toFixed(1)} sim min`;
        else                              description = `1 real sec = ${(simSecPerRealSec/3600).toFixed(2)} sim hr`;

        console.log(` [Sim] Speed set to ${multiplier}× — ${description}`);
        console.log(` [Sim]   Slow sample interval (5 min) fires every ${(5*60/multiplier).toFixed(1)}s real time`);
        console.log(` [Sim]   Fast sample interval (1 min) fires every ${(60/multiplier).toFixed(1)}s real time`);
        return;
    }

    // ── General ────────────────────────────────────────────────────────────────
    if (cmd === 'status') { printSimStatus(); return; }
    if (cmd === 'help')   { printCommandHelp(); return; }

    console.log(` [Sim] Unknown command: "${raw}" — type 'help' for the command list`);
}

// Read commands from stdin line by line.
// setEncoding ensures multi-byte characters don't arrive split across chunks.
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
    // A single chunk may contain multiple newline-separated commands if the
    // user pastes input — split and handle each line individually
    chunk.split('\n').forEach(line => handleCommand(line));
});