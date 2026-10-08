import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Bell, CheckCheck, CheckCircle2, Lock, ShieldCheck } from 'lucide-react'
import { api, currentSession } from './api'
import type { Notification, PublicFixture, Sport } from './types'
import { AuthPage, ErrorState, Field, Loading, Page, PageIntro, StatusPill } from './App'

function useLoad<T>(loader: () => Promise<T>, initial: T) {
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = () => { setLoading(true); setError(''); loader().then(setData).catch(e => setError(e instanceof Error ? e.message : 'Unable to load this view')).finally(() => setLoading(false)) }
  useEffect(reload, [])
  return { data, loading, error, reload }
}
const fmtDay = (value?: string) => value ? new Intl.DateTimeFormat('en', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(value)) : 'Date to be announced'
const fmtTime = (value?: string) => value ? new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'TBA'

export function SchedulePage() {
  const sports = useLoad(api.publicSports, [])
  const [mode, setMode] = useState<'upcoming' | 'results'>('upcoming')
  const [sportId, setSportId] = useState<number | undefined>()
  const board = useLoad(() => api.publicFixturesBoard({ filter: mode, sportId, limit: 150 }), [] as PublicFixture[])
  useEffect(() => { board.reload() }, [mode, sportId])
  const days = useMemo(() => {
    const grouped = new Map<string, PublicFixture[]>()
    board.data.forEach(fixture => { const key = fixture.startsAt ? new Date(fixture.startsAt).toDateString() : 'Unscheduled'; const list = grouped.get(key) || []; list.push(fixture); grouped.set(key, list) })
    return [...grouped.entries()]
  }, [board.data])
  return <Page>
    <PageIntro eyebrow="MATCH CALENDAR" title="Full schedule" text="Every confirmed kick-off across the SportsWeek programme, straight from the official desk." action={<div className="admin-tabs"><button className={mode === 'upcoming' ? 'active' : ''} onClick={() => setMode('upcoming')}>Upcoming</button><button className={mode === 'results' ? 'active' : ''} onClick={() => setMode('results')}>Results</button></div>} />
    <div className="sport-filter" aria-label="Filter by sport"><button className={!sportId ? 'active' : ''} onClick={() => setSportId(undefined)}>All sports</button>{sports.data.map((s: Sport) => <button className={sportId === s.id ? 'active' : ''} key={s.id} onClick={() => setSportId(s.id)}>{s.name}</button>)}</div>
    {board.loading ? <Loading text="Loading the fixture board…" /> : board.error ? <ErrorState message={board.error} retry={board.reload} /> : days.length ? <div className="fixture-stack">{days.map(([key, fixtures]) => <div className="round-group" key={key}><div className="round-head"><strong>{key === 'Unscheduled' ? 'Awaiting scheduling' : fmtDay(fixtures[0].startsAt)}</strong><span>{fixtures.length} match{fixtures.length === 1 ? '' : 'es'}</span></div>{fixtures.map(fixture => <ScheduleRow key={fixture.id} fixture={fixture} />)}</div>)}</div> : <div className="empty">{mode === 'upcoming' ? 'No upcoming fixtures are scheduled yet — brackets appear here as soon as the admin desk publishes them.' : 'No results have been recorded yet. Check back once matches are played.'}</div>}
  </Page>
}
function ScheduleRow({ fixture }: { fixture: PublicFixture }) {
  const resolved = ['Completed', 'Walkover', 'DoubleForfeit', 'Abandoned'].includes(fixture.status)
  return <div className="fixture-row">
    <div className="fixture-time"><strong>{fmtTime(fixture.startsAt)}</strong><small>{fixture.venue || 'Venue TBA'}</small></div>
    <div className="fixture-teams"><strong className={fixture.homeTeam ? '' : 'placeholder'}>{fixture.homeTeam || `Winner M${2 * fixture.slot - 1}`}</strong><span>vs</span><strong className={fixture.awayTeam ? '' : 'placeholder'}>{fixture.awayTeam || (fixture.roundNo > 1 ? `Winner M${2 * fixture.slot}` : 'TBD')}</strong><Link className="link-arrow" to={`/tournaments/${fixture.tournamentId}`} style={{ marginLeft: 10, fontSize: 9 }}>{fixture.sportName} · {fixture.tournamentName} <ArrowRight size={12} /></Link></div>
    <div className="fixture-state"><StatusPill status={fixture.status} />{resolved && <b>{fixture.homeScore ?? '–'} — {fixture.awayScore ?? '–'}</b>}</div>
  </div>
}

