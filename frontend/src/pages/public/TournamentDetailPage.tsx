import React from 'react';
import { useParams } from 'react-router-dom';
import { useLoad } from '../../hooks/useLoad';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { StatusPill } from '../../components/shared/StatusPill';
import { fmtDateTime } from '../../utils/helpers';

export const TournamentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const tournament = useLoad(() => api.publicTournament(Number(id)), undefined as any);
  const fixtures = useLoad(() => api.publicFixtures(Number(id)), [] as any[]);

  if (tournament.loading) return <div className="loading"><span className="spinner" />Loading...</div>;
  if (!tournament.data) return <div className="error-state"><h3>Tournament not found</h3></div>;

  const t = tournament.data;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <h1 className="page-title" style={{ margin: 0 }}>{t.name}</h1>
          <Badge variant={t.status === 'Live' ? 'success' : 'primary'}>{t.status}</Badge>
        </div>
        <p className="page-subtitle">{t.sportName} • {t.teamCount} teams • {t.fixtureCount} fixtures</p>
      </div>

      <div className="grid md:grid-cols-2" style={{ gap: '2rem' }}>
        <Card title="Tournament Info">
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div><strong>Start:</strong> {fmtDateTime(t.startAt)}</div>
            <div><strong>End:</strong> {fmtDateTime(t.endAt)}</div>
            <div><strong>Completed:</strong> {t.completedFixtureCount} / {t.fixtureCount} fixtures</div>
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', height: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${t.fixtureCount ? (t.completedFixtureCount / t.fixtureCount) * 100 : 0}%`, background: 'var(--primary)', height: '100%', transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {t.fixtureCount ? Math.round((t.completedFixtureCount / t.fixtureCount) * 100) : 0}% complete
              </div>
            </div>
          </div>
        </Card>

        <Card title="Recent Fixtures">
          {fixtures.data && fixtures.data.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {fixtures.data.slice(0, 5).map((f: any) => (
                <div key={f.id} style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>{f.homeTeam} vs {f.awayTeam}</span>
                    <StatusPill status={f.status} />
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {fmtDateTime(f.startsAt)} • {f.venue || 'TBA'}
                    {f.status === 'Completed' && <span style={{ marginLeft: '0.5rem', fontWeight: 600 }}>{f.homeScore} - {f.awayScore}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No fixtures yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
};
