import paho.mqtt.publish as publish
import time as t
import random

#Test reading, change in microcontroller

# MQTT Publish
pole1Value = 2.0
pole2Value = 1.0
stepSize = 0.1
direction1 = 1
direction2 = 1


while 1:
    print(pole1Value, pole2Value)
    #msg = [{'topic':"sensors/1/waterlevel", 'payload':round(pole1Value,2), 'qos':1},
    #       {'topic':"sensors/2/waterlevel", 'payload':round(pole2Value,2), 'qos':2}]
    #publish.multiple(
    #    msg,
    #    hostname="83ad0f202f85425e99ee81ecdda5e543.s1.eu.hivemq.cloud",
    #    port=8883,
    #    auth={"username":"Sensor", "password":"Team13Capstone"},
    #    tls={}
    #)
    publish.single(
    f"sensors/1/waterlevel", 
    payload = pole1Value,          # Message payload
    hostname="83ad0f202f85425e99ee81ecdda5e543.s1.eu.hivemq.cloud",             # Broker IP address
    auth={"username":"Sensor", "password":"Team13Capstone"}, # Authentication
    tls={},
    qos=1
)
    if(pole1Value >= 8.0 or pole1Value <= 0):
        direction1 *= -1
    if(pole2Value >= 8.0 or pole2Value <= 0):
        direction2 *= -1
    pole1Value = round(pole1Value + (stepSize + random.uniform(-0.1, 0.1)) * direction1,2)
    pole2Value = round(pole2Value + (stepSize + random.uniform(-0.1, 0.1)) * direction2,2)
    t.sleep(1)