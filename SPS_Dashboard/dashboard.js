/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: dashboard.js
** --------
** contentDescription
*/


//Creates global variables
let chartUpdateInterval = null;
let lastIDPole1;
let lastIDPole2;
let pole1Data = [];
let pole2Data = [];
let alarmState = {
    pole1Flooding: false,
    pole2Flooding: false,
    alarmPlaying: false,
    alarmInterval: null
};

/* Plays alarm for set amount of time at set volume
** Used to alert users of flooding event
** Uses the webkitAudioContect API to create alarm sound
** Uses sine waves at different freqencies to create alarm
** Parameters:
**     float volume (0.0 to 1.0)
**     int duration
** Return:
**     None
*/
function playAlarmSound(volume = 0.7, duration = 2000) {
    if (!settings.alarmEnabled) return null;
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Create alarm sound (alternating frequencies for urgency)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.25);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.5);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.75);
        
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
        
        return { oscillator, audioContext };
    } catch (error) {
        console.error('Error playing alarm sound:', error);
        return null;
    }
}/* playAlarmSound() */

/* Starts playing alarm, when called, every 3 seconds
** Continues until stopContinuousAlarm() is called
** Parameters:
**     None
** Return:
**     None
*/
function startContinuousAlarm() {
    if (!settings.alarmEnabled || alarmState.alarmPlaying) return;
    
    alarmState.alarmPlaying = true;
    
    // Play alarm sound immediately
    playAlarmSound(settings.alarmVolume, 1500);
    
    // Continue playing every 3 seconds
    alarmState.alarmInterval = setInterval(() => {
        if (alarmState.alarmPlaying && settings.alarmEnabled) {
            playAlarmSound(settings.alarmVolume, 1500);
        }
    }, 3000);
}/* startContinuousAlarm() */

/* stops continuouse alarm and clears interval from alarm state
** Parameters:
**     None
** Return:
**     None
*/
function stopContinuousAlarm() {
    alarmState.alarmPlaying = false;
    
    if (alarmState.alarmInterval) {
        clearInterval(alarmState.alarmInterval);
        alarmState.alarmInterval = null;
    }
}/* stopContinuousAlarm() */

