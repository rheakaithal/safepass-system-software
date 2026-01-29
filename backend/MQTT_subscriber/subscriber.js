const mqtt = require('mqtt')

const client = mqtt.connect('mqtt://10.244.80.97:1883', {
  username: 'Sensor',
  password: 'Team13Capstone',
  clientId: 'debug-subscriber',
  clean: true
})

client.on('connect', () => {
  console.log('CONNECTED')
  client.subscribe('sensors/+/waterlevel', { qos: 1 })
})

client.on('message', (topic, message) => {
  console.log('RECEIVED:', topic, message.toString())
})

client.on('error', console.error)
