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
    updateFrequency:   1000,    // Data poll interval in milliseconds
    distanceUnits:     'Inches',
    warningThreshold:  3.0,     // Always stored in inches
    criticalThreshold: 6.0,     // Always stored in inches
    alarmEnabled:      true,    // Alarm sound on/off
    alarmVolume:       0.7,     // 0.0 to 1.0
    heartbeatEnabled:  true,    // Run the automatic DB health check interval
    heartbeatInterval: 45000    // Milliseconds between DB health checks
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
        console.info(`[Settings] Loaded from localStorage — frequency: ${settings.updateFrequency}ms, units: ${settings.distanceUnits}, warning: ${settings.warningThreshold} in, critical: ${settings.criticalThreshold} in, alarm: ${settings.alarmEnabled ? 'on' : 'off'} @ ${Math.round(settings.alarmVolume * 100)}%, heartbeat: ${settings.heartbeatEnabled ? 'on' : 'off'} @ ${settings.heartbeatInterval}ms`);
    } else {
        console.info('[Settings] No saved settings found — using defaults');
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
    const prev = { ...settings };
    settings = { ...settings, ...newSettings };
    localStorage.setItem('dashboardSettings', JSON.stringify(settings));

    // Log only the keys that actually changed
    const changed = Object.keys(newSettings).filter(k => prev[k] !== settings[k]);
    if (changed.length > 0) {
        const diff = changed.map(k => `${k}: ${prev[k]} → ${settings[k]}`).join(', ');
        console.info(`[Settings] Saved — changed: ${diff}`);
    } else {
        console.info('[Settings] Saved — no values changed');
    }

    // Settings runs inside an iframe. window.top is SafePassSystem.html.
    // We walk every iframe in the parent and dispatch the event directly
    // into their contentWindow so they receive it regardless of origin.
    if (changed.includes('distanceUnits')) {
        try {
            const frames = window.top.document.querySelectorAll('iframe');
            frames.forEach(frame => {
                try {
                    frame.contentWindow.dispatchEvent(
                        new CustomEvent('ripple:settingsChanged', {
                            detail: { changed }
                        })
                    );
                } catch (_) {}
            });
        } catch (_) {}
    }

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
    console.info('[Settings] Initializing settings page');

    // ── Gather all form elements ──────────────────────────────────────────────
    const updateFreqSelect        = document.getElementById('updateFrequencySelect');
    const distanceUnitSelect      = document.getElementById('distanceUnitSelect');
    const warningInput            = document.getElementById('warningInput');
    const criticalInput           = document.getElementById('criticalInput');
    const warningLabel            = document.getElementById('warningLabel');
    const criticalLabel           = document.getElementById('criticalLabel');
    const alarmEnabledCheckbox    = document.getElementById('alarmEnabledCheckbox');
    const alarmVolumeSlider       = document.getElementById('alarmVolumeSlider');
    const volumeDisplay           = document.getElementById('volumeDisplay');
    const testAlarmButton         = document.getElementById('testAlarmButton');
    const heartbeatEnabledCheckbox = document.getElementById('heartbeatEnabledCheckbox');
    const heartbeatIntervalSelect  = document.getElementById('heartbeatIntervalSelect');
    const saveButton              = document.getElementById('saveSettings');
    const resetButtonLocksBtn    = document.getElementById('resetButtonLocks');
    const resetButtonLocksStatus = document.getElementById('resetButtonLocksStatus');

    // Warn about missing DOM elements so layout regressions are easy to spot
    const requiredElements = {
        updateFreqSelect, distanceUnitSelect, warningInput, criticalInput,
        alarmEnabledCheckbox, alarmVolumeSlider,
        heartbeatEnabledCheckbox, heartbeatIntervalSelect, saveButton
    };
    warnAboutMissingElements(requiredElements);

    // ── Populate form with current settings ───────────────────────────────────
    populateDisplaySettings(updateFreqSelect, distanceUnitSelect);
    populateThresholdSettings(warningInput, criticalInput, warningLabel, criticalLabel, distanceUnitSelect);
    populateAlarmSettings(alarmEnabledCheckbox, alarmVolumeSlider, volumeDisplay);
    populateHeartbeatSettings(heartbeatEnabledCheckbox, heartbeatIntervalSelect);

    // ── Wire live update listeners ────────────────────────────────────────────
    wireDistanceUnitListener(distanceUnitSelect, warningInput, criticalInput, warningLabel, criticalLabel);
    wireVolumeSliderListener(alarmVolumeSlider, volumeDisplay);
    wireTestAlarmButton(testAlarmButton, alarmVolumeSlider);
    wireHeartbeatEnabledToggle(heartbeatEnabledCheckbox, heartbeatIntervalSelect);
    wireResetButtonLocks(resetButtonLocksBtn, resetButtonLocksStatus);

    console.info('[Settings] Settings page ready');

    // ── Save button ───────────────────────────────────────────────────────────
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const newSettings = collectFormValues(
                updateFreqSelect, distanceUnitSelect,
                warningInput, criticalInput,
                alarmEnabledCheckbox, alarmVolumeSlider,
                heartbeatEnabledCheckbox, heartbeatIntervalSelect
            );

            // ── NEW: null means validation failed ────────────────────────────
            if (newSettings === null) {
                flashSaveButtonError(saveButton);  // show "Settings Not Saved"
                return;
            }

            saveSettings(newSettings);
            flashSaveButton(saveButton);
        });
    }
} /* initializeSettingsPage() */


