/**
 * Log Ingestion and Querying System - Backend (Node.js + Express)
 * Storage: Single JSON file (db.json)
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const REQUIRED_FIELDS = [
  'level', 'message', 'resourceId', 'timestamp', 'traceId', 'spanId', 'commit', 'metadata'
];
const ALLOWED_LEVELS = ['error', 'warn', 'info', 'debug'];

/** Ensure DB file exists */
async function ensureDb() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify({ logs: [] }, null, 2), 'utf-8');
  }
}

/** Load logs from file */
async function loadLogs() {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, 'utf-8');
  try {
    const data = JSON.parse(raw || '{}');
    return Array.isArray(data.logs) ? data.logs : [];
  } catch (e) {
    // If file is corrupted, reset safely (avoid crash)
    await fs.writeFile(DB_PATH, JSON.stringify({ logs: [] }, null, 2), 'utf-8');
    return [];
  }
}

/** Save logs to file (simple atomic write) */
async function saveLogs(logs) {
  const tmp = DB_PATH + '.tmp';
  await fs.writeFile(tmp, JSON.stringify({ logs }, null, 2), 'utf-8');
  await fs.rename(tmp, DB_PATH);
}

/** Validate incoming log object */
function validateLog(body) {
  // Check required fields
  for (const key of REQUIRED_FIELDS) {
    if (!(key in body)) {
      return `Missing required field: ${key}`;
    }
  }
  // Validate level
  if (!ALLOWED_LEVELS.includes(String(body.level))) {
    return `Invalid level. Expected one of: ${ALLOWED_LEVELS.join(', ')}`;
  }
  // Validate timestamp
  const d = new Date(body.timestamp);
  if (isNaN(d.getTime())) {
    return 'Invalid timestamp. Must be ISO 8601 string.';
  }
  // Validate metadata object
  if (typeof body.metadata !== 'object' || body.metadata === null || Array.isArray(body.metadata)) {
    return 'Invalid metadata. Must be a JSON object.';
  }
  return null; // OK
}

/** POST /logs - ingest one log */
app.post('/logs', async (req, res) => {
  try {
    const error = validateLog(req.body || {});
    if (error) {
      return res.status(400).json({ error });
    }

    const logs = await loadLogs();
    logs.push(req.body);
    await saveLogs(logs);

    return res.status(201).json(req.body);
  } catch (e) {
    console.error('POST /logs error:', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /logs - list logs with filters (AND logic)
 * Query params (all optional):
 *   level, message (contains, ci), resourceId (contains, ci),
 *   timestamp_start (ISO), timestamp_end (ISO),
 *   traceId (exact), spanId (exact), commit (exact)
 * Returns reverse-chronological by timestamp
 */
app.get('/logs', async (req, res) => {
  try {
    const {
      level,
      message,
      resourceId,
      timestamp_start,
      timestamp_end,
      traceId,
      spanId,
      commit
    } = req.query;

    let logs = await loadLogs();

    // Filtering (AND)
    if (level) {
      logs = logs.filter(l => String(l.level) === String(level));
    }
    if (message) {
      const q = String(message).toLowerCase();
      logs = logs.filter(l => String(l.message || '').toLowerCase().includes(q));
    }
    if (resourceId) {
      const q = String(resourceId).toLowerCase();
      logs = logs.filter(l => String(l.resourceId || '').toLowerCase().includes(q));
    }
    if (timestamp_start) {
      const start = new Date(timestamp_start);
      if (!isNaN(start.getTime())) {
        logs = logs.filter(l => new Date(l.timestamp) >= start);
      }
    }
    if (timestamp_end) {
      const end = new Date(timestamp_end);
      if (!isNaN(end.getTime())) {
        logs = logs.filter(l => new Date(l.timestamp) <= end);
      }
    }
    if (traceId) {
      logs = logs.filter(l => String(l.traceId) === String(traceId));
    }
    if (spanId) {
      logs = logs.filter(l => String(l.spanId) === String(spanId));
    }
    if (commit) {
      logs = logs.filter(l => String(l.commit) === String(commit));
    }

    // Sort reverse-chronological
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.json(logs);
  } catch (e) {
    console.error('GET /logs error:', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** Health check */
app.get('/', (_req, res) => res.send('Log Ingestion API is running'));

ensureDb().then(() => {
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
});