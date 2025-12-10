
// Load Google Charts
google.charts.load('current', { packages: ['corechart'] });

google.charts.setOnLoadCallback(drawChart);

async function drawChart(chartData) {
    var data = new google.visualization.DataTable();
    data.addColumn('timeofday', 'Time (Hours)');
    data.addColumn('number', 'Pole 1');
    data.addColumn('number', 'Pole 2');
    //data.addColumn('number', 'Threshold 1 (3 in)');
    //data.addColumn('number', 'Threshold 2 (6 in)');

    // Add threshold lines to chart data
    //const threshold1 = 3.0;
    //const threshold2 = 6.0;
    //chartData = chartData.map(row => [...row, threshold1, threshold2]);

    data.addRows(chartData);
    

    var options = {
        title: 'Water Level Over Time',
        hAxis: { 
            title: 'Time (Hours)',
            format: 'h:mm a',
            gridlines: { units: { hours: {format: ['h:mm', "h:mm a"] } } },
            minorGridlines: { units: { minutes: { format: ['h:mm', "h:mm a"] } } },
            //viewWindow: { min: [0, 0, 0], max: [23, 59, 59] }
        },
        vAxis: { 
            title: 'Level (Inches)',
            viewWindow: { min: 0, max: 10},
            ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        },
        legend: { position: 'bottom' },
        lineWidth: 3,
        colors: ['#CC2222', 'blue', '#F7DD5B', '#CC0000'],
        curveType: 'function',
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
        //console.log("Server says:", data.status);
        status = "<span style=\"color:green;\">" + data.status + "</span>";
    } catch {
        //console.log("Server unreachable");
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

    //Entries will have PoleID and water level - sample data has four entries in the data.json file
    //last entry is the most recent
    
    //get latest pole data obects from JSON file
    let lastPole1Data = data[data.length-2]; //Second to last entry is Pole 1
    let lastPole2Data = data[data.length-1]; //Last entry is Pole 2

    //update water levels
    let pole1waterlvl = Math.round((lastPole1Data.waterlevel / 6.0) * 100) / 100;
    let pole2waterlvl = Math.round((lastPole2Data.waterlevel / 6.0) * 100) / 100;
    
    //update wate level displays
    document.getElementById("pole1lvl").textContent = "Water Level: " + pole1waterlvl + " in";
    document.getElementById("pole2lvl").textContent = "Water Level: " + pole2waterlvl + " in";

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

    let dataIndexRange = 100; //Number of data points to show on chart
    let chartData = [];

    for (let i = ((data.length >= dataIndexRange) ? data.length - dataIndexRange : 0); i < data.length-1; i+=2) { //Assumes data has entries for both poles in pairs
        let time = new Date(data[i].created_at);
        let hour = time.getHours();
        let minute = time.getMinutes();
        let second = time.getSeconds();
        let pole1Level = data[i].waterlevel / 6.0;
        let pole2Level = data[i+1].waterlevel / 6.0;
        //console.log("Time: ", [hour, minute, second], " Pole1: ", pole1Level, " Pole2: ", pole2Level);
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

    //calcualte linear regression slope (m) and intercept (b) for each pole
    function linearRegression(levels) {
        const n = levels.length;
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumX2 = 0;
        let dateinit = new Date(levels[0].created_at);
        let m = 0;
        let b = 0;
        for(let i = 0; i < n; i++){
            let date = new Date(levels[i].created_at);
            sumX += (date.getTime() - dateinit.getTime()) / 1000; //Convert to seconds
            sumY += levels[i].waterlevel / 6.0;
            sumXY += ((date.getTime() - dateinit.getTime()) / 1000) * (levels[i].waterlevel / 6.0);
            sumX2 += ((date.getTime() - dateinit.getTime()) / 1000) * ((date.getTime() - dateinit.getTime()) / 1000);
        }
        m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        b = (sumY - m * sumX) / n;
        console.log('sumX:', sumX, ' sumY:', sumY, ' sumXY:', sumXY, ' sumX2:', sumX2, ' n:', n);
        console.log("m:", m, " b:", b);
        return { m, b, dateinit };
    }
    //console.log("Last 10 Pole 1 Data:", pole1Last10);
    let pole1LR = linearRegression(pole1Last10);
    //console.log("Last 10 Pole 2 Data:", pole2Last10);
    let pole2LR = linearRegression(pole2Last10);
    //console.log("Pole 1 LR:", pole1LR);
    //console.log("Pole 2 LR:", pole2LR);
    
    //predict time to reach critical level (6 inches)
    let pole1ttf = (CRITLVL_THRESHOLD - pole1LR.b) / pole1LR.m; //time in seconds
    let pole2ttf = (CRITLVL_THRESHOLD - pole2LR.b) / pole2LR.m; //time in seconds
    //update time to full displays 
    document.getElementById("pole1ttf").textContent = ((pole1ttf > 0 && isFinite(pole1ttf) && pole1LR.m > 0 && pole1ttf < 20000 && pole1waterlvl < 6) ? "Time to Flood: " + Math.floor(pole1ttf/60) + ":" + Math.round(pole1ttf % 60) + " min" : "");
    document.getElementById("pole2ttf").textContent = ((pole2ttf > 0 && isFinite(pole2ttf) && pole2LR.m > 0 && pole2ttf < 20000 && pole2waterlvl < 6) ? "Time to Flood: " + Math.floor(pole2ttf/60) + ":" + Math.round(pole2ttf % 60) + " min" : "");

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
setInterval(UpdateData, 1000); 


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


