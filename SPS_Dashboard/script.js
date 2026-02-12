
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
updatePoleData()
setInterval(updatePoleData(), 1000);

