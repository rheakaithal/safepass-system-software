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

        console.log(`[Alarm] Playing alarm — volume: ${Math.round(volume * 100)}%, duration: ${duration}ms`);
        return { oscillator, audioContext };
    } catch (error) {
        console.error('[Alarm] Failed to play alarm sound:', error);
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
    console.warn('[Alarm] Continuous alarm started');
    
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
    console.log('[Alarm] Continuous alarm stopped');
    
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
        const floodingPoles = [
            alarmState.pole1Flooding ? 'Pole 1' : null,
            alarmState.pole2Flooding ? 'Pole 2' : null
        ].filter(Boolean).join(', ');
        console.error(`[Flood] CRITICAL FLOODING DETECTED on ${floodingPoles} — Pole 1: ${pole1Level.toFixed(2)} in, Pole 2: ${pole2Level.toFixed(2)} in (threshold: ${settings.criticalThreshold} in)`);
        startContinuousAlarm();
    }
    
    // Warn when approaching warning threshold but not yet critical
    const pole1Warning = pole1Level >= settings.warningThreshold && !alarmState.pole1Flooding;
    const pole2Warning = pole2Level >= settings.warningThreshold && !alarmState.pole2Flooding;
    if (pole1Warning) console.warn(`[Flood] Pole 1 at WARNING level: ${pole1Level.toFixed(2)} in (warning threshold: ${settings.warningThreshold} in)`);
    if (pole2Warning) console.warn(`[Flood] Pole 2 at WARNING level: ${pole2Level.toFixed(2)} in (warning threshold: ${settings.warningThreshold} in)`);

    // Stop alarm if flooding has stopped
    if (!anyFlooding && wasFlooding) {
        stopContinuousAlarm();
        console.log(`[Flood] Flooding subsided — Pole 1: ${pole1Level.toFixed(2)} in, Pole 2: ${pole2Level.toFixed(2)} in`);
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
        //Check for new data
        await getNewData();

        //trims new data
        trimOldData(pole1Data);
        trimOldData(pole2Data);

        // Get latest pole data objects
        const lastPole1Data = pole1Data[pole1Data.length - 1];
        const lastPole2Data = pole2Data[pole2Data.length - 1];

        if (!lastPole1Data || !lastPole2Data) {
            console.warn('[Data] No pole data available yet — skipping UI update');
            return;
        }

        // Calculate water levels (in inches, will convert for display)
        const pole1WaterLevel = lastPole1Data.waterlevel;
        const pole2WaterLevel = lastPole2Data.waterlevel;

        console.log(`[Data] Pole 1: ${pole1WaterLevel.toFixed(3)} in | Pole 2: ${pole2WaterLevel.toFixed(3)} in | Buffer: ${pole1Data.length} / ${pole2Data.length} records`);
        
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
        const pole1TimeToFlood = predictTimeToFlood(pole1Data, settings.criticalThreshold, pole1WaterLevel);
        const pole2TimeToFlood = predictTimeToFlood(pole2Data, settings.criticalThreshold, pole2WaterLevel);

        if (pole1TimeToFlood !== null) console.warn(`[Flood] Pole 1 est. time to flood: ${pole1TimeToFlood} min`);
        if (pole2TimeToFlood !== null) console.warn(`[Flood] Pole 2 est. time to flood: ${pole2TimeToFlood} min`);
        
        updateTimeToFlood('pole1', pole1TimeToFlood, alarmState.pole1Flooding);
        updateTimeToFlood('pole2', pole2TimeToFlood, alarmState.pole2Flooding);

        // Update chart with new data
        updateChartData(pole1Data, pole2Data);
        
    } catch (error) {
        console.error('[Data] Error in updatePoleData:', error);
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

        const mysql = result.mysql ?? false;
        const mqtt  = result.mqtt  ?? false;

        if (mysql && mqtt) {
            console.log('[Health] All systems online — MySQL: OK, MQTT: OK');
        } else {
            if (!mysql) console.error('[Health] MySQL is unreachable');
            if (!mqtt)  console.error('[Health] MQTT broker is unreachable');
        }

        updateHealthDisplay({ mysql, mqtt });

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('[Health] Ping request timed out after 4s — server may be unreachable');
        } else {
            console.error('[Health] Health check failed:', error);
        }

        updateHealthDisplay({ mysql: false, mqtt: false });
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
            console.error('[Health] All systems offline — dashboard is running without live data');
            setIndicatorState('overall-indicator', 'systemStatus', 'offline', 'Systems Offline');
            setIndicatorState('pole-status-indicator', 'poleStatusText', 'offline', 'Offline');
        } else {
            const downService = !status.mysql ? 'SQL Server is Down' : 'MQTT Broker is Down';
            console.warn(`[Health] Degraded — ${downService}`);
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
        console.log('[Init] Fetching historical data from server...');

        const pole1Response = await fetch(`/api/initdata?poleID=1`);
        pole1Data = await pole1Response.json();
        lastIDPole1 = pole1Data[pole1Data.length - 1]?.id;

        const pole2Response = await fetch(`/api/initdata?poleID=2`);
        pole2Data = await pole2Response.json();
        lastIDPole2 = pole2Data[pole2Data.length - 1]?.id;

        console.log(`[Init] Historical data loaded — Pole 1: ${pole1Data.length} records (last ID: ${lastIDPole1}), Pole 2: ${pole2Data.length} records (last ID: ${lastIDPole2})`);

    } catch (error) {
        console.error('[Init] Failed to load historical data:', error);
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

            if (newRecord.id > (lastIDPole1 ?? -1)) {
                pole1Data.push(newRecord);
                lastIDPole1 = newRecord.id;
                console.log(`[Data] New Pole 1 record — ID: ${newRecord.id}, level: ${newRecord.waterlevel.toFixed(3)} in, time: ${newRecord.created_at}`);
            }
        } else {
            console.warn('[Data] /api/data returned empty result for Pole 1');
        }

        const pole2Response = await fetch(`/api/data?poleID=2`);
        const pole2Result = await pole2Response.json();

        if (pole2Result.length > 0) {
            const newRecord = pole2Result[0];

            if (newRecord.id > (lastIDPole2 ?? -1)) {
                pole2Data.push(newRecord);
                lastIDPole2 = newRecord.id;
                console.log(`[Data] New Pole 2 record — ID: ${newRecord.id}, level: ${newRecord.waterlevel.toFixed(3)} in, time: ${newRecord.created_at}`);
            }
        } else {
            console.warn('[Data] /api/data returned empty result for Pole 2');
        }

    } catch (error) {
        console.error('[Data] Failed to fetch new data:', error);
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
    let trimCount = 0;

    while (dataArray.length > 0 && new Date(dataArray[0].created_at).getTime() < oneWeekAgo) 
    {
        dataArray.shift();
        trimCount++;
    }

    if (trimCount > 0) {
        console.log(`[Data] Trimmed ${trimCount} record(s) older than 1 week from buffer`);
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
            
            console.log('[Images] Image request sent to RIPPLE system');
            //TEMP
            setTimeout(() => {
                imageRequestButton.disabled = false;
                imageRequestButton.style.opacity = '1';
                console.log('[Images] Image request button re-enabled');
            }, 1500);
        })
    } else {
        console.warn('[Images] Image request button element not found in DOM');
    }
}


