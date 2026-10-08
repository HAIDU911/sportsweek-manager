import React, { useState } from 'react';
import { useLoad } from '../../hooks/useLoad';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';

export const ManageSportsPage: React.FC = () => {
  const sports = useLoad(() => api.sports(), [] as any[]);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      await api.createSport({ name });
      setCreateOpen(false);
      setName('');
      sports.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to create sport');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this sport?')) return;
    try {
      await api.deleteSport(id);
      sports.reload();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Sports</h1>
          <p className="page-subtitle">Manage available sports.</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>+ New Sport</Button>
      </div>

      <Card>
        <Table
          columns={[
            { header: 'ID', accessor: 'id' },
            { header: 'Name', accessor: 'name' },
            { header: 'Actions', accessor: (row: any) => <Button size="sm" variant="danger" onClick={() => handleDelete(row.id)}>Delete</Button> },
          ]}
          data={sports.data || []}
          emptyMessage="No sports configured."
        />
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Sport" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} loading={loading}>Create</Button>
        </>
      }>
        {error && <div style={{ background: 'var(--error-light)', color: 'var(--error)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        <Input label="Sport Name" value={name} onChange={e => setName(e.target.value)} required />
      </Modal>
    </div>
  );
};
