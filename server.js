import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';
import connectSqlite3 from 'connect-sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const SQLiteStore = connectSqlite3(session);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const db = new sqlite3.Database("results.db");
const port = process.env.PORT || 3000;

app.post("/api/results", (req, res) => {
  const { timestamp, ip, download, upload, ping, jitter, email } = req.body;
  const user_email = email || req.user?.emails?.[0]?.value || null;

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

// Middleware
app.use(cors({
  origin: "https://amp3rs4n.github.io",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-user-email']
}));

app.use(express.json());
app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite' }),
  secret: process.env.SESSION_SECRET || 'netpulse_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'none'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport config
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://netpulse-server.onrender.com/auth/google/callback"
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
    const { displayName, emails, photos } = req.user;
    const email = emails?.[0]?.value || '';
    const picture = photos?.[0]?.value || '';

    const redirectUrl = `https://amp3rs4n.github.io/netpulse?name=${encodeURIComponent(displayName)}&email=${encodeURIComponent(email)}&photo=${encodeURIComponent(picture)}`;
    res.redirect(redirectUrl);
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('https://amp3rs4n.github.io/netpulse');
  });
});

// 🔐 Get current user info
app.get("/auth/user", (req, res) => {
  if (req.isAuthenticated() && req.user) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ user: null });
  }
});

// Save result
app.post("/api/results", (req, res) => {
  const { timestamp, ip, download, upload, ping, jitter, email } = req.body;
  const user_email = email || null;

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

// Get results (by email)
app.get("/api/results", (req, res) => {
  const email = req.query.email || req.headers["x-user-email"];
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  db.all(
    "SELECT * FROM test_results WHERE user_email = ? ORDER BY id DESC LIMIT 100",
    [email],
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
