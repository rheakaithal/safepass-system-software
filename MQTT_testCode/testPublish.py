<<<<<<< HEAD:testPublish.py
import paho.mqtt.publish as publish

#Test reading, change in microcontroller
pole_id = 2
waterlevel = 100

publish.single(
    f"sensors/{pole_id}/waterlevel",  # Topic, pole id is implicit from reading and waterlevel (int) is stored to the lowest level
    payload=str(waterlevel),          # Message payload, uploads waterlevel recorded to the lowest level topic
    hostname="10.244.80.97",             # Broker IP (database, change when accessed by microcontroller)
    auth={"username":"Sensor", "password":"Team13Capstone"},
    qos=1
=======
import paho.mqtt.publish as publish

#Test reading, change in microcontroller
pole_id = 2
waterlevel = 30

publish.single(
    f"sensors/{pole_id}/waterlevel",  # Topic, pole id is implicit from reading and waterlevel (int) is stored to the lowest level
    payload=str(waterlevel),          # Message payload, uploads waterlevel recorded to the lowest level topic
    hostname="10.244.80.97",             # Broker IP (database, change when accessed by microcontroller)
    auth={"username":"Sensor", "password":"Team13Capstone"},
    qos=1
>>>>>>> 07352556e53fc5a8630f6a3a2110a8a1d93ee360:MQTT_testCode/testPublish.py
)