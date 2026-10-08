import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Trophy, Dumbbell, Users, Edit3, Settings, X } from 'lucide-react';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/tournaments', label: 'Tournaments', icon: Trophy },
  { to: '/admin/sports', label: 'Sports', icon: Dumbbell },
  { to: '/admin/teams', label: 'Teams', icon: Users },
  { to: '/admin/score-corrections', label: 'Score Corrections', icon: Edit3 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Link to="/admin" className="sidebar-brand">
          <div className="navbar-logo" style={{ width: 32, height: 32, fontSize: '0.875rem' }}>SW</div>
          <span>Admin Panel</span>
        </Link>
        <ul className="sidebar-nav">
          {adminLinks.map(link => (
            <li key={link.to}>
              <Link
                to={link.to}
                className={`sidebar-link ${isActive(link.to) ? 'active' : ''}`}
                onClick={onClose}
              >
                <link.icon size={20} />
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 85,
          }}
        />
      )}
    </>
  );
};
