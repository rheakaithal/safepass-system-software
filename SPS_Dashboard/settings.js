/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: settings.js
** --------
** Contains the functions used by the settings page. 
** Uses local storage from the device to save custom settings per user(localstorage API)
** Controls the update frequency, thresholds, and alarm settings
*/


// Default settings for the dashboard
const DEFAULT_SETTINGS = {
    updateFrequency: 1000, // milliseconds
    distanceUnits: 'Inches',
    warningThreshold: 3.0,      // Always stored in inches
    criticalThreshold: 6.0,      // Always stored in inches
    alarmEnabled: true,          // Alarm sound on/off
    alarmVolume: 0.7            // 0.0 to 1.0
};

//loads default settings as the dashboards settings
let settings = { ...DEFAULT_SETTINGS };


/* Loads locally stored settings from device into settings object. 
** Keeps default settings if no locally stored settings
** Parameters:
**     None
** Return:
**     settings object
*/
function loadSettings() {
    const savedSettings = localStorage.getItem('dashboardSettings');
    if (savedSettings) {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
    }
    return settings;
} /* loadSettings() */

/* Saves the settings to the local storage on the device using localStorage API
** Parameters:
**     settings object
** Return:
**     settings object
*/
function saveSettings(newSettings) {
    settings = { ...settings, ...newSettings };
    localStorage.setItem('dashboardSettings', JSON.stringify(settings));
    return settings;
} /* saveSettings() */

/* Converts threshold displays to centimeters or inches based on distance unit selected.
** Only for display
** Parameters:
**     float inches
** Return:
**     float inches or float centimeters
*/
function convertDistance(inches) {
    if (settings.distanceUnits === 'Centimeters') {
        return (inches * 2.54).toFixed(2);
    }
    return inches.toFixed(2);
} /* convertDistance() */

/* Returns the unit label depending on the distance unit
** Parameters:
**     None
** Return:
**     str cm or str inches
*/
function getUnitLabel() {
    return settings.distanceUnits === 'Centimeters' ? 'cm' : 'inches';
} /* getUnitLabel() */

/* Settings page init
** Converts threshold values in settings sheet between inches and centimeters along with the label
** Loads default/saved settings into settings sheet inputs
** Contains the "Save Settings" button functionality - Saves settings to local storage
** Parameters:
**     None
** Return:
**     None
*/
function initializeSettingsPage() {
    // Get form elements by ID
    const updateFreqSelect = document.getElementById('updateFrequencySelect');
    const distanceUnitSelect = document.getElementById('distanceUnitSelect');
    const warningInput = document.getElementById('warningInput');
    const criticalInput = document.getElementById('criticalInput');
    const warningLabel = document.getElementById('warningLabel');
    const criticalLabel = document.getElementById('criticalLabel');
    const alarmEnabledCheckbox = document.getElementById('alarmEnabledCheckbox');
    const alarmVolumeSlider = document.getElementById('alarmVolumeSlider');
    const volumeDisplay = document.getElementById('volumeDisplay');
    const testAlarmButton = document.getElementById('testAlarmButton');
    const saveButton = document.getElementById('saveSettings');

    /* Updates threshold labels and values based on distance unit
    ** Parameters:
    **     distanceUnitSelect, warningLabel, criticalLabel, warningInput, criticalInput
    ** Return:
    **     void None
    */
    function updateThresholdDisplay() {
        const currentUnit = distanceUnitSelect ? distanceUnitSelect.value : 'Inches';
        const unitLabel = currentUnit === 'Centimeters' ? 'centimeters' : 'inches';
        
        // Update labels
        if (warningLabel) {
            warningLabel.textContent = `Warning Level (${unitLabel})`;
        }
        if (criticalLabel) {
            criticalLabel.textContent = `Critical Level (${unitLabel})`;
        }
        
        // Convert and display threshold values
        if (warningInput) {
            const warningInches = settings.warningThreshold;
            if (currentUnit === 'Centimeters') {
                warningInput.value = (warningInches * 2.54).toFixed(2);
            } else {
                warningInput.value = warningInches.toFixed(2);
            }
        }
        
        if (criticalInput) {
            const criticalInches = settings.criticalThreshold;
            if (currentUnit === 'Centimeters') {
                criticalInput.value = (criticalInches * 2.54).toFixed(2);
            } else {
                criticalInput.value = criticalInches.toFixed(2);
            }
        }
    } /* updateThresholdDistance() */

    // Load current settings into form
    if (updateFreqSelect) {
        updateFreqSelect.value = settings.updateFrequency.toString();
    }

    if (distanceUnitSelect) {
        distanceUnitSelect.value = settings.distanceUnits;
        
        // Add change listener to update threshold labels and values
        distanceUnitSelect.addEventListener('change', updateThresholdDisplay);
    }

    // Load alarm settings
    if (alarmEnabledCheckbox) {
        alarmEnabledCheckbox.checked = settings.alarmEnabled;
    }

    if (alarmVolumeSlider && volumeDisplay) {
        const volumePercent = Math.round(settings.alarmVolume * 100);
        alarmVolumeSlider.value = volumePercent;
        volumeDisplay.textContent = volumePercent + '%';
        
        // Update volume display as slider moves
        alarmVolumeSlider.addEventListener('input', () => {
            volumeDisplay.textContent = alarmVolumeSlider.value + '%';
        });
    }

    // Test alarm button
    if (testAlarmButton && alarmVolumeSlider) {
        testAlarmButton.addEventListener('click', () => {
            const volume = parseInt(alarmVolumeSlider.value) / 100;
            playAlarmSound(volume, 2000); // Play for 2 seconds
        });
    }

    // Initial display update
    updateThresholdDisplay();

    // Handle save button click
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const newSettings = {};

            if (updateFreqSelect) {
                newSettings.updateFrequency = parseInt(updateFreqSelect.value);
            }

            if (distanceUnitSelect) {
                newSettings.distanceUnits = distanceUnitSelect.value;
            }
            
            if (warningInput) {
                const warningValue = parseFloat(warningInput.value);
                newSettings.warningThreshold = convertDistance(warningValue);
            }

            if (criticalInput) {
                const criticalValue = parseFloat(criticalInput.value);
                newSettings.criticalThreshold = convertDistance(criticalValue);
            }

            // Save alarm settings
            if (alarmEnabledCheckbox) {
                newSettings.alarmEnabled = alarmEnabledCheckbox.checked;
            }

            if (alarmVolumeSlider) {
                newSettings.alarmVolume = parseInt(alarmVolumeSlider.value) / 100;
            }

            // Save settings
            saveSettings(newSettings);
            
            // Show success message
            const originalText = saveButton.textContent;
            const originalColor = saveButton.style.backgroundColor;
            
            saveButton.textContent = 'Settings Saved!';
            saveButton.style.backgroundColor = '#10b981';
            
            // Change back after 2 seconds
            setTimeout(() => {
                saveButton.textContent = originalText;
                saveButton.style.backgroundColor = originalColor;
            }, 2000);

            console.log('Settings saved:', settings);
        });
    }
} /* initializeSettingPage() */

/* Uses the webkitAudioContect API to create alarm sound
** Uses sine waves at different freqencies to create alarm
** Parameters:
**     float volume
**     int duration
** Return:
**     {oscilator object, audioContext object}
**     -or-
**     null
*/
function playAlarmSound(volume = 0.7, duration = 2000) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Create alarm sound (alternating frequencies)
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
} /* playAlarmSound() */