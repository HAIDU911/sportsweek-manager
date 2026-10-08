import React, { useState } from 'react';
import { useLoad } from '../../hooks/useLoad';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';

export const TeamsPage: React.FC = () => {
  const [sportId, setSportId] = useState<number | undefined>(undefined);
  const teams = useLoad(() => api.publicTeams(sportId), [] as any[]);
  const sports = useLoad(() => api.publicSports(), [] as any[]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Teams</h1>
        <p className="page-subtitle">All registered teams across tournaments.</p>
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
            { header: 'Team', accessor: 'name' },
            { header: 'Department', accessor: 'department' },
            { header: 'Section', accessor: 'section' },
            { header: 'Sport', accessor: 'sportName' },
            { header: 'Tournament', accessor: 'tournamentName' },
            { header: 'Status', accessor: (row: any) => <Badge variant={row.status === 'Approved' ? 'success' : 'warning'}>{row.status}</Badge> },
          ]}
          data={teams.data || []}
          emptyMessage="No teams found."
        />
      </Card>
    </div>
  );
};
