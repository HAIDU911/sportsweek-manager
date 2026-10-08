import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, RefreshCw, ShieldCheck, UserPlus, X } from 'lucide-react'
import { api } from './api'
import type { AuthSession, DashboardData, Fixture, Notification, Team, Tournament, UserSearchResult } from './types'

type LoadState<T> = { data: T; loading: boolean; error: string; reload: () => void }
function useLoad<T>(loader: () => Promise<T>, initial: T): LoadState<T> {
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = () => { setLoading(true); setError(''); loader().then(setData).catch(e => setError(e instanceof Error ? e.message : 'Unable to load this view')).finally(() => setLoading(false)) }
  useEffect(reload, [])
  return { data, loading, error, reload }
}
function Page({ children }: { children: React.ReactNode }) { return <div className="page">{children}</div> }
function Intro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{text}</p></div></div> }
function Field({ label, value, onChange, type = 'text', placeholder, required, disabled, min }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; disabled?: boolean; min?: string }) { return <label className="field"><span>{label}</span><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} disabled={disabled} min={min} /></label> }
function SelectField({ label, value, onChange, children, disabled }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean }) { return <label className="field"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>{children}</select></label> }
function Feedback({ error, message }: { error?: string; message?: string }) { if (!error && !message) return null; return <div className={error ? 'form-alert' : 'success-note'}>{error || message}</div> }
function statusClass(status?: string) { return `pill ${status === 'Approved' ? 'lime' : status === 'Rejected' || status === 'Withdrawn' ? 'orange' : 'muted'}` }
const errText = (e: unknown, fallback: string) => e instanceof Error ? e.message : fallback
const splitList = (value: string) => value.split(',').map(v => v.trim()).filter(Boolean)
const isResolved = (status?: string) => status === 'Completed' || status === 'Walkover' || status === 'DoubleForfeit' || status === 'Abandoned'
const RESOLVED_STATUSES = ['Completed', 'Walkover', 'DoubleForfeit', 'Abandoned']

