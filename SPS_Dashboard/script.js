// ============================================
// GOOGLE CHARTS SETUP
// ============================================
google.charts.load('current', { packages: ['corechart'] });
let init = true;
let chart;

// ============================================
// CHART DRAWING FUNCTION
// ============================================
async function drawChart(chartData) {
    const data = new google.visualization.DataTable();
    data.addColumn('datetime', 'Time');
    data.addColumn('number', 'Pole 1');
    data.addColumn('number', 'Pole 2');
    data.addRows(chartData);
    
    const options = {
        backgroundColor: 'transparent',
        title: 'Water Level Over Time',
        titleTextStyle: {
            color: '#1e293b',
            fontSize: 16,
            bold: true
        },
        chartArea: {
            left: 70,
            top: 50,
            width: '90%',
            height: '70%'
        },
        hAxis: {
            title: 'Time',
            format: 'MMM d \n h:mm a',
            textStyle: { color: '#64748b' },
            titleTextStyle: { color: '#1e293b' },
            gridlines: { color: '#e2e8f0'},
            minorGridlines: { color: '#f1f5f9', count: 0}
        },
        vAxis: {
            title: 'Water Level (Inches)',
            viewWindow: { min: 0, max: 12 },
            textStyle: { color: '#64748b' },
            titleTextStyle: { color: '#1e293b' },
            gridlines: { color: '#e2e8f0' },
            minorGridlines: { color: '#f1f5f9'}
        },
        legend: {
            position: 'top',
            alignment: 'end',
            textStyle: { color: '#1e293b', fontSize: 13 }
        },
        lineWidth: 3,
        pointSize: 0,
        colors: ['#CC2222', '#2196F3'],  // Red for Pole 1, Blue for Pole 2
        curveType: 'function',
        animation: init ? {
            startup: true,
            duration: 800,
            easing: 'out'
        } : null,
        interpolateNulls: true
    };

    durationSelection(options);

    if (!chart) {
    chart = new google.visualization.LineChart(
        document.getElementById('linechart')
    );
}
    chart.draw(data, options);

    // Redraw chart on window resize for responsiveness
    window.addEventListener('resize', function() {
        chart.draw(data, options);
    });
    
    init = false;
}
// ============================================
// DRAW CHART RANGE
// ============================================
async function durationSelection(options) {
    let duration = document.getElementById("duration-select").value;
    let now = new Date();
    let minDate;
    let format;
    let gridCount;

    switch(duration) {

        case "12 Hours":
            minDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
            format = 'MMM d \n h:mm a';
            gridCount = 7;
            break;

        case "1 Day":
            minDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            format = 'MMM d \n h:mm a';
            gridCount = 12;
            break;

        case "3 Days":
            minDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            format = 'MMM d \n h:mm a';
            gridCount = 3;
            break;

        case "1 Week":
            minDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            format = 'MMM d';
            gridCount = 7;
            break;

        default:
            minDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
            format = 'MMM d \n h:mm a';
            gridCount = 6;
            break;
    }

    options.hAxis.viewWindow = {
        min: minDate,
        max: now
    };

    options.hAxis.format = format;

    options.hAxis.gridlines = {
        count: gridCount,
        color: '#e2e8f0'
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
        
        // Water level thresholds (inches)
        WARNING_THRESHOLD = 3.0;  // State 1
        CRITICAL_THRESHOLD = 6.0; // State 2
        
        // Get latest pole data objects from JSON files
        const lastPole1Data = pole1Data[pole1Data.length - 1];
        const lastPole2Data = pole2Data[pole2Data.length - 1];

        // Calculate water levels (rounded to 2 decimal places)
        const pole1WaterLevel = Math.round(lastPole1Data.waterlevel * 100) / 100;
        const pole2WaterLevel = Math.round(lastPole2Data.waterlevel * 100) / 100;
        
        // Update water level displays
        document.getElementById("pole1-lvl").textContent = pole1WaterLevel + " Inches";
        document.getElementById("pole2-lvl").textContent = pole2WaterLevel + " Inches";

        // Update Pole 1 status image based on water level
        updatePoleStatus('pole1-image', pole1WaterLevel, WARNING_THRESHOLD, CRITICAL_THRESHOLD);
        
        // Update Pole 2 status image based on water level
        updatePoleStatus('pole2-image', pole2WaterLevel, WARNING_THRESHOLD, CRITICAL_THRESHOLD);

        // Prepare chart data
        const chartData = prepareChartData(pole1Data, pole2Data);
        
        // Draw the chart
        drawChart(chartData);
        
    } catch (error) {
        console.error('Error updating pole data:', error);
        // Handle error gracefully - show error state to user if needed
    }
}

