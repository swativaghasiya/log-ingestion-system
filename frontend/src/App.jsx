import { useEffect, useMemo, useRef, useState } from 'react'

const LEVELS = ['', 'error', 'warn', 'info', 'debug']

function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

export default function App() {
  const [level, setLevel] = useState('')
  const [message, setMessage] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [traceId, setTraceId] = useState('')
  const [spanId, setSpanId] = useState('')
  const [commit, setCommit] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const debouncedMessage = useDebounced(message)
  const debouncedResourceId = useDebounced(resourceId)

  const qs = useMemo(() => {
    const params = new URLSearchParams()
    if (level) params.set('level', level)
    if (debouncedMessage) params.set('message', debouncedMessage)
    if (debouncedResourceId) params.set('resourceId', debouncedResourceId)
    if (traceId) params.set('traceId', traceId)
    if (spanId) params.set('spanId', spanId)
    if (commit) params.set('commit', commit)
    if (start) params.set('timestamp_start', new Date(start).toISOString())
    if (end) params.set('timestamp_end', new Date(end).toISOString())
    return params.toString()
  }, [level, debouncedMessage, debouncedResourceId, traceId, spanId, commit, start, end])

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true); setError('')
      try {
        const res = await fetch(`/logs${qs ? `?${qs}` : ''}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setLogs(Array.isArray(data) ? data : [])
      } catch (e) {
        setError('Failed to load logs. Is the backend running on :4000?')
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [qs])

  function clearFilters() {
    setLevel(''); setMessage(''); setResourceId('')
    setTraceId(''); setSpanId(''); setCommit('')
    setStart(''); setEnd('')
  }

  return (
    <div className="container">
      <div className="card">
        <h1>Log Query Interface</h1>
        <div className="filters">
          <input className="input" placeholder="Search message (full-text)"
                 value={message} onChange={e => setMessage(e.target.value)} />
          <select className="select" value={level} onChange={e => setLevel(e.target.value)}>
            {LEVELS.map(l => <option key={l} value={l}>{l || 'Any level'}</option>)}
          </select>
          <input className="input" placeholder="Filter by resourceId"
                 value={resourceId} onChange={e => setResourceId(e.target.value)} />
          <input className="input" type="datetime-local" value={start}
                 onChange={e => setStart(e.target.value)} />
          <input className="input" type="datetime-local" value={end}
                 onChange={e => setEnd(e.target.value)} />
          <button className="button secondary" onClick={clearFilters}>Clear</button>
        </div>

        <div className="row">
          <small>traceId</small>
          <input className="input" placeholder="trace-123" value={traceId} onChange={e => setTraceId(e.target.value)} />
          <small>spanId</small>
          <input className="input" placeholder="span-456" value={spanId} onChange={e => setSpanId(e.target.value)} />
        </div>
        <div className="row">
          <small>commit</small>
          <input className="input" placeholder="e.g. 5e5342f" value={commit} onChange={e => setCommit(e.target.value)} />
          <div></div><div></div>
        </div>

        <div className="toolbar">
          <span className="badge">AND filters</span>
          <span className="badge">Reverse-chronological</span>
        </div>

        {loading && <div className="loading">Loading logs…</div>}
        {error && <div className="loading">{error}</div>}

        <div className="logs">
          {!loading && logs.length === 0 && <div className="empty">No logs match your filters.</div>}
          {logs.map((l, idx) => (
            <div className={`log ${l.level}`} key={idx}>
              <div>
                <div className="meta">{new Date(l.timestamp).toLocaleString()}</div>
                <div className="badge">{l.level}</div>
              </div>
              <div>
                <div>{l.message}</div>
                <div className="meta">resourceId: {l.resourceId}</div>
              </div>
              <div className="meta">
                traceId: {l.traceId}<br/>
                spanId: {l.spanId}<br/>
                commit: {l.commit}
              </div>
              <div className="meta">
                metadata: <code>{JSON.stringify(l.metadata)}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}