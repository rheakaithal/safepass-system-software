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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
        console.log(`Subscribe to topic '${subImageRequestTopic}'`);
    });
    client.subscribe([subPingRequestTopic], () => {
        console.log(`Subscribe to topic '${subPingRequestTopic}'`);
    });
    client.subscribe([pubPingRequestTopic], () => {
        console.log(`Subscribe to topic '${pubPingRequestTopic}'`);
    })
});


console.log('Running Test Code...');

client.on('message', (topic, message) => {
    console.log('Message Received\n');
    if(topic === subImageRequestTopic){
        console.log(`[Image Req] Image data received on ${topic}\nPayload: ${message}\nType: ${typeof(message)}`);
    }
    else if(topic === subPingRequestTopic){
        console.log(`[Ping Req] Ping results received on ${topic}\nPayload: ${message}\nType: ${typeof(message)}`);
    }
    else if(topic === pubPingRequestTopic)
    {
        console.log(`[Ping Req] Ping Request received... Publishing Status to ${subPingRequestTopic}`);
        // sleep(10000);
        // const poleStatus = "101";
        // client.publish(subPingRequestTopic, poleStatus, {qos: 1});
    }
    else{
        console.log(`[Error] Incorrect topic Recieved | Topic: ${topic}`);
    }
});



