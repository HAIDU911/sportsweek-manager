import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface LoginPageProps {
  onLogin: (session: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login({ email, password });
      onLogin({ user: res.user, token: res.token, role: res.user.role });
      const dest = res.user.role === 'Admin' ? '/admin' : res.user.role === 'Captain' ? '/captain' : res.user.role === 'Scorer' ? '/scorer' : '/';
      navigate(dest);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '3rem auto', padding: '0 1rem' }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="navbar-logo" style={{ width: 56, height: 56, fontSize: '1.5rem', margin: '0 auto 1rem' }}>SW</div>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Sign In</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>Access your SportsWeek account</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div style={{ background: 'var(--error-light)', color: 'var(--error)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Your password" />
          <Button type="submit" variant="primary" block loading={loading}>Sign In</Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem' }}>
          <Link to="/forgot-password" style={{ color: 'var(--primary)' }}>Forgot password?</Link>
          <span style={{ margin: '0 0.75rem', color: 'var(--border)' }}>|</span>
          <Link to="/register" style={{ color: 'var(--primary)' }}>Create account</Link>
        </div>
      </div>
    </div>
  );
};
