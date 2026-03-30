# Safepass App Testing Guide 🧪

Welcome! Testing the live SafePass mobile architecture is designed to be completely frictionless. You don't need to manually configure any brokers or touch any backend code. 

## Step 1 [FOR DEVELOPER]: Boot the Mobile App via Expo
From the `ios-app` root directory, simply run:
```bash
npx expo start --tunnel
```
Open the **Expo Go** app on your physical iOS/Android device and scan the massive QR code that pops up in the terminal.

*(Note: Push notifications strictly require a physical device. Simulators will run the app but cannot generate Expo Push Tokens).*

## Step 1 [FOR TESTER]:
Have ExpoGo app downloaded, this is the demo environment.
Log in with team gmail (must be logged through [EMAIL_ADDRESS] to work)
Scan the QR-code in the drive at Software > App > Test to open the app within ExpoGo.


## Step 2: Grant Notification Permissions
When the app launches for the first time, your phone will ask for permission to send notifications. **You must press Allow.**
Behind the scenes, the app will instantly generate a unique `ExpoPushToken` and publish it to the backend infrastructure.

## Step 3: Run the Interactive Water Tester
Open a second terminal window, navigate to the backend folder, and start the interactive data generator:
```bash
cd ios-app/components/backend
node interactiveTest.js
```
The script will actively stall and wait. **Once your mobile app successfully connects, the terminal will print:**
`📱 Push Device Connected! You can now trigger alerts.`

## Step 4: Trigger Active Flood Alerts
You can now freely submit simulated water levels (measured in **inches**) to test the app's real-time UI updates and push notification dispatchers. 

### Input Syntax
- **Basic:** Type a number like `4.5` (defaults to testing Pole 1)
- **Advanced:** Type `[Pole] [Level]` like `2 6.5` to explicitly target Pole 2. 
*(Note: To prevent UI ghost-poles, the system restricts inputs strictly to Pole 1 and Pole 2).*

### Thresholds
- 🛑 **>= 6.0 in** = CRITICAL (Triggers Red UI & "Road Closed" Push)
- ⚠️ **>= 2.0 in** = WARNING (Triggers Orange UI & "Heavy Rain" Push)
- ✅ **< 2.0 in** = SAFE (Triggers Green UI & "Roads Clear" Push)

If you have the app closed or minimized in your pocket when you hit `Enter` on a Critical water level, your phone will instantly light up with a native OS-level push notification!
