import React, { useState } from 'react';
import { useLoad } from '../../hooks/useLoad';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

export const LeaderboardsPage: React.FC = () => {
  const [sportId, setSportId] = useState<number | undefined>(undefined);
  const leaderboard = useLoad(() => api.publicLeaderboard(sportId), [] as any[]);

  const sports = useLoad(() => api.publicSports(), [] as any[]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Leaderboards</h1>
        <p className="page-subtitle">Department rankings and standings.</p>
      </div>

      <div className="filter-bar">
        <button className={`filter-chip ${!sportId ? 'active' : ''}`} onClick={() => setSportId(undefined)}>All Sports</button>
        {sports.data?.map((s: any) => (
          <button key={s.id} className={`filter-chip ${sportId === s.id ? 'active' : ''}`} onClick={() => setSportId(s.id)}>
            {s.name}
          </button>
        ))}
      </div>

      <Card>
        <Table
          columns={[
            { header: 'Rank', accessor: (row: any) => <strong>#{row._rank + 1}</strong> },
            { header: 'Department', accessor: 'department' },
            { header: 'Teams', accessor: 'teams' },
            { header: 'Matches', accessor: 'matchesPlayed' },
            { header: 'Wins', accessor: 'wins' },
            { header: 'Points', accessor: (row: any) => <strong style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>{row.points}</strong> },
          ]}
          data={(leaderboard.data || []).map((row: any, i: number) => ({ ...row, _rank: i }))}
          emptyMessage="No leaderboard data available."
        />
      </Card>
    </div>
  );
};
