import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ListVideo, X, RotateCw, Trash2, HardDrive, Loader2 } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../utils/api';
import { useStatus } from '../context/StatusContext';
import './Queue.css';

const FILTERS = [
  { key: 'active', label: 'Active' },
  { key: '', label: 'All' },
  { key: 'done', label: 'Done' },
  { key: 'failed', label: 'Failed' },
];

function timeAgo(ts) {
  if (!ts) return '';
  const secs = Math.max(0, Date.now() / 1000 - ts);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function Queue() {
  const { stats, refresh: refreshStatus } = useStatus();
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet('/api/jobs');
      setJobs(data.jobs || []);
    } catch {
      /* the shell already shows backend reachability */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll while work is in flight.
  useEffect(() => {
    const active = jobs.some((j) => ['queued', 'downloading'].includes(j.status));
    const t = setInterval(load, active ? 2500 : 15000);
    return () => clearInterval(t);
  }, [jobs, load]);

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await load();
      refreshStatus();
    } finally {
      setBusy(false);
    }
  };

  const visible = jobs.filter((j) => {
    if (filter === 'active') return ['queued', 'downloading'].includes(j.status);
    if (!filter) return true;
    return j.status === filter;
  });

  const finishedCount = jobs.filter((j) =>
    ['done', 'failed', 'cancelled'].includes(j.status)
  ).length;

  const disk = stats?.disk;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-title-box">
          <ListVideo size={26} className="header-icon" />
          <div>
            <h2>Queue</h2>
            <p className="subtitle">
              {loading ? 'Loading…' : `${visible.length} job${visible.length === 1 ? '' : 's'}`}
              {disk && ` · ${disk.freeGb} GB free`}
            </p>
          </div>
        </div>
        <div className="header-controls">
          {finishedCount > 0 && (
            <button
              className="btn small"
              disabled={busy}
              onClick={() => act(() => apiPost('/api/jobs/clear'))}
            >
              <Trash2 size={14} /> Clear finished
            </button>
          )}
        </div>
      </div>

      <div className="queue-filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><Loader2 size={30} className="spin" /></div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <HardDrive size={40} />
          <p>
            {filter === 'active'
              ? 'Nothing downloading. Pick a drama from Browse to queue episodes.'
              : 'No jobs here.'}
          </p>
          <Link to="/" className="btn">Browse dramas</Link>
        </div>
      ) : (
        <div className="job-list">
          {visible.map((j) => (
            <div key={j.id} className="job-row glass-panel">
              <div className="job-main">
                <div className="job-head">
                  <Link to={`/series/${j.seriesId}`} className="job-title">
                    {j.seriesTitle}
                  </Link>
                  <span className="job-ep">Episode {j.epNumber}</span>
                  <span className={`pill ${j.status}`}>{j.status}</span>
                  {j.source === 'monitor' && <span className="job-src">auto</span>}
                </div>

                {j.status === 'downloading' && (
                  <>
                    <div className="job-progress">
                      <div className="job-progress-fill" style={{ width: `${j.progress}%` }} />
                    </div>
                    <div className="job-sub">
                      {j.progress.toFixed(1)}%
                      {j.speed && ` · ${j.speed}`}
                      {j.eta && ` · ${j.eta} left`}
                    </div>
                  </>
                )}

                {j.status === 'queued' && <div className="job-sub">Waiting…</div>}

                {j.status === 'done' && (
                  <div className="job-sub done" title={j.filePath}>
                    {j.filePath?.split('/').pop()} · {timeAgo(j.finishedAt)}
                  </div>
                )}

                {j.status === 'failed' && (
                  <div className="job-sub failed">{j.error?.split('\n')[0]}</div>
                )}
              </div>

              <div className="job-actions">
                {['queued', 'downloading'].includes(j.status) && (
                  <button
                    className="btn small danger"
                    disabled={busy}
                    onClick={() => act(() => apiDelete(`/api/jobs/${j.id}`))}
                    title="Cancel"
                  >
                    <X size={14} />
                  </button>
                )}
                {['failed', 'cancelled'].includes(j.status) && (
                  <button
                    className="btn small"
                    disabled={busy}
                    onClick={() => act(() => apiPost(`/api/jobs/${j.id}/retry`))}
                    title="Retry"
                  >
                    <RotateCw size={14} /> Retry
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