/* creates red boarder around dashboard to show visual warning of critical flood
** Parameters:
**     bool isFlooding
** Return:
**     None
*/
function updateBorderPulse(isFlooding) {
    const body = document.body;
    
    if (isFlooding) {
        // Adds pulsing red border
        body.style.boxShadow = 'inset 0 0 0 8px rgba(220, 38, 38, 0.6)';
        body.style.animation = 'borderPulse 1.5s ease-in-out infinite';
        
        // Adds keyframe animation
        if (!document.getElementById('borderPulseStyle')) {
            const style = document.createElement('style');
            style.id = 'borderPulseStyle';
            style.textContent = `
                @keyframes borderPulse {
                    0%, 100% {
                        box-shadow: inset 0 0 0 8px rgba(220, 38, 38, 0.8);
                    }
                    50% {
                        box-shadow: inset 0 0 0 8px rgba(220, 38, 38, 0.3);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    } else {
        // Remove pulsing border
        body.style.boxShadow = 'none';
        body.style.animation = 'none';
    }
}/* updateBorderPulse() */

/* Checks flooding status of both poles and starts/stop alarm based on flooding status
** Parameters:
**     None
** Return:
**     None
*/
function checkFloodingStatus(pole1Level, pole2Level) {
    const pole1WasFlooding = alarmState.pole1Flooding;
    const pole2WasFlooding = alarmState.pole2Flooding;
    
    // Check current flooding status
    alarmState.pole1Flooding = pole1Level >= settings.criticalThreshold;
    alarmState.pole2Flooding = pole2Level >= settings.criticalThreshold;
    
    const anyFlooding = alarmState.pole1Flooding || alarmState.pole2Flooding;
    const wasFlooding = pole1WasFlooding || pole2WasFlooding;
    
    // Update visual border alert
    updateBorderPulse(anyFlooding);
    
    // Start alarm if flooding just started
    if (anyFlooding && !wasFlooding) {
        startContinuousAlarm();
        console.log('CRITICAL FLOODING DETECTED - ALARM ACTIVATED');
    }
    
    // Stop alarm if flooding has stopped
    if (!anyFlooding && wasFlooding) {
        stopContinuousAlarm();
        console.log('Flooding subsided - Alarm stopped');
    }
}/* checkFloodingStatus() */

/* Predicts time to flood using linear interpolation of the last 10 points
** Only returns a value if under the critical threshold, less than 120 minutes, and trenging positively
** Parameters:
**     array dataPoints
**     float criticalThreshold
** Return:
**     float timeToFloodMinutes
**     -or-
**     null 
**     -or-
**     0
*/
function predictTimeToFlood(dataPoints, criticalThreshold, currentLevel) {
    // Need at least 2 points to calculate a trend
    if (dataPoints.length < 2) {
        return null;
    }
    
    // Get the last 10 points (or fewer if not available) for trend calculation
    const recentPoints = dataPoints.slice(-10);
    
    // Calculate average rate of change (inches per millisecond)
    let totalRateChange = 0;
    let validIntervals = 0;
    
    for (let i = 1; i < recentPoints.length; i++) {
        const timeDiff = new Date(recentPoints[i].created_at).getTime() - new Date(recentPoints[i - 1].created_at).getTime();
        const waterDiff = recentPoints[i].waterlevel - recentPoints[i - 1].waterlevel;
        
        if (timeDiff > 0) {
            totalRateChange += waterDiff / timeDiff;
            validIntervals++;
        }
    }
    
    if (validIntervals === 0) {
        return null;
    }
    
    const averageRatePerMs = totalRateChange / validIntervals;
    
    // Use the caller-supplied currentLevel (the value shown on screen) so the
    // flooding threshold check is consistent with what the UI is displaying
    if (currentLevel === undefined || currentLevel === null) {
        currentLevel = recentPoints[recentPoints.length - 1].waterlevel;
    }
    
    // If already at or above critical, return 0
    if (currentLevel >= criticalThreshold) {
        return 0;
    }
    
    // If water is dropping or stable, no flood predicted
    if (averageRatePerMs <= 0) {
        return null;
    }
    
    // Calculate time to reach critical threshold
    const levelDifference = criticalThreshold - currentLevel;
    const timeToFloodMs = levelDifference / averageRatePerMs;
    
    // Convert to minutes
    const timeToFloodMinutes = Math.floor(timeToFloodMs / (1000 * 60));
    
    // Only return if within 2 hours (120 minutes)
    if (timeToFloodMinutes > 120) {
        return null;
    }
    
    // Clamp to minimum of 1 — a 0 return value is reserved exclusively for
    // when currentLevel >= criticalThreshold (already flooding). Without this,
    // a sub-minute prediction would round down to 0 and falsely trigger "FLOODING NOW"
    return Math.max(1, timeToFloodMinutes);
}/* predictTimeToFlood() */

/* Formats data for front end. Seperated data based on urgency and time units
** Allows for different coloring for more urgent flood proedictions
** Parameters:
**     int minutes
** Return:
**     {display: boolean, text: string, urgent: boolean}
*/
function formatTimeToFlood(minutes) {
    if (minutes === null || minutes === undefined) {
        return { display: false, text: '' };
    }
    
    // Only show FLOODING NOW when water has actually reached the critical threshold
    // (predictTimeToFlood returns 0 only when currentLevel >= criticalThreshold)
    if (minutes <= 0) {
        return { display: true, text: 'FLOODING NOW', urgent: true };
    }
    
    if (minutes === 1) {
        return { display: true, text: '1 minute', urgent: true };
    }
    
    if (minutes < 60) {
        return { display: true, text: `${minutes} minutes`, urgent: minutes <= 10 };
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
        return { display: true, text: `${hours} hour${hours > 1 ? 's' : ''}`, urgent: false };
    }
    
    return { 
        display: true, 
        text: `${hours}h ${remainingMinutes}m`, 
        urgent: false 
    };
}/* formatTimeToFlood() */

/* Main handle for dashboard functionallity.
** Function calls to calculate and display latest waterlevel, status image, time to flood, and chart waterlevel.
** Parameters:
**     None
** Return:
**     None
*/
async function updatePoleData() {
    try {
        // Fetch pole data from JSON files *TEMP*
        //const pole1Data = await (await fetch('pole1Data.json')).json();  
        //const pole2Data = await (await fetch('pole2Data.json')).json();
        
        //Check for new datas
        await getNewData();

        //trims new data
        trimOldData(pole1Data);
        trimOldData(pole2Data);
        // Get latest pole data objects
        const lastPole1Data = pole1Data[pole1Data.length - 1];
        const lastPole2Data = pole2Data[pole2Data.length - 1];

        // Calculate water levels (in inches, will convert for display)
        const pole1WaterLevel = lastPole1Data.waterlevel;
        const pole2WaterLevel = lastPole2Data.waterlevel;
        
        // Check flooding status and trigger alarms/visual alerts
        checkFloodingStatus(pole1WaterLevel, pole2WaterLevel);
        
        // Update water level displays with unit conversion
        const pole1Lvl = document.getElementById("pole1-lvl");
        const pole2Lvl = document.getElementById("pole2-lvl");
        const unitLabel = getUnitLabel();
        
        if (pole1Lvl) pole1Lvl.textContent = `${convertDistance(pole1WaterLevel)} ${unitLabel}`;
        if (pole2Lvl) pole2Lvl.textContent = `${convertDistance(pole2WaterLevel)} ${unitLabel}`;

        // Update pole status images (uses inches internally)
        updatePoleStatus('pole1-image', pole1WaterLevel, settings.warningThreshold, settings.criticalThreshold);
        updatePoleStatus('pole2-image', pole2WaterLevel, settings.warningThreshold, settings.criticalThreshold);

        // Calculate and update time to flood predictions
        // Pass the same water level values being displayed so the flooding
        // threshold check is consistent with the status icons
        const pole1TimeToFlood = predictTimeToFlood(pole1Data, settings.criticalThreshold, pole1WaterLevel);
        const pole2TimeToFlood = predictTimeToFlood(pole2Data, settings.criticalThreshold, pole2WaterLevel);
        
        // Pass the flooding state as a safety guard — updateTimeToFlood will never
        // show "FLOODING NOW" unless the water level has actually crossed the threshold
        updateTimeToFlood('pole1', pole1TimeToFlood, alarmState.pole1Flooding);
        updateTimeToFlood('pole2', pole2TimeToFlood, alarmState.pole2Flooding);

        // Update chart with new data
        updateChartData(pole1Data, pole2Data);
        
    } catch (error) {
        console.error('Error updating pole data:', error);
    }
}/* updatePoleData() */

/* Updates the time to flood amount. Formats urgent time to flood values with bright red, other values orange
** Parameters:
**     string poleId
**     int minutes
** Return:
**     None
*/
function updateTimeToFlood(poleId, minutes, isActuallyFlooding = false) {
    const floodWarningElement = document.querySelector(`#${poleId}-image`)?.closest('.pole-item')?.querySelector('.flood-warning');
    
    if (!floodWarningElement) return;
    
    // Safety guard: if the algorithm returns 0 (FLOODING NOW) but the water level
    // hasn't actually crossed the critical threshold, treat it as 1 minute instead
    if (minutes === 0 && !isActuallyFlooding) {
        minutes = 1;
    }
    
    const formatted = formatTimeToFlood(minutes);
    
    if (!formatted.display) {
        // Hide the time to flood section if no prediction
        floodWarningElement.style.display = 'none';
        return;
    }
    
    // Show the time to flood section
    floodWarningElement.style.display = 'flex';
    
    const valueElement = floodWarningElement.querySelector('.warning-value');
    if (valueElement) {
        valueElement.textContent = formatted.text;
        
        // Update styling based on urgency
        if (formatted.urgent) {
            valueElement.style.color = '#dc2626'; // Bright red for urgent
            valueElement.style.fontWeight = '700';
            valueElement.style.animation = 'pulse 1s ease-in-out infinite';
        } else {
            valueElement.style.color = '#f59e0b'; // Orange for warning
            valueElement.style.fontWeight = '700';
            valueElement.style.animation = 'none';
        }
    }
}/* updateTimeToFlood() */

/* Updates pole status image 
** Parameters:
**     strong elementId
**     float waterLevel
**     float warningThreshold
**     float criticalThreshold
** Return:
**     None
*/
function updatePoleStatus(elementId, waterLevel, warningThreshold, criticalThreshold) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    if (waterLevel >= criticalThreshold) {
        element.src = "images/WarningState2.svg";
        element.alt = "Critical flood warning";
    } else if (waterLevel >= warningThreshold) {
        element.src = "images/WarningState1.svg";
        element.alt = "Flood warning";
    } else {
        element.src = "images/WarningState0.svg";
        element.alt = "Normal status";
    }
}/* updatePoleStatus() */

/* changes the source of the image element to new source from parameter
** Parameters:
**     string newImagePath
** Return:
**     None
*/
function changeImage(newImagePath) {
    const imageElement = document.getElementById("image");
    if (imageElement) {
        imageElement.src = newImagePath;
    }
}/* changeImage() */

/* Handels the functions of the image buttons.
** Highlights the active button.
** Changes the image source to specified image for each button
** Parameters:
**     None
** Return:
**     None
*/
function initializeImageButtons() {
    const imageButtons = document.querySelectorAll('.image-selector-btn');
    
    imageButtons.forEach(button => {
        button.addEventListener('click', () => {
            imageButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const imagePath = button.getAttribute('data-image');
            if (imagePath) {
                changeImage(imagePath);
            }
        });
    });
}/* initializeImageButtons() */

/* Pings the database and mqtt broker through API calls.
** If connected, ping request is sent to RIPPLE system
** Parameters:
**     None
** Return:
**     None
*/
function initializePingButton() {
    const pingButton = document.querySelector('.ping-button');
    if (!pingButton) return;

    pingButton.addEventListener('click', async () => {
        pingButton.disabled = true;
        pingButton.style.opacity = '0.6';

        // Show a "checking" state while the request is in-flight
        setIndicatorState('overall-indicator', 'systemStatus', 'checking', 'Checking...');
        setIndicatorState('pole-status-indicator', 'poleStatusText', 'checking', 'Checking...');

        await checkSystemHealth();

        pingButton.disabled = false;
        pingButton.style.opacity = '1';
    });
}

/* initializePingButton() */

async function checkSystemHealth() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const response = await fetch('/api/ping', { signal: controller.signal });

        clearTimeout(timeout);

        const result = await response.json();

        // Whether ok or 500, the server always returns { mysql: bool, mqtt: bool }
        // Use those values directly so the display shows exactly which service is down
        updateHealthDisplay({
            mysql: result.mysql ?? false,
            mqtt:  result.mqtt  ?? false
        });

    } catch (error) {
        // Only reaches here if the server is completely unreachable (network error / timeout)
        console.error("Health check failed:", error);

        updateHealthDisplay({
            mysql: false,
            mqtt: false
        });
    }
}

