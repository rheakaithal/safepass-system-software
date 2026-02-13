
// Load Google Charts
google.charts.load('current', { packages: ['corechart'] });
let init = true;

async function drawChart(chartData) {
    var data = new google.visualization.DataTable();
    data.addColumn('timeofday', 'Time (Hours)');
    data.addColumn('number', 'Pole 1');
    data.addColumn('number', 'Pole 2');

    data.addRows(chartData);
    
    var options = {
        backgroundColor: 'transparent',

        title: 'Water Level Over Time',
        titleTextStyle: {
            color: '#000000',
            fontSize: 16,
            bold: true
        },

        chartArea: {
            left: 60,
            top: 50,
            width: '85%',
            height: '65%'
        },

        hAxis: {
            title: 'Time',
            format: 'h:mm a',
            textStyle: { color: '#cccccc' },
            titleTextStyle: { color: '#000000' },
            gridlines: { color: '#222222' },
            minorGridlines: { color: '#222222' }
        },

        vAxis: {
            title: 'Water Level (Inches)',
            viewWindow: { min: 0, max: 10 },
            textStyle: { color: '#222222' },
            titleTextStyle: { color: '#000000' },
            gridlines: { color: '#222222' },
            minorGridlines: { color: '#666666' }
        },

        legend: {
            position: 'top',
            alignment: 'end',
            textStyle: { color: '#000000' }
        },

        lineWidth: 3,
        pointSize: 0,

        colors: ['#CC2222', '#2196F3'],  // Red for Pole 1, Blue for Pole 2
        curveType: 'function',

        animation: init ? {
            startup: true,
            duration: 800,
            easing: 'out'
        } : {
            duration: 150,
            easing: 'out'
        },
        interpolateNulls: true
    };


    var chart = new google.visualization.LineChart(document.getElementById('linechart'));
    chart.draw(data, options);

    window.addEventListener('resize', function() {
        chart.draw(data, options);
    });
    init = false;
}

async function updatePoleData(){
    const pole1Data = await (await fetch('pole1Data.json')).json();  
    const pole2Data = await (await fetch('pole2Data.json')).json();
    
    //Inches of water level thresholds
    const WARNING_THRESHOLD = 3.0; //State 1
    const CRITLVL_THRESHOLD = 6.0; //State 2
    
    //get latest pole data obects from JSON file
    let lastPole1Data = pole1Data[pole1Data.length-1];
    let lastPole2Data = pole2Data[pole2Data.length-1];

    //update water levels
    let pole1waterlvl = Math.round((lastPole1Data.waterlevel) * 100) / 100;
    let pole2waterlvl = Math.round((lastPole2Data.waterlevel) * 100) / 100;
    
    //update wate level displays
    document.getElementById("pole1-lvl").textContent = pole1waterlvl + " Inches";
    document.getElementById("pole2-lvl").textContent = pole2waterlvl + " Inches";

    //Updates Pole Status
    if (pole1waterlvl >= CRITLVL_THRESHOLD){
        document.getElementById("pole1-image").src = "images/WarningState2.jpg";
    }else if (pole1waterlvl >= WARNING_THRESHOLD){
        document.getElementById("pole1-image").src = "images/WarningState1.jpg";
    }else{
        document.getElementById("pole1-image").src = "images/WarningState0.jpg";
    }
    if (pole2waterlvl >= CRITLVL_THRESHOLD){
        document.getElementById("pole2-image").src = "images/WarningState2.jpg";
    }else if (pole2waterlvl >= WARNING_THRESHOLD){
        document.getElementById("pole2-image").src = "images/WarningState1.jpg";
    }else{
        document.getElementById("pole2-image").src = "images/WarningState0.jpg";
    }

    //Creates array of data for chart function
    let dataIndexRange = 1000; //Number of data points to show on chart
    let chartData = [];

    let minLength = Math.min(pole1Data.length, pole2Data.length);
    let startIndex = (minLength >= dataIndexRange) ? minLength - dataIndexRange : 0;

    for (let i = startIndex; i < minLength; i++) {

        let time = new Date(pole1Data[i].createdat);
        let hour = time.getHours();
        let minute = time.getMinutes();
        let second = time.getSeconds();

        let pole1Level = pole1Data[i].waterlevel;
        let pole2Level = pole2Data[i].waterlevel;

        chartData.push([[hour, minute, second], pole1Level, pole2Level]);
}

    drawChart(chartData);
}

//Image Changing Function
function changeImage(newImagePath) {
    // Get the image element using its ID
    const imageElement = document.getElementById("image");
    
    // Change the src attribute to the new path
    imageElement.src = newImagePath;
}

//Button behavior
const image_buttons = document.querySelectorAll('.image-button');
document.querySelector('.button1').classList.add('pressed'); //Set default pressed button
image_buttons.forEach(button => {
  button.addEventListener('click', () => {
    // Remove 'pressed' from all buttons
    image_buttons.forEach(btn => btn.classList.remove('pressed'));
    // Add 'pressed' to the clicked button
    button.classList.add('pressed');
  });
});



updatePoleData();
setInterval(updatePoleData, 1000);

