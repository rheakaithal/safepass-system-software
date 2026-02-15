import json
from datetime import datetime, timedelta
import random
import time

# Starting timestamp
startTime = datetime(2026, 2, 15, 15, 0, 0)
pole1TimeDelta = random.uniform(-5, 5)
pole2TimeDelta = random.uniform(-5, 5)
pole1Time = startTime + timedelta(minutes = pole1TimeDelta)
pole2Time = startTime + timedelta(minutes = pole2TimeDelta)


# Value ranges
POLE1_MIN, POLE1_MAX = 0.0, 10.0
POLE2_MIN, POLE2_MAX = 0.0, 10.0

# Starting values (middle of each range)
p1 = 1.0
p2 = 0.0

# Trend drift variables
p1_trend = random.uniform(0, 1)
p2_trend = random.uniform(-1, 0.3)

# JSON file and counter
pole1DataPath = "safepass-system-software\SPS_Dashboard\pole1Data.json"
pole2DataPath = "safepass-system-software\SPS_Dashboard\pole2Data.json"
pole1_entry = []
pole2_entry = []
entry_id = 1

while True:
    # Update levels smoothly
    p1 += p1_trend 
    p2 += p2_trend 

    # Clamp to allowed range
    p1 = max(POLE1_MIN, min(p1, POLE1_MAX))
    p2 = max(POLE2_MIN, min(p2, POLE2_MAX))

    # Add Pole 1
    pole1_entry.append({
        "id": entry_id,
        "PoleID": 1,
        "waterlevel": round(p1, 2),
        "createdat": pole1Time.strftime("%Y-%m-%dT%H:%M:%S")
    })
    entry_id += 1

    # Add Pole 2
    pole2_entry.append({
        "id": entry_id,
        "PoleID": 2,
        "waterlevel": round(p2, 2),
        "createdat": pole2Time.strftime("%Y-%m-%dT%H:%M:%S")
    })
    entry_id += 1

    # Write file
    with open(pole1DataPath, "w") as f:
        f.write(json.dumps(pole1_entry, indent=2))
    with open(pole2DataPath, "w") as f:
        f.write(json.dumps(pole2_entry, indent=2))

    # Move time forward
    pole1Time += timedelta(minutes=5)
    pole2Time += timedelta(minutes=5)
    
    # Wait before next generation
    time.sleep(1)
