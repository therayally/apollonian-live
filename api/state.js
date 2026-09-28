// /api/state — server-side state sync for Apollonian Gasket
const fs = require('fs');
const path = require('path');
const STATE_FILE = path.join('/tmp', 'apollonian-state.json');

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function writeState(s) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(s)); return true; } catch { return false; }
}

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ state: readState() });
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad request' });
    const ok = writeState({ ...body, updatedAt: new Date().toISOString() });
    if (!ok) return res.status(500).json({ error: 'persist failed' });
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'method not allowed' });
};
