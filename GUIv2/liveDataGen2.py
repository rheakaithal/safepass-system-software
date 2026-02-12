import json
from datetime import datetime, timedelta
import random
import time

# Starting timestamp
current_time = datetime(2025, 11, 30, 2, 0, 0)

# Value ranges
POLE1_MIN, POLE1_MAX = 0.0, 10.0
POLE2_MIN, POLE2_MAX = 0.0, 10.0

# Starting values (middle of each range)
p1 = (POLE1_MIN + POLE1_MAX) / 2
p2 = (POLE2_MIN + POLE2_MAX) / 2

# Trend drift variables
p1_trend = random.uniform(-0.2, 0.2)
p2_trend = random.uniform(-0.3, 0.3)

# JSON file and counter
path = "C:\Users\parke\Desktop\SPS_UI\safepass-system-software\SPS_Dashboard\data.json"
json_entries = []
entry_id = 1

while True:

    # Occasionally change direction of trend
    if random.random() < 0.1:  # 5% chance every cycle
        p1_trend = random.uniform(-0.02, 0.02)
    if random.random() < 0.1:
        p2_trend = random.uniform(-0.03, 0.03)

    # Update levels smoothly
    p1 += p1_trend + random.uniform(-0.01, 0.01)  # small noise
    p2 += p2_trend + random.uniform(-0.015, 0.015)

    # Clamp to allowed range
    p1 = max(POLE1_MIN, min(p1, POLE1_MAX))
    p2 = max(POLE2_MIN, min(p2, POLE2_MAX))

    # Add Pole 1
    json_entries.append({
        "id": entry_id,
        "PoleID": 1,
        "waterLevel": round(p1, 2),
        "createsAt": current_time.strftime("%Y-%m-%dT%H:%M:%S")
    })
    entry_id += 1

    # Add Pole 2
    json_entries.append({
        "id": entry_id,
        "PoleID": 2,
        "waterLevel": round(p2, 2),
        "createsAt": current_time.strftime("%Y-%m-%dT%H:%M:%S")
    })
    entry_id += 1

    # Write file
    with open(path, "w") as f:
        f.write(json.dumps(json_entries, indent=2))

    # Move time forward
    current_time += timedelta(minutes=15)

    # Wait before next generation
    time.sleep(1)
