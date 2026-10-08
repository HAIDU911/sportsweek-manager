import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { Button } from '../../components/ui/Button';

export const VerifyEmailPage: React.FC = () => {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const token = params.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!email || !token) { setStatus('error'); setMessage('Invalid verification link'); return; }
    api.verifyEmail(email, token)
      .then(res => { setStatus('success'); setMessage(res.message || 'Email verified!'); })
      .catch(err => { setStatus('error'); setMessage(err.message || 'Verification failed'); });
  }, [email, token]);

  return (
    <div style={{ maxWidth: '440px', margin: '3rem auto', padding: '0 1rem', textAlign: 'center' }}>
      <div className="card">
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Email Verification</h1>
        {status === 'loading' && <p>Verifying your email...</p>}
        {status === 'success' && <div style={{ color: 'var(--success)', marginBottom: '1rem' }}>{message}</div>}
        {status === 'error' && <div style={{ color: 'var(--error)', marginBottom: '1rem' }}>{message}</div>}
        <Link to="/login"><Button variant="primary">Go to Login</Button></Link>
      </div>
    </div>
  );
};
