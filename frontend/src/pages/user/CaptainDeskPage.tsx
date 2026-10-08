import React from 'react';
import { useLoad } from '../../hooks/useLoad';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { StatusPill } from '../../components/shared/StatusPill';
import { fmtDateTime } from '../../utils/helpers';

export const CaptainDeskPage: React.FC = () => {
  const teams = useLoad(() => api.captainTeams(), [] as any[]);
  const fixtures = useLoad(() => api.captainFixtures(), [] as any[]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Captain Desk</h1>
        <p className="page-subtitle">Manage your teams and view fixtures.</p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <Card title="My Teams">
        <Table
          columns={[
            { header: 'Team', accessor: 'name' },
            { header: 'Tournament', accessor: 'tournamentName' },
            { header: 'Sport', accessor: 'sportName' },
            { header: 'Status', accessor: (row: any) => <Badge variant={row.status === 'Approved' ? 'success' : 'warning'}>{row.status}</Badge> },
          ]}
          data={teams.data || []}
          emptyMessage="You haven't registered any teams yet."
        />
        </Card>
      </div>

      <Card title="My Fixtures">
        <Table
          columns={[
            { header: 'Match', accessor: (row: any) => <strong>{row.homeTeam} vs {row.awayTeam}</strong> },
            { header: 'Date', accessor: (row: any) => fmtDateTime(row.startsAt) },
            { header: 'Venue', accessor: 'venue' },
            { header: 'Status', accessor: (row: any) => <StatusPill status={row.status} /> },
            { header: 'Score', accessor: (row: any) => row.status === 'Completed' ? `${row.homeScore} - ${row.awayScore}` : '-' },
          ]}
          data={fixtures.data || []}
          emptyMessage="No fixtures scheduled yet."
        />
      </Card>
    </div>
  );
};