/* Logs a warning for every key in the elements object whose value is null/undefined.
** Parameters:
**     object elements  { elementName: domElement, ... }
** Return:
**     None
*/
function warnAboutMissingElements(elements) {
    Object.entries(elements).forEach(([name, el]) => {
        if (!el) console.warn(`[Settings] Expected element not found in DOM: ${name}`);
    });
}/* warnAboutMissingElements() */


/* Loads display-section values (update frequency, distance units) into the form.
** Parameters:
**     HTMLSelectElement updateFreqSelect
**     HTMLSelectElement distanceUnitSelect
** Return:
**     None
*/
function populateDisplaySettings(updateFreqSelect, distanceUnitSelect) {
    if (updateFreqSelect)   updateFreqSelect.value   = settings.updateFrequency.toString();
    if (distanceUnitSelect) distanceUnitSelect.value = settings.distanceUnits;
}/* populateDisplaySettings() */


/* Loads threshold values into the form, converting from inches to the current
** display unit if necessary.
** Parameters:
**     HTMLInputElement  warningInput
**     HTMLInputElement  criticalInput
**     HTMLElement       warningLabel
**     HTMLElement       criticalLabel
**     HTMLSelectElement distanceUnitSelect
** Return:
**     None
*/
function populateThresholdSettings(warningInput, criticalInput, warningLabel, criticalLabel, distanceUnitSelect) {
    updateThresholdDisplay(warningInput, criticalInput, warningLabel, criticalLabel, distanceUnitSelect);
}/* populateThresholdSettings() */


/* Loads alarm values (enabled checkbox, volume slider) into the form.
** Parameters:
**     HTMLInputElement  alarmEnabledCheckbox
**     HTMLInputElement  alarmVolumeSlider
**     HTMLElement       volumeDisplay
** Return:
**     None
*/
function populateAlarmSettings(alarmEnabledCheckbox, alarmVolumeSlider, volumeDisplay) {
    if (alarmEnabledCheckbox) alarmEnabledCheckbox.checked = settings.alarmEnabled;

    if (alarmVolumeSlider && volumeDisplay) {
        const pct = Math.round(settings.alarmVolume * 100);
        alarmVolumeSlider.value    = pct;
        volumeDisplay.textContent  = pct + '%';
    }
}/* populateAlarmSettings() */


