import React from 'react';
import { useLoad } from '../../hooks/useLoad';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';

export const SportsPage: React.FC = () => {
  const sports = useLoad(() => api.publicSports(), [] as any[]);

  if (sports.loading) return <div className="loading"><span className="spinner" />Loading sports...</div>;
  if (sports.error) return <div className="error-state"><h3>Error</h3><p>{sports.error.message}</p></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sports</h1>
        <p className="page-subtitle">Browse all available sports in the tournament.</p>
      </div>
      <div className="grid md:grid-cols-3">
        {sports.data?.map((sport: any) => (
          <Card key={sport.id} hover>
            <h3 style={{ margin: 0 }}>{sport.name}</h3>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              View tournaments and teams for {sport.name}.
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
};
