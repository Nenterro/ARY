import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Radar, Trash2, PlayCircle, Loader2, Clock, CalendarClock } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../utils/api';
import { useStatus } from '../context/StatusContext';
import './Monitors.css';

function lastChecked(ts) {
  if (!ts) return 'not checked yet';
  const mins = Math.floor((Date.now() / 1000 - ts) / 60);
  if (mins < 1) return 'checked just now';
  if (mins < 60) return `checked ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `checked ${hrs}h ago`;
  return `checked ${Math.floor(hrs / 24)}d ago`;
}

function ago(ts) {
  if (!ts) return '';
  const hrs = Math.floor((Date.now() / 1000 - ts) / 3600);
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** "4d 16h", "16h 20m", "in a moment" — coarse on purpose, it is an estimate. */
function countdown(seconds) {
  if (seconds == null) return '';
  if (seconds <= 0) return 'airing now';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function whenLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function Monitors() {
  const { refresh: refreshStatus } = useStatus();
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  // Ticks the countdowns without refetching.
  const [, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const data = await apiGet('/api/monitors', { timeout: 30000 });
      setMonitors(data.monitors || []);
    } catch {
      /* shell shows reachability */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const checkNow = async () => {
    setBusy(true);
    setFlash(null);
    try {
      const res = await apiPost('/api/monitors/check', undefined, { timeout: 240000 });
      setFlash(
        res.queued > 0
          ? `Queued ${res.queued} new episode${res.queued === 1 ? '' : 's'}.`
          : 'Checked — no new episodes.'
      );
      await load();
      refreshStatus();
    } catch (err) {
      setFlash(err.message || 'Check failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    setBusy(true);
    try {
      await apiDelete(`/api/monitors/${id}`);
      await load();
      refreshStatus();
    } finally {
      setBusy(false);
    }
  };

  // Countdowns drift between renders; recompute from the absolute timestamp
  // rather than the seconds value the server sent.
  const secondsUntil = (m) => {
    if (!m.nextAirs) return null;
    return Math.round((new Date(m.nextAirs).getTime() - Date.now()) / 1000);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-title-box">
          <Radar size={26} className="header-icon" />
          <div>
            <h2>Monitors</h2>
            <p className="subtitle">
              {loading ? 'Loading…' : `${monitors.length} series watched for new episodes`}
            </p>
          </div>
        </div>
        <div className="header-controls">
          <button className="btn small primary" onClick={checkNow} disabled={busy || monitors.length === 0}>
            {busy ? <Loader2 size={14} className="spin" /> : <PlayCircle size={14} />}
            {busy ? 'Checking…' : 'Check now'}
          </button>
        </div>
      </div>

      {flash && (
        <div className="monitor-flash glass-panel" onClick={() => setFlash(null)}>
          {flash}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><Loader2 size={30} className="spin" /></div>
      ) : monitors.length === 0 ? (
        <div className="empty-state">
          <Radar size={40} />
          <p>
            No monitors yet. Open a drama and choose <strong>Monitor new</strong> to have
            future episodes downloaded automatically as they air.
          </p>
          <Link to="/" className="btn">Browse dramas</Link>
        </div>
      ) : (
        <div className="monitor-list">
          {monitors.map((m) => {
            const secs = secondsUntil(m);
            return (
              <div key={m.id} className="monitor-row glass-panel">
                <Link to={`/series/${m.seriesId}`} className="monitor-poster">
                  {m.poster
                    ? <img src={m.poster} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    : <Radar size={20} />}
                </Link>

                <div className="monitor-body">
                  <Link to={`/series/${m.seriesId}`} className="monitor-title">
                    {m.seriesTitle}
                  </Link>

                  <div className="monitor-sub">
                    <span className={`mode-tag ${m.mode}`}>
                      {m.mode === 'future' ? 'New episodes only' : 'All episodes'}
                    </span>
                    {m.maxHeight && <span className="res-tag">{m.maxHeight}p</span>}
                    <span className="monitor-when">
                      <Clock size={12} /> {lastChecked(m.lastCheck)}
                    </span>
                  </div>

                  {m.schedule ? (
                    <div className="monitor-schedule">
                      <CalendarClock size={13} />
                      <span className="sched-text">{m.schedule}</span>
                      {m.scheduleSource === 'inferred' && (
                        <span
                          className="sched-est"
                          title="ARY publishes no schedule for this series; this is worked out from when episodes actually appeared"
                        >
                          estimated
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="monitor-schedule muted">
                      <CalendarClock size={13} />
                      <span className="sched-text">No schedule available</span>
                    </div>
                  )}

                  <div className="monitor-timeline">
                    {m.lastEpisode != null && (
                      <span>
                        Latest <b>E{m.lastEpisode}</b>
                        {m.lastEpisodeAt ? ` · ${ago(m.lastEpisodeAt)}` : ''}
                      </span>
                    )}
                    {secs != null && (
                      <span className="next-up" title={whenLabel(m.nextAirs)}>
                        Next in <b>{countdown(secs)}</b> · {whenLabel(m.nextAirs)}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  className="btn small danger"
                  onClick={() => remove(m.id)}
                  disabled={busy}
                  title="Stop monitoring"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
