import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const db = new sqlite3.Database("results.db");
const port = process.env.PORT || 3000;

app.use(cors({ origin: "https://amp3rs4n.github.io" }));
app.use(express.json());

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    ip TEXT,
    download REAL,
    upload REAL,
    ping REAL,
    jitter REAL
  )`);
});

app.post("/api/results", (req, res) => {
  const { timestamp, ip, download, upload, ping, jitter } = req.body;

  db.run(
    `INSERT INTO test_results (timestamp, ip, download, upload, ping, jitter)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [timestamp, ip, download, upload, ping, jitter],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id: this.lastID });
    }
  );
});

app.get("/api/results", (req, res) => {
  db.all(
    "SELECT * FROM test_results ORDER BY id DESC LIMIT 100",
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get("/", (_, res) => res.send("NetPulse API is running ✅"));

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