export function NotificationsPage() {
  const session = currentSession()
  const notifications = useLoad(api.notifications, [] as Notification[])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!session) return <Page><PageIntro eyebrow="PRIVATE" title="Notifications" text="Sign in to see your match reminders and review updates." /><Link className="button primary" to="/login">Go to sign in <ArrowRight size={16} /></Link></Page>
  const unread = notifications.data.filter(n => !n.read).length
  const markAll = async () => { setBusy(true); setError(''); try { await api.notificationsReadAll(); notifications.reload() } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update notifications') } finally { setBusy(false) } }
  const markOne = async (n: Notification) => { if (n.read) return; try { await api.notificationRead(n.id); notifications.reload() } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update the notification') } }
  return <Page>
    <PageIntro eyebrow="PRIVATE DESK" title="Notifications" text="Team approvals, schedule changes, and official results land here instantly." action={<button className="button tiny ghost" disabled={busy || !unread} onClick={markAll}><CheckCheck size={14} /> {unread ? `Mark all read (${unread})` : 'All caught up'}</button>} />
    {error && <div className="form-alert">{error}</div>}
    <div className="workspace-card">
      {notifications.loading ? <Loading text="Loading your notifications…" /> : notifications.error ? <ErrorState message={notifications.error} retry={notifications.reload} /> : notifications.data.length ? notifications.data.map(n => <div className={`notification-row ${n.read ? '' : 'unread'}`} key={n.id}><Bell size={16} /><div><strong>{n.title}</strong><p>{n.body}</p><small>{new Date(n.createdAt).toLocaleString()}</small>{!n.read && <button className="button tiny ghost" onClick={() => markOne(n)}>Mark read</button>}</div></div>) : <div className="empty compact">Nothing here yet — approvals, schedules, and results will appear as they happen.</div>}
    </div>
  </Page>
}

export function ProfilePage() {
  const session = currentSession()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (!session) return <Page><PageIntro eyebrow="PRIVATE" title="My profile" text="Sign in to manage your account details and password." /><Link className="button primary" to="/login">Go to sign in <ArrowRight size={16} /></Link></Page>
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage(''); setError('')
    if (form.newPassword.length < 8) { setError('New password must be at least 8 characters.'); return }
    if (form.newPassword !== form.confirm) { setError('New password and confirmation do not match.'); return }
    setBusy(true)
    try { const result = await api.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }); setMessage(result.message); setForm({ currentPassword: '', newPassword: '', confirm: '' }) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to change the password') } finally { setBusy(false) }
  }
  return <Page>
    <PageIntro eyebrow="PRIVATE DESK" title="My profile" text="Your account identity and the password you use at the SportsWeek desk." />
    <div className="workspace-grid">
      <div className="workspace-card">
        <div className="section-heading"><div><div className="eyebrow">ACCOUNT</div><h2>{session.user.name}</h2></div><span className="pill lime"><span className="pill-dot" />{session.user.role}</span></div>
        <div className="admin-row"><div><strong>Gmail address</strong><small>{session.user.email}</small></div><ShieldCheck size={16} /></div>
        <div className="admin-row"><div><strong>Department</strong><small>{session.user.department} · Semester {session.user.semester} · Section {session.user.section}</small></div></div>
        <div className="admin-row"><div><strong>Enrollment no.</strong><small>{session.user.enrollmentNo}</small></div></div>
        <div className="admin-row"><div><strong>Email verified</strong><small>{session.user.emailVerified ? 'Verified — you can register teams and receive match alerts.' : 'Not verified — check your inbox for the verification link.'}</small></div><span className={`pill ${session.user.emailVerified ? 'lime' : 'orange'}`}><span className="pill-dot" />{session.user.emailVerified ? 'Verified' : 'Pending'}</span></div>
      </div>
      <div className="workspace-card">
        <div className="section-heading"><div><div className="eyebrow">SECURITY</div><h2>Change password</h2><p>Choose a new password you do not use anywhere else.</p></div></div>
        <form className="form-stack" onSubmit={submit}>
          <Field label="Current password" type="password" value={form.currentPassword} onChange={v => setForm({ ...form, currentPassword: v })} required />
          <Field label="New password" type="password" value={form.newPassword} onChange={v => setForm({ ...form, newPassword: v })} placeholder="At least 8 characters" required />
          <Field label="Confirm new password" type="password" value={form.confirm} onChange={v => setForm({ ...form, confirm: v })} required />
          {error && <div className="form-alert">{error}</div>}
          {message && <div className="success-note">{message}</div>}
          <button className="button primary full" disabled={busy}>{busy ? 'Updating…' : 'Update password'} <Lock size={15} /></button>
        </form>
      </div>
    </div>
  </Page>
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage(''); setError(''); setBusy(true)
    try { const result = await api.forgotPassword({ email }); setMessage(result.message) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to request a reset link') } finally { setBusy(false) }
  }
  return <AuthPage eyebrow="ACCOUNT RECOVERY" title="Reset your password" text="We will email a secure reset link to your registered Gmail address. It expires after one hour.">
    {message ? <div className="success-panel"><CheckCircle2 size={30} /><h3>Check your inbox</h3><p>{message}</p><Link className="button primary" to="/login">Back to sign in</Link></div> :
      <form className="form-stack" onSubmit={submit}>
        <Field label="Gmail address" type="email" value={email} onChange={setEmail} placeholder="you@gmail.com" required />
        {error && <div className="form-alert">{error}</div>}
        <button className="button primary full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'} <ArrowRight size={16} /></button>
        <p className="form-foot">Remembered it after all? <Link to="/login">Back to sign in</Link></p>
      </form>}
  </AuthPage>
}

