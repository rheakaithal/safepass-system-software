/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: database.js
** --------
** Contains the code for the backend server for the ems dashboard
*/

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const app = express();

const showErrors = false;
const showErrorMsgs = false;

if(showErrors) {
    console.log("Showing Errors");
} else {
    console.log("Not Showing Errors");
}
if(showErrorMsgs) {
    console.log("Showing Error Messages");
} else {
    console.log("Not Showing Error Messages");
}

// Project root is one level up from the scripts folder
const ROOT = path.resolve(__dirname, '..');

app.use(cors());
app.use(express.json());
app.use(express.static(ROOT));

// Explicitly serve SafePassSystem.html at the root
app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT, 'SafePassSystem.html'));
});

// ── Web server ────────────────────────────────────────────────────────────────
const WEBSITEPORT = parseInt(process.env.WEBSITE_PORT);

// ── MySQL table names (configured in .env) ────────────────────────────────────
const TABLE_USERS       = process.env.DB_TABLE_USERS;
const TABLE_POLE_STATUS = process.env.DB_TABLE_POLE_STATUS;

// ── MQTT constants ─────────────────────────────────────────────────────────────
const HOSTNAME = process.env.MQTT_HOSTNAME;
const PORT     = process.env.MQTT_PORT;
const connectUrl = `mqtts://${HOSTNAME}:${PORT}`;

const pubImageRequestTopic = process.env.MQTT_PUB_IMAGE_REQUEST;
const pubPingRequestTopic  = process.env.MQTT_PUB_PING_REQUEST;
const pubPingTopic         = process.env.MQTT_PING;

// Subscribe: broker signals DB image write is complete (payload "1")
const subImageStatusTopic  = process.env.MQTT_SUB_IMAGE_STATUS;
// Subscribe: broker pushes automatic pole status updates
const subPingRequestTopic  = process.env.MQTT_SUB_PING_RESULT;

// Source tables written directly by the RIPPLE hardware
const TABLE_POLE1_IMAGE    = process.env.DB_TABLE_POLE1_IMAGE;
const TABLE_POLE2_IMAGE    = process.env.DB_TABLE_POLE2_IMAGE;

// ── MQTT connection ───────────────────────────────────────────────────────────
const client = mqtt.connect(connectUrl, {
    keepalive: 5,           // Send keepalive every 5s so drops are detected quickly
    clean: true,
    connectTimeout: 4000,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    reconnectPeriod: 1000
});

// Track MQTT connection state dynamically via event listeners
// so /api/ping/status always reflects the real current state
let mqttConnected = false;

client.on('connect', () => {
    mqttConnected = true;
    console.log('Connected to MQTT');

    client.subscribe([subImageStatusTopic], () => {
        console.log(`Subscribed to topic '${subImageStatusTopic}'`);
    });
    client.subscribe([subPingRequestTopic], () => {
        console.log(`Subscribed to topic '${subPingRequestTopic}'`);
    });
});

client.on('disconnect', () => {
    mqttConnected = false;
    console.log('MQTT disconnected');
});

client.on('offline', () => {
    mqttConnected = false;
    console.log('MQTT offline');
});

client.on('error', (err) => {
    mqttConnected = false;
    if (showErrorMsgs) console.error('MQTT error:', err.message);
    else if (showErrors) console.error('MQTT error');
});

client.on('reconnect', () => {
    console.log('MQTT reconnecting...');
});

/* Persistent top-level MQTT message handler for automatic pole status updates.
** The MQTT broker pushes a pole status message to subPingRequestTopic whenever
** the poles send new water level data — no ping request is needed for this.
** Every message received here is saved to the database so the dashboard can
** read the latest pole status on its 10-second interval without ever sending
** a ping request to the poles.
**
** Pole status format: 3-character binary string
**   Position 0 — main pole      (1 = active, 0 = inactive)
**   Position 1 — secondary pole (1 = active, 0 = inactive)
**   Position 2 — warning pole   (1 = active, 0 = inactive)
**
** Known values:
**   "000" — no pole responding
**   "100" — main pole only
**   "101" — main + warning pole
**   "110" — main + secondary pole
**   "111" — all poles responding
*/
client.on('message', (topic, message) => {
    if (topic !== subPingRequestTopic) return;

    const raw = message.toString().trim();

    // Validate: must be exactly 3 characters of 0s and 1s
    if (!/^[01]{3}$/.test(raw)) {
        if (showErrorMsgs) console.error(`[Pole Status] Unexpected format received: "${raw}"`);
        return;
    }

    console.log(`[Pole Status] Automatic status update received: "${raw}"`);
});