let healthUpdateTimeout = null;

/* Helper — sets a single status indicator element to a given state.
** Parameters:
**     string indicatorId   id of the .status-indicator div
**     string textElId      id of the status text span
**     string state         'online' | 'warning' | 'offline' | 'checking'
**     string text          label to show
** Return:
**     None
*/
function setIndicatorState(indicatorId, textElId, state, text) {
    const indicator = document.getElementById(indicatorId);
    const textEl    = document.getElementById(textElId);

    const dotColors = {
        online:   '#22c55e', // green
        warning:  '#f59e0b', // amber
        offline:  '#ef4444', // red
        checking: '#a3a3a3', // grey
    };

    if (indicator) {
        indicator.classList.remove('online', 'warning', 'offline', 'checking');
        indicator.classList.add(state);
        const dot = indicator.querySelector('.status-dot');
        if (dot) dot.style.backgroundColor = dotColors[state] || '#a3a3a3';
    }

    if (textEl) textEl.textContent = text;
}/* setIndicatorState() */

/* Updates the ping status card to reflect current system health.
** Handles three states: fully online, partial (one service down), and fully offline.
** Updates the overall summary and each individual service row.
** Parameters:
**     object status  { mysql: bool, mqtt: bool }
** Return:
**     None
*/
function updateHealthDisplay(status) {
    // Clear any pending update
    if (healthUpdateTimeout) {
        clearTimeout(healthUpdateTimeout);
    }

    healthUpdateTimeout = setTimeout(() => {
        const allOnline  = status.mysql && status.mqtt;
        const allOffline = !status.mysql && !status.mqtt;

        // --- Overall summary (ping card) ---
        if (allOnline) {
            setIndicatorState('overall-indicator', 'systemStatus', 'online', 'System Online');
            setIndicatorState('pole-status-indicator', 'poleStatusText', 'online', 'Live');
        } else if (allOffline) {
            setIndicatorState('overall-indicator', 'systemStatus', 'offline', 'Systems Offline');
            setIndicatorState('pole-status-indicator', 'poleStatusText', 'offline', 'Offline');
        } else {
            const downService = !status.mysql ? 'SQL Server is Down' : 'MQTT Broker is Down';
            setIndicatorState('overall-indicator', 'systemStatus', 'warning', downService);
            setIndicatorState('pole-status-indicator', 'poleStatusText', 'warning', 'Degraded');
        }

        // --- Per-service rows ---

    }, 500);
}


