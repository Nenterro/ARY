import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { apiGet } from '../utils/api';

const StatusContext = createContext(null);

/**
 * Polls /api/stats so the shell can show backend reachability, queue depth and
 * disk headroom without every page fetching it independently.
 *
 * Polls faster while downloads are active, because that is the only time the
 * numbers move quickly.
 */
export function StatusProvider({ children }) {
  const [stats, setStats] = useState(null);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet('/api/stats', { timeout: 8000 });
      setStats(data);
      setOnline(true);
      return data;
    } catch {
      setOnline(false);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const data = await refresh();
      if (cancelled) return;
      const busy =
        (data?.jobs?.downloading || 0) > 0 || (data?.jobs?.queued || 0) > 0;
      timerRef.current = setTimeout(tick, busy ? 3000 : 20000);
    };

    tick();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [refresh]);

  return (
    <StatusContext.Provider value={{ stats, online, loading, refresh }}>
      {children}
    </StatusContext.Provider>
  );
}

export function useStatus() {
  return useContext(StatusContext) || { stats: null, online: false, loading: true, refresh: () => {} };
}
