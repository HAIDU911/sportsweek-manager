import React, { useState } from 'react';
import { useLoad } from '../../hooks/useLoad';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StatusPill } from '../../components/shared/StatusPill';
import { fmtDateTime } from '../../utils/helpers';

export const ScoreCorrectionsPage: React.FC = () => {
  const tournaments = useLoad(() => api.tournaments(), [] as any[]);
  const [selectedTournament, setSelectedTournament] = useState<number | null>(null);
  const fixtures = useLoad(() => selectedTournament ? api.fixtures(selectedTournament) : Promise.resolve([]), [] as any[]);
  const [correcting, setCorrecting] = useState<any>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCorrect = async () => {
    if (!correcting) return;
    setError('');
    setLoading(true);
    try {
      await api.correctScore(correcting.id, {
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
        status: 'Completed',
        outcome: Number(homeScore) > Number(awayScore) ? 'home win' : Number(awayScore) > Number(homeScore) ? 'away win' : 'draw',
        expectedVersion: correcting.version || 1,
        reason
      });
      setCorrecting(null);
      setHomeScore('');
      setAwayScore('');
      setReason('');
      fixtures.reload();
    } catch (err: any) {
      setError(err.message || 'Correction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Score Corrections</h1>
        <p className="page-subtitle">Correct scores for completed fixtures.</p>
      </div>

      <div className="filter-bar">
        <select className="form-select" style={{ maxWidth: '300px' }} value={selectedTournament || ''} onChange={e => setSelectedTournament(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Select a tournament</option>
          {tournaments.data?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {selectedTournament && (
        <Card>
          <Table
            columns={[
              { header: 'Match', accessor: (row: any) => <strong>{row.homeTeam} vs {row.awayTeam}</strong> },
              { header: 'Date', accessor: (row: any) => fmtDateTime(row.startsAt) },
              { header: 'Score', accessor: (row: any) => row.status === 'Completed' ? `${row.homeScore} - ${row.awayScore}` : '-' },
              { header: 'Status', accessor: (row: any) => <StatusPill status={row.status} /> },
              { header: 'Actions', accessor: (row: any) => <Button size="sm" onClick={() => { setCorrecting(row); setHomeScore(String(row.homeScore || 0)); setAwayScore(String(row.awayScore || 0)); }}>Correct</Button> },
            ]}
            data={fixtures.data || []}
            emptyMessage="No fixtures found for this tournament."
          />
        </Card>
      )}

      <Modal open={!!correcting} onClose={() => setCorrecting(null)} title="Correct Score" footer={
        <>
          <Button variant="secondary" onClick={() => setCorrecting(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleCorrect} loading={loading}>Save Correction</Button>
        </>
      }>
        {error && <div style={{ background: 'var(--error-light)', color: 'var(--error)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        {correcting && (
          <div>
            <p style={{ marginBottom: '1rem' }}><strong>{correcting.homeTeam}</strong> vs <strong>{correcting.awayTeam}</strong></p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <Input label={`${correcting.homeTeam} Score`} type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)} />
              <Input label={`${correcting.awayTeam} Score`} type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)} />
            </div>
            <Input label="Reason for Correction" value={reason} onChange={e => setReason(e.target.value)} required placeholder="Explain why this correction is needed" />
          </div>
        )}
      </Modal>
    </div>
  );
};