/* Gets the initial data from SQL database from the last week for each pole
** Parameters:
**     None
** Return:
**     None
*/
async function initializeData() {
    try {
        const pole1Response = await fetch(`/api/initdata?poleID=1`);
        pole1Data = await pole1Response.json();
        lastIDPole1 = pole1Data[pole1Data.length - 1]?.id;

        const pole2Response = await fetch(`/api/initdata?poleID=2`);
        pole2Data = await pole2Response.json();
        lastIDPole2 = pole2Data[pole2Data.length - 1]?.id;

    } catch (error) {
        console.error("Error initializing data:", error);
    }
}/* initializeData() */

/* Description
** Parameters:
**     None
** Return:
**     None
*/
async function getNewData() {
    try {
        const pole1Response = await fetch(`/api/data?poleID=1`);
        const pole1Result = await pole1Response.json();

        if (pole1Result.length > 0) {
            const newRecord = pole1Result[0];

            if (newRecord.id > lastIDPole1) {
                pole1Data.push(newRecord);
                lastIDPole1 = newRecord.id;
            }
        }

        const pole2Response = await fetch(`/api/data?poleID=2`);
        const pole2Result = await pole2Response.json();

        if (pole2Result.length > 0) {
            const newRecord = pole2Result[0];

            if (newRecord.id > lastIDPole2) {
                pole2Data.push(newRecord);
                lastIDPole2 = newRecord.id;
            }
        }

    } catch (error) {
        console.error("Error retrieving data:", error);
    }
}
/* getNewData() */

