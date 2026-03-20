const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

let PORT = 3000; // Default MySQL port

// Create MySQL connection
const db = mysql.createConnection({
    host: '10.247.160.206',
    user: 'parker',
    password: 'Team13Capstone',
    database: 'my_database',
    port: 3306
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL!');
});
// Initial data fetch and write to data.json
db.query("SELECT * FROM users", (err, results) => {
    if (err) {
        console.error("Query error:", err);
        return;
    }
    fs.writeFileSync('data.json', JSON.stringify(results, null, 2));
    //console.log(results);  // results is an array of rows
});

app.get('/api/data', (req, res) => {
    db.query("SELECT * FROM users", (err, results) => {
        if (err) {
            console.error("Query error:", err); 
            res.status(500).send("Error retrieving users");
            return;
        }
        res.json(results);
        fs.writeFileSync('data.json', JSON.stringify(results, null, 2));
    });
});

//ping API to check if database is online
app.get("/api/db-ping", async (req, res) => {
  db.ping(err => {
    if (err) return res.json({ status: "DB offline" });
    res.json({ status: "DB online" });
  });
});

app.listen(PORT, () => console.log('Server running on port ' + PORT)); //change port
