import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Search, RefreshCw, AlertCircle, Radar, ArrowDownWideNarrow } from 'lucide-react';
import { apiGet, apiPost } from '../utils/api';
import { useStatus } from '../context/StatusContext';
import './Browse.css';

const FALLBACK_SORTS = [
  { key: 'title', label: 'Title (A-Z)' },
  { key: 'added', label: 'Recently added' },
  { key: 'release', label: 'Release date' },
  { key: 'episodes', label: 'Episode count' },
];

const SORT_KEY = 'ary_browse_sort';

function releaseYear(value) {
  return value ? String(value).slice(0, 4) : null;
}

function addedYear(ts) {
  return ts ? String(new Date(ts * 1000).getFullYear()) : null;
}

export default function Browse() {
  const { refresh: refreshStatus } = useStatus();
  const [series, setSeries] = useState([]);
  const [rails, setRails] = useState([]);
  const [sortOptions, setSortOptions] = useState(FALLBACK_SORTS);
  const [monitored, setMonitored] = useState(new Set());
  const [query, setQuery] = useState('');
  const [rail, setRail] = useState('');
  const [sort, setSort] = useState(() => {
    try {
      return localStorage.getItem(SORT_KEY) || 'title';
    } catch {
      return 'title';
    }
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const load = async (sortKey) => {
    setError(null);
    try {
      const [cat, railData, mon, sortList] = await Promise.all([
        apiGet(`/api/catalog?sort=${encodeURIComponent(sortKey)}`),
        apiGet('/api/rails'),
        apiGet('/api/monitors'),
        apiGet('/api/sorts').catch(() => null),
      ]);
      setSeries(cat.series || []);
      setRails(railData.rails || []);
      setMonitored(new Set((mon.monitors || []).filter(m => m.enabled).map(m => m.seriesId)));
      if (sortList?.sorts?.length) setSortOptions(sortList.sorts);
    } catch (err) {
      setError(err.message || 'Could not reach the backend');
    } finally {
      setLoading(false);
    }
  };

  // Ordering is done by the backend, so a sort change means a refetch.
  useEffect(() => { load(sort); }, [sort]);

  const changeSort = (key) => {
    setSort(key);
    try {
      localStorage.setItem(SORT_KEY, key);
    } catch {
      /* storage unavailable (private mode) */
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      // The first sync after a scope change also enriches release dates, which
      // is one request per series, so this needs more headroom than a read.
      await apiPost('/api/catalog/sync', undefined, { timeout: 300000 });
      await load(sort);
      refreshStatus();
    } catch (err) {
      setError(err.message || 'Catalogue sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Filtering only ever removes entries, so the backend's order survives.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return series.filter((s) => {
      if (rail && !s.rails.includes(rail)) return false;
      if (needle && !s.title.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [series, query, rail]);

  // Show whichever value the current sort orders by, so the ordering reads as
  // deliberate rather than arbitrary.
  const badgeFor = (s) => {
    if (sort === 'release') return releaseYear(s.releaseDate) || addedYear(s.addedAt);
    if (sort === 'added') return addedYear(s.addedAt);
    return s.episodeCount > 0 ? `${s.episodeCount} ep` : null;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-title-box">
          <LayoutGrid size={26} className="header-icon" />
          <div>
            <h2>Browse</h2>
            <p className="subtitle">
              {loading ? 'Loading catalogue…' : `${visible.length} of ${series.length} dramas`}
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
        <div className="controls-row">
          <div className="search-box">
            <Search size={17} />
            <input
              className="text-input"
              type="search"
              placeholder="Search dramas…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <label className="sort-box" title="Sort order">
            <ArrowDownWideNarrow size={16} />
            <select
              className="sort-select"
              value={sort}
              onChange={(e) => changeSort(e.target.value)}
            >
              {sortOptions.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </label>
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
          <button className="btn small" onClick={() => load(sort)}>Retry</button>
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
          {visible.map((s) => {
            const badge = badgeFor(s);
            return (
              <Link key={s.id} to={`/series/${s.id}`} className="poster-card">
                <div className="poster-image">
                  {s.poster ? (
                    <img src={s.poster} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="poster-fallback">{s.title.slice(0, 1)}</div>
                  )}
                  {monitored.has(s.id) && (
                    <span className="poster-monitor" title="Monitored">
                      <Radar size={13} />
                    </span>
                  )}
                  {badge && <span className="poster-eps">{badge}</span>}
                </div>
                <div className="poster-title">{s.title}</div>
                {s.airDay && <div className="poster-air">{s.airDay}</div>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
