import React, { useState } from 'react';
import { useLoad } from '../../hooks/useLoad';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

export const ManageTournamentsPage: React.FC = () => {
  const tournaments = useLoad(() => api.tournaments(), [] as any[]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', sportId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sports = useLoad(() => api.sports(), [] as any[]);

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      await api.createTournament({ name: form.name, sportId: Number(form.sportId) });
      setCreateOpen(false);
      setForm({ name: '', sportId: '' });
      tournaments.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this tournament?')) return;
    try {
      await api.deleteTournament(id);
      tournaments.reload();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Tournaments</h1>
          <p className="page-subtitle">Manage all tournaments.</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>+ New Tournament</Button>
      </div>

      <Card>
        <Table
          columns={[
            { header: 'Name', accessor: 'name' },
            { header: 'Sport', accessor: 'sportName' },
            { header: 'Teams', accessor: 'teamCount' },
            { header: 'Fixtures', accessor: 'fixtureCount' },
            { header: 'Status', accessor: (row: any) => <Badge variant={row.status === 'Live' ? 'success' : 'primary'}>{row.status}</Badge> },
            { header: 'Actions', accessor: (row: any) => <Button size="sm" variant="danger" onClick={() => handleDelete(row.id)}>Delete</Button> },
          ]}
          data={tournaments.data || []}
          emptyMessage="No tournaments yet."
        />
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Tournament" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} loading={loading}>Create</Button>
        </>
      }>
        {error && <div style={{ background: 'var(--error-light)', color: 'var(--error)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        <Input label="Tournament Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <Select label="Sport" value={form.sportId} onChange={e => setForm({ ...form, sportId: e.target.value })} options={sports.data?.map((s: any) => ({ value: s.id, label: s.name })) || []} placeholder="Select a sport" />
      </Modal>
    </div>
  );
};