// ── MySQL connection ──────────────────────────────────────────────────────────
// Config stored separately so createConnection can be called again on reconnect
const dbConfig = {
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

let db;
let mysqlConnected = false;
let mysqlReconnectTimer = null;

/* Creates a new MySQL connection, attaches error handling, and attempts to connect.
** On failure, schedules a retry every 5 seconds until the server comes back online.
** Uses a module-level 'db' variable so all routes always reference the latest connection.
** Parameters:
**     None
** Return:
**     None
*/
function connectMySQL() {
    if (db) {
        try { db.destroy(); } catch (_) {}
    }

    db = mysql.createConnection(dbConfig);

    db.on('error', (err) => {
        mysqlConnected = false;
        if (showErrorMsgs) console.error('MySQL connection error:', err.message);
        else if (showErrors) console.error('MySQL connection error');
        scheduleReconnect();
    });

    db.connect((err) => {
        if (err) {
            mysqlConnected = false;
            if (showErrorMsgs) console.error('MySQL connect failed:', err.message);
            else if (showErrors) console.error('MySQL connect failed');
            scheduleReconnect();
            return;
        }
        mysqlConnected = true;
        console.log('Connected to MySQL!');
        if (mysqlReconnectTimer) {
            clearTimeout(mysqlReconnectTimer);
            mysqlReconnectTimer = null;
        }
    });
}

/* Schedules a MySQL reconnect attempt after 5 seconds.
** Prevents overlapping retries with a guard timer.
** Parameters:
**     None
** Return:
**     None
*/
function scheduleReconnect() {
    if (mysqlReconnectTimer) return;
    console.log('MySQL reconnecting in 5s...');
    mysqlReconnectTimer = setTimeout(() => {
        mysqlReconnectTimer = null;
        connectMySQL();
    }, 5000);
}

// Initial connection
connectMySQL();


// ── API: Water level data ─────────────────────────────────────────────────────

/* Returns up to 8 days of historical water level records for a given pole.
** Used on dashboard initialization to populate the chart.
** Parameters (query): poleID
** Returns: array of records ordered by created_at ASC
*/
app.get('/api/initdata', (req, res) => {
    const poleId = req.query.poleID;

    db.query(
        `SELECT * FROM ${TABLE_USERS} WHERE pole_id = ? AND created_at >= NOW() - INTERVAL 8 DAY ORDER BY created_at ASC`,
        [poleId],
        (err, results) => {
            if (err) {
                if (showErrorMsgs) console.error('Query error:', err);
                else if (showErrors) console.error('Query error');
                return res.status(500).json({ error: 'Query failed' });
            }
            res.json(results);
        }
    );
});

/* Returns the single most recent water level record for a given pole.
** Parameters (query): poleID
** Returns: array (length 0 or 1) of the latest record
*/
app.get('/api/data', (req, res) => {
    const poleID = req.query.poleID;

    db.query(
        `SELECT * FROM ${TABLE_USERS} WHERE pole_id = ? ORDER BY created_at DESC LIMIT 1`,
        [poleID],
        (err, results) => {
            if (err) {
                if (showErrorMsgs) console.error('Query error:', err);
                else if (showErrors) console.error('Query error');
                return res.status(500).send('Error retrieving users');
            }
            res.json(results);
        }
    );
});


// ── API: Pole status ──────────────────────────────────────────────────────────

/* DB-only health check. Confirms MySQL and MQTT are live, then reads the
** most recent pole status row from the database.
**
** This is the endpoint used by the automatic 10-second dashboard interval.
** It NEVER publishes a ping request to the poles — the poles are not contacted.
** Pole status is kept current by the persistent MQTT listener above, which
** saves every broker-pushed update automatically.
**
** Returns:
**   { success, mysql, mqtt, mainPole, secPole, warnPole, poleStatus, updated_at, errors[] }
**
** poleStatus: 3-character binary string ("111", "110", "101", "100", "000")
**   [0] main pole  [1] secondary pole  [2] warning pole  (1=active, 0=inactive)
*/
app.get('/api/ping/status', async (req, res) => {
    let errors = [];

    // --- MySQL liveness check ---
    const mysqlStatus = await new Promise((resolve) => {
        if (!mysqlConnected) connectMySQL();

        const timer = setTimeout(() => resolve(false), 3000);

        db.query('SELECT 1', (err) => {
            clearTimeout(timer);
            if (err) { mysqlConnected = false; resolve(false); }
            else     { mysqlConnected = true;  resolve(true);  }
        });
    });

    if (!mysqlStatus) errors.push('MySQL not connected');

    // --- MQTT liveness check ---
    // Publishes a test heartbeat — does NOT request a pole response
    const mqttStatus = await new Promise((resolve) => {
        if (!mqttConnected) return resolve(false);

        const timer = setTimeout(() => resolve(false), 3000);

        client.publish(
            pubPingTopic,
            "PING TEST",
            { qos: 1 },
            (err) => {
                clearTimeout(timer);
                resolve(!err);
            }
        );
    });

    if (!mqttStatus) errors.push('MQTT not connected');

    if (!mysqlStatus || !mqttStatus) {
        mqttConnected = mqttStatus;
        return res.status(500).json({
            success: false,
            mysql:   mysqlStatus,
            mqtt:    mqttStatus,
            errors
        });
    }

    // --- Read latest pole status from database ---
    const statusRow = await new Promise((resolve) => {
        db.query(
            `SELECT * FROM ${TABLE_POLE_STATUS}`,
            (err, results) => {
                if (err) resolve(null);
                else resolve(results[0] ?? null);
            }
        );
    });

    if (!statusRow) {
        // Infrastructure is up but no pole status has been received yet
        return res.json({
            success:    true,
            mysql:      true,
            mqtt:       true,
            poleStatus: null,
            updated_at: null,
            errors
        });
    }

    const raw      = statusRow.status;
    const mainPole = raw[0] === '1';
    const secPole  = raw[1] === '1';
    const warnPole = raw[2] === '1';

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
        poleStatus: raw,
        updated_at: statusRow.updated_at,
        errors
    });
});