/* Loads heartbeat values (enabled checkbox, interval select) into the form.
** Also sets the interval select's disabled state to match the checkbox.
** Parameters:
**     HTMLInputElement  heartbeatEnabledCheckbox
**     HTMLSelectElement heartbeatIntervalSelect
** Return:
**     None
*/
function populateHeartbeatSettings(heartbeatEnabledCheckbox, heartbeatIntervalSelect) {
    if (heartbeatEnabledCheckbox) heartbeatEnabledCheckbox.checked = settings.heartbeatEnabled;

    if (heartbeatIntervalSelect) {
        heartbeatIntervalSelect.value    = settings.heartbeatInterval.toString();
        heartbeatIntervalSelect.disabled = !settings.heartbeatEnabled;
    }
}/* populateHeartbeatSettings() */


/* Updates threshold labels and input values when the distance unit changes.
** Converts the stored inch values to the selected display unit.
** Parameters:
**     HTMLInputElement  warningInput
**     HTMLInputElement  criticalInput
**     HTMLElement       warningLabel
**     HTMLElement       criticalLabel
**     HTMLSelectElement distanceUnitSelect
** Return:
**     None
*/
function updateThresholdDisplay(warningInput, criticalInput, warningLabel, criticalLabel, distanceUnitSelect) {
    const unit      = distanceUnitSelect ? distanceUnitSelect.value : 'Inches';
    const unitLabel = unit === 'Centimeters' ? 'centimeters' : 'inches';

    if (warningLabel)  warningLabel.textContent  = `Warning Level (${unitLabel})`;
    if (criticalLabel) criticalLabel.textContent = `Critical Level (${unitLabel})`;

    if (warningInput) {
        const inches = parseFloat(settings.warningThreshold);
        warningInput.value = unit === 'Centimeters' ? (inches * 2.54).toFixed(2) : inches.toFixed(2);
    }

    if (criticalInput) {
        const inches = parseFloat(settings.criticalThreshold);
        criticalInput.value = unit === 'Centimeters' ? (inches * 2.54).toFixed(2) : inches.toFixed(2);
    }
}/* updateThresholdDisplay() */


/* Attaches a 'change' listener to the distance unit select so threshold labels
** and values update live as the user switches units.
** Parameters:
**     HTMLSelectElement distanceUnitSelect
**     HTMLInputElement  warningInput
**     HTMLInputElement  criticalInput
**     HTMLElement       warningLabel
**     HTMLElement       criticalLabel
** Return:
**     None
*/
function wireDistanceUnitListener(distanceUnitSelect, warningInput, criticalInput, warningLabel, criticalLabel) {
    if (!distanceUnitSelect) return;
    distanceUnitSelect.addEventListener('change', () => {
        console.info(`[Settings] Distance unit changed to: ${distanceUnitSelect.value}`);
        updateThresholdDisplay(warningInput, criticalInput, 
                               warningLabel, criticalLabel, distanceUnitSelect);

        // ── NEW: update input min/max to match unit ────────────────────────
        const isCm = distanceUnitSelect.value === 'Centimeters';
        const maxVal = isCm ? '30.48' : '12';
        if (warningInput)  {
            warningInput.min  = '0';
            warningInput.max  = maxVal;
            warningInput.type = 'number';
        }
        if (criticalInput) {
            criticalInput.min  = '0';
            criticalInput.max  = maxVal;
            criticalInput.type = 'number';
        }
    });
}/* wireDistanceUnitListener() */


/* Attaches an 'input' listener to the volume slider so the percentage
** label updates in real time as the user drags.
** Parameters:
**     HTMLInputElement alarmVolumeSlider
**     HTMLElement      volumeDisplay
** Return:
**     None
*/
function wireVolumeSliderListener(alarmVolumeSlider, volumeDisplay) {
    if (!alarmVolumeSlider || !volumeDisplay) return;
    alarmVolumeSlider.addEventListener('input', () => {
        volumeDisplay.textContent = alarmVolumeSlider.value + '%';
    });
}/* wireVolumeSliderListener() */


/* Attaches a click listener to the test alarm button.
** Parameters:
**     HTMLButtonElement testAlarmButton
**     HTMLInputElement  alarmVolumeSlider
** Return:
**     None
*/
function wireTestAlarmButton(testAlarmButton, alarmVolumeSlider) {
    if (!testAlarmButton || !alarmVolumeSlider) return;
    testAlarmButton.addEventListener('click', () => {
        const volume = parseInt(alarmVolumeSlider.value) / 100;
        console.info(`[Settings] Test alarm triggered at volume: ${Math.round(volume * 100)}%`);
        playAlarmSound(volume, 2000);
    });
}/* wireTestAlarmButton() */


