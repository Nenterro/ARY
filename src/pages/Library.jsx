import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { HardDrive, RefreshCw, Loader2, ChevronDown, FolderOpen, Film } from 'lucide-react';
import { apiGet } from '../utils/api';
import './Library.css';

function gb(bytes) {
  if (!bytes) return '0 GB';
  const value = bytes / 1e9;
  return value < 1 ? `${Math.round(bytes / 1e6)} MB` : `${value.toFixed(1)} GB`;
}

/** Collapse [1,2,3,5,6,9] into "1-3, 5-6, 9" so long runs stay readable. */
function ranges(numbers) {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const out = [];
  let start = null;
  let prev = null;
  for (const n of sorted) {
    if (start === null) {
      start = prev = n;
      continue;
    }
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    out.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = prev = n;
  }
  if (start !== null) out.push(start === prev ? `${start}` : `${start}-${prev}`);
  return out.join(', ');
}

export default function Library() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(new Set());
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiGet('/api/library', { timeout: 60000 }));
    } catch (err) {
      setError(err.message || 'Could not read the library');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (folder) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  const totals = data?.totals;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-title-box">
          <HardDrive size={26} className="header-icon" />
          <div>
            <h2>Library</h2>
            <p className="subtitle">
              {loading
                ? 'Reading the library…'
                : totals
                  ? `${totals.series} series · ${totals.episodes} episodes · ${gb(totals.bytes)}`
                  : 'Unavailable'}
            </p>
          </div>
        </div>
        <div className="header-controls">
          <button
            className="btn small"
            onClick={() => { setRefreshing(true); load(); }}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Rescan
          </button>
        </div>
      </div>

      {error && (
        <div className="browse-error glass-panel">
          <span>{error}</span>
          <button className="btn small" onClick={load}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><Loader2 size={30} className="spin" /></div>
      ) : !data?.series?.length ? (
        <div className="empty-state">
          <FolderOpen size={40} />
          <p>
            Nothing downloaded yet. Pick a drama from Browse and request an episode,
            and it will appear here once it lands in the Jellyfin library.
          </p>
          <Link to="/" className="btn">Browse dramas</Link>
        </div>
      ) : (
        <>
          <div className="lib-list">
            {data.series.map((s) => {
              const isOpen = open.has(s.folder);
              const heights = [...new Set(s.episodes.map((e) => e.height).filter(Boolean))]
                .sort((a, b) => b - a);
              return (
                <div key={s.folder} className="lib-row glass-panel">
                  <button className="lib-head" onClick={() => toggle(s.folder)}>
                    <div className="lib-poster">
                      {s.poster
                        ? <img src={s.poster} alt="" loading="lazy" referrerPolicy="no-referrer" />
                        : <Film size={18} />}
                    </div>

                    <div className="lib-body">
                      <div className="lib-title">{s.title}</div>
                      <div className="lib-sub">
                        <span>{s.episodeCount} episode{s.episodeCount === 1 ? '' : 's'}</span>
                        <span>{gb(s.bytes)}</span>
                        {heights.map((h) => (
                          <span key={h} className="res-tag">{h}p</span>
                        ))}
                      </div>
                      <div className="lib-eps">Episodes {ranges(s.episodes.map((e) => e.number))}</div>
                    </div>

                    <ChevronDown size={18} className={`lib-chev ${isOpen ? 'open' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="lib-files">
                      {s.episodes.map((e) => (
                        <div key={e.file} className="lib-file">
                          <span className="lib-file-ep">
                            S{String(e.season).padStart(2, '0')}E{String(e.number).padStart(2, '0')}
                          </span>
                          <span className="lib-file-name" title={e.file}>{e.file}</span>
                          <span className="lib-file-size">{gb(e.bytes)}</span>
                        </div>
                      ))}
                      {s.seriesId && (
                        <Link to={`/series/${s.seriesId}`} className="btn small lib-open">
                          Open series
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {data.skippedForeign > 0 && (
            <p className="lib-note">
              {data.skippedForeign} other folder{data.skippedForeign === 1 ? '' : 's'} in{' '}
              <code>{data.root}</code> {data.skippedForeign === 1 ? 'is' : 'are'} not ARY
              content and {data.skippedForeign === 1 ? 'was' : 'were'} skipped.
            </p>
          )}
        </>
      )}
    </div>
  );
}