// ============================================
// UPDATE POLE STATUS HELPER
// ============================================
function updatePoleStatus(elementId, waterLevel, warningThreshold, criticalThreshold) {
    const element = document.getElementById(elementId);
    
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
// PREPARE CHART DATA
// ============================================
function prepareChartData(pole1Data, pole2Data) {
    const DATA_POINTS_TO_SHOW = 10000000; // Number of data points to display
    let chartData = [];
    let poleSelect = document.getElementById("pole-select").value;
    console.log(poleSelect);
    let minLength = Math.min(pole1Data.length, pole2Data.length);
    let startIndex = (minLength >= DATA_POINTS_TO_SHOW) 
        ? minLength - DATA_POINTS_TO_SHOW 
        : 0;

    for (let i = startIndex; i < minLength; i++) {
        let dateTime = new Date(pole1Data[i].createdat);
        let pole1Level = null;
        let pole2Level = null;
        if(poleSelect === "All Poles" || poleSelect === "Pole 1"){
            pole1Level = pole1Data[i].waterlevel;
        }
        if(poleSelect === "All Poles" || poleSelect === "Pole 2"){
            pole2Level = pole2Data[i].waterlevel;
        }
        chartData.push([dateTime, pole1Level, pole2Level]);
    }

    return chartData;
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
            // Remove 'active' class from all buttons
            imageButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add 'active' class to clicked button
            button.classList.add('active');
            
            // Get image path from data attribute or onclick
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
            
            // Simulate ping delay -- To be removed
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
// RESPONSIVE SIDEBAR TOGGLE (Mobile)
// ============================================
function initializeSidebarToggle() {
    // This function can be extended to add a hamburger menu for mobile
    // Currently the sidebar is hidden on mobile via CSS
    const sidebar = document.querySelector('.sidebar');
    
    // Add mobile menu button if needed
    if (window.innerWidth <= 640) {
        // Mobile menu logic can be added here
    }
}

// ============================================
// NAVIGATION HANDLER FOR IFRAME
// ============================================
function initializeNavigation() {
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const contentFrame = document.getElementById('content-frame');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Get data attributes
            const page = this.getAttribute('data-page');
            const title = this.getAttribute('data-title');
            const subtitle = this.getAttribute('data-subtitle');
            
            // Update active state
            sidebarLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Update header
            if (pageTitle && title) {
                pageTitle.textContent = title;
            }
            if (pageSubtitle && subtitle) {
                pageSubtitle.textContent = subtitle;
            }
            
            // Update iframe source
            if (contentFrame && page) {
                // For dashboard pages, load the content version
                if (page === 'RossSt.html') {
                    contentFrame.src = 'RossStContent.html';
                } else if (page === 'Filler.html') {
                    contentFrame.src = 'FillerContent.html'; // You'll need to create this
                } else {
                    // For other pages, load them directly
                    contentFrame.src = page;
                }
            }
        });
    });
}

// ============================================
// INITIALIZE APPLICATION
// ============================================
function initializeApp() {
    // Check if we're in the main page (not iframe)
    if (window.self === window.top) {
        // Initialize navigation for main page
        initializeNavigation();
    } else {
        // We're inside an iframe, initialize dashboard functionality
        initializeDashboard();
    }
    
    console.log('Application initialized successfully');
}

// ============================================
// INITIALIZE DASHBOARD (FOR IFRAME CONTENT)
// ============================================
function initializeDashboard() {
    // Initialize image selector buttons
    initializeImageButtons();
    
    // Initialize ping button
    initializePingButton();
    
    // Start updating pole data
    updatePoleData();
    
    // Update pole data every second
    setInterval(updatePoleData, 1000);
}

// ============================================
// START APPLICATION WHEN DOM IS READY
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// ============================================
// HANDLE WINDOW RESIZE
// ============================================
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        // Re-initialize components that need resize handling
        initializeSidebarToggle();
    }, 250);
});