/* Attaches a 'change' listener to the heartbeat enabled checkbox.
** Enables or disables the interval select to reflect the current state.
** Parameters:
**     HTMLInputElement  heartbeatEnabledCheckbox
**     HTMLSelectElement heartbeatIntervalSelect
** Return:
**     None
*/
function wireHeartbeatEnabledToggle(heartbeatEnabledCheckbox, heartbeatIntervalSelect) {
    if (!heartbeatEnabledCheckbox || !heartbeatIntervalSelect) return;
    heartbeatEnabledCheckbox.addEventListener('change', () => {
        heartbeatIntervalSelect.disabled = !heartbeatEnabledCheckbox.checked;
        console.info(`[Settings] Heartbeat ${heartbeatEnabledCheckbox.checked ? 'enabled' : 'disabled'}`);
    });
}/* wireHeartbeatEnabledToggle() */


/* Reads all form inputs and returns a settings object ready for saveSettings().
** Converts threshold values from the displayed unit back to inches for storage.
** Parameters:
**     HTMLSelectElement updateFreqSelect
**     HTMLSelectElement distanceUnitSelect
**     HTMLInputElement  warningInput
**     HTMLInputElement  criticalInput
**     HTMLInputElement  alarmEnabledCheckbox
**     HTMLInputElement  alarmVolumeSlider
**     HTMLInputElement  heartbeatEnabledCheckbox
**     HTMLSelectElement heartbeatIntervalSelect
** Return:
**     object  settings delta to pass to saveSettings()
*/
function collectFormValues( updateFreqSelect, distanceUnitSelect, warningInput, criticalInput, alarmEnabledCheckbox, alarmVolumeSlider, Select) {
    const newSettings = {};
    const saveUnit = distanceUnitSelect ? distanceUnitSelect.value : 'Inches';
    const maxInches = 12.0;

    if (updateFreqSelect)   newSettings.updateFrequency = parseInt(updateFreqSelect.value);
    if (distanceUnitSelect) newSettings.distanceUnits   = distanceUnitSelect.value;

    // ── Warning threshold ─────────────────────────────────────────────────
    if (warningInput) {
        const raw = warningInput.value.trim();
        const val = parseFloat(raw);

        // ── NEW: reject invalid input ─────────────────────────────────────
        if (raw === '' || isNaN(val)) {
            console.warn(`[Settings] Warning threshold contains invalid input: "${raw}"`);
            // Restore the field to the last saved value
            const fallback = parseFloat(settings.warningThreshold);
            warningInput.value = saveUnit === 'Centimeters'
                ? (fallback * 2.54).toFixed(2)
                : fallback.toFixed(2);
            return null;  // signal: do not save
        }

        let inches = saveUnit === 'Centimeters' ? val / 2.54 : val;
        inches = Math.min(Math.max(inches, 0), maxInches);
        newSettings.warningThreshold = parseFloat(inches.toFixed(2));
    }

    // ── Critical threshold ────────────────────────────────────────────────
    if (criticalInput) {
        const raw = criticalInput.value.trim();
        const val = parseFloat(raw);

        // ── NEW: reject invalid input ─────────────────────────────────────
        if (raw === '' || isNaN(val)) {
            console.warn(`[Settings] Critical threshold contains invalid input: "${raw}"`);
            // Restore the field to the last saved value
            const fallback = parseFloat(settings.criticalThreshold);
            criticalInput.value = saveUnit === 'Centimeters'
                ? (fallback * 2.54).toFixed(2)
                : fallback.toFixed(2);
            return null;  // signal: do not save
        }

        let inches = saveUnit === 'Centimeters' ? val / 2.54 : val;
        inches = Math.min(Math.max(inches, 0), maxInches);
        newSettings.criticalThreshold = parseFloat(inches.toFixed(2));
    }

    // ── Enforce warning < critical ────────────────────────────────────────
    if (newSettings.warningThreshold !== undefined && newSettings.criticalThreshold !== undefined) {
        if (newSettings.warningThreshold >= newSettings.criticalThreshold) {
            console.warn(
                `[Settings] Warning (${newSettings.warningThreshold} in) must be less than ` +
                `critical (${newSettings.criticalThreshold} in) — correcting warning to critical - 0.5`
            );
            newSettings.warningThreshold = parseFloat(
                (newSettings.criticalThreshold - 0.5).toFixed(2)
            );
            // Reflect corrected value back into the field
            if (warningInput) {
                warningInput.value = saveUnit === 'Centimeters'
                    ? (newSettings.warningThreshold * 2.54).toFixed(2)
                    : newSettings.warningThreshold.toFixed(2);
            }
        }
    }

    if (alarmEnabledCheckbox) newSettings.alarmEnabled = alarmEnabledCheckbox.checked;
    if (alarmVolumeSlider)    newSettings.alarmVolume  = parseInt(alarmVolumeSlider.value) / 100;

    if (heartbeatEnabledCheckbox) newSettings.heartbeatEnabled  = heartbeatEnabledCheckbox.checked;
    if (heartbeatIntervalSelect)  newSettings.heartbeatInterval = parseInt(heartbeatIntervalSelect.value);

    return newSettings;
}/* collectFormValues() */

