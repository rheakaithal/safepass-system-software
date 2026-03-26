
// Load Google Charts
google.charts.load('current', { packages: ['corechart'] });

google.charts.setOnLoadCallback(drawChart);

async function drawChart(chartData) {
    var data = new google.visualization.DataTable();
    data.addColumn('timeofday', 'Time (Hours)');
    data.addColumn('number', 'Pole 1');
    data.addColumn('number', 'Pole 2');

    data.addRows(chartData);
    
    var options = {
        title: 'Water Level Over Time',
        hAxis: { 
            title: 'Time (Hours)',
            format: 'h:mm a',
            gridlines: { units: { hours: {format: ['h:mm', "h:mm a"] } } },
            minorGridlines: { units: { minutes: { format: ['h:mm', "h:mm a"] } } },
        },
        vAxis: { 
            title: 'Level (Inches)',
            viewWindow: { min: 0, max: 10},
            ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        },
        legend: { position: 'bottom' },
        lineWidth: 3,
        colors: ['#CC2222', 'blue', '#F7DD5B', '#CC0000'],
        curveType: 'function'
    };

    var chart = new google.visualization.LineChart(document.getElementById('linechart'));
    chart.draw(data, options);
}

//API Calls and Data Updates
async function updateLastPing(){
    let status = "Unknown";
    try {
        const res = await fetch('http://127.0.0.1:3000/api/db-ping');
        const data = await res.json();
        status = "<span style=\"color:green;\">" + data.status + "</span>";
    } catch {
        status = "<span style=\"color:red;\">Server unreachable</span>";
    }
    let lastPing = new Date().toLocaleString();
    document.getElementById("lastping").innerHTML = "<span style=\"font-weight:bold;\">Status: </span>" + status + " at " + lastPing;

}

async function updateLastImages(){
    let lastImages = new Date().toLocaleString(); // Placeholder value - Updates when button is pressed
    document.getElementById("lastimages").innerHTML = "<span style=\"font-weight:bold;\">Last Images: </span>" + lastImages;
}

