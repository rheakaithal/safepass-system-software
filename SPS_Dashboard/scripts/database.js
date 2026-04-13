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
const mqtt = require('mqtt')
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') }); 
const app = express();

const showErrors = false;
const showErrorMsgs = false;

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
const WEBSITEPORT = parseInt(process.env.WEBSITE_PORT);

//MQTT constants
const HOSTNAME = process.env.MQTT_HOSTNAME;
const PORT = process.env.MQTT_PORT;
const connectUrl = `mqtts://${HOSTNAME}:${PORT}`;


const pubImageRequestTopic = process.env.MQTT_PUB_IMAGE_REQUEST;
const pubPingRequestTopic  = process.env.MQTT_PUB_PING_REQUEST;
const pubPingTopic  = process.env.MQTT_PING;

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
    if(showErrorMsgs){
        console.error('MQTT error:', err.message);
    }else if(showErrors){
        console.error('MQTT error');
    }
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
        if(showErrorMsgs){
            console.error('MySQL connection error:', err.message);
        }else if(showErrors){
            console.error('MySQL connection error');
        }
        scheduleReconnect();
    });

    db.connect((err) => {
        if (err) {
            mysqlConnected = false;
            if(showErrorMsgs){
                console.error('MySQL connect failed:', err.message);
            }else if(showErrors){
                console.error('MySQL connect failed');
            }
            
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
                if(showErrorMsgs){
                    console.error("Query error:", err);
                }else if(showErrors){
                    console.error("Query error");
                }
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
            if(showErrorMsgs){
                console.error("Query error:", err);
            }else if (showErrors){
                console.error("Query error");
            }
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
            pubPingTopic,
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

    // --- Active Pole Check ---
    // Publish ping request to MQTT broker and wait for response.
    // 45 second timeout awaiting for main sensor pole response
    const poleStatus = await new Promise((resolve) => {

        const timer = setTimeout(() => resolve(false), 45000);  //45 seconds

        client.publish(pubPingRequestTopic,"",{ qos: 1 });

        client.on('message',  (topic, message) => {
            if(topic !== subPingRequestTopic) return;
            
            let poleStatusResponse = message.toString().split(",");
            resolve(true);
        });
    });

    if (poleStatus) 
    {
        let warnPoleStatus = true;
        let secPoleStatus = true;
        if(poleStatusResponse[1] == 1)
        {
            secPoleStatus = false;
            errors.push("Secondary Pole not connected");
        }
        if(poleStatusResponse[2] == 1)
        {
            warnPoleStatus = false;
            errors.push("Warning Pole not connected");
        }
        return res.status(500).json({
            success: false,
            mysql: true,
            mqtt: true,
            mainPole: true,
            secPole: secPoleStatus,
            warnPole: warnPoleStatus,
            errors
        });
    } else {
        error.push("Main Pole not connected");
        return res.status(500).json({
            success: false,
            mysql: true,
            mqtt: true,
            mainPole: false,
            secPole: null, //unknown
            warnPole: null, //unkown
            errors
        });
    }

    res.json({
        success: true,
        mysql: true,
        mqtt: true,
        mainPole: false,
        secPole: false,
        warnPole: false
    });
});

    
app.get("/api/imagerequest", async (req, res) => {
    //send broker image request
    client.publish(pubPingRequestTopic, "", { qos: 1});
    
    let iamgeBuffer = {};
    const imageResult = await new promiseHooks((resolve) =>{

        const timer = setTimeout(() => resolve(false), 120000);     //2 minute timeout

        client.on('message', (topic, message) => {
            if(topic !== subImageRequestTopic) return;

            //Image packet recunstruction
        });
    });
});



app.listen(WEBSITEPORT, () => console.log(`Server running at http://localhost:${WEBSITEPORT}`));