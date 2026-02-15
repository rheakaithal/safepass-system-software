// ============================================
// DATA INTERPOLATION FOR SMOOTHER HOVER
// ============================================

// Get value at specific timestamp using linear interpolation
function getValueAtTime(timestamps, values, targetTime) {
    if (timestamps.length === 0) return null;
    if (timestamps.length === 1) return values[0];
    
    const targetMs = targetTime.getTime();
    
    // If before first point, return first value
    if (targetMs <= timestamps[0].getTime()) {
        return values[0];
    }
    
    // If after last point, return last value
    if (targetMs >= timestamps[timestamps.length - 1].getTime()) {
        return values[values.length - 1];
    }
    
    // Find surrounding points
    for (let i = 0; i < timestamps.length - 1; i++) {
        const t1 = timestamps[i].getTime();
        const t2 = timestamps[i + 1].getTime();
        
        if (targetMs >= t1 && targetMs <= t2) {
            // Linear interpolation
            const v1 = values[i];
            const v2 = values[i + 1];
            const ratio = (targetMs - t1) / (t2 - t1);
            return v1 + (v2 - v1) * ratio;
        }
    }
    
    return values[values.length - 1];
}

// Create unified timeline from two independent datasets
function createUnifiedTimeline(pole1Data, pole2Data, minDate, maxDate, targetPoints = 500) {
    // Extract timestamps and values from both poles
    const pole1Timestamps = [];
    const pole1Values = [];
    const pole2Timestamps = [];
    const pole2Values = [];
    
    // Filter pole 1 data within date range
    pole1Data.forEach(item => {
        const timestamp = new Date(item.createdat);
        if (timestamp >= minDate && timestamp <= maxDate) {
            pole1Timestamps.push(timestamp);
            pole1Values.push(item.waterlevel);
        }
    });
    
    // Filter pole 2 data within date range
    pole2Data.forEach(item => {
        const timestamp = new Date(item.createdat);
        if (timestamp >= minDate && timestamp <= maxDate) {
            pole2Timestamps.push(timestamp);
            pole2Values.push(item.waterlevel);
        }
    });
    
    // If no data, return empty
    if (pole1Timestamps.length === 0 && pole2Timestamps.length === 0) {
        return {
            timestamps: [],
            pole1Values: [],
            pole2Values: []
        };
    }
    
    // Find overall time range
    const allTimestamps = [...pole1Timestamps, ...pole2Timestamps];
    const startTime = Math.min(...allTimestamps.map(t => t.getTime()));
    const endTime = Math.max(...allTimestamps.map(t => t.getTime()));
    
    // Create evenly-spaced timeline
    const unifiedTimestamps = [];
    const timeStep = (endTime - startTime) / (targetPoints - 1);
    
    for (let i = 0; i < targetPoints; i++) {
        const time = startTime + (i * timeStep);
        unifiedTimestamps.push(new Date(time));
    }
    
    // Interpolate each pole's data onto unified timeline
    const unifiedPole1Values = unifiedTimestamps.map(timestamp => 
        getValueAtTime(pole1Timestamps, pole1Values, timestamp)
    );
    
    const unifiedPole2Values = unifiedTimestamps.map(timestamp => 
        getValueAtTime(pole2Timestamps, pole2Values, timestamp)
    );
    
    return {
        timestamps: unifiedTimestamps,
        pole1Values: unifiedPole1Values,
        pole2Values: unifiedPole2Values
    };
}

// ============================================
// CHART.JS IMPLEMENTATION
// ============================================
let waterLevelChart = null;

