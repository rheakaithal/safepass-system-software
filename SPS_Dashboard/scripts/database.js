/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: database.js
** --------
** Contains the code for the backend server for the ems dashboard
*/


require('dotenv').config({ path: require('path').resolve(__dirname, '../safe.env') });
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const mqtt = require('mqtt')
const fs = require('fs');
const path = require('path');
const app = express();

// Project root is one level up from the scripts folder
const ROOT = path.resolve(__dirname, '..');

app.use(cors());
app.use(express.json());
app.use(express.static(ROOT));

// Explicitly serve SafePassSystem.html at the root
app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT, 'SafePassSystem.html'));
});

//database variables
const WEBSITEPORT = parseInt(process.env.WEBSITE_PORT) || 80;

//MQTT constants
const HOSTNAME = process.env.MQTT_HOSTNAME;
const PORT = process.env.MQTT_PORT;
const connectUrl = `mqtts://${HOSTNAME}:${PORT}`;


const pubImageRequestTopic = process.env.MQTT_PUB_IMAGE_REQUEST;
const pubPingRequestTopic  = process.env.MQTT_PUB_PING_REQUEST;

const subImageRequestTopic = process.env.MQTT_SUB_IMAGE_RESULT;
const subPingRequestTopic  = process.env.MQTT_SUB_PING_RESULT;

//create MQTT broker connection
const client = mqtt.connect(connectUrl, {
    keepalive: 5,          // Send keepalive every 5s so drops are detected quickly
    clean: true,
    connectTimeout: 4000,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    reconnectPeriod: 1000
});

// Track MQTT connection state dynamically via event listeners
// so /api/ping always reflects the real current status
let mqttConnected = false;

client.on('connect', () => {
    mqttConnected = true;
    console.log('Connected to MQTT');

    client.subscribe([subImageRequestTopic], () => {
        console.log(`Subscribe to topic '${pubImageRequestTopic}'`);
    });
    client.subscribe([subPingRequestTopic], () => {
        console.log(`Subscribe to topic '${subPingRequestTopic}'`);
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
    console.error('MQTT error:', err.message);
});

client.on('reconnect', () => {
    console.log('MQTT reconnecting...');
});


// MySQL connection config — stored separately so createConnection
// can be called again when reconnecting
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
*/
function connectMySQL() {
    // Clean up any existing connection before creating a new one
    if (db) {
        try { db.destroy(); } catch (_) {}
    }

    db = mysql.createConnection(dbConfig);

    db.on('error', (err) => {
        mysqlConnected = false;
        console.error('MySQL connection error:', err.message);
        scheduleReconnect();
    });

    db.connect((err) => {
        if (err) {
            mysqlConnected = false;
            console.error('MySQL connect failed:', err.message);
            scheduleReconnect();
            return;
        }
        mysqlConnected = true;
        console.log('Connected to MySQL!');
        // Clear any pending reconnect timer on success
        if (mysqlReconnectTimer) {
            clearTimeout(mysqlReconnectTimer);
            mysqlReconnectTimer = null;
        }
    });
}

/* Schedules a MySQL reconnect attempt after 5 seconds.
** Prevents overlapping retries with a guard timer.
*/
function scheduleReconnect() {
    if (mysqlReconnectTimer) return; // already scheduled
    console.log('MySQL reconnecting in 5s...');
    mysqlReconnectTimer = setTimeout(() => {
        mysqlReconnectTimer = null;
        connectMySQL();
    }, 5000);
}

// Initial connection
connectMySQL();


// Initial data fetch
app.get('/api/initdata', (req, res) => {

    const poleId = req.query.poleID;

    db.query(`SELECT * FROM users WHERE pole_id = ? AND created_at >= NOW() - INTERVAL 8 DAY ORDER BY created_at ASC`,
        [poleId],
        (err, results) => {

            if (err) {
                console.error("Query error:", err);
                return res.status(500).json({ error: "Query failed" });
            }

            res.json(results);
        }
    );
});



app.get('/api/data', (req, res) => {
    //get last data based on time stamp and the pole id
    const poleID = req.query.poleID;
    db.query("SELECT * FROM users WHERE pole_id = ? ORDER BY created_at DESC LIMIT 1", [poleID], (err, results) => {
        if (err) {
            console.error("Query error:", err); 
            res.status(500).send("Error retrieving users");
            return;
        }

        res.json(results);
    });  
});

app.get("/api/ping", async (req, res) => {
    let errors = [];

    // --- Active MySQL check ---
    // Attempt a real query so pressing ping can detect MySQL coming back
    // online even before the 5s reconnect timer fires
    const mysqlStatus = await new Promise((resolve) => {
        if (!mysqlConnected) {
            // Try an immediate reconnect attempt before giving up
            connectMySQL();
        }

        const timer = setTimeout(() => resolve(false), 3000);

        db.query('SELECT 1', (err) => {
            clearTimeout(timer);
            if (err) {
                mysqlConnected = false;
                resolve(false);
            } else {
                mysqlConnected = true;
                resolve(true);
            }
        });
    });

    if (!mysqlStatus) errors.push("MySQL not connected");

    // --- Active MQTT check ---
    // Attempt an actual publish with a 3s timeout so we catch cases where
    // the broker connection silently dropped before keepalive detected it
    const mqttStatus = await new Promise((resolve) => {
        if (!mqttConnected) {
            return resolve(false);
        }

        const timer = setTimeout(() => resolve(false), 3000);

        client.publish(
            pubPingRequestTopic,
            JSON.stringify({ timestamp: Date.now() }),
            { qos: 1 },           // QoS 1 requires a PUBACK from the broker
            (err) => {
                clearTimeout(timer);
                resolve(!err);    // err is null on success, Error on failure
            }
        );
    });

    if (!mqttStatus) errors.push("MQTT not connected");

    if (!mysqlStatus || !mqttStatus) {
        // Update the tracked state to match the active test result
        mqttConnected = mqttStatus;
        return res.status(500).json({
            success: false,
            mysql: mysqlStatus,
            mqtt: mqttStatus,
            errors
        });
    }

    res.json({
        success: true,
        mysql: true,
        mqtt: true
    });
});

    
app.get("/api/imagerequest", async (req, res) => {
    //send broker image request
    client.publish()
    //wait for image to return from broker
});



app.listen(WEBSITEPORT, () => console.log('Server running on port ' + WEBSITEPORT)); //change port