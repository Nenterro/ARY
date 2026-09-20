import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutGrid, ListVideo, HardDrive, Radar, CalendarDays, Settings as SettingsIcon, Tv, Pin, PinOff } from 'lucide-react';
import { useStatus } from '../context/StatusContext';
import './Layout.css';

const NAV_ITEMS = [
  { path: '/', label: 'Browse', icon: LayoutGrid, end: true },
  { path: '/queue', label: 'Queue', icon: ListVideo },
  { path: '/library', label: 'Library', icon: HardDrive },
  { path: '/monitors', label: 'Monitors', icon: Radar },
  { path: '/schedule', label: 'Schedule', icon: CalendarDays },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

function activeCount(stats) {
  if (!stats?.jobs) return 0;
  return (stats.jobs.downloading || 0) + (stats.jobs.queued || 0);
}

function Brand({ size = 28, titleSize }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <Tv size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
      <h1 className="title" style={titleSize ? { fontSize: titleSize } : undefined}>
        ARY<span style={{ color: 'var(--accent-color)' }}>Grab</span>
      </h1>
    </div>
  );
}

function Sidebar({ isPinned, togglePin, online, badge }) {
  return (
    <div className={`sidebar-wrapper desktop-only ${isPinned ? 'pinned' : 'unpinned'}`}>
      <aside className={`sidebar glass-panel ${isPinned ? 'pinned' : 'unpinned'}`}>
        <div className="sidebar-header">
          <Brand />
          <button className="pin-btn" onClick={togglePin} title={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}>
            {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} />
              <span className="nav-label">{item.label}</span>
              {item.path === '/queue' && badge > 0 && (
                <span className="nav-badge">{badge}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-status-card">
            <div className={`conn-dot ${online ? 'online' : 'offline'}`} />
            <span className="sidebar-status-text">
              {online ? 'Backend Online' : 'Backend Offline'}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function BottomNav({ badge }) {
  return (
    <nav className="bottom-nav mobile-only">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.end}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title={item.label}
        >
          <item.icon size={22} />
          {item.path === '/queue' && badge > 0 && <span className="nav-badge-dot" />}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const [isSidebarPinned, setIsSidebarPinned] = useState(true);
  const { stats, online } = useStatus();
  const badge = activeCount(stats);

  return (
    <div className="app-container">
      <Sidebar
        isPinned={isSidebarPinned}
        togglePin={() => setIsSidebarPinned(!isSidebarPinned)}
        online={online}
        badge={badge}
      />
      <div className="main-wrapper">
        <header className="mobile-only glass-panel mobile-top-bar">
          <Brand size={24} titleSize="1.1rem" />
          <div className="mobile-top-right-wrapper">
            <div
              className={`conn-dot ${online ? 'online' : 'offline'}`}
              title={online ? 'Backend Online' : 'Backend Offline'}
            />
          </div>
        </header>

        <main className="main-content">
          <div className="page-transition-wrapper">
            <Outlet />
            <div className="mobile-scroll-spacer mobile-only" />
          </div>
        </main>

        <BottomNav badge={badge} />
      </div>
    </div>
  );
}
