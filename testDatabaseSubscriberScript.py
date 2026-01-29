import paho.mqtt.client as mqtt
import mysql.connector
 
# MySQL connection
conn = mysql.connector.connect(
    host="127.0.0.1",
    user="root",
    password="Team13Capstone",
    database="my_database"
)
cursor = conn.cursor()

def on_connect(client, userdata, flags, rc):
    print("Connected with result code", rc)
    client.subscribe("sensors/+/waterlevel")

# Callback when a message is received
def on_message(client, userdata, msg):
    topic_parts = msg.topic.split("/")
    pole_id = int(topic_parts[1])
    waterlevel = int(msg.payload.decode())

    cursor.execute(
        "INSERT INTO users (pole_id, waterlevel) VALUES (%s, %s)",
        (pole_id, waterlevel)
    )
    conn.commit()
    print(f"Inserted: pole {pole_id}, waterlevel {waterlevel}")

# Set up MQTT client
client = mqtt.Client()
client.username_pw_set("Sensor", "Team13Capstone")
client.on_connect = on_connect
client.on_message = on_message

# Connect to broker
client.connect("127.0.0.1", 1883, 60)
client.loop_forever()
