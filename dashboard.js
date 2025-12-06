require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();

// PERSISTENT DATABASE ON RENDER
const db = new sqlite3.Database('/tmp/keys.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        used INTEGER DEFAULT 0,
        used_by TEXT,
        hwid TEXT,
        expiry TEXT,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        used_at DATETIME
    )`);
});

const app = express();
const PORT = process.env.PORT || 4000;
const PASS = process.env.DASHBOARD_PASSWORD || "CertifiedHater";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let loggedin = false;

// LOGIN
app.use((req, res, next) => {
    if (['/login', '/redeem', '/generate', '/api/keys'].includes(req.path)) return next();
    if (loggedin) return next();
    res.send(`
        <style>body{background:#111;color:#0f0;font-family:Arial;text-align:center;padding:100px;}</style>
        <h1>Elite Dashboard Login</h1>
        <form method="POST" action="/login">
            <input type="password" name="pass" placeholder="Password" style="padding:15px;font-size:20px;width:300px;" required autofocus>
            <button type="submit" style="padding:15px 30px;font-size:20px;margin-top:20px;">Login</button>
        </form>
    `);
});

app.post('/login', (req, res) => {
    if (req.body.pass === PASS) {
        loggedin = true;
        res.redirect('/');
    } else {
        res.send("<h1 style='color:red'>Wrong password</h1><a href='/'>Back</a>");
    }
});

// MAIN DASHBOARD — NOW SHOWS EXPIRY CORRECTLY
app.get('/', (req, res) => {
    db.all("SELECT * FROM keys ORDER BY generated_at DESC", (err, keys) => {
        db.get("SELECT COUNT(*) as total, SUM(CASE WHEN used = 1 THEN 1 ELSE 0 END) as used FROM keys", (e, stats) => {
            const unused = (stats?.total || 0) - (stats?.used || 0);
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Elite Keys Dashboard</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body{background:#111;color:#0f0;font-family:Arial;padding:20px;margin:0;}
                        table{width:100%;border-collapse:collapse;margin-top:20px;}
                        th,td{border:1px solid #0f0;padding:12px;text-align:left;}
                        th{background:#003300;}
                        .stats{font-size:22px;margin:20px 0;}
                        code{background:#000;padding:4px 8px;border-radius:4px;}
                    </style>
                </head>
                <body>
                    <h1>Elite Key System — HWID + EXPIRY</h1>
                    <div class="stats">
                        Total: <b>${stats?.total || 0}</b> | Used: <b style="color:red">${stats?.used || 0}</b> | Unused: <b>${unused}</b>
                    </div>
                    <button onclick="location.reload()">Refresh</button>
                    <button onclick="loggedin=false;location.href='/'">Logout</button>
                    <table>
                        <tr><th>Key</th><th>Status</th><th>Used By</th><th>HWID</th><th>Expires</th><th>Generated</th></tr>
                        ${keys.map(k => {
                            const expiryText = k.expiry 
                                ? new Date(k.expiry) < new Date() 
                                    ? '<span style="color:red">EXPIRED</span>' 
                                    : new Date(k.expiry).toLocaleString()
                                : 'Never';
                            return `
                                <tr style="${k.used ? 'opacity:0.5' : ''}">
                                    <td><code>${k.key}</code></td>
                                    <td>${k.used ? 'Used' : '<b>Valid</b>'}</td>
                                    <td>${k.used_by || '-'}</td>
                                    <td><code>${k.hwid || '-'}</code></td>
                                    <td>${expiryText}</td>
                                    <td>${new Date(k.generated_at).toLocaleString()}</td>
                                </tr>
                            `;
                        }).join('')}
                    </table>
                </body>
                </html>
            `);
        });
    });
});

// REDEEM
app.post('/redeem', (req, res) => {
    const { key, user, hwid } = req.body || {};
    if (!key || !hwid) return res.json({ success: false, message: "Missing data" });

    db.get("SELECT * FROM keys WHERE key = ? AND used = 0", [key], (err, row) => {
        if (!row) return res.json({ success: false, message: "Invalid or used key" });
        if (row.expiry && new Date(row.expiry) < new Date()) return res.json({ success: false, message: "Key expired" });
        if (row.hwid && row.hwid !== hwid) return res.json({ success: false, message: "Key bound to another device!" });

        db.run("UPDATE keys SET used = 1, used_by = ?, hwid = ?, used_at = CURRENT_TIMESTAMP WHERE key = ?", 
            [user || "Roblox", hwid, key]);

        res.json({ success: true, message: "Access granted" });
    });
});

// GENERATE — NOW PROPERLY SAVES EXPIRY
app.post('/generate', (req, res) => {
    const { keys, password, expiry } = req.body;
    if (password !== PASS) return res.status(403).send("Wrong password");
    if (!Array.isArray(keys)) return res.status(400).send("Invalid keys");

    const stmt = db.prepare("INSERT OR IGNORE INTO keys (key, expiry) VALUES (?, ?)");
    let added = 0;
    keys.forEach(k => {
        stmt.run(k, expiry || null, () => added++);
    });
    stmt.finalize();

    res.send(`Added ${added} keys${expiry ? ' with expiry' : ''}`);
});

// /keys API
app.get('/api/keys', (req, res) => {
    if (req.headers['x-password'] !== PASS) return res.status(403).send("No");
    db.get("SELECT COUNT(*) as total FROM keys WHERE used = 0", (err, count) => {
        db.all("SELECT key FROM keys WHERE used = 0 ORDER BY generated_at DESC LIMIT 15", (err, rows) => {
            res.json({ total: count.total, keys: rows });
        });
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Elite Dashboard LIVE → https://elite-hub.onrender.com`);
});