async function updatePoleData(){
    const JSONdata = await fetch('data.json');  //Gets the file from directory
    const data = await JSONdata.json(); //Parses the JSON data to get database entries
    //Inches of water level thresholds
    const WARNING_THRESHOLD = 3.0; //State 1
    const CRITLVL_THRESHOLD = 6.0; //State 2
    
    //get latest pole data obects from JSON file
    let lastPole1Data = data[data.length-2]; //Second to last entry is Pole 1
    let lastPole2Data = data[data.length-1]; //Last entry is Pole 2

    //update water levels
    let pole1waterlvl = Math.round((lastPole1Data.waterlevel) * 100) / 100;
    let pole2waterlvl = Math.round((lastPole2Data.waterlevel) * 100) / 100;
    
    //update wate level displays
    document.getElementById("pole1lvl").textContent = "Water Level: " + pole1waterlvl + " in";
    document.getElementById("pole2lvl").textContent = "Water Level: " + pole2waterlvl + " in";

    //Updates Pole Status
    if (pole1waterlvl >= CRITLVL_THRESHOLD){
        document.getElementById("pole1status").src = "images/WarningState2.jpg";
    }else if (pole1waterlvl >= WARNING_THRESHOLD){
        document.getElementById("pole1status").src = "images/WarningState1.jpg";
    }else{
        document.getElementById("pole1status").src = "images/WarningState0.jpg";
    }
    if (pole2waterlvl >= CRITLVL_THRESHOLD){
        document.getElementById("pole2status").src = "images/WarningState2.jpg";
    }else if (pole2waterlvl >= WARNING_THRESHOLD){
        document.getElementById("pole2status").src = "images/WarningState1.jpg";
    }else{
        document.getElementById("pole2status").src = "images/WarningState0.jpg";
    }

    //Creates array of data for chart function
    let dataIndexRange = 1000; //Number of data points to show on chart
    let chartData = [];

    for (let i = ((data.length >= dataIndexRange) ? data.length - dataIndexRange : 0); i < data.length-1; i+=2) { //Assumes data has entries for both poles in pairs
        let time = new Date(data[i].created_at);
        let hour = time.getHours();
        let minute = time.getMinutes();
        let second = time.getSeconds();
        let pole1Level = data[i].waterlevel;
        let pole2Level = data[i+1].waterlevel;
        chartData.push([[hour, minute, second], pole1Level, pole2Level]);
        
    }
    drawChart(chartData);

    //predictive water level logic using linear regression - When water level reaches 6 inches
    //get last 10 data points for each pole
    let pole1Last10 = [];
    let pole2Last10 = [];
    for(let i = data.length - 20; i <=data.length-1; i+=2){
        pole1Last10.push(data[i]);
        pole2Last10.push(data[i+1]);
    }

    let pole1LR = linearRegression(pole1Last10);
    let pole2LR = linearRegression(pole2Last10);
    
    //predict time to reach critical level (6 inches)
    let pole1ttf = ((CRITLVL_THRESHOLD - pole1LR.b) / pole1LR.m) - pole1LR.t; //time in seconds
    let pole2ttf = ((CRITLVL_THRESHOLD - pole2LR.b) / pole2LR.m) - pole2LR.t; //time in seconds
    
    const MAXTTF = 7200; //Filters out flood times greater than 2 hours - Unlikely to flood
    //update time to full displays 
    if(pole1ttf > 3600 && pole1ttf < MAXTTF){
        document.getElementById("pole1ttf").textContent = ((isFinite(pole1ttf) && pole1LR.m > 0) ? "Time to Flood: " + Math.floor(pole1ttf/3600) + ":" + Math.round((pole1ttf / 3600) % 60) + ":" + Math.round(pole1ttf % 60) + " hours" : "");
    }else if(pole1ttf > 60 && pole1ttf < MAXTTF){
        document.getElementById("pole1ttf").textContent = ((isFinite(pole1ttf) && pole1LR.m > 0) ? "Time to Flood: " + Math.floor(pole1ttf/60) + ":" + Math.round(pole1ttf % 60) + " min" : "");
    }else{
        document.getElementById("pole1ttf").textContent = ((pole1ttf > 0 && isFinite(pole1ttf) && pole1LR.m > 0  && pole1ttf < MAXTTF) ? "Time to Flood: " + Math.round(pole1ttf % 60) + " sec" : "");
    }
    if(pole2ttf > 3600 && pole2ttf < MAXTTF){
        document.getElementById("pole2ttf").textContent = ((isFinite(pole2ttf) && pole2LR.m > 0) ? "Time to Flood: " + Math.floor(pole2ttf/3600) + ":" + Math.round((pole2ttf / 3600) % 60) + ":" + Math.round(pole2ttf % 60) + " hours" : "");
    }else if(pole2ttf > 60 && pole1ttf < MAXTTF){
        document.getElementById("pole2ttf").textContent = ((isFinite(pole2ttf) && pole2LR.m > 0) ? "Time to Flood: " + Math.floor(pole2ttf/60) + ":" + Math.round(pole2ttf % 60) + " min" : "");
    }else{
        document.getElementById("pole2ttf").textContent = ((pole2ttf > 0 && isFinite(pole2ttf) && pole2LR.m > 0 && pole1ttf < MAXTTF) ? "Time to Flood: " + Math.round(pole2ttf % 60) + " sec" : "");
    }
}

//calcualte linear regression slope (m) and intercept (b) for each pole
function linearRegression(levels) {
    const n = levels.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    let dateinit = new Date(levels[0].created_at);
    let t = 0;
    for(let i = 0; i < n; i++){
        let date = new Date(levels[i].created_at);
        t = (date.getTime() - dateinit.getTime()) / 1000
        let lvl = levels[i].waterlevel;
        sumX += t;
        sumY += lvl;
        sumXY += t * lvl;
        sumX2 += t * t;
    }
    let m = (sumXY - (sumX * sumY / n)) / (sumX2 - (sumX * sumX / n));
    let b = (sumY - m * sumX) / n;
    return { m, b, t };
}
//Image Changing Function
function changeImage(newImagePath) {
    // Get the image element using its ID
    const imageElement = document.getElementById("myImage");
    
    // Change the src attribute to the new path
    imageElement.src = newImagePath;
}

function UpdateData(){
    fetch("http://127.0.0.1:3000/api/data");
}
//Run update functions to update data every 1 second
setInterval(updatePoleData, 1000);
setInterval(UpdateData, 10000); 


//Button behavior
const buttons = document.querySelectorAll('.image-buttons button');
document.querySelector('.button1').classList.add('pressed'); //Set default pressed button
buttons.forEach(button => {
  button.addEventListener('click', () => {
    // Remove 'pressed' from all buttons
    buttons.forEach(btn => btn.classList.remove('pressed'));
    // Add 'pressed' to the clicked button
    button.classList.add('pressed');
  });
});