/* Full active pole ping. Confirms MySQL and MQTT, then publishes a ping
** request to the poles and waits up to 45 seconds for a response.
**
** Use ONLY when the user presses the Ping button — this actively contacts
** the poles and should not be called on any automatic interval.
**
** The persistent MQTT listener above handles saving the response to the DB,
** so this endpoint does not need to write to the database itself.
**
** Returns:
**   { success, mysql, mqtt, mainPole, secPole, warnPole, poleStatus, updated_at, errors[] }
*/
app.get('/api/ping/full', async (req, res) => {
    let errors = [];

    // --- MySQL liveness check ---
    const mysqlStatus = await new Promise((resolve) => {
        if (!mysqlConnected) connectMySQL();

        const timer = setTimeout(() => resolve(false), 3000);

        db.query('SELECT 1', (err) => {
            clearTimeout(timer);
            if (err) { mysqlConnected = false; resolve(false); }
            else     { mysqlConnected = true;  resolve(true);  }
        });
    });

    if (!mysqlStatus) errors.push('MySQL not connected');

    // --- MQTT liveness check ---
    const mqttStatus = await new Promise((resolve) => {
        if (!mqttConnected) return resolve(false);

        const timer = setTimeout(() => resolve(false), 3000);

        client.publish(
            pubPingTopic,
            "PING TEST",
            { qos: 1 },
            (err) => {
                clearTimeout(timer);
                resolve(!err);
            }
        );
    });

    if (!mqttStatus) errors.push('MQTT not connected');

    if (!mysqlStatus || !mqttStatus) {
        mqttConnected = mqttStatus;
        return res.status(500).json({
            success: false,
            mysql:   mysqlStatus,
            mqtt:    mqttStatus,
            errors
        });
    }
    // --- Active pole ping ---
    // Publishes a ping request and waits for the pole to respond with a
    // 3-character binary status string. The persistent listener above will
    // also catch this response and save it to the database automatically.
    const poleResponse = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 15000);

        // One-shot listener — removes itself after the first valid response
        // so it doesn't accumulate across repeated button presses
        const onMessage = (topic, message) => {
            if (topic !== subPingRequestTopic) return;
            const raw = message.toString().trim();
            if (!/^[01]{3}$/.test(raw)) return;  // ignore malformed messages
            clearTimeout(timer);
            client.removeListener('message', onMessage);
            resolve(raw);
        };

        client.on('message', onMessage);
        client.publish(pubPingRequestTopic, 'PING REQUEST', { qos: 1 });
    });

    if (!poleResponse) {
        errors.push('Main pole did not respond within 45 seconds');
        client.publish('sensor/ping/response', "000", {qos: 1});
        console.log("[Ping] DB Updated");
        return res.status(500).json({
            success:    false,
            mysql:      true,
            mqtt:       true,
            mainPole:   false,
            secPole:    null,
            warnPole:   null,
            poleStatus: '000',
            updated_at: null,
            errors
        });
    }

    const mainPole = poleResponse[0] === '1';
    const secPole  = poleResponse[1] === '1';
    const warnPole = poleResponse[2] === '1';

    if (!mainPole) errors.push('Main pole not responding');
    if (!secPole)  errors.push('Secondary pole not responding');
    if (!warnPole) errors.push('Warning pole not responding');

    const allPolesUp = mainPole && secPole && warnPole;


    return res.status(allPolesUp ? 200 : 500).json({
        success:    allPolesUp,
        mysql:      true,
        mqtt:       true,
        mainPole: mainPole,
        secPole: secPole,
        warnPole: warnPole,
        poleStatus: poleResponse,
        updated_at: null,
        errors
    });
});