/* Description
** Parameters:
**     None
** Return:
**     None
*/
function trimOldData(dataArray) {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    while (dataArray.length > 0 && new Date(dataArray[0].created_at).getTime() < oneWeekAgo) 
    {
        dataArray.shift(); // removes oldest item
    }
}/* trimOldData() */

/* requests image from ripple system
** For now, just takes image on laptop camera
** Parameters:
**     None
** Return:
**     None
*/
function initializeImageRequestButton(){
    const imageRequestButton = document.getElementById('image-request-button');
    if(imageRequestButton){
        imageRequestButton.addEventListener('click', async () => {
            imageRequestButton.disabled = true;
            imageRequestButton.style.opacity = '0.6';
            
            console.log("Image request button pressed");
            //TEMP
            setTimeout(() => {
                imageRequestButton.disabled = false;
                imageRequestButton.style.opacity = '1';
            }, 1500);
        })
    }
}


/* Initializes the dashboard elements when page is loaded
** Parameters:
**     None
** Return:
**     None
*/
async function initializeDashboard() {
    // Load settings
    loadSettings();
    
    // Check if we're on the settings page
    if (document.getElementById('saveSettings')) { //button in settings page
        initializeSettingsPage();
        return; // Don't initialize chart on settings page
    }
    
    // Initial Data
    await initializeData();

    // Initialize dashboard components
    initializeImageButtons();
    initializePingButton();
    initializeImageRequestButton();
    initializeChart();
    
    // Start updating pole data
    updatePoleData();
    // Check system health on load
    checkSystemHealth();

    // Update pole data at interval specified in settings
    chartUpdateInterval = setInterval(updatePoleData, settings.updateFrequency);
    // Check system health every 10 seconds
    setInterval(checkSystemHealth, 10000);
}/* initializeDashboard() */