/* Wires the Reset Button Locks button on the Settings page.
** Clears all localStorage keys used by the action button lock system
** (_disableActionButtons / _restoreButtonDisabledState in globals.js).
** This is a manual escape hatch for when a ping or image request times out
** and the buttons remain stuck in the disabled state.
** Parameters:
**     HTMLButtonElement resetButton
**     HTMLElement       statusLabel   optional span to show confirmation
** Return:
**     None
*/
function wireResetButtonLocks(resetButton, statusLabel) {
    if (!resetButton) return;

    resetButton.addEventListener('click', () => {
        // ── Clear all button-lock keys from localStorage ──────────────────
        localStorage.removeItem('ripple_buttons_disabled');
        localStorage.removeItem('ripple_buttons_disabled_time');

        // ── Also clear the individual button state keys ───────────────────
        // These are written by ping.js and images.js respectively
        localStorage.removeItem('ripple_ping_btn_disabled');
        localStorage.removeItem('ripple_ping_btn_disabled_time');
        localStorage.removeItem('ripple_img_btn_disabled');
        localStorage.removeItem('ripple_img_btn_disabled_time');

        console.info('[Settings] Button locks cleared by user');

        // ── Visual confirmation ───────────────────────────────────────────
        if (statusLabel) {
            statusLabel.textContent = '✓ Locks cleared';
            statusLabel.style.color = '#10b981';
            setTimeout(() => {
                statusLabel.textContent = '';
            }, 3000);
        }

        // Flash the button itself green briefly
        resetButton.textContent           = '✓ Locks Cleared!';
        resetButton.style.backgroundColor = '#10b981';
        resetButton.style.color           = '#ffffff';
        setTimeout(() => {
            resetButton.textContent           = 'Reset Button Locks';
            resetButton.style.backgroundColor = '';
            resetButton.style.color           = '';
        }, 2000);
    });
}/* wireResetButtonLocks() */

/* Briefly turns the save button green to confirm the save, then resets it.
** Parameters:
**     HTMLButtonElement saveButton
** Return:
**     None
*/
function flashSaveButton(saveButton) {
    saveButton.textContent         = 'Settings Saved!';
    saveButton.style.backgroundColor = '#10b981';
    setTimeout(() => {
        saveButton.textContent         = 'Save Settings';
        saveButton.style.backgroundColor = '#073763';
    }, 2000);
}/* flashSaveButton() */

