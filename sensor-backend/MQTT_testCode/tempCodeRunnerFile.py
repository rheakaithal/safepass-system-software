msg = [{'topic':"sensors/1/waterlevel", 'payload':round(pole1Value,2), 'qos':1},
          {'topic':"sensors/2/waterlevel", 'payload':round(pole2Value,2), 'qos':2}]
    publish.multiple(
       msg,
       hostname="83ad0f202f85425e99ee81ecdda5e543.s1.eu.hivemq.cloud",
       port=8883,
       auth={"username":"Sensor", "password":"Team13Capstone"},
       tls={}
    )