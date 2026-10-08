import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Bell, User, LogOut, LayoutDashboard } from 'lucide-react';

interface NavbarProps {
  isAuthenticated: boolean;
  userRole?: string;
  userName?: string;
  unreadNotifications?: number;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAuthenticated,
  userRole,
  userName,
  unreadNotifications = 0,
  onLogout
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [location]);

  const publicLinks = [
    { to: '/', label: 'Home' },
    { to: '/sports', label: 'Sports' },
    { to: '/tournaments', label: 'Tournaments' },
    { to: '/leaderboards', label: 'Leaderboards' },
    { to: '/teams', label: 'Teams' },
    { to: '/schedule', label: 'Schedule' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand">
          <div className="navbar-logo">SW</div>
          <span>SportsWeek</span>
        </Link>

        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <ul className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {publicLinks.map(link => (
            <li key={link.to}>
              <Link to={link.to} className={`navbar-link ${isActive(link.to) ? 'active' : ''}`}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="navbar-actions">
          {isAuthenticated ? (
            <>
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
                  <span className="hide-mobile">{userName || 'Profile'}</span>
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
                    minWidth: '200px',
                    zIndex: 100
                  }}>
                    {userRole === 'Admin' && (
                      <Link to="/admin" className="navbar-link" style={{ display: 'block', padding: '0.75rem 1rem' }}>
                        <LayoutDashboard size={16} style={{ marginRight: '0.5rem' }} />
                        Admin Dashboard
                      </Link>
                    )}
                    <Link to="/profile" className="navbar-link" style={{ display: 'block', padding: '0.75rem 1rem' }}>
                      Profile
                    </Link>
                    {userRole === 'Captain' && (
                      <Link to="/captain" className="navbar-link" style={{ display: 'block', padding: '0.75rem 1rem' }}>
                        Captain Desk
                      </Link>
                    )}
                    {userRole === 'Scorer' && (
                      <Link to="/scorer" className="navbar-link" style={{ display: 'block', padding: '0.75rem 1rem' }}>
                        Scorer Desk
                      </Link>
                    )}
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
            </>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
};