/* Briefly turns the save button red to indicate a validation failure.
** Parameters:
**     HTMLButtonElement saveButton
** Return:
**     None
*/
function flashSaveButtonError(saveButton) {
    saveButton.textContent           = 'Settings Not Saved';
    saveButton.style.backgroundColor = '#dc2626';
    setTimeout(() => {
        saveButton.textContent           = 'Save Settings';
        saveButton.style.backgroundColor = '#073763';
    }, 2000);
}/* flashSaveButtonError() */

/* ─── Diagnostic Console ─────────────────────────────────────────────────────
** Intercepts console.log, console.warn, and console.error globally so every
** call is both forwarded to the real browser console and appended to the
** on-page diagnostic panel in Settings.html.
**
** The panel is only rendered on the Settings page, but the interceptor is
** installed as soon as settings.js loads (which is on every page), so log
** entries from the dashboard, chart, and navigation are all captured and
** available the next time the user opens Settings.
**
** The ring buffer is stored on window.top (the parent window) rather than
** in the iframe's own scope. The parent window stays alive for the entire
** browser session, so the buffer survives every iframe reload caused by
** sidebar navigation — no localStorage required.
**
** Entries are capped at MAX_LOG_ENTRIES so memory use stays bounded even
** if the dashboard runs for a long time.
** ─────────────────────────────────────────────────────────────────────────────
*/

const MAX_LOG_ENTRIES = 200;

// ── Session-scoped ring buffer ────────────────────────────────────────────────
// diagnosticLog lives on window.top (the parent window) rather than in this
// iframe's own scope. The parent window (SafePassSystem.html) stays alive for
// the entire browser session — only the iframe is destroyed on navigation —
// so this array persists across every page change without needing localStorage.
//
// On first load window.top._diagnosticLog won't exist yet, so we create it.
// On every subsequent iframe reload it already exists and we just reference it,
// giving us the full session history automatically.
if (!window.top._diagnosticLog) {
    window.top._diagnosticLog = [];
}
const diagnosticLog = window.top._diagnosticLog;

// ── Log level ────────────────────────────────────────────────────────────────
// Three levels in ascending order of severity.
// 'log'   → show everything  (LOG + WARN + ERR)
// 'warn'  → show warnings and errors only  (WARN + ERR)
// 'error' → show errors only  (ERR)
//
// Stored in localStorage under 'diagnosticLogLevel' so the preference
// survives page navigation and refreshes.

const LOG_LEVEL_PRIORITY = { info: 0, warn: 1, error: 2 };

/* Returns the current log level string, defaulting to 'log' (show all).
** Parameters:
**     None
** Return:
**     string 'info' | 'warn' | 'error'
*/
function getLogLevel() {
    return localStorage.getItem('diagnosticLogLevel') || 'info';
} /* getLogLevel() */

/* Saves the log level to localStorage and re-renders the panel so entries
** that were previously hidden (or shown) update immediately.
** Parameters:
**     string level  'log' | 'warn' | 'error'
** Return:
**     None
*/
function setLogLevel(level) {
    if (!LOG_LEVEL_PRIORITY.hasOwnProperty(level)) {
        _realWarn('[DiagConsole] Invalid log level:', level);
        return;
    }
    localStorage.setItem('diagnosticLogLevel', level);
    _realInfo(`[DiagConsole] Log level set to: ${level}`);
    renderDiagnosticLog(false); // preserve scroll position on filter change
} /* setLogLevel() */

/* Returns true if an entry at the given level should be visible
** under the current log level setting.
** Parameters:
**     string entryLevel  'log' | 'warn' | 'error'
** Return:
**     boolean
*/
function _isLevelVisible(entryLevel) {
    return LOG_LEVEL_PRIORITY[entryLevel] >= LOG_LEVEL_PRIORITY[getLogLevel()];
} /* _isLevelVisible() */

// Save references to the originals before we wrap them
const _realInfo   = console.info.bind(console);
const _realWarn  = console.warn.bind(console);
const _realError = console.error.bind(console);

/* Converts any number of console arguments to a single readable string,
** matching the behaviour of the browser console (objects shown as JSON).
** Parameters:
**     ...any args
** Return:
**     string
*/
function _formatArgs(...args) {
    return args.map(a => {
        if (a === null)           return 'null';
        if (a === undefined)      return 'undefined';
        if (typeof a === 'object') {
            try { return JSON.stringify(a, null, 2); }
            catch { return String(a); }
        }
        return String(a);
    }).join(' ');
} /* _formatArgs() */

