/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: flood.js
** --------
** Flood prediction maths, time-to-flood formatting, and pole status image updates.
** Depends on: globals.js, settings.js
**
** Functions defined here:
**   predictTimeToFlood(dataPoints, criticalThreshold, currentLevel)
**   formatTimeToFlood(minutes)
**   updateTimeToFlood(poleId, minutes, isActuallyFlooding)
**   updatePoleStatus(elementId, waterLevel, warningThreshold, criticalThreshold)
*/


/* Predicts minutes until flooding using a linear trend over the last 10 readings.
** Returns null  — water is not rising or there is not enough data.
** Returns 0     — water has already reached the critical threshold.
** Returns 1–120 — estimated minutes to flood (clamped to 2-hour window).
** Parameters:
**     array dataPoints       array of { waterlevel, created_at } records
**     float criticalThreshold inches
**     float currentLevel      current displayed water level in inches
** Return:
**     int | null | 0
*/
function predictTimeToFlood(dataPoints, criticalThreshold, currentLevel) {
    if (dataPoints.length < 2) return null;

    const recentPoints = dataPoints.slice(-10);

    let totalRateChange = 0;
    let validIntervals  = 0;

    for (let i = 1; i < recentPoints.length; i++) {
        const timeDiff  = new Date(recentPoints[i].created_at).getTime()
                        - new Date(recentPoints[i - 1].created_at).getTime();
        const waterDiff = recentPoints[i].waterlevel - recentPoints[i - 1].waterlevel;

        if (timeDiff > 0) {
            totalRateChange += waterDiff / timeDiff;
            validIntervals++;
        }
    }

    if (validIntervals === 0) return null;

    const averageRatePerMs = totalRateChange / validIntervals;

    // Use the caller-supplied current level so the prediction is consistent
    // with what the UI is already displaying
    if (currentLevel === undefined || currentLevel === null) {
        currentLevel = recentPoints[recentPoints.length - 1].waterlevel;
    }

    if (currentLevel >= criticalThreshold) return 0;
    if (averageRatePerMs <= 0)              return null;

    const levelDifference    = criticalThreshold - currentLevel;
    const timeToFloodMinutes = Math.floor(levelDifference / averageRatePerMs / (1000 * 60));

    if (timeToFloodMinutes > 120) return null;

    // Clamp to 1 — a 0 return is reserved for "already flooding" above
    return Math.max(1, timeToFloodMinutes);
}/* predictTimeToFlood() */


/* Converts a minutes value into a display object used by updateTimeToFlood().
** Parameters:
**     int minutes
** Return:
**     { display: bool, text: string, urgent: bool }
*/
function formatTimeToFlood(minutes) {
    if (minutes === null || minutes === undefined) return { display: false, text: '' };

    if (minutes <= 0)  return { display: true, text: 'FLOODING NOW', urgent: true };
    if (minutes === 1) return { display: true, text: '1 minute',     urgent: true };
    if (minutes < 60)  return { display: true, text: `${minutes} minutes`, urgent: minutes <= 10 };

    const hours            = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
        return { display: true, text: `${hours} hour${hours > 1 ? 's' : ''}`, urgent: false };
    }

    return { display: true, text: `${hours}h ${remainingMinutes}m`, urgent: false };
}/* formatTimeToFlood() */


/* Updates the "Est. Time to Flood" row inside a pole's card.
** Hides the row when no prediction is available; colours urgent predictions red.
** Parameters:
**     string poleId           DOM id prefix, e.g. 'pole1'
**     int    minutes          value from predictTimeToFlood()
**     bool   isActuallyFlooding
** Return:
**     None
*/
function updateTimeToFlood(poleId, minutes, isActuallyFlooding = false) {
    const floodWarningEl = document
        .querySelector(`#${poleId}-image`)
        ?.closest('.pole-item')
        ?.querySelector('.flood-warning');

    if (!floodWarningEl) return;

    // Safety guard: algorithm may return 0 before the threshold is actually crossed
    if (minutes === 0 && !isActuallyFlooding) minutes = 1;

    const formatted = formatTimeToFlood(minutes);

    if (!formatted.display) {
        floodWarningEl.style.display = 'none';
        return;
    }

    floodWarningEl.style.display = 'flex';

    const valueEl = floodWarningEl.querySelector('.warning-value');
    if (valueEl) {
        valueEl.textContent = formatted.text;
        valueEl.style.color      = formatted.urgent ? '#dc2626' : '#f59e0b';
        valueEl.style.fontWeight = '700';
        valueEl.style.animation  = formatted.urgent ? 'pulse 1s ease-in-out infinite' : 'none';
    }
}/* updateTimeToFlood() */


/* Swaps the warning-state SVG icon for a pole based on its current water level.
** Parameters:
**     string elementId        DOM id of the <img> element
**     float  waterLevel       inches
**     float  warningThreshold inches
**     float  criticalThreshold inches
** Return:
**     None
*/
function updatePoleStatus(elementId, waterLevel, warningThreshold, criticalThreshold) {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (waterLevel >= criticalThreshold) {
        element.src = 'images/WarningState2.svg';
        element.alt = 'Critical flood warning';
    } else if (waterLevel >= warningThreshold) {
        element.src = 'images/WarningState1.svg';
        element.alt = 'Flood warning';
    } else {
        element.src = 'images/WarningState0.svg';
        element.alt = 'Normal status';
    }
}/* updatePoleStatus() */
