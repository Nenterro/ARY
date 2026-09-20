import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Search, RefreshCw, AlertCircle, Radar } from 'lucide-react';
import { apiGet, apiPost } from '../utils/api';
import { useStatus } from '../context/StatusContext';
import './Browse.css';

export default function Browse() {
  const { refresh: refreshStatus } = useStatus();
  const [series, setSeries] = useState([]);
  const [rails, setRails] = useState([]);
  const [monitored, setMonitored] = useState(new Set());
  const [query, setQuery] = useState('');
  const [rail, setRail] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      const [cat, railData, mon] = await Promise.all([
        apiGet('/api/catalog'),
        apiGet('/api/rails'),
        apiGet('/api/monitors'),
      ]);
      setSeries(cat.series || []);
      setRails(railData.rails || []);
      setMonitored(new Set((mon.monitors || []).filter(m => m.enabled).map(m => m.seriesId)));
    } catch (err) {
      setError(err.message || 'Could not reach the backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      await apiPost('/api/catalog/sync', undefined, { timeout: 90000 });
      await load();
      refreshStatus();
    } catch (err) {
      setError(err.message || 'Catalogue sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return series.filter((s) => {
      if (rail && !s.rails.includes(rail)) return false;
      if (needle && !s.title.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [series, query, rail]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-title-box">
          <LayoutGrid size={26} className="header-icon" />
          <div>
            <h2>Browse</h2>
            <p className="subtitle">
              {loading ? 'Loading catalogue…' : `${visible.length} of ${series.length} titles`}
            </p>
          </div>
        </div>
        <div className="header-controls">
          <button className="btn small" onClick={sync} disabled={syncing}>
            <RefreshCw size={15} className={syncing ? 'spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      </div>

      <div className="browse-controls">
        <div className="search-box">
          <Search size={17} />
          <input
            className="text-input"
            type="search"
            placeholder="Search dramas, telefilms, movies…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="rail-chips">
          <button
            className={`chip ${rail === '' ? 'active' : ''}`}
            onClick={() => setRail('')}
          >
            All
          </button>
          {rails.map((r) => (
            <button
              key={r.name}
              className={`chip ${rail === r.name ? 'active' : ''}`}
              onClick={() => setRail(rail === r.name ? '' : r.name)}
              title={`${r.count} titles`}
            >
              {r.name}
              <span className="chip-count">{r.count}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="browse-error glass-panel">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button className="btn small" onClick={load}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="poster-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="poster-card skeleton" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <Search size={40} />
          <p>
            {series.length === 0
              ? 'The catalogue is empty. Hit Sync to pull it from ARY.'
              : 'Nothing matches that search.'}
          </p>
        </div>
      ) : (
        <div className="poster-grid">
          {visible.map((s) => (
            <Link key={s.id} to={`/series/${s.id}`} className="poster-card">
              <div className="poster-image">
                {s.poster ? (
                  <img src={s.poster} alt="" loading="lazy" />
                ) : (
                  <div className="poster-fallback">{s.title.slice(0, 1)}</div>
                )}
                {monitored.has(s.id) && (
                  <span className="poster-monitor" title="Monitored">
                    <Radar size={13} />
                  </span>
                )}
                {s.episodeCount > 0 && (
                  <span className="poster-eps">{s.episodeCount} ep</span>
                )}
              </div>
              <div className="poster-title">{s.title}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
