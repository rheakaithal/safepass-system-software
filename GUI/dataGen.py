import json
from datetime import datetime, timedelta
import random
import time

entries = []
start = datetime(2025, 11, 29, 10, 0, 0)
num_entries = 50  # 50 timestamps, each has 2 poles => 100 entries

pole1_start = 2.0
pole2_start = 4.5

pole1_end = random.uniform(3.0, 5.9)
pole2_end = random.uniform(6.0, 10.0)

# Linear trend increments
pole1_step = (pole1_end - pole1_start) / (num_entries - 1)
pole2_step = (pole2_end - pole2_start) / (num_entries - 1)

json_entries = []
entry_id = 1

for i in range(num_entries):
    t = start + timedelta(minutes=15 * i)

    # Base trend
    p1 = pole1_start + pole1_step * i
    p2 = pole2_start + pole2_step * i

    # Random noise
    p1 += random.uniform(-0.15, 0.15)
    p2 += random.uniform(-0.25, 0.25)

    # Append Pole 1
    json_entries.append({
        "id": entry_id,
        "PoleID": 1,
        "waterLevel": round(p1, 2),
        "createsAt": t.strftime("%Y-%m-%dT%H:%M:%S")
    })
    entry_id += 1

    # Append Pole 2
    json_entries.append({
        "id": entry_id,
        "PoleID": 2,
        "waterLevel": round(p2, 2),
        "createsAt": t.strftime("%Y-%m-%dT%H:%M:%S")
    })
    entry_id += 1

json_output = json.dumps(json_entries, indent=2)
path = 'data.json'
with open(path, 'w') as f:
    f.write(json_output)
