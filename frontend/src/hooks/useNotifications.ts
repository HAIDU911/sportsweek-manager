import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export function useNotifications(session: any) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const list = await api.notifications();
      setNotifications(list || []);
      setUnread((list || []).filter((n: any) => !n.isRead).length);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 45000);
    return () => clearInterval(interval);
  }, [session]);

  const markRead = async (id: number) => {
    try {
      await api.notificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnread(u => Math.max(0, u - 1));
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await api.notificationsReadAll();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnread(0);
    } catch {
      // ignore
    }
  };

  return { notifications, unread, loading, load, markRead, markAllRead };
}
