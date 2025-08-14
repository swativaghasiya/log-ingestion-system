# Log Ingestion and Querying System

A self-contained full‑stack project implementing a file‑backed Log Ingestion API (Node.js + Express) and a React UI for searching and filtering logs. **Data is persisted to a single JSON file** as required.

## Tech
- **Backend:** Node.js, Express, CORS, file persistence via `fs` to `db.json`
- **Frontend:** React (Vite), functional components + hooks, dynamic filtering with debounced inputs
- **Storage:** Single JSON file (`backend/db.json`)

## Project Structure
```
log-ingestion-system/
  backend/
    server.js
    package.json
    db.json
  frontend/
    index.html
    vite.config.js
    package.json
    src/
      main.jsx
      App.jsx
      styles.css
```

## Run Locally

### 1) Backend (port 4000)
```
cd backend
npm i
npm run start
```
- Health check: http://localhost:4000/
- Endpoints:
  - `POST /logs` – ingest one log object (schema below)
  - `GET  /logs` – list logs with filters (AND logic), reverse‑chronological

### 2) Frontend (port 5173, proxied to backend)
```
cd ../frontend
npm i
npm run dev
```
- UI: http://localhost:5173

> Vite dev server proxies `/logs` requests to `http://localhost:4000`, so no extra config is needed during development.

## API Contract

### Log Schema (required fields)
```json
{
  "level": "error | warn | info | debug",
  "message": "string",
  "resourceId": "string",
  "timestamp": "ISO 8601 string",
  "traceId": "string",
  "spanId": "string",
  "commit": "string",
  "metadata": { "any": "object" }
}
```

### POST /logs
- **Body:** a single object matching the schema above
- **201 Created** on success; the created object is returned
- **400** if validation fails (missing field, bad level/timestamp, non‑object metadata)

### GET /logs (all query params are optional; **AND** logic)
- `level` (exact)
- `message` (case‑insensitive substring match on `message`)
- `resourceId` (case‑insensitive substring match)
- `timestamp_start`, `timestamp_end` (ISO strings, inclusive range)
- `traceId`, `spanId`, `commit` (exact)
- **Response:** array sorted reverse‑chronological by `timestamp`

#### Example
```
GET /logs?level=error&message=db&resourceId=server-1&timestamp_start=2023-09-15T00:00:00Z
```

## Seeding / Quick Test
Use curl to ingest a few logs:
```bash
curl -X POST http://localhost:4000/logs -H "Content-Type: application/json" -d '{
  "level": "error",
  "message": "Failed to connect to database.",
  "resourceId": "server-1234",
  "timestamp": "2023-09-15T08:00:00Z",
  "traceId": "abc-xyz-123",
  "spanId": "span-456",
  "commit": "5e5342f",
  "metadata": {"parentResourceId": "server-5678"}
}'
```
Then open the UI and filter.

## Notes & Trade‑offs
- **Persistence:** File writes are done via atomic rename (`.tmp` then `rename`) to reduce chances of partial writes.
- **Validation:** Strict server‑side validation for level/timestamp/metadata and required fields.
- **Filtering:** Implemented in Node.js memory, then sorted by timestamp desc. This matches the requirement to avoid external DBs and exercise JS data manipulation.
- **Debounce:** Message and resourceId inputs are debounced to limit request bursts during typing.

## Future Enhancements (bonus ideas)
- Real‑time updates with WebSockets when new logs are ingested
- Tiny analytics card (counts by level for current filters)
- Dockerfile and docker‑compose for one‑shot spin‑up
- Unit tests around the filter function
```