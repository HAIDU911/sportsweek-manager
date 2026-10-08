import { useState, useEffect, useCallback } from 'react';

export function useAuth() {
  const [session, setSession] = useState(() => {
    try {
      const raw = sessionStorage.getItem('sportsweek-session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const saveSession = useCallback((data: any) => {
    sessionStorage.setItem('sportsweek-session', JSON.stringify(data));
    setSession(data);
  }, []);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem('sportsweek-session');
    setSession(null);
  }, []);

  return { session, saveSession, clearSession };
}
