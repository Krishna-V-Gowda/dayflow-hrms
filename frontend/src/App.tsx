import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Activity, CalendarDays, CheckCircle2, Clock3, LayoutDashboard, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import './index.css'

const API = 'http://localhost:8000'

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
  full_name: string
  department: string
  job_title: string
  salary: number
  employee_code: string
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

  const api = useMemo(() => axios.create({ baseURL: API, headers: token ? { Authorization: `Bearer ${token}` } : {} }), [token])

  const loadData = async () => {
    if (!token) return
    try {
      const [profile, leaveData] = await Promise.all([api.get('/api/employees/me'), api.get('/api/leaves')])
      setEmployee(profile.data)
      setLeaves(leaveData.data)
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

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-dot">D</span><div><strong>Dayflow</strong><span>Workforce OS</span></div></div>
      <nav>
        <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}><LayoutDashboard size={18}/> Overview</button>
        <button className={view === 'attendance' ? 'active' : ''} onClick={() => setView('attendance')}><Clock3 size={18}/> Attendance</button>
        <button className={view === 'leave' ? 'active' : ''} onClick={() => setView('leave')}><CalendarDays size={18}/> Time Off</button>
        {isHR && <button className={view === 'hr' ? 'active' : ''} onClick={() => setView('hr')}><ShieldCheck size={18}/> HR Control</button>}
        <button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}><UserRound size={18}/> Profile</button>
      </nav>
      <button className="logout" onClick={logout}><LogOut size={18}/> Sign out</button>
    </aside>

    <main className="content">
      <header className="topbar"><div><span className="eyebrow">{isHR ? 'HR CONTROL CENTER' : 'EMPLOYEE WORKSPACE'}</span><h2>Good morning, {employee?.full_name?.split(' ')[0] || 'there'}.</h2></div><div className="avatar">{employee?.full_name?.slice(0,1) || 'D'}</div></header>

      {view === 'overview' && <>
        <section className="hero-card"><div><div className="eyebrow">DAYFLOW PULSE</div><h3>Make today's decisions with context.</h3><p>Dayflow connects attendance, leave and workforce data so HR can understand what needs attention next.</p></div><div className="pulse-score">{isHR ? '84' : '96'}<span>pulse</span></div></section>
        <div className="metric-grid">
          <div className="metric"><span>Attendance</span><strong>{isHR ? '87.5%' : '96%'}</strong><small>This month</small></div>
          <div className="metric"><span>Leave balance</span><strong>12</strong><small>Days available</small></div>
          <div className="metric"><span>Payroll</span><strong>₹{employee?.salary?.toLocaleString('en-IN') || '68,500'}</strong><small>Current month view</small></div>
          <div className="metric"><span>Attention</span><strong>{isHR ? '4' : '0'}</strong><small>{isHR ? 'Items to review' : 'Items today'}</small></div>
        </div>
        <section className="panel-grid">
          <div className="panel"><div className="panel-head"><div><span className="eyebrow">RECENT TIME OFF</span><h3>Requests</h3></div><button className="ghost" onClick={() => setView('leave')}>View all</button></div>{leaves.slice(0,4).map(l => <div className="row" key={l.id}><div><strong>{l.leave_type} leave</strong><span>{l.start_date} → {l.end_date}</span></div><span className={`status ${l.status}`}>{l.status}</span></div>)}{leaves.length === 0 && <div className="empty">No leave requests yet.</div>}</div>
          <div className="panel"><div className="panel-head"><div><span className="eyebrow">DECISION ENGINE</span><h3>Leave impact preview</h3></div></div><div className="impact"><div><span>Current team coverage</span><strong>86%</strong></div><div className="arrow">→</div><div><span>If request approved</span><strong className="warning">71%</strong></div></div><p className="muted">3 existing absences and 2 overlapping requests create moderate coverage risk.</p></div>
        </section>
      </>}

      {view === 'leave' && <section className="panel large"><div className="panel-head"><div><span className="eyebrow">TIME OFF</span><h3>{isHR ? 'Leave review' : 'Request leave'}</h3></div></div>{!isHR && <div className="form-grid"><select value={leaveType} onChange={e => setLeaveType(e.target.value)}><option>Paid</option><option>Sick</option><option>Unpaid</option></select><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}/><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}/><input placeholder="Remarks" value={remarks} onChange={e => setRemarks(e.target.value)}/><button className="primary" onClick={submitLeave}>Submit request</button></div>}{message && <div className="success">{message}</div>}<div className="table">{leaves.map(l => <div className="table-row" key={l.id}><div><strong>{l.employee_name}</strong><span>{l.leave_type} · {l.start_date} → {l.end_date}</span></div><span className={`status ${l.status}`}>{l.status}</span>{isHR && l.status === 'pending' && <div className="actions"><button className="approve" onClick={() => decideLeave(l.id, 'approved')}>Approve</button><button className="reject" onClick={() => decideLeave(l.id, 'rejected')}>Reject</button></div>}</div>)}</div></section>}

      {view === 'attendance' && <section className="panel large"><span className="eyebrow">ATTENDANCE</span><h3>Attendance workspace</h3><div className="attendance-actions"><button className="primary" onClick={async () => { await api.post('/api/attendance/check-in'); setMessage('Checked in successfully.'); }}>Check in</button><button className="secondary" onClick={async () => { await api.post('/api/attendance/check-out'); setMessage('Checked out successfully.'); }}>Check out</button></div>{message && <div className="success">{message}</div>}<div className="attendance-placeholder"><Activity size={36}/><strong>Your daily and weekly attendance view</strong><span>Server-side state prevents duplicate check-ins and checkout before check-in.</span></div></section>}

      {view === 'profile' && <section className="panel large"><span className="eyebrow">PROFILE</span><h3>{employee?.full_name}</h3><div className="profile-grid"><div><span>Employee ID</span><strong>{employee?.employee_code}</strong></div><div><span>Department</span><strong>{employee?.department}</strong></div><div><span>Job title</span><strong>{employee?.job_title}</strong></div><div><span>Salary</span><strong>₹{employee?.salary?.toLocaleString('en-IN')}</strong></div></div></section>}

      {view === 'hr' && isHR && <section className="panel large"><span className="eyebrow">HR CONTROL</span><h3>Decision center</h3><div className="alert-card"><div><span className="eyebrow">TEAM COVERAGE RISK</span><strong>Engineering · moderate</strong><p>Approving the pending request would reduce projected coverage from 86% to 71%.</p></div><button className="ghost" onClick={() => setView('leave')}>Review requests</button></div><div className="panel-grid inner"><div className="metric"><span>Pending leaves</span><strong>{leaves.filter(l => l.status === 'pending').length}</strong></div><div className="metric"><span>Active employees</span><strong>128</strong></div><div className="metric"><span>Attendance today</span><strong>87.5%</strong></div></div></section>}
    </main>
  </div>
}

export default App
