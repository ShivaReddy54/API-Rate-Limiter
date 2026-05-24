import { useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const styledStatus = (status) => {
  if (status === 200) return 'success';
  if (status === 429 || status === 503) return 'warning';
  return 'error';
};

const buildLabel = (result) => {
  if (!result) return 'No history yet';
  if (result.ok) return 'OK';
  if (result.status === 429) return 'Rate Limit';
  if (result.status === 503) return 'Concurrency';
  return 'Error';
};

function App() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useState([]);
  const [bursting, setBursting] = useState(false);

  const latest = history[0] || null;
  const summary = useMemo(() => {
    const counts = { success: 0, rateLimited: 0, busy: 0, error: 0 };
    history.forEach((item) => {
      if (item.status === 200) counts.success += 1;
      else if (item.status === 429) counts.rateLimited += 1;
      else if (item.status === 503) counts.busy += 1;
      else counts.error += 1;
    });
    return counts;
  }, [history]);

  const requestEndpoint = async (path) => {
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch(`${API_BASE}${path}`);
      const data = await res.json();
      const result = {
        status: res.status,
        ok: res.ok,
        body: data,
        path,
        time: new Date().toLocaleTimeString(),
      };
      setResponse(result);
      setHistory((prev) => [result, ...prev].slice(0, 12));
    } catch (err) {
      const result = {
        status: 0,
        ok: false,
        body: { message: err.message },
        path,
        time: new Date().toLocaleTimeString(),
      };
      setResponse(result);
      setHistory((prev) => [result, ...prev].slice(0, 12));
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = () => requestEndpoint('/');
  const handleHealth = () => requestEndpoint('/health');

  const handleBurst = async () => {
    setBursting(true);
    setHistory([]);
    const tasks = Array.from({ length: 10 }, (_, index) =>
      fetch(`${API_BASE}/`).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        return {
          status: res.status,
          ok: res.ok,
          body,
          path: '/',
          time: new Date().toLocaleTimeString(),
          index: index + 1,
        };
      }).catch((err) => ({
        status: 0,
        ok: false,
        body: { message: err.message },
        path: '/',
        time: new Date().toLocaleTimeString(),
        index: index + 1,
      }))
    );

    const results = await Promise.all(tasks);
    setHistory(results.reverse());
    setBursting(false);
  };

  return (
    <div className="page-shell">
      <div className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">API Rate Limiter</span>
          <h1>Premium request control dashboard</h1>
          <p>Monitor the rate limiter, test concurrency behavior, and see service responses. </p>
        </div>
        <div className="hero-actions">
          <button className="button solid" onClick={handleFetch} disabled={loading || bursting}>
            {loading ? 'Waiting...' : 'Send API Request'}
          </button>
          <button className="button outline" onClick={handleHealth} disabled={loading || bursting}>
            Health Check
          </button>
          <button className="button accent" onClick={handleBurst} disabled={bursting || loading}>
            {bursting ? 'Burst Running...' : 'Run Burst Load'}
          </button>
        </div>
      </div>

      <div className="status-grid">
        <section className="card glass card-large">
          <div className="card-header">
            <div>
              <p className="card-label">Latest call</p>
              <h2>{latest ? `${latest.path} @ ${latest.time}` : 'No requests yet'}</h2>
            </div>
            {latest && <span className={`pill ${styledStatus(latest.status)}`}>{buildLabel(latest)}</span>}
          </div>
          {latest ? (
            <div className="card-body">
              <pre>{JSON.stringify(latest.body, null, 2)}</pre>
              <div className="meta-row">
                <span>Status {latest.status}</span>
                <span>{latest.ok ? 'Successful' : 'Failed'}</span>
              </div>
            </div>
          ) : (
            <div className="card-body empty">Use the buttons above to exercise the backend.</div>
          )}
        </section>

        <section className="card stats-card">
          <div className="stat-item">
            <span className="stat-label">Total success</span>
            <span className="stat-value">{summary.success}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Rate-limited</span>
            <span className="stat-value warning">{summary.rateLimited}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Concurrent rejects</span>
            <span className="stat-value danger">{summary.busy}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Request errors</span>
            <span className="stat-value danger">{summary.error}</span>
          </div>
        </section>
      </div>

      <section className="history-card card glass">
        <div className="section-title">
          <h3>Recent request history</h3>
          <span>{history.length} entries</span>
        </div>
        <div className="history-list">
          {history.length === 0 ? (
            <div className="empty-state">No history yet. Send a request to see detailed activity.</div>
          ) : (
            history.map((entry, index) => (
              <article key={`${entry.time}-${index}`} className="history-item">
                <div>
                  <strong>{entry.path}</strong>
                  <small>{entry.time}</small>
                </div>
                <div className="history-meta">
                  <span className={`pill ${styledStatus(entry.status)}`}>{entry.status}</span>
                  <span>{entry.body?.message || entry.body?.message || ''}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
