import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Activity, CalendarDays, Clock3, LayoutDashboard, LogOut, ShieldCheck, UserRound, Bell, WalletCards } from 'lucide-react'
import './index.css'

const API = 'http://127.0.0.1:8000'

type Leave = {
  id: number
  employee_id: number
  employee_name: string
  leave_type: string
  start_date: string
  end_date: string
  remarks: string
  status: 'pending' | 'approved' | 'rejected'
  reviewer_comment: string
  created_at: string
}

type Employee = {
  id: number
  phone: string
  address: string
  full_name: string
  department: string
  job_title: string
  salary: number
  employee_code: string
}

type Attendance = { id: number; employee_name: string; work_date: string; check_in: string | null; check_out: string | null; status: string; duration_minutes: number | null; signal: string | null }
type Payroll = { id: number; employee_id: number; employee_name: string; basic_salary: number; allowances: number; deductions: number; net_salary: number; effective_from: string; updated_at?: string }
type Notification = { id: number; title: string; message: string; is_read: boolean; created_at: string }
type Summary = { employee_count: number; attendance_today: number; open_checkins: number; pending_leaves: number; approved_leaves: number; attendance_records: number; half_days: number }
type Impact = { leave_id: number; employee: string; department: string; leave_type: string; requested_days: number; current_team_coverage: number; projected_coverage: number; coverage_delta: number; overlapping_absences: { employee: string; status: string }[]; risk: string; recommendation: string; reasons: string[] }
type AuditEntry = { id: number; actor_name: string; action: string; entity_type: string; entity_id: number; details: string; created_at: string }

