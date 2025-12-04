// dashboard.js — FINAL HWID-LOCKED VERSION (2025)
require('dotenv').config();
const express = require('express');
const db = require('./db.js');
const app = express();
const PORT = process.env.DASHBOARD_PORT || 4000;
const PASS = process.env.DASHBOARD_PASSWORD || "CertifiedHater";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let loggedin = false;

// === LOGIN PAGE ===
app.use((req, res, next) => {
    if (req.path === '/login' || req.path === '/redeem') return next();
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
        res.send("<h1 style='color:red'>Wrong password</h1><br><a href='/'>Back</a>");
    }
});

// === MAIN DASHBOARD (now shows HWID) ===
app.get('/', (req, res) => {
    db.all("SELECT * FROM keys ORDER BY generated_at DESC LIMIT 200", (err, keys) => {
        db.get("SELECT COUNT(*) as total, SUM(CASE WHEN used = 1 THEN 1 ELSE 0 END) as used FROM keys", (e, stats) => {
            const unused = (stats?.total || 0) - (stats?.used || 0);
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Elite Keys Dashboard</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body{font-family:Arial;background:#111;color:#0f0;margin:0;padding:20px;}
                        table{width:100%;border-collapse:collapse;margin-top:20px;}
                        th,td{border:1px solid #0f0;padding:10px;text-align:left;}
                        th{background:#003300;}
                        .stats{font-size:20px;margin:20px 0;}
                        .green{color:#0f0;} .red{color:#f00;}
                        code{background:#000;padding:2px 6px;border-radius:4px;}
                    </style>
                </head>
                <body>
                    <h1>Elite Key System — HWID LOCKED</h1>
                    <div class="stats">
                        Total: <b>${stats?.total || 0}</b> |
                        Used: <b class="red">${stats?.used || 0}</b> |
                        Unused: <b class="green">${unused}</b>
                    </div>
                    <button onclick="location.reload()">Refresh</button> |
                    <button onclick="loggedin=false;location.href='/'" style="background:#500;color:#fff;">Logout</button>
                    <table>
                        <tr><th>Key</th><th>Status</th><th>Used By</th><th>HWID</th><th>Expires</th><th>Generated</th></tr>
                        ${keys.map(k => `
                            <tr style="${k.used ? 'opacity:0.5' : ''}">
                                <td><code>${k.key}</code></td>
                                <td>${k.used ? 'Used' : 'Valid'}</td>
                                <td>${k.used_by || '-'}</td>
                                <td><code>${k.hwid || '-'}</code></td>
                                <td>${k.expiry ? new Date(k.expiry).toLocaleString() : 'Never'}</td>
                                <td>${new Date(k.generated_at).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </table>
                </body>
                </html>
            `);
        });
    });
});

// === REDEEM API — NOW WITH FULL HWID LOCK ===
app.post('/redeem', (req, res) => {
    const { key, user, hwid } = req.body || {};
    if (!key || !hwid) {
        return res.json({ success: false, message: "Missing key or HWID" });
    }

    db.get("SELECT * FROM keys WHERE key = ? AND used = 0", [key], (err, row) => {
        if (!row) {
            return res.json({ success: false, message: "Invalid or already used key" });
        }
        if (row.expiry && new Date(row.expiry) < new Date()) {
            return res.json({ success: false, message: "Key expired" });
        }

        // If key already has HWID and it's different → deny
        if (row.hwid && row.hwid !== hwid) {
            return res.json({ success: false, message: "Key already bound to another device!" });
        }

        // Lock key to this HWID
        db.run("UPDATE keys SET used = 1, used_by = ?, hwid = ?, used_at = CURRENT_TIMESTAMP WHERE key = ?", 
            [user || "RobloxUser", hwid, key]);

        res.json({ success: true, message: "Access granted & HWID locked" });
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Dashboard running → http://0.0.0.0:${PORT}`);
    console.log(`Login password: ${PASS}`);
    console.log(`HWID lock: ACTIVE`);
});