/* Returns the most recently saved pole status row from the database.
** Called on dashboard initialization to restore last known state without
** issuing any MQTT request.
** Parameters (query): none
** Returns: { poleStatus: string|null, updated_at: string|null }
*/
app.get('/api/polestatus/latest', (req, res) => {
    db.query(
        `SELECT * FROM ${TABLE_POLE_STATUS}`,
        (err, results) => {
            if (err) {
                if (showErrorMsgs) console.error('Query error:', err);
                else if (showErrors) console.error('Query error');
                return res.status(500).json({ error: 'Query failed' });
            }
            if (results.length === 0) return res.json({ poleStatus: null, updated_at: null });
            res.json({ poleStatus: results[0].status, updated_at: results[0].updated_at });
        }
    );
});


// ── API: Images ───────────────────────────────────────────────────────────────

/* Fetches the latest raw image binary from one of the hardware image tables.
** The RIPPLE system writes directly to pole1_image / pole2_image.
** Table structure: [id | raw_binary | created_at]
** Selects the most recent row (highest id) and returns the value in column index 1.
** Parameters:
**     string tableName  — TABLE_POLE1_IMAGE or TABLE_POLE2_IMAGE
** Return:
**     Promise<Buffer|null>  raw image binary, or null on error / no rows
*/
function fetchRawImageFromDB(tableName) {
    return new Promise((resolve) => {
        db.query(
            `SELECT * FROM ${tableName}`,
            (err, results) => {
                if (err) {
                    console.log(err);
                    if (showErrorMsgs) console.error(`[DB] Failed to read ${tableName}:`, err);
                    else if (showErrors) console.error(`[DB] Failed to read ${tableName}`);
                    return resolve(null);
                }
                if (!results || results.length === 0) {
                    console.warn(`[DB] No rows found in ${tableName}`);
                    return resolve(null);
                }
                // Column index 1 (0=id, 1=raw binary, 2=created_at)
                const dbResult = results[0].image_data;
                resolve(dbResult);
            }
        );
    });
}/* fetchRawImageFromDB() */

