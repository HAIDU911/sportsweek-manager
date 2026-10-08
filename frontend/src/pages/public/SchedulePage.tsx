import React, { useState } from 'react';
import { useLoad } from '../../hooks/useLoad';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { StatusPill } from '../../components/shared/StatusPill';
import { fmtDate, fmtTime } from '../../utils/helpers';

export const SchedulePage: React.FC = () => {
  const [filter, setFilter] = useState<'upcoming' | 'results'>('upcoming');
  const [sportId, setSportId] = useState<number | undefined>(undefined);
  const fixtures = useLoad(() => api.publicFixturesBoard({ filter, sportId, limit: 100 }), [] as any[]);
  const sports = useLoad(() => api.publicSports(), [] as any[]);

  const grouped = (fixtures.data || []).reduce((acc: any, f: any) => {
    const day = fmtDate(f.startsAt);
    if (!acc[day]) acc[day] = [];
    acc[day].push(f);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Schedule</h1>
        <p className="page-subtitle">Full match calendar with filters.</p>
      </div>

      <div className="filter-bar">
        <button className={`filter-chip ${filter === 'upcoming' ? 'active' : ''}`} onClick={() => setFilter('upcoming')}>Upcoming</button>
        <button className={`filter-chip ${filter === 'results' ? 'active' : ''}`} onClick={() => setFilter('results')}>Results</button>
      </div>

      <div className="filter-bar">
        <button className={`filter-chip ${!sportId ? 'active' : ''}`} onClick={() => setSportId(undefined)}>All Sports</button>
        {sports.data?.map((s: any) => (
          <button key={s.id} className={`filter-chip ${sportId === s.id ? 'active' : ''}`} onClick={() => setSportId(s.id)}>
            {s.name}
          </button>
        ))}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card><p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No fixtures found.</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {Object.entries(grouped).map(([day, dayFixtures]: [string, any]) => (
            <div key={day}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--border)' }}>{day}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(dayFixtures as any[]).map((f: any) => (
                  <Card key={f.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                          {fmtTime(f.startsAt)} • {f.venue || 'TBA'}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '1.125rem' }}>
                          {f.homeTeam} vs {f.awayTeam}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          {f.sportName} • {f.tournamentName}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <StatusPill status={f.status} />
                        {f.status === 'Completed' && (
                          <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {f.homeScore} - {f.awayScore}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
