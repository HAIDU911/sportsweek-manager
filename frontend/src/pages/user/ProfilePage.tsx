import React, { useState } from 'react';
import { api } from '../../utils/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

interface ProfilePageProps {
  session: any;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ session }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setMessage('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-title">Profile</h1>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <Card title="Account Information">
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div><strong>Email:</strong> {session?.email || 'N/A'}</div>
          <div><strong>Role:</strong> {session?.role || 'N/A'}</div>
          <div><strong>Name:</strong> {session?.user?.fullName || 'N/A'}</div>
        </div>
        </Card>
      </div>

      <Card title="Change Password">
        <form onSubmit={handleChangePassword}>
          {error && <div style={{ background: 'var(--error-light)', color: 'var(--error)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
          {message && <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>{message}</div>}
          <Input label="Current Password" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
          <Input label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
          <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
          <Button type="submit" variant="primary" loading={loading}>Change Password</Button>
        </form>
      </Card>
    </div>
  );
};