/* Pushes a new entry onto the diagnostic ring buffer and, if the panel is
** currently visible in the DOM, appends a row immediately.
** Parameters:
**     string level   'info' | 'warn' | 'error'
**     string message
** Return:
**     None
*/
function _pushEntry(level, message) {
    const entry = {
        level,
        message,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    // Always store in the ring buffer regardless of level — the user may
    // lower the level later and want to see entries that arrived earlier.
    diagnosticLog.push(entry);

    // Enforce ring-buffer limit
    if (diagnosticLog.length > MAX_LOG_ENTRIES) {
        diagnosticLog.shift();
    }

    // Only append to the panel if the entry meets the current level filter
    if (_isLevelVisible(level)) {
        _appendEntryToPanel(entry);
    }
} /* _pushEntry() */

/* Creates and appends a single log row to #diagnostic-output if the element
** exists in the current document. Scrolls the panel to the bottom after insert.
** Parameters:
**     object entry  { level, message, timestamp }
** Return:
**     None
*/
function _appendEntryToPanel(entry) {
    const output = document.getElementById('diagnostic-output');
    if (!output) return;

    const colors = { info: '#a3e635', warn: '#fbbf24', error: '#f87171' };
    const prefixes = { info: 'INF', warn: 'WARN', error: 'ERR' };

    const row = document.createElement('div');
    row.style.cssText = `
        display: flex;
        gap: 10px;
        padding: 3px 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.5;
        word-break: break-all;
    `;

    const ts = document.createElement('span');
    ts.style.cssText = 'color: #64748b; white-space: nowrap; flex-shrink: 0;';
    ts.textContent = entry.timestamp;

    const badge = document.createElement('span');
    badge.style.cssText = `color: ${colors[entry.level]}; white-space: nowrap; flex-shrink: 0; font-weight: 700;`;
    badge.textContent = prefixes[entry.level];

    const msg = document.createElement('span');
    msg.style.cssText = `color: ${colors[entry.level]}; white-space: pre-wrap;`;
    msg.textContent = entry.message;

    row.appendChild(ts);
    row.appendChild(badge);
    row.appendChild(msg);
    output.appendChild(row);

    // Auto-scroll to bottom only when the user is already near the bottom.
    // Using a generous threshold (120px) so new entries keep following even
    // if the user is slightly scrolled up but clearly still at the tail end.
    const AUTOSCROLL_THRESHOLD_PX = 120;
    const nearBottom = output.scrollHeight - output.scrollTop - output.clientHeight < AUTOSCROLL_THRESHOLD_PX;
    if (nearBottom) output.scrollTop = output.scrollHeight;
} /* _appendEntryToPanel() */

/* Replays the entire diagnosticLog ring buffer into the panel.
** Called on initial load (scrollToBottom=true) and on level filter changes
** (scrollToBottom=false) so the user's scroll position is preserved when
** they change the log level while reading old entries.
** Parameters:
**     bool scrollToBottom  default true
** Return:
**     None
*/
function renderDiagnosticLog(scrollToBottom = true) {
    const output = document.getElementById('diagnostic-output');
    if (!output) return;

    // Save scroll position before wiping so we can restore it after
    const prevScrollTop = output.scrollTop;
    const prevScrollHeight = output.scrollHeight;

    output.innerHTML = '';
    // Only render entries that meet the current level filter
    diagnosticLog
        .filter(entry => _isLevelVisible(entry.level))
        .forEach(entry => _appendEntryToPanel(entry));

    if (scrollToBottom) {
        // Initial load — jump to the latest entry
        output.scrollTop = output.scrollHeight;
    } else {
        // Re-render due to filter change — maintain relative scroll position
        // so the entries the user was reading stay in view
        const newScrollHeight = output.scrollHeight;
        output.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
    }
} /* renderDiagnosticLog() */

/* Initializes the diagnostic console panel on the Settings page.
** Wires up the toggle button, clear button, and copy button, then replays
** any log entries that were captured before the page loaded.
** Parameters:
**     None
** Return:
**     None
*/
function initializeDiagnosticConsole() {
    const toggleBtn  = document.getElementById('diagnostic-toggle');
    const panel      = document.getElementById('diagnostic-panel');
    const clearBtn   = document.getElementById('diagnostic-clear');
    const copyBtn    = document.getElementById('diagnostic-copy');
    const levelSelect = document.getElementById('diagnostic-level');

    if (!toggleBtn || !panel) return;

    // Restore collapsed/expanded state from last visit
    const collapsed = localStorage.getItem('diagnosticCollapsed') !== 'false';
    panel.style.display = collapsed ? 'none' : 'block';
    toggleBtn.textContent = collapsed ? '▶ Show Console' : '▼ Hide Console';

    // Restore saved log level into the dropdown
    if (levelSelect) {
        levelSelect.value = getLogLevel();
        levelSelect.addEventListener('change', () => {
            setLogLevel(levelSelect.value);
        });
    }

    toggleBtn.addEventListener('click', () => {
        const isHidden = panel.style.display === 'none';
        panel.style.display = isHidden ? 'block' : 'none';
        toggleBtn.textContent = isHidden ? '▼ Hide Console' : '▶ Show Console';
        localStorage.setItem('diagnosticCollapsed', String(!isHidden));
        if (isHidden) renderDiagnosticLog(false); // re-render on expand, preserve scroll position
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            // Truncate in place so the window.top reference stays valid
            diagnosticLog.length = 0;
            const output = document.getElementById('diagnostic-output');
            if (output) output.innerHTML = '';
            _realInfo('[DiagConsole] Log cleared by user');
        });
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const text = diagnosticLog
                .filter(e => _isLevelVisible(e.level))
                .map(e => `[${e.timestamp}] ${e.level.toUpperCase()}: ${e.message}`)
                .join('\n');

            // ── NEW: fallback for non-secure contexts (http://ripple.local) ──
            if (navigator.clipboard && navigator.clipboard.writeText) {
                // Secure context path (HTTPS / localhost)
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.textContent = '✓ Copied';
                    setTimeout(() => { copyBtn.textContent = '⎘ Copy'; }, 2000);
                }).catch(err => {
                    console.warn('[DiagConsole] Clipboard write failed:', err.message);
                });
            } else {
                // Insecure context fallback — create a temporary textarea
                try {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    const ok = document.execCommand('copy');
                    document.body.removeChild(ta);
                    if (ok) {
                        copyBtn.textContent = '✓ Copied';
                        setTimeout(() => { copyBtn.textContent = '⎘ Copy'; }, 2000);
                    } else {
                        copyBtn.textContent = '✗ Failed';
                        setTimeout(() => { copyBtn.textContent = '⎘ Copy'; }, 2000);
                        console.warn('[DiagConsole] execCommand copy returned false');
                    }
                } catch (err) {
                    console.warn('[DiagConsole] Fallback copy failed:', err.message);
                }
            }
        });
    }

    // Replay any entries already in the buffer
    renderDiagnosticLog();
} /* initializeDiagnosticConsole() */

// ── Install interceptors ──────────────────────────────────────────────────────
// These run immediately when settings.js is first parsed, so nothing is missed.

console.info = (...args) => {
    _realInfo(...args);
    _pushEntry('info', _formatArgs(...args));
};

console.warn = (...args) => {
    _realWarn(...args);
    _pushEntry('warn', _formatArgs(...args));
};

console.error = (...args) => {
    _realError(...args);
    _pushEntry('error', _formatArgs(...args));
};

// Capture uncaught errors and unhandled promise rejections too
window.addEventListener('error', (e) => {
    _pushEntry('error', `Uncaught: ${e.message} (${e.filename}:${e.lineno})`);
});

window.addEventListener('unhandledrejection', (e) => {
    _pushEntry('error', `Unhandled Promise: ${e.reason}`);
});