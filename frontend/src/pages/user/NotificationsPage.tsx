import React from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { fmtDateTime } from '../../utils/helpers';

interface NotificationsPageProps {
  session: any;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ session }) => {
  const { notifications, unread, markRead, markAllRead, loading } = useNotifications(session);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{unread} unread</p>
        </div>
        {unread > 0 && <Button variant="secondary" size="sm" onClick={markAllRead}>Mark all read</Button>}
      </div>

      {loading ? (
        <div className="loading"><span className="spinner" />Loading...</div>
      ) : notifications.length === 0 ? (
        <Card><p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No notifications yet.</p></Card>
      ) : (
        <div className="notification-list">
          {notifications.map((n: any) => (
            <div key={n.id} className={`notification-item ${!n.isRead ? 'unread' : ''}`} onClick={() => !n.isRead && markRead(n.id)} style={{ cursor: !n.isRead ? 'pointer' : 'default' }}>
              <div className="notification-content">
                <div className="notification-title">{n.title || 'Notification'}</div>
                <p className="notification-message">{n.message}</p>
                <div className="notification-time">{fmtDateTime(n.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
