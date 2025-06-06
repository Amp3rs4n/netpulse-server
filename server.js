import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const db = new sqlite3.Database("results.db");
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: "https://amp3rs4n.github.io", credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'netpulse_secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// SQLite init
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    ip TEXT,
    download REAL,
    upload REAL,
    ping REAL,
    jitter REAL,
    user_email TEXT
  )`);
});

// Auth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('https://amp3rs4n.github.io/netpulse');
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('https://amp3rs4n.github.io/netpulse');
  });
});

// Save result
app.post("/api/results", (req, res) => {
  const { timestamp, ip, download, upload, ping, jitter } = req.body;
  const user_email = req.user?.emails?.[0]?.value || null;

  db.run(
    `INSERT INTO test_results (timestamp, ip, download, upload, ping, jitter, user_email)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [timestamp, ip, download, upload, ping, jitter, user_email],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id: this.lastID });
    }
  );
});

// Get results (only for authenticated user)
app.get("/api/results", (req, res) => {
  const user_email = req.user?.emails?.[0]?.value || null;
  if (!user_email) return res.status(401).json({ error: "Unauthorized" });

  db.all(
    "SELECT * FROM test_results WHERE user_email = ? ORDER BY id DESC LIMIT 100",
    [user_email],
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