/* Returns the most recently saved image for each sensor pole.
** Parameters (query): none
** Returns: { images: [{ pole_id, image_data, captured_at }, ...] }
*/
app.get('/api/images/latest', async (req, res) => {
    const [raw1, raw2] = await Promise.all([
        fetchRawImageFromDB(TABLE_POLE1_IMAGE),
        fetchRawImageFromDB(TABLE_POLE2_IMAGE)
    ]);

    if (!raw1 && !raw2) {
        return res.status(500).json({ error: 'Both image tables returned no data' });
    }

    // Convert raw binary to base64 data URI — Buffer.from handles both
    // Buffer values (mysql2 BLOB) and string values gracefully
    const toDataUri = (raw) => {
        if (!raw) return null;
        const b64 = Buffer.isBuffer(raw) ? raw.toString('base64') : Buffer.from(raw).toString('base64');
        return `data:image/jpeg;base64,${b64}`;
    };

    const images = [toDataUri(raw1), toDataUri(raw2)];

    console.log(`[Image] Pole 1 image: ${raw1 ? images[0].length + ' chars' : 'missing'}`);
    console.log(`[Image] Pole 2 image: ${raw2 ? images[1].length + ' chars' : 'missing'}`);

    res.json({ images });
});


/* Requests images from the RIPPLE system via MQTT, then reads the assembled
** images from the MySQL database once the broker signals completion.
**
** Flow:
**   1. Publish request to pubImageRequestTopic — poles capture and write images to DB
**   2. Wait for subImageStatusTopic to receive payload "1" (DB write complete)
**   3. Query pole1_image and pole2_image for the latest row, column 1 (raw binary)
**   4. Convert raw binary to base64 data URI
**   5. Cache each image in TABLE_POLE_IMAGES for dashboard reload on init
**   6. Return { images: [dataUri, dataUri] }
**
** Parameters (query): none
** Returns: { images: string[] } — base64 data URIs, one per pole
*/
app.get('/api/imagerequest', async (req, res) => {
    const IMAGE_TIMEOUT = 300000;   // 5 minutes for the DB write to complete

    console.log('[Image] Publishing image request to RIPPLE system');
    client.publish(pubImageRequestTopic, 'IMAGE REQUEST', { qos: 1 });

    // ── Wait for the DB-complete signal from the broker ───────────────────────
    // The RIPPLE system writes both images to the DB, then publishes "1" to
    // subImageStatusTopic. We wait for that signal before querying the DB.
    console.log(`[Image] Waiting for DB-complete signal on "${subImageStatusTopic}"...`);

    const dbReady = await new Promise((resolve) => {
        const timer = setTimeout(() => {
            client.removeListener('message', onStatusMessage);
            console.error(`[Image] Timed out after ${IMAGE_TIMEOUT / 1000 / 60} Minutes waiting for DB-complete signal`);
            resolve(false);
        }, IMAGE_TIMEOUT);

        const onStatusMessage = (topic, message) => {
            if (topic !== subImageStatusTopic) return;
            const payload = message.toString().trim();
            if (payload !== '1') return;    // ignore any other payloads on this topic
            clearTimeout(timer);
            client.removeListener('message', onStatusMessage);
            console.log('[Image] DB-complete signal received');
            resolve(true);
        };

        client.on('message', onStatusMessage);
    });

    if (!dbReady) {
        return res.status(504).json({ error: 'Image request timed out — no DB-complete signal received' });
    }

    // ── Read raw images from the hardware tables ──────────────────────────────
    console.log('[Image] Reading raw images from database...');

    const [raw1, raw2] = await Promise.all([
        fetchRawImageFromDB(TABLE_POLE1_IMAGE),
        fetchRawImageFromDB(TABLE_POLE2_IMAGE)
    ]);

    if (!raw1 && !raw2) {
        return res.status(500).json({ error: 'Both image tables returned no data' });
    }

    // Convert raw binary to base64 data URI — Buffer.from handles both
    // Buffer values (mysql2 BLOB) and string values gracefully
    const toDataUri = (raw) => {
        if (!raw) return null;
        const b64 = Buffer.isBuffer(raw) ? raw.toString('base64') : Buffer.from(raw).toString('base64');
        return `data:image/jpeg;base64,${b64}`;
    };

    const images = [toDataUri(raw1), toDataUri(raw2)];

    console.log(`[Image] Pole 1 image: ${raw1 ? images[0].length + ' chars' : 'missing'}`);
    console.log(`[Image] Pole 2 image: ${raw2 ? images[1].length + ' chars' : 'missing'}`);

    res.json({ images });
});


app.listen(WEBSITEPORT, () => console.log(`Server running at http://localhost:${WEBSITEPORT}`));