function RosterPicker({ tournamentId, captainId, players, onChange, disabled }: { tournamentId?: number; captainId: number; players: UserSearchResult[]; onChange: (next: UserSearchResult[]) => void; disabled?: boolean }) {
  const [term, setTerm] = useState(''); const [results, setResults] = useState<UserSearchResult[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const search = async () => {
    if (term.trim().length < 2) { setError('Type at least two characters of a name or enrollment number.'); return }
    setBusy(true); setError('')
    try { const found = await api.userSearch(term.trim(), tournamentId); setResults(found.filter(u => u.id !== captainId && !players.some(p => p.id === u.id))) }
    catch (e) { setError(errText(e, 'Search failed')) } finally { setBusy(false) }
  }
  const add = (u: UserSearchResult) => { onChange([...players, u]); setResults(results.filter(r => r.id !== u.id)) }
  const remove = (id: number) => onChange(players.filter(p => p.id !== id))
  return <div className="roster-builder">
    <span className="field-hint" style={{ fontSize: 10, color: '#8a7f71', textTransform: 'uppercase', letterSpacing: 1 }}>Team roster</span>
    <div className="search-row"><input value={term} onChange={e => setTerm(e.target.value)} placeholder="Search teammate by name or enrollment no." disabled={disabled} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search() } }} /><button type="button" className="button tiny ghost" onClick={search} disabled={busy || disabled}>{busy ? 'Searching…' : 'Search'}</button></div>
    {error && <div className="form-alert">{error}</div>}
    {results.length > 0 && <div className="search-results">{results.map(u => <div className="search-result" key={u.id}><span><strong>{u.name}</strong> · {u.department} · {u.enrollmentNo} · Sec {u.section}</span><button type="button" className="button tiny primary" onClick={() => add(u)}><UserPlus size={12} /> Add</button></div>)}</div>}
    <div className="chips">{players.length ? players.map(p => <span className="chip" key={p.id}>{p.name}<button type="button" className="chip-x" onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`}><X size={11} /></button></span>) : <span className="field-hint">No additional players yet — you play as captain automatically.</span>}</div>
    <span className="field-hint">Only verified SportsWeek accounts can be added. One player cannot join two teams in the same tournament.</span>
  </div>
}

export function CaptainWorkspace({ session }: { session: AuthSession }) {
  const tournaments = useLoad(api.publicTournaments, [])
  const teams = useLoad(api.captainTeams, [])
  const fixtures = useLoad(api.captainFixtures, [])
  const notifications = useLoad(api.notifications, [])
  const openTournaments = tournaments.data.filter(t => t.registrationOpen)
  const [form, setForm] = useState({ tournamentId: '', name: '', captainPhone: '', section: session.user.section === 'B' ? 'B' : 'A' })
  const [players, setPlayers] = useState<UserSearchResult[]>([])
  const [editing, setEditing] = useState<null | { id: number; name: string; captainPhone: string; section: string; players: UserSearchResult[] }>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [resendPassword, setResendPassword] = useState('')
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const verified = session.user.emailVerified
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage(''); setError('')
    if (!form.tournamentId) { setError('Select an open tournament first.'); return }
    try {
      await api.registerTeam(Number(form.tournamentId), { name: form.name, section: form.section, captainPhone: form.captainPhone, playerIds: players.map(p => p.id) })
      setMessage('Team registration submitted for admin approval. Reviewers were notified.')
      setForm({ ...form, name: '', captainPhone: '' }); setPlayers([]); teams.reload()
    } catch (e) { setError(errText(e, 'Unable to submit registration')) }
  }
  const saveEdit = async () => {
    if (!editing) return; setMessage(''); setError('')
    try {
      await api.editTeam(editing.id, { name: editing.name, captainPhone: editing.captainPhone, section: editing.section, playerIds: editing.players.map(p => p.id) })
      setMessage('Registration updated and resubmitted for review.'); setEditing(null); teams.reload()
    } catch (e) { setError(errText(e, 'Unable to update registration')) }
  }
  const resend = async () => {
    if (resending || cooldown > 0) return
    setResending(true); setMessage(''); setError('')
    try {
      const result = await api.resendVerification({ email: session.user.email, password: resendPassword })
      setMessage(result.message); setResendPassword(''); setCooldown(60)
      const timer = window.setInterval(() => setCooldown(value => { if (value <= 1) { window.clearInterval(timer); return 0 } return value - 1 }), 1000)
    } catch (e) { setError(errText(e, 'Unable to resend the verification email')) } finally { setResending(false) }
  }
  const readOne = async (n: Notification) => { if (n.read) return; try { await api.notificationRead(n.id); notifications.reload() } catch { /* keep the row visible */ } }
  return <Page>
    <Intro eyebrow="CAPTAIN DESK" title={`Good to see you, ${session.user.name.split(' ')[0]}.`} text={verified ? 'Your verified Gmail keeps team updates and match results moving.' : 'Verify your Gmail address before registering a team.'} />
    <Feedback error={error} message={message} />
    <div className="workspace-grid">
      <div className="workspace-card">
        <div className="section-heading"><div><div className="eyebrow">REGISTER A TEAM</div><h2>Enter the competition</h2></div></div>
        {!verified && <div className="form-alert">Email verification is required before team registration.<div className="search-row"><input type="password" value={resendPassword} onChange={e => setResendPassword(e.target.value)} placeholder="Your password (to resend the link)" /><button className="button tiny ghost" onClick={resend} disabled={resending || cooldown > 0}>{resending ? 'Sending…' : cooldown ? `Resend in ${cooldown}s` : 'Resend verification'}</button></div></div>}
        <form className="form-stack" onSubmit={submit}>
          <SelectField label="Tournament" value={form.tournamentId} onChange={v => setForm({ ...form, tournamentId: v })} disabled={!verified}><option value="">Select open tournament</option>{openTournaments.map(t => <option key={t.id} value={t.id}>{t.name} · {t.sportName}</option>)}</SelectField>
          <Field label="Team name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="The Strikers" required />
          <div className="form-grid">
            <Field label="Captain phone" value={form.captainPhone} onChange={v => setForm({ ...form, captainPhone: v })} placeholder="03xx-xxxxxxx" required />
            <SelectField label="Section" value={form.section} onChange={v => setForm({ ...form, section: v })}><option value="A">A</option><option value="B">B</option></SelectField>
          </div>
          <RosterPicker tournamentId={form.tournamentId ? Number(form.tournamentId) : undefined} captainId={session.user.id} players={players} onChange={setPlayers} disabled={!verified} />
          <button className="button primary full" disabled={!verified}>{verified ? 'Submit registration' : 'Verify Gmail first'} <ArrowRight size={16} /></button>
        </form>
      </div>
      <div className="workspace-card">
        <div className="section-heading"><div><div className="eyebrow">MY REGISTRATIONS</div><h2>Team status</h2></div><button className="icon-button" onClick={teams.reload} aria-label="Refresh team status"><RefreshCw size={16} /></button></div>
        {teams.loading ? <div className="loading">Loading registrations…</div> : teams.error ? <Feedback error={teams.error} /> : teams.data.length ? teams.data.map(team => <div className="notification-row" key={team.id}><ShieldCheck size={16} /><div>
          <strong>{team.name}</strong>
          <p>{team.tournamentName} · {team.sportName} · Section {team.section}</p>
          <span className={statusClass(team.status)}><span className="pill-dot" />{team.status}</span>
          {team.reviewReason && <small>Reviewer note: {team.reviewReason}</small>}
          {team.players && team.players.length > 0 && <div className="chips">{team.players.map(p => <span className="chip muted-chip" key={p.userId}>{p.name}</span>)}</div>}
          {(team.status === 'Pending' || team.status === 'Rejected') && !editing && <button className="button tiny ghost" onClick={() => setEditing({ id: team.id, name: team.name, captainPhone: team.captainPhone || '', section: team.section, players: (team.players || []).map(p => ({ id: p.userId, name: p.name, department: p.department, enrollmentNo: '', section: p.section })) })}>Edit & resubmit</button>}
        </div></div>) : <div className="empty compact">No team registrations yet.</div>}
        {editing && <div className="roster-builder" style={{ marginTop: 16 }}>
          <span className="field-hint" style={{ fontSize: 10, color: '#8a7f71', textTransform: 'uppercase', letterSpacing: 1 }}>Edit registration #{editing.id}</span>
          <Field label="Team name" value={editing.name} onChange={v => setEditing({ ...editing, name: v })} />
          <div className="form-grid">
            <Field label="Captain phone" value={editing.captainPhone} onChange={v => setEditing({ ...editing, captainPhone: v })} />
            <SelectField label="Section" value={editing.section} onChange={v => setEditing({ ...editing, section: v })}><option value="A">A</option><option value="B">B</option></SelectField>
          </div>
          <RosterPicker captainId={session.user.id} players={editing.players} onChange={next => setEditing({ ...editing, players: next })} />
          <div className="search-row"><button className="button tiny primary" onClick={saveEdit}>Save & resubmit</button><button className="button tiny ghost" onClick={() => setEditing(null)}>Cancel</button></div>
        </div>}
      </div>
      <div className="workspace-card">
        <div className="section-heading"><div><div className="eyebrow">MY FIXTURES</div><h2>Upcoming and results</h2></div><button className="icon-button" onClick={fixtures.reload} aria-label="Refresh fixtures"><RefreshCw size={16} /></button></div>
        {fixtures.loading ? <div className="loading">Loading fixtures…</div> : fixtures.error ? <Feedback error={fixtures.error} /> : fixtures.data.length ? fixtures.data.map(f => <CaptainFixture key={f.id} fixture={f} />) : <div className="empty compact">Your fixtures will appear after your team is approved and scheduled.</div>}
      </div>
      <div className="workspace-card">
        <div className="section-heading"><div><div className="eyebrow">PRIVATE UPDATES</div><h2>Notifications</h2></div><button className="icon-button" onClick={notifications.reload} aria-label="Refresh notifications"><RefreshCw size={16} /></button></div>
        {notifications.loading ? <div className="loading">Loading notifications…</div> : notifications.data.length ? notifications.data.slice(0, 10).map(n => <div className={`notification-row ${n.read ? '' : 'unread'}`} key={n.id}><Bell size={16} /><div><strong>{n.title}</strong><p>{n.body}</p><small>{new Date(n.createdAt).toLocaleString()}</small>{!n.read && <button className="button tiny ghost" onClick={() => readOne(n)}>Mark read</button>}</div></div>) : <div className="empty compact">Match reminders and result notifications will appear here.</div>}
      </div>
    </div>
  </Page>
}

function CaptainFixture({ fixture }: { fixture: Fixture }) {
  const resolved = isResolved(fixture.status)
  const opponent = fixture.myTeamId != null && fixture.myTeamId === fixture.homeTeamId ? fixture.awayTeam : fixture.myTeamId === fixture.awayTeamId ? fixture.homeTeam : null
  const result = resolved ? (fixture.winnerTeamId == null ? 'No result' : fixture.winnerTeamId === fixture.myTeamId ? 'Won' : 'Lost') : null
  const tone = result === 'Won' ? 'lime' : result === 'Lost' ? 'orange' : 'muted'
  return <div className="notification-row"><CheckCircle2 size={16} /><div>
    <strong>vs {opponent || 'Opponent TBD'} {result && <span className={`pill ${tone}`}><span className="pill-dot" />{result}</span>}</strong>
    <p>{fixture.tournamentName} · Round {fixture.roundNo} · {fixture.startsAt ? new Date(fixture.startsAt).toLocaleString() : 'Time TBA'} · {fixture.venue || 'Venue TBA'}</p>
    <small>{fixture.status}{resolved ? ` · ${fixture.homeScore ?? '–'} — ${fixture.awayScore ?? '–'}` : ''}</small>
  </div></div>
}

export function AdminWorkspace({ session }: { session: AuthSession }) {
  const tournaments = useLoad(api.tournaments, [])
  const sports = useLoad(api.sports, [])
  const dashboard = useLoad(api.adminDashboard, undefined as DashboardData | undefined)
  const audit = useLoad(api.audit, [])
  const [teamTab, setTeamTab] = useState('Pending')
  const teams = useLoad(() => api.adminTeams(teamTab), [])
  useEffect(() => { teams.reload() }, [teamTab])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const clear = () => { setMessage(''); setError('') }
  const [selected, setSelected] = useState<Tournament | null>(null)
  const [approvedTeams, setApprovedTeams] = useState<Team[]>([])
  const [withdrawId, setWithdrawId] = useState('')
  const [preview, setPreview] = useState<{ tournamentVersion: number; withdrawnTeamId: number; withdrawnTeamName: string; preservedWinnerNames: string[]; neverPlayedNames: string[]; excludedTeamNames: string[]; completedFixtureCount: number; newFixtureCount: number } | null>(null)
  useEffect(() => { if (selected) api.adminTeams('Approved', selected.id).then(setApprovedTeams).catch(e => setError(errText(e, 'Unable to load approved teams'))) }, [selected])
  const [sportName, setSportName] = useState('')
  const [sportEditId, setSportEditId] = useState<number | null>(null)
  const blankCreate = { name: '', sportId: '', startAt: '', endAt: '', thirdPlace: 'No', matchStartTime: '', matchEndTime: '', dates: '', venues: '' }
  const [create, setCreate] = useState(blankCreate)
  const [tournamentEdit, setTournamentEdit] = useState<null | { id: number; name: string; status: string; registrationOpen: boolean; thirdPlace: boolean; matchStartTime: string; matchEndTime: string; dates: string; venues: string }>(null)
  const [auto, setAuto] = useState({ tournamentId: '', start: '', end: '', dates: '', venues: '', duration: '' })
  const [correction, setCorrection] = useState<{ tournamentId: string; loading: boolean; fixtures: Fixture[]; forms: Record<number, { home: string; away: string; status: string; reason: string }> }>({ tournamentId: '', loading: false, fixtures: [], forms: {} })
  const review = async (team: Team, approve: boolean) => { setBusy(true); clear(); try { if (approve) await api.approveTeam(team.id); else await api.rejectTeam(team.id, 'Please correct the registration details and contact the sports committee.'); setMessage(`${team.name} ${approve ? 'approved' : 'rejected'}. The captain was notified.`); teams.reload(); dashboard.reload() } catch (e) { setError(errText(e, 'Review failed')) } finally { setBusy(false) } }
  const saveSport = async () => { if (!sportName.trim()) return; setBusy(true); clear(); try { if (sportEditId) await api.updateSport(sportEditId, { name: sportName }); else await api.createSport({ name: sportName }); setMessage(sportEditId ? 'Sport updated.' : 'Sport created.'); setSportName(''); setSportEditId(null); sports.reload(); dashboard.reload() } catch (e) { setError(errText(e, 'Sport save failed')) } finally { setBusy(false) } }
  const deleteSport = async (id: number, name: string) => { if (!window.confirm(`Delete sport “${name}”? This is only possible when no tournaments reference it.`)) return; setBusy(true); clear(); try { await api.deleteSport(id); setMessage('Sport deleted.'); sports.reload() } catch (e) { setError(errText(e, 'Sport delete failed')) } finally { setBusy(false) } }
  const createTournament = async () => { if (!create.name.trim() || !create.sportId) { setError('Tournament name and sport are required.'); return } setBusy(true); clear(); try { await api.createTournament({ name: create.name.trim(), sportId: Number(create.sportId), startAt: create.startAt ? new Date(create.startAt).toISOString() : null, endAt: create.endAt ? new Date(create.endAt).toISOString() : null, thirdPlace: create.thirdPlace === 'Yes', matchStartTime: create.matchStartTime || null, matchEndTime: create.matchEndTime || null, availableDates: splitList(create.dates), venueIds: splitList(create.venues) }); setMessage('Tournament created. Open registration, collect teams, then generate fixtures.'); setCreate(blankCreate); tournaments.reload(); dashboard.reload() } catch (e) { setError(errText(e, 'Tournament creation failed')) } finally { setBusy(false) } }
  const saveTournament = async () => { if (!tournamentEdit) return; const original = tournaments.data.find(t => t.id === tournamentEdit.id); if (!original) return; setBusy(true); clear(); try { await api.updateTournament(tournamentEdit.id, { sportId: original.sportId, name: tournamentEdit.name, status: tournamentEdit.status, registrationOpen: tournamentEdit.registrationOpen, thirdPlace: tournamentEdit.thirdPlace, matchStartTime: tournamentEdit.matchStartTime, matchEndTime: tournamentEdit.matchEndTime, availableDates: splitList(tournamentEdit.dates), venueIds: splitList(tournamentEdit.venues) }); setMessage('Tournament settings updated.'); setTournamentEdit(null); tournaments.reload() } catch (e) { setError(errText(e, 'Tournament update failed')) } finally { setBusy(false) } }
  const deleteTournament = async (t: Tournament) => { if (!window.confirm(`Delete tournament “${t.name}”? Allowed only before teams or fixtures exist.`)) return; setBusy(true); clear(); try { await api.deleteTournament(t.id); setMessage('Tournament deleted.'); tournaments.reload(); dashboard.reload() } catch (e) { setError(errText(e, 'Tournament delete failed')) } finally { setBusy(false) } }
  const generate = async (id: number) => { setBusy(true); clear(); try { const result = await api.generateFixtures(id); setMessage(`Generated ${result.fixtureCount} fixtures. Byes were advanced automatically — set times from the auto-scheduler.`); tournaments.reload(); dashboard.reload() } catch (e) { setError(errText(e, 'Fixture generation failed')) } finally { setBusy(false) } }
  const pickAutoTournament = (id: string) => { const t = tournaments.data.find(x => String(x.id) === id); const day = t?.startAt ? t.startAt.slice(0, 10) : ''; setAuto({ tournamentId: id, start: t?.matchStartTime && day ? `${day}T${t.matchStartTime}` : auto.start, end: t?.matchEndTime && day ? `${day}T${t.matchEndTime}` : auto.end, dates: t?.availableDates?.length ? t.availableDates.join(', ') : auto.dates, venues: t?.venueIds?.length ? t.venueIds.join(', ') : auto.venues, duration: auto.duration }) }
  const runAutoSchedule = async () => { const id = Number(auto.tournamentId); if (!id || !auto.start || !auto.end || !splitList(auto.dates).length || !splitList(auto.venues).length) { setError('Auto-schedule needs a tournament, start/end times, at least one date, and at least one venue.'); return } setBusy(true); clear(); try { const result = await api.autoSchedule(id, { matchStartTime: new Date(auto.start).toISOString(), matchEndTime: new Date(auto.end).toISOString(), availableDates: splitList(auto.dates), venues: splitList(auto.venues), durationMinutes: auto.duration ? Number(auto.duration) : null }); setMessage(`Auto-scheduled ${result.scheduled} fixtures (${result.durationMinutes} minutes per match). Captains were notified by email.`); tournaments.reload() } catch (e) { setError(errText(e, 'Auto-schedule failed')) } finally { setBusy(false) } }
  const loadCorrections = async (id: string) => { if (!id) { setCorrection({ tournamentId: '', loading: false, fixtures: [], forms: {} }); return } setCorrection(prev => ({ ...prev, tournamentId: id, loading: true, fixtures: [] })); try { const list = await api.fixtures(Number(id)); setCorrection({ tournamentId: id, loading: false, fixtures: list, forms: {} }) } catch (e) { setError(errText(e, 'Unable to load fixtures')); setCorrection({ tournamentId: id, loading: false, fixtures: [], forms: {} }) } }
  const saveCorrection = async (f: Fixture) => { const form = correction.forms[f.id]; if (!form) return; const home = Number(form.home); const away = Number(form.away); if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) { setError('Enter non-negative whole-number scores.'); return } if ((form.status === 'Completed' || form.status === 'Walkover') && home === away) { setError('A knockout match needs a decisive score. Use Double forfeit or Abandoned when there is no result.'); return } setBusy(true); clear(); try { const outcome = form.status === 'Completed' || form.status === 'Walkover' ? (home > away ? 'home win' : 'away win') : 'no result'; await api.correctScore(f.id, { homeScore: home, awayScore: away, status: form.status, outcome, expectedVersion: f.version ?? 1, reason: form.reason || 'Score correction' }); setMessage('Score corrected. The downstream bracket was refreshed and captains were emailed.'); await loadCorrections(correction.tournamentId) } catch (e) { setError(errText(e, 'Correction failed')) } finally { setBusy(false) } }
  const loadPreview = async () => { if (!selected || !withdrawId) return; setBusy(true); clear(); try { setPreview(await api.regenerationPreview(selected.id, Number(withdrawId))) } catch (e) { setError(errText(e, 'Preview unavailable')) } finally { setBusy(false) } }
  const regenerate = async () => { if (!selected || !preview || !window.confirm(`Withdraw ${preview.withdrawnTeamName} and preserve all completed history?`)) return; setBusy(true); clear(); try { const result = await api.regenerateFixtures(selected.id, { withdrawTeamId: Number(withdrawId), expectedVersion: preview.tournamentVersion }); setMessage(result.message); setPreview(null); setWithdrawId(''); tournaments.reload(); dashboard.reload(); audit.reload() } catch (e) { setError(errText(e, 'Regeneration failed')) } finally { setBusy(false) } }
  const resolvedFixtures = correction.fixtures.filter(f => isResolved(f.status))
  return <Page>
    <Intro eyebrow="ADMIN DESK" title="Run the tournament cleanly." text={`Signed in as ${session.user.name}. Control the live event without losing history.`} />
    <div className="stats-grid admin-metrics">{dashboard.data && [['Teams', dashboard.data.totalTeams], ['Approved', dashboard.data.approvedTeams], ['Pending', dashboard.data.pendingTeams], ['Fixtures', dashboard.data.fixtures], ['Completed', dashboard.data.completedFixtures], ['Tournaments', dashboard.data.tournaments]].map(([label, value]) => <div className="metric-card" key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <Feedback error={error} message={message} />
    <div className="admin-grid">
      <div className="workspace-card"><div className="section-heading"><div><div className="eyebrow">CREATE TOURNAMENT</div><h2>Open a new event</h2></div></div><div className="form-stack"><div className="form-grid"><Field label="Name" value={create.name} onChange={v => setCreate({ ...create, name: v })} placeholder="Futsal Open 2026" /><SelectField label="Sport" value={create.sportId} onChange={v => setCreate({ ...create, sportId: v })}><option value="">Select sport</option>{sports.data.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</SelectField></div><div className="form-grid"><Field label="Starts" type="date" value={create.startAt} onChange={v => setCreate({ ...create, startAt: v })} /><Field label="Ends" type="date" value={create.endAt} onChange={v => setCreate({ ...create, endAt: v })} /></div><div className="form-grid"><Field label="Match window start" type="time" value={create.matchStartTime} onChange={v => setCreate({ ...create, matchStartTime: v })} /><Field label="Match window end" type="time" value={create.matchEndTime} onChange={v => setCreate({ ...create, matchEndTime: v })} /></div><div className="form-grid"><SelectField label="Third-place playoff" value={create.thirdPlace} onChange={v => setCreate({ ...create, thirdPlace: v })}><option value="No">No</option><option value="Yes">Yes</option></SelectField><SelectField label="Registration" value="Open" onChange={() => {}} disabled><option value="Open">Open (default)</option></SelectField></div><Field label="Available dates (comma separated)" value={create.dates} onChange={v => setCreate({ ...create, dates: v })} placeholder="2026-10-12, 2026-10-13" /><Field label="Venues (comma separated)" value={create.venues} onChange={v => setCreate({ ...create, venues: v })} placeholder="Main Arena, Court B" /><button className="button primary full" disabled={busy} onClick={createTournament}>Create tournament <ArrowRight size={15} /></button></div></div>
      <div className="workspace-card"><div className="section-heading"><div><div className="eyebrow">SPORTS CATALOG</div><h2>Manage sports</h2></div><button className="icon-button" onClick={sports.reload} aria-label="Refresh sports"><RefreshCw size={16} /></button></div><div className="form-grid"><Field label="Sport name" value={sportName} onChange={setSportName} placeholder="Futsal" /><button className="button tiny primary" disabled={busy || !sportName.trim()} onClick={saveSport}>{sportEditId ? 'Update sport' : 'Create sport'}</button></div>{sports.data.map(s => <div className="admin-row" key={s.id}><div><strong>{s.name}</strong><small>ID {s.id} · {s.tournamentCount ?? 0} tournament{(s.tournamentCount ?? 0) === 1 ? '' : 's'}</small></div><div className="toolbar"><button className="button tiny ghost" onClick={() => { setSportEditId(s.id); setSportName(s.name) }}>Edit</button><button className="button tiny ghost" disabled={busy} onClick={() => deleteSport(s.id, s.name)}>Delete</button></div></div>)}</div>
      <div className="workspace-card"><div className="section-heading"><div><div className="eyebrow">TEAM DIRECTORY</div><h2>Registrations</h2></div><button className="icon-button" onClick={teams.reload} aria-label="Refresh teams"><RefreshCw size={16} /></button></div><div className="admin-tabs">{['Pending', 'Approved', 'Rejected', 'Withdrawn'].map(tab => <button key={tab} className={teamTab === tab ? 'active' : ''} onClick={() => setTeamTab(tab)}>{tab}</button>)}</div>{teams.loading ? <div className="loading">Loading registrations…</div> : teams.data.length ? teams.data.map(team => <div className="admin-row" key={team.id}><div><strong>{team.name}</strong><small>{team.tournamentName} · {team.department} · Section {team.section} · {team.playerCount ?? 0} player{(team.playerCount ?? 0) === 1 ? '' : 's'}</small><small>Captain: {team.captainName} · {team.captainEmail} · {team.captainPhone}</small>{team.reviewReason && <small>Note: {team.reviewReason}</small>}</div><div className="toolbar">{team.status === 'Pending' || team.status === 'Rejected' ? <button className="button tiny primary" disabled={busy} onClick={() => review(team, true)}>Approve</button> : null}{team.status === 'Pending' && <button className="button tiny ghost" disabled={busy} onClick={() => review(team, false)}>Reject</button>}</div></div>) : <div className="empty compact">No {teamTab.toLowerCase()} registrations.</div>}</div>
      <div className="workspace-card"><div className="section-heading"><div><div className="eyebrow">TOURNAMENT CONTROL</div><h2>Lifecycle and fixtures</h2></div><button className="icon-button" onClick={tournaments.reload} aria-label="Refresh tournaments"><RefreshCw size={16} /></button></div>{tournaments.data.map(t => <div className="admin-row" key={t.id}><div><strong>{t.name}</strong><small>{t.sportName} · {t.teamCount} approved teams · {t.fixtureCount} fixtures · {t.completedFixtureCount ?? 0} completed</small></div><div className="toolbar"><button className="button tiny ghost" onClick={() => setTournamentEdit({ id: t.id, name: t.name, status: t.status, registrationOpen: t.registrationOpen, thirdPlace: t.thirdPlace || false, matchStartTime: t.matchStartTime || '', matchEndTime: t.matchEndTime || '', dates: (t.availableDates || []).join(', '), venues: (t.venueIds || []).join(', ') })}>Edit</button><button className="button tiny primary" disabled={busy || t.fixtureCount > 0} onClick={() => generate(t.id)}>{t.fixtureCount > 0 ? 'Bracket ready' : 'Generate'}</button><button className="button tiny ghost" disabled={busy || t.teamCount > 0 || t.fixtureCount > 0} onClick={() => deleteTournament(t)}>Delete</button></div></div>)}{tournamentEdit && <div className="roster-builder" style={{ marginTop: 16 }}><Field label="Name" value={tournamentEdit.name} onChange={v => setTournamentEdit({ ...tournamentEdit, name: v })} /><div className="form-grid"><Field label="Status" value={tournamentEdit.status} onChange={v => setTournamentEdit({ ...tournamentEdit, status: v })} /><SelectField label="Registration" value={String(tournamentEdit.registrationOpen)} onChange={v => setTournamentEdit({ ...tournamentEdit, registrationOpen: v === 'true' })}><option value="true">Open</option><option value="false">Closed</option></SelectField></div><div className="form-grid"><SelectField label="Third-place playoff" value={tournamentEdit.thirdPlace ? 'Yes' : 'No'} onChange={v => setTournamentEdit({ ...tournamentEdit, thirdPlace: v === 'Yes' })}><option value="No">No</option><option value="Yes">Yes</option></SelectField><Field label="Match window start" type="time" value={tournamentEdit.matchStartTime} onChange={v => setTournamentEdit({ ...tournamentEdit, matchStartTime: v })} /></div><div className="form-grid"><Field label="Match window end" type="time" value={tournamentEdit.matchEndTime} onChange={v => setTournamentEdit({ ...tournamentEdit, matchEndTime: v })} /><Field label="Available dates" value={tournamentEdit.dates} onChange={v => setTournamentEdit({ ...tournamentEdit, dates: v })} placeholder="2026-10-12, 2026-10-13" /></div><Field label="Venues" value={tournamentEdit.venues} onChange={v => setTournamentEdit({ ...tournamentEdit, venues: v })} placeholder="Main Arena, Court B" /><div className="search-row"><button className="button tiny primary" onClick={saveTournament} disabled={busy}>Save tournament</button><button className="button tiny ghost" onClick={() => setTournamentEdit(null)}>Cancel</button></div></div>}</div>
      <div className="workspace-card"><div className="section-heading"><div><div className="eyebrow">AUTO-SCHEDULER</div><h2>Place matches on the calendar</h2><p>Uses the tournament window, dates, and venues. Already scheduled or resolved matches are untouched.</p></div></div><div className="form-stack"><SelectField label="Tournament" value={auto.tournamentId} onChange={pickAutoTournament}><option value="">Select tournament</option>{tournaments.data.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</SelectField>{auto.tournamentId && <div className="form-grid"><Field label="Daily window start" type="datetime-local" value={auto.start} onChange={v => setAuto({ ...auto, start: v })} /><Field label="Daily window end" type="datetime-local" value={auto.end} onChange={v => setAuto({ ...auto, end: v })} /></div>}{auto.tournamentId && <><Field label="Play dates (comma separated)" value={auto.dates} onChange={v => setAuto({ ...auto, dates: v })} placeholder="2026-10-12, 2026-10-13" /><div className="form-grid"><Field label="Venues (comma separated)" value={auto.venues} onChange={v => setAuto({ ...auto, venues: v })} placeholder="Main Arena" /><Field label="Match duration (min, blank = sport default)" type="number" min="5" value={auto.duration} onChange={v => setAuto({ ...auto, duration: v })} /></div><button className="button primary full" disabled={busy} onClick={runAutoSchedule}>Run auto-scheduler</button></>}</div></div>
      <div className="workspace-card"><div className="section-heading"><div><div className="eyebrow">SCORE CORRECTIONS</div><h2>Fix an official result</h2><p>Correcting a score refreshes the winner path and notifies both captains.</p></div></div><SelectField label="Tournament" value={correction.tournamentId} onChange={loadCorrections}><option value="">Select tournament</option>{tournaments.data.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</SelectField>{correction.loading ? <div className="loading">Loading resolved fixtures…</div> : resolvedFixtures.length ? resolvedFixtures.map(f => { const form = correction.forms[f.id] || { home: String(f.homeScore ?? 0), away: String(f.awayScore ?? 0), status: f.status, reason: '' }; return <div className="notification-row" key={f.id}><AlertTriangle size={16} /><div style={{ flex: 1 }}><strong>M{f.roundNo}.{f.slot} · {f.homeTeam || 'TBD'} {f.homeScore ?? '–'}–{f.awayScore ?? '–'} {f.awayTeam || 'TBD'}</strong><small>Currently {f.status} · version {f.version ?? 1}</small><div className="form-grid" style={{ marginTop: 8 }}><Field label="Home" type="number" min="0" value={form.home} onChange={v => setCorrection(prev => ({ ...prev, forms: { ...prev.forms, [f.id]: { ...form, home: v } } }))} /><Field label="Away" type="number" min="0" value={form.away} onChange={v => setCorrection(prev => ({ ...prev, forms: { ...prev.forms, [f.id]: { ...form, away: v } } }))} /></div><div className="form-grid"><SelectField label="Status" value={form.status} onChange={v => setCorrection(prev => ({ ...prev, forms: { ...prev.forms, [f.id]: { ...form, status: v } } }))}>{RESOLVED_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</SelectField><Field label="Reason" value={form.reason} onChange={v => setCorrection(prev => ({ ...prev, forms: { ...prev.forms, [f.id]: { ...form, reason: v } } }))} placeholder="Wrong score entered at the desk" /></div><button className="button tiny primary" disabled={busy} onClick={() => saveCorrection(f)}>Apply correction</button></div></div> }) : correction.tournamentId ? <div className="empty compact">No resolved fixtures to correct yet.</div> : null}</div>
      <div className="workspace-card danger-card"><div className="section-heading"><div><div className="eyebrow">WITHDRAW + REGENERATE</div><h2>Protect the bracket</h2><p>Select an approved team, preview the continuation, and preserve completed history.</p></div></div><SelectField label="Tournament" value={selected ? String(selected.id) : ''} onChange={v => { setSelected(tournaments.data.find(t => t.id === Number(v)) || null); setWithdrawId(''); setPreview(null) }}><option value="">Select tournament</option>{tournaments.data.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</SelectField><SelectField label="Approved team" value={withdrawId} onChange={setWithdrawId} disabled={!selected}><option value="">Select team to withdraw</option>{approvedTeams.map(team => <option key={team.id} value={team.id}>{team.name} · {team.department}</option>)}</SelectField><button className="button warning full" disabled={busy || !selected || !withdrawId} onClick={loadPreview}>{busy ? 'Preparing preview…' : 'Preview regeneration'}</button>{preview && <div className="regen-preview"><div className="preview-warning"><ShieldCheck size={18} /><strong>{preview.withdrawnTeamName} will be excluded from future play.</strong><span>Completed match history stays intact.</span></div><div className="preview-columns"><div><small>PRESERVED WINNERS</small><strong>{preview.preservedWinnerNames?.join(', ') || 'None'}</strong></div><div><small>NEVER PLAYED</small><strong>{preview.neverPlayedNames?.join(', ') || 'None'}</strong></div><div><small>EXCLUDED</small><strong>{preview.excludedTeamNames?.join(', ') || 'None'}</strong></div><div><small>HISTORICAL</small><strong>{preview.completedFixtureCount}</strong></div><div><small>NEW FIXTURES</small><strong>{preview.newFixtureCount}</strong></div></div><button className="button primary full" onClick={regenerate} disabled={busy}>Confirm and regenerate fixtures</button></div>}</div>
      <div className="workspace-card"><div className="section-heading"><div><div className="eyebrow">PER-SPORT BREAKDOWN</div><h2>Programme health</h2></div></div>{dashboard.data?.games?.length ? dashboard.data.games.map(g => <div className="admin-row" key={g.id}><div><strong>{g.name}</strong><small>{g.totalTeams} approved team{g.totalTeams === 1 ? '' : 's'}</small></div><small>{g.tournaments} tournament{g.tournaments === 1 ? '' : 's'}</small></div>) : <div className="empty compact">No sports in the catalog yet.</div>}</div>
      <div className="workspace-card"><div className="section-heading"><div><div className="eyebrow">AUDIT TRAIL</div><h2>Recent structural actions</h2></div><button className="icon-button" onClick={audit.reload} aria-label="Refresh audit log"><RefreshCw size={16} /></button></div>{audit.loading ? <div className="loading">Loading audit trail…</div> : audit.data.length ? audit.data.slice(0, 12).map(item => <div className="notification-row" key={item.id}><ShieldCheck size={16} /><div><strong>{item.action} · {item.entityType} {item.entityId || ''}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></div></div>) : <div className="empty compact">No structural actions recorded yet.</div>}</div>
    </div>
  </Page>
}

export function ScorerWorkspace({ session }: { session: AuthSession }) {
  const tournaments = useLoad(api.publicTournaments, [])
  const [selectedId, setSelectedId] = useState('')
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [scores, setScores] = useState<Record<number, { home: string; away: string; status: string }>>({})
  const [schedule, setSchedule] = useState<Record<number, { startsAt: string; venue: string }>>({})
  const [confirming, setConfirming] = useState<number | null>(null)
  const load = async (id: string) => { if (!id) { setFixtures([]); return } try { setFixtures(await api.fixtures(Number(id))) } catch (e) { setError(errText(e, 'Unable to load fixtures')) } }
  useEffect(() => { load(selectedId) }, [selectedId])
  const selectable = useMemo(() => fixtures.filter(f => (f.status === 'Pending' || f.status === 'Scheduled') && f.homeTeam && f.awayTeam), [fixtures])
  const review = (fixture: Fixture) => {
    const v = scores[fixture.id] || { home: '', away: '', status: 'Completed' }
    const home = Number(v.home); const away = Number(v.away)
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) { setError('Enter non-negative whole-number scores.'); return }
    if ((v.status === 'Completed' || v.status === 'Walkover') && home === away) { setError('A knockout match needs a decisive score. Forfeited or abandoned matches, choose Double forfeit or Abandoned instead.'); return }
    setError(''); setConfirming(fixture.id)
  }
  const saveScore = async (fixture: Fixture) => {
    const v = scores[fixture.id]; if (!v) return
    const home = Number(v.home); const away = Number(v.away)
    setBusy(true); setError(''); setMessage('')
    try {
      const outcome = v.status === 'Completed' || v.status === 'Walkover' ? (home > away ? 'home win' : 'away win') : 'no result'
      await api.score(fixture.id, { homeScore: home, awayScore: away, status: v.status, outcome, expectedVersion: fixture.version ?? 1 })
      setMessage('Result saved, bracket advanced, and captains notified.'); setConfirming(null); await load(selectedId)
    } catch (e) { setError(errText(e, 'Could not save the result. Refresh and review the fixture.')); setConfirming(null) } finally { setBusy(false) }
  }
  const saveSchedule = async (fixture: Fixture) => {
    const values = schedule[fixture.id]
    if (!values?.startsAt || !values.venue) { setError('Choose a start time and venue before scheduling.'); return }
    const body = { startsAt: new Date(values.startsAt).toISOString(), venue: values.venue, expectedVersion: fixture.version ?? 1, override: false }
    setBusy(true); setError(''); setMessage('')
    try { await api.schedule(fixture.id, body); setMessage('Fixture scheduled and both captains were notified.'); await load(selectedId) }
    catch (e) {
      const text = errText(e, 'Could not schedule the fixture.')
      if (text.toLowerCase().includes('clash')) {
        if (window.confirm(`${text}. Schedule anyway? This overrides the clash warning and is logged in the audit trail.`)) {
          try { await api.schedule(fixture.id, { ...body, override: true }); setMessage('Fixture scheduled with an overridden clash. Captains were notified.'); await load(selectedId) }
          catch (inner) { setError(errText(inner, 'Override scheduling failed.')) }
        } else setMessage('Scheduling cancelled. Pick another slot or override the clash.')
      } else setError(text)
    } finally { setBusy(false) }
  }
  return <Page>
    <Intro eyebrow="SCORER DESK" title="Keep the result official." text={`Ready, ${session.user.name}. Schedule matches and post official results — captains are notified and brackets advance automatically.`} />
    <div className="workspace-card">
      <div className="toolbar"><SelectField label="Tournament" value={selectedId} onChange={setSelectedId}><option value="">Select tournament</option>{tournaments.data.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</SelectField><button className="button tiny ghost" disabled={!selectedId} onClick={() => load(selectedId)}><RefreshCw size={13} /> Refresh</button></div>
      <Feedback error={error} message={message} />
      {selectedId ? <div className="fixture-stack scorer-list">{fixtures.map(f => <div className="scorer-row" key={f.id}>
        <div className="fixture-row"><div className="fixture-time"><strong>{f.startsAt ? new Date(f.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBA'}</strong><small>{f.venue || 'Venue TBA'}</small></div><div className="fixture-teams"><strong className={f.homeTeam ? '' : 'placeholder'}>{f.homeTeam || `Winner M${2 * f.slot - 1}`}</strong><span>vs</span><strong className={f.awayTeam ? '' : 'placeholder'}>{f.awayTeam || (f.roundNo > 1 ? `Winner M${2 * f.slot}` : 'TBD')}</strong></div><div className="fixture-state"><span className="pill muted"><span className="pill-dot" />{f.status}</span>{isResolved(f.status) && <b>{f.homeScore ?? '–'} — {f.awayScore ?? '–'}</b>}</div></div>
        {selectable.some(x => x.id === f.id) && <div className="form-grid">
          <Field label="Home score" type="number" min="0" value={scores[f.id]?.home || ''} onChange={v => setScores({ ...scores, [f.id]: { home: v, away: scores[f.id]?.away || '', status: scores[f.id]?.status || 'Completed' } })} />
          <Field label="Away score" type="number" min="0" value={scores[f.id]?.away || ''} onChange={v => setScores({ ...scores, [f.id]: { home: scores[f.id]?.home || '', away: v, status: scores[f.id]?.status || 'Completed' } })} />
          <SelectField label="Result type" value={scores[f.id]?.status || 'Completed'} onChange={v => setScores({ ...scores, [f.id]: { home: scores[f.id]?.home || '', away: scores[f.id]?.away || '', status: v } })}>{['Completed', 'Walkover', 'DoubleForfeit', 'Abandoned'].map(s => <option key={s} value={s}>{s}</option>)}</SelectField>
          <div className="toolbar" style={{ marginBottom: 0 }}><button className="button tiny primary" disabled={busy || confirming === f.id} onClick={() => review(f)}>Review result</button></div>
          <Field label="Start time" type="datetime-local" value={schedule[f.id]?.startsAt || ''} onChange={v => setSchedule({ ...schedule, [f.id]: { startsAt: v, venue: schedule[f.id]?.venue || '' } })} />
          <Field label="Venue" value={schedule[f.id]?.venue || ''} onChange={v => setSchedule({ ...schedule, [f.id]: { startsAt: schedule[f.id]?.startsAt || '', venue: v } })} placeholder="Main Arena" />
          <div className="toolbar" style={{ marginBottom: 0 }}><button className="button tiny ghost" disabled={busy} onClick={() => saveSchedule(f)}>Schedule or reschedule</button></div>
          {confirming === f.id && <div className="confirm-strip"><AlertTriangle size={14} />Post {scores[f.id]?.home}–{scores[f.id]?.away} as {scores[f.id]?.status}? The bracket advances and both captains receive email + in-app alerts.<button className="button tiny primary" disabled={busy} onClick={() => saveScore(f)}>{busy ? 'Saving…' : 'Confirm & post'}</button><button className="button tiny ghost" disabled={busy} onClick={() => setConfirming(null)}>Cancel</button></div>}
        </div>}
        {isResolved(f.status) && <small className="field-hint">Resolved — contact the admin desk for official corrections, which keep the audit trail.</small>}
      </div>)}</div> : <div className="empty">Choose a tournament to open its fixture queue.</div>}
    </div>
  </Page>
}
