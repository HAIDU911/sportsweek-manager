import React from 'react';
import { useLoad } from '../../hooks/useLoad';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';

export const AdminDashboardPage: React.FC = () => {
  const dashboard = useLoad(() => api.adminDashboard(), undefined as any);

  if (dashboard.loading) return <div className="loading"><span className="spinner" />Loading dashboard...</div>;
  const d = dashboard.data;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Overview of the SportsWeek platform.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Tournaments</div>
          <div className="stat-value">{d?.tournamentCount || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Teams</div>
          <div className="stat-value">{d?.teamCount || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Fixtures</div>
          <div className="stat-value">{d?.fixtureCount || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{d?.completedMatches || 0}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2" style={{ gap: '2rem' }}>
        <Card title="Quick Actions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <a href="/admin/tournaments" className="btn btn-secondary">Manage Tournaments →</a>
            <a href="/admin/sports" className="btn btn-secondary">Manage Sports →</a>
            <a href="/admin/teams" className="btn btn-secondary">Manage Teams →</a>
            <a href="/admin/score-corrections" className="btn btn-secondary">Score Corrections →</a>
          </div>
        </Card>

        <Card title="Platform Status">
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div><strong>Sports:</strong> 6 active</div>
            <div><strong>Season:</strong> 2026</div>
            <div><strong>Platform:</strong> <span style={{ color: 'var(--success)' }}>Operational</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
};
