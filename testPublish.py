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
)