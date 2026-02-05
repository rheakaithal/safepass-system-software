const mqtt = require('mqtt')
const fs = require('fs')

const host = '83ad0f202f85425e99ee81ecdda5e543.s1.eu.hivemq.cloud'
const port = '8883'
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`

const connectUrl = `mqtts://${host}:${port}`

const client = mqtt.connect(connectUrl, {
  clientId,
  clean: true,
  connectTimeout: 4000,
  username: 'Dashboard',
  password: 'Team13Capstone',
  reconnectPeriod: 1000
})

const topic = 'sensors/2/waterlevel'

client.on('connect', () => {
  console.log('Connected')

  client.subscribe([topic], () => {
    console.log(`Subscribe to topic '${topic}'`)
  })
})

client.on('message', (topic, payload) => {
    console.log('Received Message:', topic, payload.toString())
    
})
