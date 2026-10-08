import React, { useState } from 'react';
import { Sidebar } from '../components/shared/Sidebar';
import { Menu, Bell, User, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AdminLayoutProps {
  children: React.ReactNode;
  session: any;
  onLogout: () => void;
  unreadNotifications?: number;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  session,
  onLogout,
  unreadNotifications = 0
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="admin-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSidebarOpen(true)}
            style={{ display: 'none' }}
            id="admin-menu-btn"
          >
            <Menu size={20} />
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to="/notifications" className="navbar-link" style={{ position: 'relative' }}>
              <Bell size={20} />
              {unreadNotifications > 0 && (
                <span className="badge badge-error" style={{ position: 'absolute', top: -8, right: -8, fontSize: '0.625rem', padding: '0.125rem 0.375rem' }}>
                  {unreadNotifications}
                </span>
              )}
            </Link>
            <div style={{ position: 'relative' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setProfileOpen(!profileOpen)}>
                <User size={16} />
                <span>{session?.email || 'Admin'}</span>
              </button>
              {profileOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  minWidth: '180px',
                  zIndex: 100
                }}>
                  <Link to="/profile" className="navbar-link" style={{ display: 'block', padding: '0.75rem 1rem' }}>
                    Profile
                  </Link>
                  <button
                    className="btn btn-ghost btn-block"
                    onClick={onLogout}
                    style={{ borderRadius: 0, borderTop: '1px solid var(--border)' }}
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
};
