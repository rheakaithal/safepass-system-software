/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: alarm.js
** --------
** Audio alarm and critical-flood visual alert functions.
** Depends on: globals.js, settings.js
**
** Functions defined here:
**   playAlarmSound(volume, duration)
**   startContinuousAlarm()
**   stopContinuousAlarm()
**   updateBorderPulse(isFlooding)
**   checkFloodingStatus(pole1Level, pole2Level)
*/


/* Plays a single alarm tone using the Web Audio API.
** Creates alternating 800 Hz / 1000 Hz sine waves for urgency.
** Returns early without error if alarms are disabled in settings.
** Parameters:
**     float volume   0.0 to 1.0  (default 0.7)
**     int   duration milliseconds (default 2000)
** Return:
**     { oscillator, audioContext } | null
*/
function playAlarmSound(volume = 0.7, duration = 2000) {
    // Respects the user's alarm preference — return silently if disabled
    if (!settings.alarmEnabled) return null;

    try {
        // Web Audio API context must be created fresh each call — reusing a
        // closed context throws an error
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator   = audioContext.createOscillator();
        const gainNode     = audioContext.createGain();

        // Route: oscillator → gain → speakers
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Alternate between 800 Hz and 1000 Hz to create an urgent two-tone effect
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800,  audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.25);
        oscillator.frequency.setValueAtTime(800,  audioContext.currentTime + 0.5);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.75);

        // Start at the requested volume and fade out smoothly over the duration
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);

        console.info(`[Alarm] Playing alarm — volume: ${Math.round(volume * 100)}%, duration: ${duration}ms`);
        return { oscillator, audioContext };

    } catch (error) {
        console.error('[Alarm] Failed to play alarm sound:', error);
        return null;
    }
}/* playAlarmSound() */


/* Starts the continuous alarm loop, playing a tone every 3 seconds.
** Does nothing if alarms are disabled or the alarm is already playing.
** Parameters:
**     None
** Return:
**     None
*/
function startContinuousAlarm() {
    if (!settings.alarmEnabled || alarmState.alarmPlaying) return;

    alarmState.alarmPlaying = true;
    console.warn('[Alarm] Continuous alarm started');

    playAlarmSound(settings.alarmVolume, 1500);

    alarmState.alarmInterval = setInterval(() => {
        if (alarmState.alarmPlaying && settings.alarmEnabled) {
            playAlarmSound(settings.alarmVolume, 1500);
        }
    }, 3000);
}/* startContinuousAlarm() */


/* Stops the continuous alarm and clears its interval.
** Parameters:
**     None
** Return:
**     None
*/
function stopContinuousAlarm() {
    alarmState.alarmPlaying = false;
    console.info('[Alarm] Continuous alarm stopped');

    if (alarmState.alarmInterval) {
        clearInterval(alarmState.alarmInterval);
        alarmState.alarmInterval = null;
    }
}/* stopContinuousAlarm() */


/* Adds or removes a pulsing red inset border on the page body to give
** a full-screen visual warning when critical flooding is active.
** Parameters:
**     bool isFlooding
** Return:
**     None
*/
function updateBorderPulse(isFlooding) {
    const body = document.body;

    if (isFlooding) {
        body.style.boxShadow = 'inset 0 0 0 8px rgba(220, 38, 38, 0.6)';
        body.style.animation = 'borderPulse 1.5s ease-in-out infinite';

        if (!document.getElementById('borderPulseStyle')) {
            const style = document.createElement('style');
            style.id = 'borderPulseStyle';
            style.textContent = `
                @keyframes borderPulse {
                    0%, 100% { box-shadow: inset 0 0 0 8px rgba(220, 38, 38, 0.8); }
                    50%       { box-shadow: inset 0 0 0 8px rgba(220, 38, 38, 0.3); }
                }
            `;
            document.head.appendChild(style);
        }
    } else {
        body.style.boxShadow = 'none';
        body.style.animation = 'none';
    }
}/* updateBorderPulse() */


/* Compares current water levels against the critical threshold and starts
** or stops the continuous alarm accordingly. Also fires the border pulse.
** Parameters:
**     float pole1Level  water level in inches
**     float pole2Level  water level in inches
** Return:
**     None
*/
function checkFloodingStatus(pole1Level, pole2Level) {
    // Snapshot the previous flooding state so we can detect transitions
    const pole1WasFlooding = alarmState.pole1Flooding;
    const pole2WasFlooding = alarmState.pole2Flooding;

    // Update current flooding state based on latest water levels
    alarmState.pole1Flooding = pole1Level >= settings.criticalThreshold;
    alarmState.pole2Flooding = pole2Level >= settings.criticalThreshold;

    const anyFlooding = alarmState.pole1Flooding || alarmState.pole2Flooding;
    const wasFlooding = pole1WasFlooding || pole2WasFlooding;

    // Always sync the border pulse to the current flooding state
    updateBorderPulse(anyFlooding);

    // Only start the alarm on the transition from not-flooding → flooding
    // to avoid restarting it on every poll tick while flooding is active
    if (anyFlooding && !wasFlooding) {
        const floodingPoles = [
            alarmState.pole1Flooding ? 'Pole 1' : null,
            alarmState.pole2Flooding ? 'Pole 2' : null
        ].filter(Boolean).join(', ');
        console.error(
            `[Flood] CRITICAL FLOODING DETECTED on ${floodingPoles} — ` +
            `Pole 1: ${pole1Level.toFixed(2)} in, Pole 2: ${pole2Level.toFixed(2)} in ` +
            `(threshold: ${settings.criticalThreshold} in)`
        );
        startContinuousAlarm();
    }

    // Log warning-level readings (above warning threshold but not yet critical)
    const pole1Warning = pole1Level >= settings.warningThreshold && !alarmState.pole1Flooding;
    const pole2Warning = pole2Level >= settings.warningThreshold && !alarmState.pole2Flooding;
    if (pole1Warning) console.warn(`[Flood] Pole 1 at WARNING level: ${pole1Level.toFixed(2)} in (threshold: ${settings.warningThreshold} in)`);
    if (pole2Warning) console.warn(`[Flood] Pole 2 at WARNING level: ${pole2Level.toFixed(2)} in (threshold: ${settings.warningThreshold} in)`);

    // Stop the alarm on the transition from flooding → not-flooding
    if (!anyFlooding && wasFlooding) {
        stopContinuousAlarm();
        console.info(`[Flood] Flooding subsided — Pole 1: ${pole1Level.toFixed(2)} in, Pole 2: ${pole2Level.toFixed(2)} in`);
    }
}/* checkFloodingStatus() */