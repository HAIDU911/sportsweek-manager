import React, { useState } from 'react';
import { useLoad } from '../../hooks/useLoad';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusPill } from '../../components/shared/StatusPill';
import { fmtDateTime } from '../../utils/helpers';
import { Modal } from '../../components/ui/Modal';

export const ScorerDeskPage: React.FC = () => {
  const fixtures = useLoad(() => api.captainFixtures(), [] as any[]);
  const [selected, setSelected] = useState<any>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScore = async () => {
    if (!selected) return;
    setError('');
    setLoading(true);
    try {
      await api.score(selected.id, {
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
        status: 'Completed',
        outcome: Number(homeScore) > Number(awayScore) ? 'home win' : Number(awayScore) > Number(homeScore) ? 'away win' : 'draw',
        expectedVersion: selected.version || 1
      });
      setSelected(null);
      setHomeScore('');
      setAwayScore('');
      fixtures.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to submit score');
    } finally {
      setLoading(false);
    }
  };

  const pendingFixtures = (fixtures.data || []).filter((f: any) => f.status === 'Scheduled' || f.status === 'InProgress');

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Scorer Desk</h1>
        <p className="page-subtitle">Enter scores for scheduled matches.</p>
      </div>

      <Card title="Pending Fixtures">
        <Table
          columns={[
            { header: 'Match', accessor: (row: any) => <strong>{row.homeTeam} vs {row.awayTeam}</strong> },
            { header: 'Date', accessor: (row: any) => fmtDateTime(row.startsAt) },
            { header: 'Venue', accessor: 'venue' },
            { header: 'Status', accessor: (row: any) => <StatusPill status={row.status} /> },
            { header: 'Action', accessor: (row: any) => <Button size="sm" onClick={() => setSelected(row)}>Enter Score</Button> },
          ]}
          data={pendingFixtures}
          emptyMessage="No pending fixtures to score."
        />
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Enter Score" footer={
        <>
          <Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleScore} loading={loading}>Submit Score</Button>
        </>
      }>
        {error && <div style={{ background: 'var(--error-light)', color: 'var(--error)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        {selected && (
          <div>
            <p style={{ marginBottom: '1rem' }}><strong>{selected.homeTeam}</strong> vs <strong>{selected.awayTeam}</strong></p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Input label={`${selected.homeTeam} Score`} type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)} required />
              <Input label={`${selected.awayTeam} Score`} type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)} required />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
