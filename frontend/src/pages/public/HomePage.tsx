import React from 'react';
import { Link } from 'react-router-dom';
import { useLoad } from '../../hooks/useLoad';
import { api } from '../../utils/api';
import { StatusPill } from '../../components/shared/StatusPill';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export const HomePage: React.FC = () => {
  const tournaments = useLoad(() => api.publicTournaments(), [] as any[]);
  const fixtures = useLoad(() => api.publicFixturesBoard({ limit: 5 }), [] as any[]);

  if (tournaments.loading || fixtures.loading) {
    return <div className="loading"><span className="spinner" />Loading...</div>;
  }

  return (
    <div>
      <div style={{ textAlign: 'center', padding: '3rem 0' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>SportsWeek Manager</h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 2rem' }}>
          Track tournaments, view schedules, and follow your team's progress throughout the week.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/tournaments"><Button variant="primary">View Tournaments</Button></Link>
          <Link to="/schedule"><Button variant="secondary">See Schedule</Button></Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Active Tournaments</div>
          <div className="stat-value">{tournaments.data?.length || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Upcoming Fixtures</div>
          <div className="stat-value">{fixtures.data?.length || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sports</div>
          <div className="stat-value">6</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2" style={{ gap: '2rem', marginTop: '2rem' }}>
        <Card title="Upcoming Fixtures" headerRight={<Link to="/schedule" style={{ fontSize: '0.875rem' }}>View all →</Link>}>
          {fixtures.data && fixtures.data.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {fixtures.data.slice(0, 5).map((f: any) => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{f.homeTeamName} vs {f.awayTeamName}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{f.sportName} • {f.venueName || 'TBA'}</div>
                  </div>
                  <StatusPill status={f.status} />
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No upcoming fixtures.</p>
          )}
        </Card>

        <Card title="Active Tournaments" headerRight={<Link to="/tournaments" style={{ fontSize: '0.875rem' }}>View all →</Link>}>
          {tournaments.data && tournaments.data.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tournaments.data.slice(0, 5).map((t: any) => (
                <Link key={t.id} to={`/tournaments/${t.id}`} style={{ display: 'block', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t.sportName}</div>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No active tournaments.</p>
          )}
        </Card>
      </div>
    </div>
  );
};
