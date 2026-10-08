import React, { useState } from 'react';
import { useLoad } from '../../hooks/useLoad';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export const ManageTeamsPage: React.FC = () => {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const teams = useLoad(() => api.adminTeams(status), [] as any[]);

  const handleApprove = async (id: number) => {
    try { await api.approveTeam(id); teams.reload(); } catch (err: any) { alert(err.message); }
  };
  const handleReject = async (id: number) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try { await api.rejectTeam(id, reason); teams.reload(); } catch (err: any) { alert(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Teams</h1>
        <p className="page-subtitle">Review and manage team registrations.</p>
      </div>

      <div className="filter-bar">
        <button className={`filter-chip ${!status ? 'active' : ''}`} onClick={() => setStatus(undefined)}>All</button>
        <button className={`filter-chip ${status === 'Pending' ? 'active' : ''}`} onClick={() => setStatus('Pending')}>Pending</button>
        <button className={`filter-chip ${status === 'Approved' ? 'active' : ''}`} onClick={() => setStatus('Approved')}>Approved</button>
        <button className={`filter-chip ${status === 'Rejected' ? 'active' : ''}`} onClick={() => setStatus('Rejected')}>Rejected</button>
      </div>

      <Card>
        <Table
          columns={[
            { header: 'Team', accessor: 'name' },
            { header: 'Department', accessor: 'department' },
            { header: 'Tournament', accessor: 'tournamentName' },
            { header: 'Status', accessor: (row: any) => <Badge variant={row.status === 'Approved' ? 'success' : row.status === 'Rejected' ? 'error' : 'warning'}>{row.status}</Badge> },
            { header: 'Actions', accessor: (row: any) => row.status === 'Pending' ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button size="sm" variant="primary" onClick={() => handleApprove(row.id)}>Approve</Button>
                <Button size="sm" variant="danger" onClick={() => handleReject(row.id)}>Reject</Button>
              </div>
            ) : '-' },
          ]}
          data={teams.data || []}
          emptyMessage="No teams found."
        />
      </Card>
    </div>
  );
};
