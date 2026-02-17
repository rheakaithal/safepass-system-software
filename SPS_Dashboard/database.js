const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const mqtt = require('mqtt')
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

//MQTT constants
const HOSTNAME = '83ad0f202f85425e99ee81ecdda5e543.s1.eu.hivemq.cloud';
const PORT = '8883';
const connectUrl = `mqtts://${host}:${port}`;

const pubImageRequestTopic = 'dashboard/image/request';
const pubPingRequestTopic = 'dashbaord/ping/request';

const subImageRequestTopic = 'dashboard/image/resutl';
const subPingRequestTopic = 'dashbaord/ping/result';

//create MQTT broker connection
const client = mqtt.connect(connectUrl, {
    keepalive: 30,
    clean: true,
    connectTimeout: 4000,
     username: 'Dashboard',
     password: 'Team13Capstone',
    reconnectPeriod: 1000
});

//Connect and subscribe to topics
client.on('connect', () => {
    console.log('Connected');

    client.subscribe([subImageRequestTopic], () => {
        console.log(`Subscribe to topic '${topic}'`);
    });
    client.subscribe([subPingRequestTopic], () => {
        console.log(`Subscribe to topic '${topic}'`);
    });
});


// Create MySQL connection
const db = mysql.createConnection({
    host: '10.247.160.206',
    user: 'parker',
    password: 'Team13Capstone',
    database: 'my_database',
    port: 3306
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL!');
});


// Initial data fetch and write to data.json
db.query("SELECT * FROM users", (err, results) => { //users is table name
    if (err) {
        console.error("Query error:", err);
        return;
    }
    console.log("DB INIT QUERY");
    console.log(results);
});

app.get('/api/data', (req, res) => {
    db.query("SELECT * FROM users", (err, results) => {
        //get last ids from stored values
        //get last line of data from table
        //compare to stored data
        //if old -> discard
        //if new -> store
        if (err) {
            console.error("Query error:", err); 
            res.status(500).send("Error retrieving users");
            return;
        }
        console.log("API SQL CALL");
        console.log(results);
    });
});

app.get("/api/ping", async (req, res) => {
    //Ping Database
    //If good, ping mqtt
    //If good, send ping request
    //wait for response from broker
});

app.get("/api/imagerequest", async (req, res) => {
    //ping mqtt broker
    //send broker image request
    //wait for image to return from broker
});



app.listen(PORT, () => console.log('Server running on port ' + PORT)); //change port
