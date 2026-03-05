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
        console.log(`[Settings] Loaded from localStorage — frequency: ${settings.updateFrequency}ms, units: ${settings.distanceUnits}, warning: ${settings.warningThreshold} in, critical: ${settings.criticalThreshold} in, alarm: ${settings.alarmEnabled ? 'on' : 'off'} @ ${Math.round(settings.alarmVolume * 100)}%`);
    } else {
        console.log('[Settings] No saved settings found — using defaults');
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
        console.log(`[Settings] Saved — changed: ${diff}`);
    } else {
        console.log('[Settings] Saved — no values changed');
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
    console.log('[Settings] Initializing settings page');

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

    // Warn about any missing elements so layout regressions are easy to spot
    const elements = { updateFreqSelect, distanceUnitSelect, warningInput, criticalInput, alarmEnabledCheckbox, alarmVolumeSlider, saveButton };
    Object.entries(elements).forEach(([name, el]) => {
        if (!el) console.warn(`[Settings] Expected element not found in DOM: ${name}`);
    });

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
            const warningInches = parseFloat(settings.warningThreshold);
            if (currentUnit === 'Centimeters') {
                warningInput.value = (warningInches * 2.54).toFixed(2);
            } else {
                warningInput.value = warningInches.toFixed(2);
            }
        }
        
        if (criticalInput) {
            const criticalInches = parseFloat(settings.criticalThreshold);
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
        distanceUnitSelect.addEventListener('change', () => {
            console.log(`[Settings] Distance unit changed to: ${distanceUnitSelect.value}`);
            updateThresholdDisplay();
        });
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
            console.log(`[Settings] Test alarm triggered at volume: ${Math.round(volume * 100)}%`);
            playAlarmSound(volume, 2000);
        });
    }

    // Initial display update
    updateThresholdDisplay();
    console.log('[Settings] Settings page ready');

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

                // Warn if thresholds are inverted or equal
                if (parseFloat(newSettings.criticalThreshold) <= parseFloat(newSettings.warningThreshold)) {
                    console.warn(`[Settings] Critical threshold (${newSettings.criticalThreshold}) is not greater than warning threshold (${newSettings.warningThreshold}) — this may cause unexpected behaviour`);
                }
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
            saveButton.textContent = 'Settings Saved!';
            saveButton.style.backgroundColor = '#10b981';
            
            // Change back after 2 seconds
            setTimeout(() => {
                saveButton.textContent = "Save Settings";
                saveButton.style.backgroundColor = '#073763';
            }, 2000);
        });
    }
} /* initializeSettingPage() */


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

const LOG_LEVEL_PRIORITY = { log: 0, warn: 1, error: 2 };

/* Returns the current log level string, defaulting to 'log' (show all).
** Parameters:
**     None
** Return:
**     string 'log' | 'warn' | 'error'
*/
function getLogLevel() {
    return localStorage.getItem('diagnosticLogLevel') || 'log';
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
    _realLog(`[DiagConsole] Log level set to: ${level}`);
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
const _realLog   = console.log.bind(console);
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
**     string level   'log' | 'warn' | 'error'
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

    const colors = { log: '#a3e635', warn: '#fbbf24', error: '#f87171' };
    const prefixes = { log: 'LOG', warn: 'WARN', error: 'ERR' };

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
            _realLog('[DiagConsole] Log cleared by user');
        });
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            // Copy only what is currently visible (respects active level filter)
            const text = diagnosticLog
                .filter(e => _isLevelVisible(e.level))
                .map(e => `[${e.timestamp}] ${e.level.toUpperCase()}: ${e.message}`)
                .join('\n');
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.textContent = '✓ Copied';
                setTimeout(() => { copyBtn.textContent = '⎘ Copy'; }, 2000);
            });
        });
    }

    // Replay any entries already in the buffer
    renderDiagnosticLog();
} /* initializeDiagnosticConsole() */

// ── Install interceptors ──────────────────────────────────────────────────────
// These run immediately when settings.js is first parsed, so nothing is missed.

console.log = (...args) => {
    _realLog(...args);
    _pushEntry('log', _formatArgs(...args));
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