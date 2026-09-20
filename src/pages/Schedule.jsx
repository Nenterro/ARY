import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, ChevronLeft, ChevronRight, Loader2, Radar, CircleHelp
} from 'lucide-react';
import { apiGet } from '../utils/api';
import './Schedule.css';

const WINDOW_DAYS = 7;

function isoDate(d) {
  // Local date, not UTC: toISOString() would shift the day either side of
  // midnight for anyone east of Greenwich, which is everyone here.
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Monday of the week containing `d`. */
function weekStart(d) {
  const out = new Date(d);
  const shift = (out.getDay() + 6) % 7; // JS weeks start Sunday
  out.setDate(out.getDate() - shift);
  out.setHours(0, 0, 0, 0);
  return out;
}

function rangeLabel(days) {
  if (!days?.length) return '';
  const first = days[0];
  const last = days[days.length - 1];
  if (first.month === last.month) {
    return `${first.dayNumber}–${last.dayNumber} ${last.month}`;
  }
  return `${first.dayNumber} ${first.month} – ${last.dayNumber} ${last.month}`;
}

function timeLabel(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export default function Schedule() {
  const [start, setStart] = useState(() => weekStart(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (from) => {
    setError(null);
    try {
      setData(await apiGet(
        `/api/schedule?start=${isoDate(from)}&days=${WINDOW_DAYS}`,
        { timeout: 45000 }
      ));
    } catch (err) {
      setError(err.message || 'Could not load the schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(start); }, [start, load]);

  const shift = (weeks) => {
    const next = new Date(start);
    next.setDate(next.getDate() + weeks * 7);
    setStart(next);
  };

  const calendar = data?.calendar || [];
  const thisWeek = isoDate(weekStart(new Date())) === isoDate(start);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-title-box">
          <CalendarDays size={26} className="header-icon" />
          <div>
            <h2>Schedule</h2>
            <p className="subtitle">
              {loading
                ? 'Loading…'
                : data?.monitorCount
                  ? `${data.monitorCount} monitored series · ${rangeLabel(calendar)}`
                  : 'Nothing monitored yet'}
            </p>
          </div>
        </div>
        <div className="header-controls">
          <button className="glass-icon-btn" onClick={() => shift(-1)} title="Previous week">
            <ChevronLeft size={18} />
          </button>
          <button
            className="btn small"
            onClick={() => setStart(weekStart(new Date()))}
            disabled={thisWeek}
          >
            Today
          </button>
          <button className="glass-icon-btn" onClick={() => shift(1)} title="Next week">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div className="browse-error glass-panel">
          <span>{error}</span>
          <button className="btn small" onClick={() => load(start)}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><Loader2 size={30} className="spin" /></div>
      ) : !data?.monitorCount ? (
        <div className="empty-state">
          <Radar size={40} />
          <p>
            Nothing is being monitored. Open a drama and choose <strong>Monitor new</strong>,
            and its airings will appear here.
          </p>
          <Link to="/" className="btn">Browse dramas</Link>
        </div>
      ) : (
        <>
          <div className="cal-grid">
            {calendar.map((day) => (
              <div
                key={day.date}
                className={`cal-day glass-panel ${day.isToday ? 'today' : ''} ${day.isPast ? 'past' : ''} ${day.airings.length ? '' : 'empty'}`}
              >
                <div className="cal-day-head">
                  <span className="cal-weekday">{day.weekday}</span>
                  <span className="cal-daynum">{day.dayNumber}</span>
                  {day.isToday && <span className="cal-today-dot" />}
                </div>

                <div className="cal-airings">
                  {day.airings.length === 0 ? (
                    <div className="cal-none">—</div>
                  ) : (
                    day.airings.map((a) => (
                      <Link
                        key={`${a.seriesId}-${a.at}`}
                        to={`/series/${a.seriesId}`}
                        className={`cal-item ${a.past ? 'aired' : ''}`}
                        title={`${a.title} · ${timeLabel(a.time)}${a.episodeIsActual ? '' : ' (estimated)'}`}
                      >
                        <div className="cal-item-thumb">
                          {a.poster
                            ? <img src={a.poster} alt="" loading="lazy" referrerPolicy="no-referrer" />
                            : <Radar size={13} />}
                        </div>
                        <div className="cal-item-body">
                          <div className="cal-item-title">{a.title}</div>
                          <div className="cal-item-meta">
                            {timeLabel(a.time)}
                            {a.episode != null && (
                              <>
                                {' · '}
                                <span className={a.episodeIsActual ? 'ep-known' : 'ep-est'}>
                                  E{a.episode}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="cal-legend">
            <span className="ep-known">E12</span> aired ·{' '}
            <span className="ep-est">E16</span> projected from the airing pattern
          </p>

          {data.unscheduled?.length > 0 && (
            <div className="cal-unscheduled glass-panel">
              <div className="cal-unsched-head">
                <CircleHelp size={15} />
                No schedule available
              </div>
              <p>
                ARY publishes no air days for {data.unscheduled.length === 1 ? 'this series' : 'these series'},
                and too few episodes have appeared to work the pattern out. They are still
                monitored — new episodes are picked up on the hourly sweep.
              </p>
              <div className="cal-unsched-list">
                {data.unscheduled.map((u) => (
                  <Link key={u.seriesId} to={`/series/${u.seriesId}`} className="cal-unsched-item">
                    {u.poster && <img src={u.poster} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                    <span>{u.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
