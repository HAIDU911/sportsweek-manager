import React from 'react';
import { Link } from 'react-router-dom';
import { useLoad } from '../../hooks/useLoad';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export const TournamentsPage: React.FC = () => {
  const tournaments = useLoad(() => api.publicTournaments(), [] as any[]);

  if (tournaments.loading) return <div className="loading"><span className="spinner" />Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tournaments</h1>
        <p className="page-subtitle">All active and upcoming tournaments.</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3">
        {tournaments.data?.map((t: any) => (
          <Link key={t.id} to={`/tournaments/${t.id}`} style={{ textDecoration: 'none' }}>
            <Card hover>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{t.name}</h3>
                <Badge variant={t.status === 'Live' ? 'success' : t.status === 'RegistrationOpen' ? 'info' : 'primary'}>
                  {t.status}
                </Badge>
              </div>
              <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t.sportName}</p>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <span>{t.teamCount} teams</span>
                <span>{t.fixtureCount} fixtures</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};
