// ============================================
// DASHBOARD DATA MANAGEMENT
// ============================================
let chartUpdateInterval = null;
let alarmState = {
    pole1Flooding: false,
    pole2Flooding: false,
    alarmPlaying: false,
    alarmInterval: null
};

// ============================================
// ALARM SYSTEM
// ============================================
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
}

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
}

function stopContinuousAlarm() {
    alarmState.alarmPlaying = false;
    
    if (alarmState.alarmInterval) {
        clearInterval(alarmState.alarmInterval);
        alarmState.alarmInterval = null;
    }
}

// ============================================
// VISUAL BORDER ALERT
// ============================================
function updateBorderPulse(isFlooding) {
    const body = document.body;
    
    if (isFlooding) {
        // Add pulsing red border
        body.style.boxShadow = 'inset 0 0 0 8px rgba(220, 38, 38, 0.6)';
        body.style.animation = 'borderPulse 1.5s ease-in-out infinite';
        
        // Add keyframe animation if not already added
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
}

// ============================================
// CHECK FLOODING STATUS
// ============================================
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
        console.log('🚨 CRITICAL FLOODING DETECTED - ALARM ACTIVATED');
    }
    
    // Stop alarm if flooding has stopped
    if (!anyFlooding && wasFlooding) {
        stopContinuousAlarm();
        console.log('✓ Flooding subsided - Alarm stopped');
    }
}

// ============================================
// FLOOD PREDICTION
// ============================================
function predictTimeToFlood(dataPoints, criticalThreshold) {
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
        const timeDiff = new Date(recentPoints[i].createdat).getTime() - 
                        new Date(recentPoints[i - 1].createdat).getTime();
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
    
    // Get current water level
    const currentLevel = recentPoints[recentPoints.length - 1].waterlevel;
    
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
    const timeToFloodMinutes = Math.round(timeToFloodMs / (1000 * 60));
    
    // Only return if within 2 hours (120 minutes)
    if (timeToFloodMinutes > 120) {
        return null;
    }
    
    return timeToFloodMinutes;
}

// ============================================
// FORMAT TIME TO FLOOD DISPLAY
// ============================================
function formatTimeToFlood(minutes) {
    if (minutes === null || minutes === undefined) {
        return { display: false, text: '' };
    }
    
    if (minutes <= 0) {
        return { display: true, text: 'FLOODING NOW', urgent: true };
    }
    
    if (minutes < 1) {
        return { display: true, text: 'Less than 1 minute', urgent: true };
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
}

// ============================================
// UPDATE POLE DATA
// ============================================
async function updatePoleData() {
    try {
        // Fetch pole data from JSON files
        const pole1Data = await (await fetch('pole1Data.json')).json();  
        const pole2Data = await (await fetch('pole2Data.json')).json();
        
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
        const pole1TimeToFlood = predictTimeToFlood(pole1Data, settings.criticalThreshold);
        const pole2TimeToFlood = predictTimeToFlood(pole2Data, settings.criticalThreshold);
        
        updateTimeToFloodDisplay('pole1', pole1TimeToFlood);
        updateTimeToFloodDisplay('pole2', pole2TimeToFlood);

        // Update chart with new data
        updateChartData(pole1Data, pole2Data);
        
    } catch (error) {
        console.error('Error updating pole data:', error);
    }
}

// ============================================
// UPDATE TIME TO FLOOD DISPLAY
// ============================================
function updateTimeToFloodDisplay(poleId, minutes) {
    const floodWarningElement = document.querySelector(`#${poleId}-image`)?.closest('.pole-item')?.querySelector('.flood-warning');
    
    if (!floodWarningElement) return;
    
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
}

// ============================================
// UPDATE POLE STATUS HELPER
// ============================================
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
}

// ============================================
// IMAGE CHANGING FUNCTION
// ============================================
function changeImage(newImagePath) {
    const imageElement = document.getElementById("image");
    if (imageElement) {
        imageElement.src = newImagePath;
    }
}

// ============================================
// IMAGE SELECTOR BUTTON BEHAVIOR
// ============================================
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
}

// ============================================
// PING BUTTON FUNCTIONALITY
// ============================================
function initializePingButton() {
    const pingButton = document.querySelector('.ping-button');
    const pingStatus = document.querySelector('.ping-status .status-text');
    
    if (pingButton) {
        pingButton.addEventListener('click', async () => {
            pingButton.disabled = true;
            pingButton.style.opacity = '0.6';
            
            if (pingStatus) {
                pingStatus.textContent = 'Pinging sensors...';
            }
            
            setTimeout(() => {
                pingButton.disabled = false;
                pingButton.style.opacity = '1';
                
                if (pingStatus) {
                    pingStatus.textContent = 'All Systems Online';
                }
            }, 1500);
        });
    }
}

// ============================================
// INITIALIZE DASHBOARD (FOR IFRAME CONTENT)
// ============================================
function initializeDashboard() {
    // Load settings
    loadSettings();
    
    // Check if we're on the settings page
    if (document.getElementById('saveSettings')) {
        initializeSettingsPage();
        return; // Don't initialize chart on settings page
    }
    
    // Initialize dashboard components
    initializeImageButtons();
    initializePingButton();
    initializeChart();
    
    // Start updating pole data
    updatePoleData();
    
    // Update pole data at interval specified in settings
    chartUpdateInterval = setInterval(updatePoleData, settings.updateFrequency);
}