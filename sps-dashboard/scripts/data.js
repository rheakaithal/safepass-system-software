/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: data.js
** --------
** Water-level data fetching, buffering, and the main poll cycle.
** Depends on: globals.js, settings.js, alarm.js, flood.js, chart.js
**
** Functions defined here:
**   initializeData()
**   getNewData()
**   trimOldData(dataArray)
**   updatePoleData()
*/


/* Fetches the last 8 days of historical records for both poles on startup.
** Populates the pole1Data / pole2Data buffers and sets the lastID trackers.
** Parameters:
**     None
** Return:
**     None (async)
*/
async function initializeData() {
    try {
        console.info('[Init] Fetching historical data from server...');

        const [res1, res2] = await Promise.all([
            fetch('/api/initdata?poleID=1'),
            fetch('/api/initdata?poleID=2'),
        ]);

        pole1Data   = await res1.json();
        lastIDPole1 = pole1Data[pole1Data.length - 1]?.id;

        pole2Data   = await res2.json();
        lastIDPole2 = pole2Data[pole2Data.length - 1]?.id;

        console.info(
            `[Init] Historical data loaded — ` +
            `Pole 1: ${pole1Data.length} records (last ID: ${lastIDPole1}), ` +
            `Pole 2: ${pole2Data.length} records (last ID: ${lastIDPole2})`
        );

    } catch (error) {
        console.error('[Init] Failed to load historical data:', error);
    }
}/* initializeData() */


/* Polls /api/data for each pole and appends any new record to the buffer.
** A record is "new" when its id is greater than the last seen id.
** Parameters:
**     None
** Return:
**     None (async)
*/
async function getNewData() {
    try {
        const [res1, res2] = await Promise.all([
            fetch('/api/data?poleID=1'),
            fetch('/api/data?poleID=2'),
        ]);

        const result1 = await res1.json();
        if (result1.length > 0) {
            const record = result1[0];
            if (record.id > (lastIDPole1 ?? -1)) {
                pole1Data.push(record);
                lastIDPole1 = record.id;
                console.info(`[Data] New Pole 1 record — ID: ${record.id}, level: ${record.waterlevel.toFixed(3)} in, time: ${record.created_at}`);
            }
        } else {
            console.warn('[Data] /api/data returned empty result for Pole 1');
        }

        const result2 = await res2.json();
        if (result2.length > 0) {
            const record = result2[0];
            if (record.id > (lastIDPole2 ?? -1)) {
                pole2Data.push(record);
                lastIDPole2 = record.id;
                console.info(`[Data] New Pole 2 record — ID: ${record.id}, level: ${record.waterlevel.toFixed(3)} in, time: ${record.created_at}`);
            }
        } else {
            console.warn('[Data] /api/data returned empty result for Pole 2');
        }

    } catch (error) {
        console.error('[Data] Failed to fetch new data:', error);
    }
}/* getNewData() */


/* Removes records older than 1 week from the front of a data array.
** Mutates the array in place.
** Parameters:
**     array dataArray
** Return:
**     None
*/
function trimOldData(dataArray) {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    let   trimCount  = 0;

    while (dataArray.length > 0 && new Date(dataArray[0].created_at).getTime() < oneWeekAgo) {
        dataArray.shift();
        trimCount++;
    }

    if (trimCount > 0) {
        console.info(`[Data] Trimmed ${trimCount} record(s) older than 1 week from buffer`);
    }
}/* trimOldData() */


/* Main poll cycle. Fetches new data, updates the water level display,
** flood predictions, pole status icons, and chart on every tick.
** Parameters:
**     None
** Return:
**     None (async)
*/
async function updatePoleData() {
    try {
        await getNewData();
        trimOldData(pole1Data);
        trimOldData(pole2Data);

        const lastPole1 = pole1Data[pole1Data.length - 1];
        const lastPole2 = pole2Data[pole2Data.length - 1];

        if (!lastPole1 || !lastPole2) {
            console.warn('[Data] No pole data available yet — skipping UI update');
            return;
        }

        const p1Level = lastPole1.waterlevel;
        const p2Level = lastPole2.waterlevel;

        logPollResult(p1Level, p2Level);
        checkFloodingStatus(p1Level, p2Level);
        updateWaterLevelBadges(p1Level, p2Level);
        updateWarningIcons(p1Level, p2Level);
        updateFloodPredictions(p1Level, p2Level);
        updateChartData(pole1Data, pole2Data);

    } catch (error) {
        console.error('[Data] Error in updatePoleData:', error);
    }
}/* updatePoleData() */


/* Logs the current water levels and buffer sizes for both poles.
** Parameters:
**     float p1Level  Pole 1 water level in inches
**     float p2Level  Pole 2 water level in inches
** Return:
**     None
*/
function logPollResult(p1Level, p2Level) {
    console.info(
        `[Data] Pole 1: ${p1Level.toFixed(3)} in | Pole 2: ${p2Level.toFixed(3)} in | ` +
        `Buffer: ${pole1Data.length} / ${pole2Data.length} records`
    );
}/* logPollResult() */


/* Formats a water level for the badge display, applying unit conversion
** and using a "Less Than 1" label for near-zero readings.
** Parameters:
**     float level     water level in inches
**     string unitLabel  e.g. 'inches' or 'cm'
** Return:
**     string
*/
function formatWaterLevelBadge(level, unitLabel) {
    return level < 1.0
        ? `Less Than ${convertDistance(1)} ${unitLabel}`
        : `${convertDistance(level)} ${unitLabel}`;
}/* formatWaterLevelBadge() */


/* Updates the water level badge elements for both poles.
** Parameters:
**     float p1Level  Pole 1 water level in inches
**     float p2Level  Pole 2 water level in inches
** Return:
**     None
*/
function updateWaterLevelBadges(p1Level, p2Level) {
    const unitLabel = getUnitLabel();
    const pole1Lvl  = document.getElementById('pole1-lvl');
    const pole2Lvl  = document.getElementById('pole2-lvl');

    if (pole1Lvl) pole1Lvl.textContent = formatWaterLevelBadge(p1Level, unitLabel);
    if (pole2Lvl) pole2Lvl.textContent = formatWaterLevelBadge(p2Level, unitLabel);
}/* updateWaterLevelBadges() */


/* Updates the warning-state SVG icons for both poles.
** Parameters:
**     float p1Level  Pole 1 water level in inches
**     float p2Level  Pole 2 water level in inches
** Return:
**     None
*/
function updateWarningIcons(p1Level, p2Level) {
    updatePoleStatus('pole1-image', p1Level, settings.warningThreshold, settings.criticalThreshold);
    updatePoleStatus('pole2-image', p2Level, settings.warningThreshold, settings.criticalThreshold);
}/* updateWarningIcons() */


/* Calculates and applies time-to-flood predictions for both poles.
** Parameters:
**     float p1Level  Pole 1 water level in inches
**     float p2Level  Pole 2 water level in inches
** Return:
**     None
*/
function updateFloodPredictions(p1Level, p2Level) {
    const ttf1 = predictTimeToFlood(pole1Data, settings.criticalThreshold, p1Level);
    const ttf2 = predictTimeToFlood(pole2Data, settings.criticalThreshold, p2Level);

    if (ttf1 !== null) console.warn(`[Flood] Pole 1 est. time to flood: ${ttf1} min`);
    if (ttf2 !== null) console.warn(`[Flood] Pole 2 est. time to flood: ${ttf2} min`);

    updateTimeToFlood('pole1', ttf1, alarmState.pole1Flooding);
    updateTimeToFlood('pole2', ttf2, alarmState.pole2Flooding);
}/* updateFloodPredictions() */