/* Initializes the dashboard elements when page is loaded
** Parameters:
**     None
** Return:
**     None
*/
async function initializeDashboard() {
    console.log('[Init] Dashboard initializing...');

    // Load settings
    loadSettings();
    console.log(`[Init] Settings loaded — update frequency: ${settings.updateFrequency}ms, units: ${settings.distanceUnits}, warning: ${settings.warningThreshold} in, critical: ${settings.criticalThreshold} in`);
    
    // Check if we're on the settings page
    if (document.getElementById('saveSettings')) {
        console.log('[Init] Settings page detected — skipping dashboard init');
        initializeSettingsPage();
        return;
    }
    
    // Attach UI listeners immediately — before any async work — so buttons
    // respond correctly even if the user interacts before data has loaded.
    initializeImageButtons();
    initializePingButton();
    initializeImageRequestButton();
    initializeChart();

    // Initial Data (async — listeners are already live by this point)
    await initializeData();
    console.log('[Init] Dashboard components initialized');
    
    // Start updating pole data
    updatePoleData();
    // Check system health on load
    checkSystemHealth();

    // Update pole data at interval specified in settings
    chartUpdateInterval = setInterval(updatePoleData, settings.updateFrequency);
    console.log(`[Init] Poll interval set to ${settings.updateFrequency}ms`);

    // Check system health every 10 seconds
    setInterval(checkSystemHealth, 10000);

    console.log('[Init] Dashboard ready');
}/* initializeDashboard() */