export function ResetPasswordPage() {
  const params = new URLSearchParams(useLocation().search)
  const email = params.get('email') || ''
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const invalidLink = !email || !token
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage(''); setError('')
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (form.password !== form.confirm) { setError('Password and confirmation do not match.'); return }
    setBusy(true)
    try { const result = await api.resetPassword({ email, token, password: form.password }); setMessage(result.message) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to reset the password') } finally { setBusy(false) }
  }
  return <AuthPage eyebrow="ACCOUNT RECOVERY" title="Choose a new password" text="Pick a strong password — at least 8 characters and different from your old one.">
    {invalidLink ? <div className="success-panel attempt-failed"><AlertTriangle size={30} /><h3>This reset link is incomplete.</h3><p>Open the link from your reset email exactly as it was sent, or request a new one.</p><Link className="button primary" to="/forgot-password">Request a new link</Link></div> :
      message ? <div className="success-panel"><CheckCircle2 size={30} /><h3>Password updated</h3><p>{message}</p><button className="button primary" onClick={() => navigate('/login')}>Continue to sign in <ArrowRight size={16} /></button></div> :
        <form className="form-stack" onSubmit={submit}>
          <Field label="Gmail address" value={email} onChange={() => {}} disabled />
          <Field label="New password" type="password" value={form.password} onChange={v => setForm({ ...form, password: v })} placeholder="At least 8 characters" required />
          <Field label="Confirm new password" type="password" value={form.confirm} onChange={v => setForm({ ...form, confirm: v })} required />
          {error && <div className="form-alert">{error}</div>}
          <button className="button primary full" disabled={busy}>{busy ? 'Saving…' : 'Set new password'} <Lock size={15} /></button>
        </form>}
  </AuthPage>
}
