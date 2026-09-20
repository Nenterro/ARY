import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Download, RefreshCw, Radar, BellOff, CheckCircle2,
  AlertCircle, Loader2
} from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../utils/api';
import { useStatus } from '../context/StatusContext';
import './Series.css';

function fmtDuration(seconds) {
  if (!seconds) return '';
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

export default function Series() {
  const { seriesId } = useParams();
  const { refresh: refreshStatus } = useStatus();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      const d = await apiGet(
        `/api/series/${seriesId}${refresh ? '?refresh=true' : ''}`,
        { timeout: refresh ? 120000 : 30000 }
      );
      setData(d);
    } catch (err) {
      setError(err.message || 'Could not load this series');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seriesId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // While anything is downloading, keep the episode rows current.
  useEffect(() => {
    const active = (data?.episodes || []).some(
      (e) => e.job && ['queued', 'downloading'].includes(e.job.status)
    );
    if (!active) return;
    const t = setInterval(() => load(), 4000);
    return () => clearInterval(t);
  }, [data, load]);

  const pending = useMemo(
    () => (data?.episodes || []).filter((e) => !e.onDisk && !e.job),
    [data]
  );

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const request = async (episodeIds, all = false) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost(
        `/api/series/${seriesId}/request`,
        all ? { all: true } : { episodeIds },
        { timeout: 120000 }
      );
      const n = res.queued?.length || 0;
      const skipped = (res.existing?.length || 0) + (res.onDisk?.length || 0);
      setFlash(
        n === 0
          ? 'Nothing new to queue — those episodes are already here.'
          : `Queued ${n} episode${n === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} already present` : ''}.`
      );
      setSelected(new Set());
      await load();
      refreshStatus();
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const setMonitor = async (mode) => {
    setBusy(true);
    setError(null);
    try {
      if (mode === null) {
        await apiDelete(`/api/monitors/${data.monitor.id}`);
        setFlash('Monitor removed.');
      } else {
        const res = await apiPost('/api/monitors', { seriesId, mode }, { timeout: 120000 });
        setFlash(
          mode === 'future'
            ? `Monitoring future episodes (from episode ${(res.baseline ?? 0) + 1} onward).`
            : 'Monitoring — every episode not already on disk will be queued.'
        );
      }
      await load();
      refreshStatus();
    } catch (err) {
      setError(err.message || 'Could not update the monitor');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <Loader2 size={34} className="spin" />
          <p>Loading series…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <AlertCircle size={38} />
          <p>{error || 'That series could not be loaded.'}</p>
          <Link to="/" className="btn">Back to Browse</Link>
        </div>
      </div>
    );
  }

  const onDiskCount = data.episodes.filter((e) => e.onDisk).length;
  const monitor = data.monitor;

  return (
    <div className="page-container">
      <div className="series-hero glass-panel">
        {data.cover && <div className="hero-bg" style={{ backgroundImage: `url(${data.cover})` }} />}
        <div className="hero-inner">
          <Link to="/" className="glass-icon-btn hero-back" title="Back">
            <ArrowLeft size={19} />
          </Link>

          {data.poster && <img className="hero-poster" src={data.poster} alt="" />}

          <div className="hero-meta">
            <h2>{data.title}</h2>
            <div className="hero-stats">
              <span>{data.episodes.length} episodes</span>
              {onDiskCount > 0 && <span className="ok">{onDiskCount} downloaded</span>}
              {monitor?.enabled && (
                <span className="mon"><Radar size={13} /> monitoring {monitor.mode}</span>
              )}
            </div>
            {data.description && <p className="hero-desc">{data.description}</p>}

            <div className="hero-actions">
              <button
                className="btn primary"
                onClick={() => request(null, true)}
                disabled={busy || pending.length === 0}
              >
                <Download size={16} />
                {pending.length === 0 ? 'All episodes present' : `Get all (${pending.length})`}
              </button>

              {monitor?.enabled ? (
                <button className="btn danger" onClick={() => setMonitor(null)} disabled={busy}>
                  <BellOff size={16} /> Stop monitoring
                </button>
              ) : (
                <>
                  <button className="btn" onClick={() => setMonitor('future')} disabled={busy}>
                    <Radar size={16} /> Monitor new
                  </button>
                  <button className="btn" onClick={() => setMonitor('all')} disabled={busy}>
                    <Radar size={16} /> Monitor all
                  </button>
                </>
              )}

              <button
                className="btn"
                onClick={() => { setRefreshing(true); load(true); }}
                disabled={busy || refreshing}
              >
                <RefreshCw size={16} className={refreshing ? 'spin' : ''} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {flash && (
        <div className="series-flash glass-panel" onClick={() => setFlash(null)}>
          <CheckCircle2 size={17} /> <span>{flash}</span>
        </div>
      )}
      {error && (
        <div className="series-flash error glass-panel" onClick={() => setError(null)}>
          <AlertCircle size={17} /> <span>{error}</span>
        </div>
      )}

      <div className="episode-bar">
        <h3>Episodes</h3>
        {selected.size > 0 && (
          <div className="episode-bar-actions">
            <span>{selected.size} selected</span>
            <button className="btn small" onClick={() => setSelected(new Set())}>Clear</button>
            <button
              className="btn primary small"
              onClick={() => request([...selected])}
              disabled={busy}
            >
              <Download size={14} /> Download
            </button>
          </div>
        )}
      </div>

      <div className="episode-list">
        {data.episodes.map((ep) => {
          const status = ep.onDisk ? 'ondisk' : ep.job?.status;
          const selectable = !ep.onDisk;
          const isSel = selected.has(ep.id);
          return (
            <div
              key={ep.id}
              className={`episode-row glass-panel ${isSel ? 'selected' : ''} ${selectable ? 'selectable' : ''}`}
              onClick={() => selectable && toggle(ep.id)}
            >
              <div className="ep-number">{ep.number}</div>

              <div className="ep-body">
                <div className="ep-title">{ep.title}</div>
                <div className="ep-sub">
                  {fmtDuration(ep.duration)}
                  {ep.job?.status === 'failed' && ep.job.error && (
                    <span className="ep-error" title={ep.job.error}>· {ep.job.error.split('\n')[0].slice(0, 80)}</span>
                  )}
                </div>
                {ep.job?.status === 'downloading' && (
                  <div className="ep-progress">
                    <div className="ep-progress-fill" style={{ width: `${ep.job.progress || 0}%` }} />
                  </div>
                )}
              </div>

              <div className="ep-right">
                {status === 'ondisk' && <span className="pill ondisk">On disk</span>}
                {status === 'downloading' && (
                  <span className="pill downloading">{(ep.job.progress || 0).toFixed(0)}%</span>
                )}
                {status === 'queued' && <span className="pill queued">Queued</span>}
                {status === 'failed' && <span className="pill failed">Failed</span>}
                {status === 'cancelled' && <span className="pill cancelled">Cancelled</span>}
                {!status && (
                  <button
                    className="btn small"
                    onClick={(e) => { e.stopPropagation(); request([ep.id]); }}
                    disabled={busy}
                  >
                    <Download size={13} /> Get
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
