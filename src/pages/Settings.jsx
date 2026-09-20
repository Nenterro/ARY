import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Server, HardDrive, RefreshCw, Check, X } from 'lucide-react';
import {
  getCustomUrl, setCustomUrl, getApiToken, setApiToken,
  getCandidateUrls, getCachedUrl, resetCachedUrl
} from '../utils/api';
import { useStatus } from '../context/StatusContext';
import './Settings.css';

function fmtTime(ts) {
  if (!ts) return 'never';
  return new Date(ts * 1000).toLocaleString();
}

export default function Settings() {
  const { stats, online, refresh } = useStatus();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState([]);

  useEffect(() => {
    setUrl(getCustomUrl());
    setToken(getApiToken());
  }, []);

  const save = () => {
    setCustomUrl(url.trim());
    setApiToken(token.trim());
    resetCachedUrl();
    setSaved(true);
    refresh();
    setTimeout(() => setSaved(false), 2200);
  };

  const testAll = async () => {
    setProbing(true);
    const results = [];
    for (const base of getCandidateUrls()) {
      const started = performance.now();
      try {
        const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(6000) });
        results.push({ base, ok: res.ok, ms: Math.round(performance.now() - started) });
      } catch {
        results.push({ base, ok: false, ms: null });
      }
    }
    setProbe(results);
    setProbing(false);
  };

  const disk = stats?.disk;
  const jobs = stats?.jobs || {};

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-title-box">
          <SettingsIcon size={26} className="header-icon" />
          <div>
            <h2>Settings</h2>
            <p className="subtitle">Backend connection and server status</p>
          </div>
        </div>
        <div className="header-controls">
          <div className={`conn-dot ${online ? 'online' : 'offline'}`} />
        </div>
      </div>

      <div className="settings-grid">
        <section className="settings-card glass-panel">
          <h3><Server size={17} /> Backend</h3>
          <p className="card-hint">
            Leave the URL blank to use the built-in candidates. Over HTTPS the
            plain-http LAN address is blocked as mixed content, so a public
            hostname is needed when this app is opened from Vercel.
          </p>

          <label className="field">
            <span>Custom backend URL</span>
            <input
              className="text-input"
              placeholder="https://huz-ary.duckdns.org:8888"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>

          <label className="field">
            <span>API token (only if set on the server)</span>
            <input
              className="text-input"
              type="password"
              placeholder="empty — backend is open"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>

          <div className="card-actions">
            <button className="btn primary" onClick={save}>
              {saved ? <><Check size={15} /> Saved</> : 'Save'}
            </button>
            <button className="btn" onClick={testAll} disabled={probing}>
              <RefreshCw size={15} className={probing ? 'spin' : ''} /> Test
            </button>
          </div>

          <div className="probe-list">
            <div className="probe-current">
              In use: <code>{getCachedUrl() || 'none yet'}</code>
            </div>
            {probe.map((p) => (
              <div key={p.base} className={`probe-row ${p.ok ? 'ok' : 'bad'}`}>
                {p.ok ? <Check size={14} /> : <X size={14} />}
                <code>{p.base}</code>
                <span>{p.ok ? `${p.ms}ms` : 'unreachable'}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="settings-card glass-panel">
          <h3><HardDrive size={17} /> Server</h3>

          {!stats ? (
            <p className="card-hint">Backend unreachable.</p>
          ) : (
            <>
              <div className="stat-rows">
                <div className="stat-row"><span>Series indexed</span><b>{stats.series}</b></div>
                <div className="stat-row"><span>Episodes indexed</span><b>{stats.episodes}</b></div>
                <div className="stat-row"><span>Active monitors</span><b>{stats.monitors}</b></div>
                <div className="stat-row"><span>Downloading</span><b>{jobs.downloading || 0}</b></div>
                <div className="stat-row"><span>Queued</span><b>{jobs.queued || 0}</b></div>
                <div className="stat-row"><span>Completed</span><b>{jobs.done || 0}</b></div>
                <div className="stat-row"><span>Failed</span><b>{jobs.failed || 0}</b></div>
                <div className="stat-row"><span>Library root</span><b><code>{stats.libraryRoot}</code></b></div>
                <div className="stat-row"><span>Catalogue synced</span><b>{fmtTime(stats.catalogSyncedAt)}</b></div>
                <div className="stat-row"><span>Monitors checked</span><b>{fmtTime(stats.monitorsCheckedAt)}</b></div>
              </div>

              {disk && (
                <div className="disk">
                  <div className="disk-head">
                    <span>Disk</span>
                    <b>{disk.freeGb} GB free of {disk.totalGb} GB</b>
                  </div>
                  <div className="disk-bar">
                    <div
                      className={`disk-fill ${disk.usedPct > 90 ? 'critical' : disk.usedPct > 80 ? 'warn' : ''}`}
                      style={{ width: `${disk.usedPct}%` }}
                    />
                  </div>
                  <div className="disk-sub">{disk.usedPct}% used</div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