// ============================================
// INITIALIZE CHART
// ============================================
function initializeChart() {
    const ctx = document.getElementById('waterLevelChart');
    if (!ctx) return;

    const unitLabel = getUnitLabel();

    waterLevelChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Pole 1',
                    data: [],
                    borderColor: '#CC2222',
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: 0.4,
                    fill: false,
                    hidden: false
                },
                {
                    label: 'Pole 2',
                    data: [],
                    borderColor: '#2196F3',
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: 0.4,
                    fill: false,
                    hidden: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                intersect: false,
                axis: 'xy'
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        color: '#1e293b',
                        font: {
                            size: 13,
                            weight: '500'
                        },
                        usePointStyle: true,
                        padding: 15,
                        boxWidth: 8,
                        boxHeight: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#475569',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            const inches = context.parsed.y;
                            const converted = convertDistance(inches);
                            label += converted + ' ' + unitLabel;
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: {
                            minute: 'h:mm a',
                            hour: 'h:mm a',
                            day: 'MMM d'
                        },
                        tooltipFormat: 'MMM d, h:mm a'
                    },
                    title: {
                        display: true,
                        text: 'Time',
                        color: '#1e293b',
                        font: {
                            size: 13,
                            weight: '600'
                        }
                    },
                    ticks: {
                        color: '#64748b',
                        maxRotation: 45,
                        minRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 10
                    },
                    grid: {
                        color: '#e2e8f0',
                        drawBorder: false
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 12,
                    title: {
                        display: true,
                        text: `Water Level (${unitLabel})`,
                        color: '#1e293b',
                        font: {
                            size: 13,
                            weight: '600'
                        }
                    },
                    ticks: {
                        color: '#64748b',
                        callback: function(value) {
                            const converted = convertDistance(value);
                            return converted + ' ' + unitLabel;
                        }
                    },
                    grid: {
                        color: '#e2e8f0',
                        drawBorder: false
                    }
                }
            },
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            }
        }
    });

    // Setup duration selector
    setupDurationSelector();
    
    // Setup pole selector
    setupPoleSelector();
}

// ============================================
// SETUP DURATION SELECTOR
// ============================================
function setupDurationSelector() {
    const durationSelect = document.getElementById('duration-select');
    if (!durationSelect) return;

    durationSelect.addEventListener('change', () => {
        updateChartTimeRange();
    });
}

// ============================================
// UPDATE CHART TIME RANGE
// ============================================
function updateChartTimeRange() {
    if (!waterLevelChart) return;

    const duration = document.getElementById('duration-select')?.value || '12 Hours';
    const now = new Date();
    let minDate;
    let timeUnit = 'minute';

    switch(duration) {
        case '12 Hours':
            minDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
            timeUnit = 'minute';
            break;
        case '1 Day':
            minDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            timeUnit = 'hour';
            break;
        case '3 Days':
            minDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            timeUnit = 'hour';
            break;
        case '1 Week':
            minDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            timeUnit = 'day';
            break;
        default:
            minDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    }

    waterLevelChart.options.scales.x.time.unit = timeUnit;
    waterLevelChart.options.scales.x.min = minDate;
    waterLevelChart.options.scales.x.max = now;
    
    waterLevelChart.update('none');
}

// ============================================
// SETUP POLE SELECTOR
// ============================================
function setupPoleSelector() {
    const poleSelect = document.getElementById('pole-select');
    if (!poleSelect) return;

    poleSelect.addEventListener('change', () => {
        updatePoleVisibility();
    });
}

// ============================================
// UPDATE POLE VISIBILITY
// ============================================
function updatePoleVisibility() {
    if (!waterLevelChart) return;

    const poleSelect = document.getElementById('pole-select')?.value || 'All Poles';

    // Show/hide datasets based on selection
    waterLevelChart.data.datasets[0].hidden = (poleSelect === 'Pole 2');
    waterLevelChart.data.datasets[1].hidden = (poleSelect === 'Pole 1');

    waterLevelChart.update('active');
}

// ============================================
// UPDATE CHART DATA
// ============================================
function updateChartData(pole1Data, pole2Data) {
    if (!waterLevelChart) {
        initializeChart();
        return;
    }

    const duration = document.getElementById('duration-select')?.value || '12 Hours';
    const now = new Date();
    let minDate;

    switch(duration) {
        case '12 Hours':
            minDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
            break;
        case '1 Day':
            minDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '3 Days':
            minDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            break;
        case '1 Week':
            minDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        default:
            minDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    }

    // Create unified timeline with interpolated data
    // This handles poles with different timestamps
    const unifiedData = createUnifiedTimeline(pole1Data, pole2Data, minDate, now);

    // Update chart data with unified timeline
    waterLevelChart.data.labels = unifiedData.timestamps;
    waterLevelChart.data.datasets[0].data = unifiedData.pole1Values;
    waterLevelChart.data.datasets[1].data = unifiedData.pole2Values;

    // Update time range
    updateChartTimeRange();
    
    // Update visibility based on selection
    updatePoleVisibility();

    // Update chart
    waterLevelChart.update('active');
}