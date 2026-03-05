const express = require('express');
const path = require('path');
const app = express();

const cors = require('cors');
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'SafePassSystem.html'));
});

// --- Mock data helpers ---

// Generates a week of fake water level readings for a given pole,
// one entry per minute, with a slow sine wave so the graph looks alive
function generateMockHistory(poleId) {
    const records = [];
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const intervalMs = 60 * 1000; // one point per minute
    const totalPoints = oneWeek / intervalMs;

    for (let i = 0; i < totalPoints; i++) {
        const t = now - oneWeek + i * intervalMs;
        // Sine wave between 1 and 5 inches, slightly different phase per pole
        const phase = poleId === 1 ? 0 : Math.PI / 3;
        const waterlevel = 3 + 2 * Math.sin((i / 200) + phase);
        records.push({
            id: i + 1,
            pole_id: poleId,
            waterlevel: parseFloat(waterlevel.toFixed(3)),
            created_at: new Date(t).toISOString()
        });
    }
    return records;
}

const mockPole1 = generateMockHistory(1);
const mockPole2 = generateMockHistory(2);

function getMockData(poleId) {
    return poleId === 1 ? mockPole1 : mockPole2;
}


// Mirrors /api/initdata — returns last 8 days of data for a pole
app.get('/api/initdata', (req, res) => {
    const poleId = parseInt(req.query.poleID);
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const data = getMockData(poleId).filter(r => new Date(r.created_at) >= eightDaysAgo);
    res.json(data);
});

// Mirrors /api/data — returns only the single latest record, 
// with waterlevel drifting slightly each call to simulate live updates
let liveOffset = 0;
app.get('/api/data', (req, res) => {
    const poleId = parseInt(req.query.poleID);
    const data = getMockData(poleId);
    const latest = { ...data[data.length - 1] };

    // Drift the live reading slightly each poll so the chart and badge update
    liveOffset += 0.05;
    const phase = poleId === 1 ? 0 : Math.PI / 3;
    latest.waterlevel = parseFloat((3 + 2 * Math.sin(liveOffset + phase)).toFixed(3));
    latest.created_at = new Date().toISOString();

    res.json([latest]);
});

// Mirrors /api/ping — always reports both services healthy
app.get('/api/ping', (req, res) => {
    res.json({ success: true, mysql: true, mqtt: true });
});

const PORT = 80;
app.listen(PORT, '0.0.0.0', () => console.log(`Mock server running at http://localhost:${PORT}`));