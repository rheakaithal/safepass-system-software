
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