function readableDetails(details: string) {
  try {
    return Object.entries(JSON.parse(details)).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`).join(' · ')
  } catch {
    return details
  }
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('dayflow_token'))
  const [role, setRole] = useState(localStorage.getItem('dayflow_role') || 'employee')
  const [email, setEmail] = useState('employee@dayflow.local')
  const [password, setPassword] = useState('Employee123!')
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [view, setView] = useState('overview')
  const [loginError, setLoginError] = useState('')
  const [leaveType, setLeaveType] = useState('Paid')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [message, setMessage] = useState('')
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [payroll, setPayroll] = useState<Payroll | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [hrEmployees, setHrEmployees] = useState<Employee[]>([])
  const [hrPayroll, setHrPayroll] = useState<Payroll[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null)
  const [payrollDraft, setPayrollDraft] = useState({ basic_salary: 0, allowances: 0, deductions: 0, effective_from: '' })
  const [impact, setImpact] = useState<Impact | null>(null)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const api = useMemo(() => axios.create({ baseURL: API, headers: token ? { Authorization: `Bearer ${token}` } : {} }), [token])

  const loadData = async () => {
    if (!token) return
    try {
      const [profile, leaveData, attendanceData, summaryData, notificationData, payrollData] = await Promise.all([
        api.get('/api/employees/me'), api.get('/api/leaves'), api.get('/api/attendance/me'), api.get('/api/dashboard/summary'), api.get('/api/notifications'), api.get('/api/payroll/me')
      ])
      setEmployee(profile.data)
      setPhone(profile.data.phone); setAddress(profile.data.address)
      setLeaves(leaveData.data)
      setAttendance(attendanceData.data); setSummary(summaryData.data); setNotifications(notificationData.data); setPayroll(payrollData.data)
      if ((localStorage.getItem('dayflow_role') || role) === 'hr') {
        const results = await Promise.allSettled([api.get('/api/employees'), api.get('/api/payroll'), api.get('/api/attendance'), api.get('/api/audit')])
        const [employeesResult, payrollResult, attendanceResult, auditResult] = results
        if (employeesResult.status === 'fulfilled') {
          setHrEmployees(employeesResult.value.data)
          if (!selectedEmployeeId && employeesResult.value.data.length) setSelectedEmployeeId(employeesResult.value.data[0].id)
        }
        if (payrollResult.status === 'fulfilled') {
          setHrPayroll(payrollResult.value.data)
          const firstPayroll = payrollResult.value.data.find((item: Payroll) => item.employee_id === (selectedEmployeeId || employeesResult.status === 'fulfilled' && employeesResult.value.data[0]?.id))
          if (firstPayroll) setPayrollDraft({ basic_salary: firstPayroll.basic_salary, allowances: firstPayroll.allowances, deductions: firstPayroll.deductions, effective_from: firstPayroll.effective_from })
        }
        if (attendanceResult.status === 'fulfilled') setAttendance(attendanceResult.value.data)
        if (auditResult.status === 'fulfilled') setAuditEntries(auditResult.value.data)
      }
    } catch {
      setToken(null)
      localStorage.removeItem('dayflow_token')
    }
  }

  useEffect(() => { loadData() }, [token])

  const login = async () => {
    setLoginError('')
    try {
      const result = await axios.post(`${API}/api/auth/login`, { email, password })
      localStorage.setItem('dayflow_token', result.data.access_token)
      localStorage.setItem('dayflow_role', result.data.role)
      setToken(result.data.access_token)
      setRole(result.data.role)
    } catch (error: any) {
      setLoginError(error?.response?.data?.detail || 'Login failed')
    }
  }

  const logout = () => {
    localStorage.clear()
    setToken(null)
    setEmployee(null)
    setLeaves([])
    setAttendance([]); setNotifications([]); setSummary(null); setPayroll(null)
    setHrEmployees([]); setHrPayroll([])
    setAuditEntries([]); setSelectedEmployeeId(null)
  }

  const submitLeave = async () => {
    setMessage('')
    try {
      await api.post('/api/leaves', { leave_type: leaveType, start_date: startDate, end_date: endDate, remarks })
      setMessage('Leave request submitted successfully.')
      setStartDate(''); setEndDate(''); setRemarks('')
      await loadData()
    } catch (error: any) {
      setMessage(error?.response?.data?.detail || 'Unable to submit leave request.')
    }
  }

  const decideLeave = async (id: number, status: 'approved' | 'rejected') => {
    await api.patch(`/api/leaves/${id}`, { status, reviewer_comment: status === 'approved' ? 'Approved by HR.' : 'Please coordinate with your manager.' })
    setMessage(`Leave request ${status}.`)
    await loadData()
  }

  const previewImpact = async (id: number) => setImpact((await api.get(`/api/decisions/leave/${id}/impact`)).data)
  const saveProfile = async () => {
    await api.patch('/api/employees/me', { phone, address }); setMessage('Profile updated.'); await loadData()
  }
  const selectedPayroll = hrPayroll.find(item => item.employee_id === selectedEmployeeId) || null
  const selectPayroll = (employeeId: number) => {
    setSelectedEmployeeId(employeeId)
    const record = hrPayroll.find(item => item.employee_id === employeeId)
    if (record) setPayrollDraft({ basic_salary: record.basic_salary, allowances: record.allowances, deductions: record.deductions, effective_from: record.effective_from })
  }
  const savePayroll = async () => {
    if (!selectedEmployeeId) return
    try { await api.put(`/api/payroll/${selectedEmployeeId}`, payrollDraft); setMessage('Payroll updated successfully.'); await loadData() } catch (error: any) { setMessage(error?.response?.data?.detail || 'Unable to update payroll.') }
  }
  const saveEmployee = async () => {
    const selected = hrEmployees.find(item => item.id === selectedEmployeeId)
    if (!selected) return
    try { await api.patch(`/api/employees/${selected.id}`, { department: selected.department, job_title: selected.job_title, salary: selected.salary, phone: selected.phone, address: selected.address }); setMessage('Employee record updated successfully.'); await loadData() } catch (error: any) { setMessage(error?.response?.data?.detail || 'Unable to update employee.') }
  }
  const markRead = async (id: number) => { await api.patch(`/api/notifications/${id}/read`); setNotifications(items => items.map(item => item.id === id ? { ...item, is_read: true } : item)) }

  if (!token) {
    return <div className="login-shell">
      <div className="login-card">
        <div className="brand-mark">D</div>
        <div className="eyebrow">DAYFLOW</div>
        <h1>Every workday, intelligently aligned.</h1>
        <p className="muted">A role-aware HRMS built for employees and HR teams.</p>
        <label>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} />
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} />
        {loginError && <div className="error">{loginError}</div>}
        <button className="primary" onClick={login}>Sign in</button>
        <div className="demo-note">Demo accounts: <b>employee@dayflow.local</b> / <b>Employee123!</b> · HR: <b>hr@dayflow.local</b> / <b>Admin123!</b></div>
      </div>
    </div>
  }

  const isHR = role === 'hr'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-dot">D</span><div><strong>Dayflow</strong><span>Workforce OS</span></div></div>
      <nav>
        <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}><LayoutDashboard size={18}/> Overview</button>
        <button className={view === 'attendance' ? 'active' : ''} onClick={() => setView('attendance')}><Clock3 size={18}/> Attendance</button>
        <button className={view === 'leave' ? 'active' : ''} onClick={() => setView('leave')}><CalendarDays size={18}/> Time Off</button>
        <button className={view === 'payroll' ? 'active' : ''} onClick={() => setView('payroll')}><WalletCards size={18}/> Payroll</button>
        <button className={view === 'notifications' ? 'active' : ''} onClick={() => setView('notifications')}><Bell size={18}/> Notifications <span className="nav-count">{notifications.filter(item => !item.is_read).length || ''}</span></button>
        {isHR && <button className={view === 'hr' ? 'active' : ''} onClick={() => setView('hr')}><ShieldCheck size={18}/> Workforce</button>}
        {isHR && <button className={view === 'audit' ? 'active' : ''} onClick={() => setView('audit')}><Activity size={18}/> Activity</button>}
        <button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}><UserRound size={18}/> Profile</button>
      </nav>
      <button className="logout" onClick={logout}><LogOut size={18}/> Sign out</button>
    </aside>

    <main className="content">
      <header className="topbar"><div><span className="eyebrow">{isHR ? 'HR CONTROL CENTER' : 'EMPLOYEE WORKSPACE'}</span><h2>{greeting}, {employee?.full_name?.split(' ')[0] || 'there'}.</h2></div><div className="topbar-actions"><button className="ghost notification-button" onClick={() => setView('notifications')} title="Open notifications"><Bell size={17}/><span>{notifications.filter(item => !item.is_read).length}</span></button><div className="avatar">{employee?.full_name?.slice(0,1) || 'D'}</div></div></header>

      {view === 'overview' && <>
        <section className="hero-card"><div><div className="eyebrow">DAYFLOW PULSE</div><h3>Make today's decisions with context.</h3><p>Dayflow connects attendance, leave and workforce data so HR can understand what needs attention next.</p></div><div className="pulse-score">{summary?.attendance_today || 0}%<span>attendance today</span></div></section>
        <div className="metric-grid">
          <div className="metric"><span>Attendance today</span><strong>{summary?.attendance_today || 0}%</strong><small>{summary?.open_checkins || 0} open check-ins</small></div>
          <div className="metric"><span>Leave requests</span><strong>{summary?.pending_leaves || 0}</strong><small>{summary?.approved_leaves || 0} approved</small></div>
          <div className="metric"><span>Monthly net salary</span><strong>₹{payroll?.net_salary?.toLocaleString('en-IN') || '0'}</strong><small>Signed-in employee</small></div>
          <div className="metric"><span>Attendance records</span><strong>{summary?.attendance_records || 0}</strong><small>{summary?.half_days || 0} half-days</small></div>
        </div>
        <section className="panel-grid">
          <div className="panel"><div className="panel-head"><div><span className="eyebrow">RECENT TIME OFF</span><h3>Requests</h3></div><button className="ghost" onClick={() => setView('leave')}>View all</button></div>{leaves.slice(0,4).map(l => <div className="row" key={l.id}><div><strong>{l.employee_name} · {l.leave_type}</strong><span>{l.start_date} → {l.end_date}</span></div><span className={`status ${l.status}`}>{l.status}</span></div>)}{leaves.length === 0 && <div className="empty">No leave requests yet.</div>}</div>
          <div className="panel decision-preview"><div className="panel-head"><div><span className="eyebrow">DECISION ENGINE</span><h3>Leave impact preview</h3></div></div>{isHR && leaves.find(l => l.status === 'pending') ? <>{!impact && <><strong>{summary?.pending_leaves || 0} pending decision(s)</strong><p className="muted">Preview workforce impact before approving leave.</p><button className="primary" onClick={() => previewImpact(leaves.find(l => l.status === 'pending')!.id)}>Preview pending impact</button></>}{impact && <><div className="impact compact-impact"><div><span>Current coverage</span><strong>{impact.current_team_coverage}%</strong></div><div className="arrow">→</div><div><span>If approved</span><strong className="warning">{impact.projected_coverage}%</strong></div></div><div className="preview-meta"><strong>{impact.employee}</strong><span>{impact.risk.toUpperCase()} risk · {impact.coverage_delta > 0 ? '+' : ''}{impact.coverage_delta} points</span></div><button className="ghost" onClick={() => setView('leave')}>Open Decision Center</button></>}</> : <p className="muted">No pending requests require a coverage preview.</p>}</div>
        </section>
      </>}

      {view === 'leave' && <section className="panel large decision-center"><div className="panel-head"><div><span className="eyebrow">{isHR ? 'DECISION CENTER' : 'TIME OFF'}</span><h3>{isHR ? 'Leave impact review' : 'Request leave'}</h3></div></div>{!isHR && <div className="form-grid"><select value={leaveType} onChange={e => setLeaveType(e.target.value)}><option>Paid</option><option>Sick</option><option>Unpaid</option></select><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}/><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}/><input placeholder="Remarks" value={remarks} onChange={e => setRemarks(e.target.value)}/><button className="primary" onClick={submitLeave}>Submit request</button></div>}{isHR && <p className="muted">What happens to team coverage if this leave is approved?</p>}{message && <div className="success">{message}</div>}<div className="table">{leaves.map(l => <div className="table-row" key={l.id}><div><strong>{l.employee_name}</strong><span>{l.leave_type} · {l.start_date} → {l.end_date}</span></div><span className={`status ${l.status}`}>{l.status}</span>{isHR && l.status === 'pending' && <div className="actions"><button className="ghost" onClick={() => previewImpact(l.id)}>Preview impact</button><button className="approve" onClick={() => decideLeave(l.id, 'approved')}>{impact?.leave_id === l.id && impact.risk !== 'low' ? 'Approve anyway' : 'Approve'}</button><button className="reject" onClick={() => decideLeave(l.id, 'rejected')}>Reject</button></div>}</div>)}</div>{impact && isHR && <div className="impact-report"><div className="leave-context"><span className="eyebrow">SELECTED REQUEST</span><strong>{impact.employee}</strong><span>{impact.department} · {impact.leave_type} · {impact.requested_days} day(s)</span><span>{leaves.find(l => l.id === impact.leave_id)?.start_date} → {leaves.find(l => l.id === impact.leave_id)?.end_date}</span></div><div className="impact"><div><span>CURRENT TEAM COVERAGE</span><strong>{impact.current_team_coverage}%</strong></div><div className="arrow">→</div><div><span>IF APPROVED</span><strong className="warning">{impact.projected_coverage}%</strong></div></div><div className="impact-summary"><span className={`risk-badge ${impact.risk}`}>{impact.risk.toUpperCase()}</span><strong>{impact.coverage_delta < 0 ? '▼' : '▲'} {Math.abs(impact.coverage_delta)} percentage points</strong><span>{impact.overlapping_absences.length} overlapping absence(s)</span></div><div className="recommendation"><span className="eyebrow">RECOMMENDATION</span><strong>{impact.recommendation}</strong></div><div className="why"><span className="eyebrow">WHY THIS WAS FLAGGED</span>{impact.reasons.map((reason, index) => <div className="why-item" key={`${impact.leave_id}-${index}`}>{reason}</div>)}</div><div className="overlaps"><span className="eyebrow">OVERLAPPING ABSENCES</span>{impact.overlapping_absences.length ? impact.overlapping_absences.map(absence => <div className="why-item" key={`${absence.employee}-${absence.status}`}>{absence.employee} · {absence.status}</div>) : <span className="muted">No overlapping absences.</span>}</div><div className="decision-actions"><button className="reject" onClick={() => decideLeave(impact.leave_id, 'rejected')}>Reject</button><button className="approve" onClick={() => decideLeave(impact.leave_id, 'approved')}>{impact.risk !== 'low' ? 'Approve anyway' : 'Approve'}</button></div></div>}</section>}

      {view === 'attendance' && <section className="panel large"><span className="eyebrow">ATTENDANCE</span><h3>{isHR ? 'Team attendance and signals' : 'Attendance workspace'}</h3>{!isHR && <div className="attendance-actions"><button className="primary" onClick={async () => { try { await api.post('/api/attendance/check-in'); setMessage('Checked in successfully.'); await loadData() } catch (error: any) { setMessage(error?.response?.data?.detail || 'Unable to check in.') } }}>Check in</button><button className="secondary" onClick={async () => { try { await api.post('/api/attendance/check-out'); setMessage('Checked out successfully.'); await loadData() } catch (error: any) { setMessage(error?.response?.data?.detail || 'Unable to check out.') } }}>Check out</button></div>}{message && <div className="success">{message}</div>}<div className="table">{attendance.map(item => <div className="table-row" key={item.id}><div><strong>{isHR ? item.employee_name : item.work_date}</strong><span>{isHR && `${item.work_date} · `}{item.check_in ? new Date(item.check_in).toLocaleTimeString() : 'Not started'} · {item.check_out ? new Date(item.check_out).toLocaleTimeString() : 'Open'}</span></div><div className="row-meta"><span className="status">{item.status} {item.duration_minutes ? `· ${Math.floor(item.duration_minutes / 60)}h ${item.duration_minutes % 60}m` : ''}</span>{item.signal && <span className="signal">{item.signal}</span>}</div></div>)}</div>{attendance.length === 0 && <div className="empty">No attendance records yet.</div>}</section>}

      {view === 'profile' && <section className="panel large"><span className="eyebrow">PROFILE</span><h3>{employee?.full_name}</h3><div className="profile-grid"><div><span>Employee ID</span><strong>{employee?.employee_code}</strong></div><div><span>Department</span><strong>{employee?.department}</strong></div><div><span>Job title</span><strong>{employee?.job_title}</strong></div><div><span>Salary</span><strong>₹{employee?.salary?.toLocaleString('en-IN')}</strong></div></div><div className="form-grid"><input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)}/><input placeholder="Address" value={address} onChange={e => setAddress(e.target.value)}/><button className="primary" onClick={saveProfile}>Save profile</button></div>{message && <div className="success">{message}</div>}</section>}

      {view === 'hr' && isHR && <section className="panel large"><span className="eyebrow">HR COMMAND CENTER</span><h3>Workforce operations</h3><div className="metric-grid compact"><div className="metric"><span>Workforce</span><strong>{summary?.employee_count || 0}</strong><small>Active employee records</small></div><div className="metric"><span>Attendance today</span><strong>{summary?.attendance_today || 0}%</strong><small>{summary?.open_checkins || 0} open check-ins</small></div><div className="metric"><span>Pending leave</span><strong>{summary?.pending_leaves || 0}</strong><small>Awaiting human review</small></div><div className="metric"><span>Signals</span><strong>{attendance.filter(item => item.signal).length}</strong><small>Explainable attention items</small></div></div><div className="alert-card"><div><span className="eyebrow">DECISION CENTER</span><strong>Context before approval</strong><p>Review leave impact, overlapping absences and explicit reasons before making the decision.</p></div><button className="primary" onClick={() => setView('leave')}>Open pending leave</button></div><h3>Employee management</h3><div className="form-grid"><select value={selectedEmployeeId || ''} onChange={event => selectPayroll(Number(event.target.value))}>{hrEmployees.map(item => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select>{(() => { const selected = hrEmployees.find(item => item.id === selectedEmployeeId); return selected ? <><input value={selected.department} onChange={event => setHrEmployees(items => items.map(item => item.id === selected.id ? { ...item, department: event.target.value } : item))} placeholder="Department"/><input value={selected.job_title} onChange={event => setHrEmployees(items => items.map(item => item.id === selected.id ? { ...item, job_title: event.target.value } : item))} placeholder="Job title"/><input type="number" value={selected.salary} onChange={event => setHrEmployees(items => items.map(item => item.id === selected.id ? { ...item, salary: Number(event.target.value) } : item))} placeholder="Salary"/><button className="primary" onClick={saveEmployee}>Save employee</button></> : null })()}</div>{message && <div className="success">{message}</div>}</section>}
      {view === 'payroll' && <section className="panel large"><span className="eyebrow">PAYROLL</span><h3>{isHR ? 'Payroll records' : 'Your payroll'}</h3>{isHR ? <><div className="form-grid"><select value={selectedEmployeeId || ''} onChange={event => selectPayroll(Number(event.target.value))}>{hrEmployees.map(item => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select><input type="number" value={payrollDraft.basic_salary} onChange={event => setPayrollDraft({ ...payrollDraft, basic_salary: Number(event.target.value) })} placeholder="Basic salary"/><input type="number" value={payrollDraft.allowances} onChange={event => setPayrollDraft({ ...payrollDraft, allowances: Number(event.target.value) })} placeholder="Allowances"/><input type="number" value={payrollDraft.deductions} onChange={event => setPayrollDraft({ ...payrollDraft, deductions: Number(event.target.value) })} placeholder="Deductions"/><input type="date" value={payrollDraft.effective_from} onChange={event => setPayrollDraft({ ...payrollDraft, effective_from: event.target.value })}/><button className="primary" onClick={savePayroll}>Save payroll</button></div>{selectedPayroll && <p className="muted">{selectedPayroll.employee_name} · current net ₹{selectedPayroll.net_salary.toLocaleString('en-IN')}</p>}</> : payroll && <div className="profile-grid"><div><span>Basic salary</span><strong>₹{payroll.basic_salary.toLocaleString('en-IN')}</strong></div><div><span>Allowances</span><strong>₹{payroll.allowances.toLocaleString('en-IN')}</strong></div><div><span>Deductions</span><strong>₹{payroll.deductions.toLocaleString('en-IN')}</strong></div><div><span>Net salary</span><strong>₹{payroll.net_salary.toLocaleString('en-IN')}</strong></div></div>}{message && <div className="success">{message}</div>}</section>}
      {view === 'notifications' && <section className="panel large"><span className="eyebrow">NOTIFICATIONS</span><h3>Recent activity</h3><div className="table">{notifications.map(item => <div className={`table-row ${item.is_read ? 'read' : 'unread'}`} key={item.id}><div><strong>{item.title}</strong><span>{item.message}</span></div><button className="ghost" disabled={item.is_read} onClick={() => markRead(item.id)}>{item.is_read ? 'Read' : 'Mark read'}</button></div>)}</div>{notifications.length === 0 && <div className="empty">You are all caught up.</div>}</section>}
      {view === 'audit' && isHR && <section className="panel large"><span className="eyebrow">AUDITABILITY</span><h3>Activity timeline</h3><div className="table">{auditEntries.map(entry => <div className="table-row" key={entry.id}><div><strong>{entry.action}</strong><span>{new Date(entry.created_at).toLocaleString()} · {entry.actor_name}</span><small>{readableDetails(entry.details)}</small></div><span className="status">{entry.entity_type} #{entry.entity_id}</span></div>)}</div>{auditEntries.length === 0 && <div className="empty">No recorded activity yet.</div>}</section>}
    </main>
  </div>
}

export default App
