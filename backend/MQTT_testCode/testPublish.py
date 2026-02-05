import paho.mqtt.publish as publish

#Test reading, change in microcontroller

# MQTT Publish
pole_id = 2
waterlevel = 90

publish.single(
    f"sensors/{pole_id}/waterlevel", 
    payload=str(waterlevel),          # Message payload
    hostname="10.244.80.97",             # Broker IP address
    auth={"username":"Sensor", "password":"Team13Capstone"}, # Authentication
    qos=1
)









