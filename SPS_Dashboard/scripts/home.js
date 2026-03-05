/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: home.js
** --------
** Drives the Home landing page.
** Fetches the latest water level for every configured pole, resolves
** each location's overall warning state, and updates the location cards.
** Refreshes automatically every 5 seconds.
*/

// ── Location config ───────────────────────────────────────────────────────────
// Add new locations here as the system grows.
// Each entry maps a card root element ID to the pole IDs it contains.
const LOCATIONS = [
    {
        cardId:   'card-ross',
        page:     'RossStContent.html',
        title:    'Ross Street',
        subtitle: 'Real-time Flood Monitoring',
        poles: [
            { poleID: 1, iconId: 'ross-p1-icon', levelId: 'ross-p1-level' },
            { poleID: 2, iconId: 'ross-p2-icon', levelId: 'ross-p2-level' },
        ],
        badgeTextId: 'ross-badge-text',
        updatedId:   'ross-updated',
    },
];

// ── State helpers ─────────────────────────────────────────────────────────────
const STATE_ORDER = { normal: 0, warning: 1, critical: 2 };

/* Returns the warning state string for a given water level (in inches).
** Parameters:
**     float level
** Return:
**     string 'normal' | 'warning' | 'critical'
*/
function getState(level) {
    if (level >= settings.criticalThreshold) return 'critical';
    if (level >= settings.warningThreshold)  return 'warning';
    return 'normal';
}

/* Maps a state string to the SVG image path used on the dashboard.
** Parameters:
**     string state
** Return:
**     string src path
*/
function svgForState(state) {
    const map = {
        normal:   'images/WarningState0.svg',
        warning:  'images/WarningState1.svg',
        critical: 'images/WarningState2.svg',
    };
    return map[state] ?? map.normal;
}

/* Human-readable label for a state string.
** Parameters:
**     string state
** Return:
**     string
*/
function stateLabel(state) {
    return { normal: 'Normal', warning: 'Warning', critical: 'CRITICAL', offline: 'Offline', loading: 'Loading…' }[state] ?? '—';
}

/* CSS class for colouring a water-level reading.
** Parameters:
**     string state
** Return:
**     string CSS class name
*/
function levelClass(state) {
    return { normal: 'level-normal', warning: 'level-warning', critical: 'level-critical' }[state] ?? 'level-unknown';
}

// ── Data fetch ────────────────────────────────────────────────────────────────
/* Fetches the most recent row for a single pole from the API.
** Parameters:
**     int poleID
** Return:
**     object | null
*/
async function fetchPole(poleID) {
    const res = await fetch(`/api/data?poleID=${poleID}`);
    const data = await res.json();
    return data[0] ?? null;
}

/* Formats a water level in inches using the user's saved unit preference.
** Parameters:
**     float inches
** Return:
**     string  e.g. "3.25 inches" or "8.26 cm"
*/
function formatLevel(inches) {
    return `${convertDistance(inches)} ${getUnitLabel()}`;
}

/* Formats a created_at timestamp as a short time string.
** Parameters:
**     string isoString
** Return:
**     string  e.g. "02:45 PM"
*/
function formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Card update ───────────────────────────────────────────────────────────────
/* Fetches live data for a single location config object and updates its card.
** Parameters:
**     object loc  — entry from LOCATIONS array
** Return:
**     None
*/
async function updateLocationCard(loc) {
    const card = document.getElementById(loc.cardId);
    if (!card) return;

    try {
        const results = await Promise.all(loc.poles.map(p => fetchPole(p.poleID)));

        // If every pole returned null there's genuinely no data
        if (results.every(r => r === null)) throw new Error('no data');

        // Resolve per-pole state and find the worst overall
        let worstState = 'normal';

        results.forEach((record, i) => {
            const poleCfg = loc.poles[i];
            const level   = record?.waterlevel ?? null;
            const state   = level !== null ? getState(level) : 'normal';

            if (STATE_ORDER[state] > STATE_ORDER[worstState]) {
                worstState = state;
            }

            // Icon
            const icon = document.getElementById(poleCfg.iconId);
            if (icon) icon.src = svgForState(state);

            // Level reading
            const levelEl = document.getElementById(poleCfg.levelId);
            if (levelEl) {
                levelEl.textContent = level !== null ? formatLevel(level) : '-- in';
                levelEl.className   = `loc-sensor-level ${levelClass(state)}`;
            }
        });

        // Overall card state class
        card.className = `home-loc-card state-${worstState}`;

        // Badge text
        const badge = document.getElementById(loc.badgeTextId);
        if (badge) badge.textContent = stateLabel(worstState);

        // Footer timestamp — most recent record wins
        const latest = results.filter(Boolean).sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )[0];

        const updatedEl = document.getElementById(loc.updatedId);
        if (updatedEl && latest) {
            updatedEl.textContent = `Updated ${formatTime(latest.created_at)}`;
        }

    } catch (_) {
        card.className = 'home-loc-card state-offline';

        const badge = document.getElementById(loc.badgeTextId);
        if (badge) badge.textContent = 'Offline';

        const updatedEl = document.getElementById(loc.updatedId);
        if (updatedEl) updatedEl.textContent = 'Could not reach server';
    }
}

/* Runs updateLocationCard for every entry in LOCATIONS.
** Parameters:
**     None
** Return:
**     None
*/
function refreshAll() {
    LOCATIONS.forEach(updateLocationCard);
}

// ── Navigation ────────────────────────────────────────────────────────────────
/* Navigates the parent window's iframe to the given page and syncs the
** header title, subtitle, and active sidebar link.
** Parameters:
**     string page      iframe src, e.g. 'RossStContent.html'
**     string title     header title text
**     string subtitle  header subtitle text
** Return:
**     None
*/
function navigateTo(page, title, subtitle) {
    const parent = window.top;
    if (!parent) return;

    const frame   = parent.document.getElementById('content-frame');
    const hTitle  = parent.document.getElementById('page-title');
    const hSub    = parent.document.getElementById('page-subtitle');
    const links   = parent.document.querySelectorAll('.sidebar-link');

    if (frame)  frame.src = page;
    if (hTitle) hTitle.textContent = title;
    if (hSub)   hSub.textContent   = subtitle;

    links.forEach(l =>
        l.classList.toggle('active', l.getAttribute('data-page') === page)
    );

    console.log(`[Home] Navigated to: ${page}`);
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadSettings();
refreshAll();
// Keep the home page live without hammering the server
setInterval(refreshAll, 5000);