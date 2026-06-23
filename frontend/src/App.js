import React, { useState, useEffect, useCallback } from 'react';
import ThemeToggle from './components/ThemeToggle';
import Spinner from './components/Spinner';
import { ToastContainer } from './components/Toast';
import logo from './assets/logo.svg';

const API = process.env.REACT_APP_BASE_URL || 'http://localhost:5000/api';

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [pageTransition, setPageTransition] = useState(false);

  const addToast = (message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  };

  const navigatePage = (newPage) => {
    setPageTransition(true);
    setTimeout(() => {
      setPage(newPage);
      setPageTransition(false);
    }, 150);
  };

  const [page, setPage] = useState('login');
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [fullName, setFullName] = useState('');
  const [fullNameError, setFullNameError] = useState('');
  const [role, setRole] = useState('patient');
  const [error, setError] = useState('');
  const [records, setRecords] = useState([]);
  const [recordTitle, setRecordTitle] = useState('');
  const [recordContent, setRecordContent] = useState('');
  const [recordMsg, setRecordMsg] = useState('');
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editMedication, setEditMedication] = useState('');
  const [editAllergies, setEditAllergies] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/health`)
      .then(r => r.json())
      // .then(() => setDbStatus('Connected ✅'))
      .catch(() => {/* ignore */})
      .finally(() => setLoading(false));
  }, []);

  
  const token = () => localStorage.getItem('token');
  const storedUser = () => JSON.parse(localStorage.getItem('user') || 'null');
  
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/records`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (Array.isArray(data.records)) setRecords(data.records);
      else if (Array.isArray(data)) setRecords(data);
    } catch (e) { console.warn('fetchRecords', e); addToast('Failed to fetch records', 'error'); }
    finally { setLoading(false); }
  }, []);
  
  useEffect(() => {
    // Restore user from localStorage or rehydrate from backend
    (async () => {
      if (!user) {
        const u = storedUser();
        if (u) { setUser(u); return; }
      }

      const t = token();
      if (t && !user) {
        try {
          const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
          if (res.ok) {
            const d = await res.json();
            localStorage.setItem('user', JSON.stringify(d.user));
            setUser(d.user);
            return;
          }
        } catch (e) {
          console.warn('rehydrate failed', e);
        }
      }

      if (user) fetchRecords();
    })();
  }, [fetchRecords, user]);

  // Auto-redirect: if a user is present and currently on auth pages, move to dashboard
  useEffect(() => {
    if (user && (page === 'login' || page === 'register')) {
      setPage('dashboard');
    }
  }, [user, page]);
  
  const handleLogin = async () => {
    setError('');
    setEmailError('');
    setPasswordError('');
    
    let isValid = true;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }
    if (!password || password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }
    if (!isValid) return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      addToast('Login successful!', 'success');
    } catch {
      setError('Server error. Is backend running?');
    }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setError('');
    setEmailError('');
    setPasswordError('');
    setFullNameError('');
    
    let isValid = true;
    if (!fullName || fullName.length < 2) {
      setFullNameError('Full name must be at least 2 characters');
      isValid = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }
    if (!password || password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }
    if (!isValid) return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, role })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      addToast('Registered successfully! Please login.', 'success');
      navigatePage('login');
      setEmail('');
      setPassword('');
      setFullName('');
    } catch {
      setError('Server error. Is backend running?');
    }
    finally { setLoading(false); }
  };

  const handleAddRecord = async () => {
    setRecordMsg('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ patientId: user.id, diagnosis: recordTitle, notes: recordContent, medication: '', allergies: '' })
      });
      const data = await res.json();
      if (!res.ok) { setRecordMsg(data.error); return; }
      setRecordTitle('');
      setRecordContent('');
      setRecordMsg('Record added successfully!');
      addToast('Record added successfully', 'success');
      fetchRecords();
    } catch {
      setRecordMsg('Failed to add record.');
      addToast('Failed to add record', 'error');
    }
    finally { setLoading(false); }
  };

  const handleEditClick = (r) => {
    const rec = r.record_data || {};
    setEditingRecordId(r.id);
    setEditTitle(rec.diagnosis || '');
    setEditContent(rec.notes || '');
    setEditMedication(rec.medication || '');
    setEditAllergies(rec.allergies || '');
  };

  const handleCancelEdit = () => {
    setEditingRecordId(null);
    setEditTitle('');
    setEditContent('');
    setEditMedication('');
    setEditAllergies('');
  };

  const handleSaveEdit = async () => {
    if (!editingRecordId) return;
    setLoading(true);
    try {
      // Send full set of editable fields; backend will enforce role restrictions
      const body = { diagnosis: editTitle, notes: editContent, medication: editMedication, allergies: editAllergies };
      const res = await fetch(`${API}/records/${editingRecordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || 'Update failed', 'error'); return; }
      handleCancelEdit();
      fetchRecords();
    } catch (e) { alert('Update failed'); }
    finally { setLoading(false); }
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/records/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Delete failed'); return; }
      fetchRecords();
    } catch (e) { alert('Delete failed'); }
    finally { setLoading(false); }
  };

  // Profile edit
  const [editingName, setEditingName] = useState(false);
  const [profileName, setProfileName] = useState('');

  const handleStartEdit = () => {
    setProfileName(user?.name || user?.full_name || '');
    setEditingName(true);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ fullName: profileName })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Update failed'); return; }
      const newUser = { id: data.user.id, name: data.user.name, email: data.user.email, role: data.user.role };
      localStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
      setEditingName(false);
    } catch (e) {
      alert('Update failed');
    }
    finally { setLoading(false); }
  };

  // Persist theme and apply class to documentElement
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('theme-dark');
    else document.documentElement.classList.remove('theme-dark');
  }, [theme]);

  if (user) return (
    <div className="container-transition" style={{ minHeight:'100vh' }}>
      {loading && <Spinner />}
      <div className="app-header">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img src={logo} alt="MedChain" style={{ width:44, height:44 }} />
          <div>
            <h1 style={{ color:'var(--text)', margin:'0 0 2px 0', fontSize:20, fontWeight:700 }}>MedChain</h1>
            <p style={{ color:'var(--muted)', margin:0, fontSize:12 }}>Secure Healthcare Platform</p>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }} className="header-actions">
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', marginRight:8 }}>
            <span style={{ color:'var(--text)', fontSize:13, fontWeight:600 }}>{user.name}</span>
            <span style={{ color:'var(--muted)', fontSize:11 }}>{user.role}</span>
          </div>
          <button onClick={handleStartEdit} className="btn-primary btn-sm">Edit Profile</button>
          <button onClick={() => { setUser(null); localStorage.removeItem('token'); localStorage.removeItem('user'); navigatePage('login'); }} className="btn-secondary btn-sm">Logout</button>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </div>
      {editingName && (
        <div style={{ padding:'20px 28px', display:'flex', gap:12, background:'var(--card)', borderBottom:'1px solid rgba(0,0,0,0.06)', animation:'slideInDown 300ms ease-out' }}>
          <input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Update your name" style={{ flex:1 }} />
          <button onClick={handleSaveProfile} className="btn-primary btn-sm">Save</button>
          <button onClick={() => setEditingName(false)} className="btn-secondary btn-sm">Cancel</button>
        </div>
      )}
      <div style={{ padding:'32px 28px' }}>
        <div className="card elevated" style={{ marginBottom:32, background:'linear-gradient(135deg,#0B1F3A 0%,#0E7C7B 100%)', color:'white' }}>
          <div style={{ fontSize:13, opacity:0.8, marginBottom:8 }}>Welcome back,</div>
          <div style={{ fontSize:28, fontWeight:700, marginBottom:8 }}>{user.name}</div>
          <div style={{ fontSize:12, opacity:0.7 }}>Manage and secure your health records with MedChain</div>
        </div>

        <div className="card" style={{ marginBottom:32 }}>
          <h3 style={{ color:'var(--text)', marginTop:0, marginBottom:20, fontSize:18, fontWeight:700 }}>➕ Add Medical Record</h3>
          {recordMsg && <div style={{ background: recordMsg.includes('success') ? 'var(--success)' : 'var(--error)', color:'white', padding:'12px 14px', borderRadius:'var(--radius-md)', marginBottom:16, fontSize:14 }}>{recordMsg.includes('success') ? '✓' : '!'} {recordMsg}</div>}
          <div style={{ marginBottom:16 }}>
            <input placeholder="Diagnosis / Record Title" value={recordTitle} onChange={e => setRecordTitle(e.target.value)} />
          </div>
          <div style={{ marginBottom:20 }}>
            <textarea placeholder="Clinical notes, observations, and recommendations..." value={recordContent} onChange={e => setRecordContent(e.target.value)} style={{ minHeight:120 }} />
          </div>
          <button onClick={handleAddRecord} className="btn-primary">Save Record</button>
        </div>

        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <h3 style={{ color:'var(--text)', margin:0, fontSize:18, fontWeight:700 }}>📋 Medical Records</h3>
            <span style={{ background:'var(--brand)', color:'white', padding:'4px 10px', borderRadius:'var(--radius-md)', fontSize:12, fontWeight:600 }}>{records.length}</span>
          </div>

          {records.length === 0 ? <p style={{ color:'#6B7A99' }}>No records yet.</p> :
            records.map(r => {
              const rec = r.record_data || { diagnosis: r.title, notes: r.content };
              const hash = r.record_hash || r.hash;
              return (
                <div key={r.id} className="card" style={{ marginBottom:16, borderLeft:'4px solid var(--brand)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:12 }}>
                    <div>
                      <h4 style={{ margin:'0 0 4px 0', fontWeight:700, fontSize:16, color:'var(--text)' }}>{rec.diagnosis || rec.title || 'Medical Record'}</h4>
                      <p style={{ color:'var(--muted)', margin:'0 0 8px 0', fontSize:13, lineHeight:1.5 }}>{rec.notes || rec.content || 'No details available.'}</p>
                    </div>
                  </div>
                  <div style={{ background:'var(--bg)', padding:12, borderRadius:'var(--radius-md)', marginBottom:12, fontSize:12, color:'var(--muted)' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      <div><strong>👤 Patient:</strong> {r.patient_name || r.patientName || 'Unknown'}</div>
                      <div><strong>👨‍⚕️ Created by:</strong> {r.created_by_name || 'Unknown'}</div>
                      <div><strong>📅 Created:</strong> {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</div>
                      {r.updated_at && <div><strong>✏️ Updated:</strong> {new Date(r.updated_at).toLocaleDateString()}</div>}
                    </div>
                    {hash && <div style={{ marginTop:8, fontSize:11, color:'var(--muted)', wordBreak:'break-all' }}><strong>🔒 Hash:</strong> {hash.substring(0,32)}...</div>}
                  </div>

                  {/* Edit / Delete controls (doctors/admins only) */}
                  {(user.role === 'admin' || user.role === 'doctor' || (user.role === 'patient' && user.id === r.patient_id)) && (
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => handleEditClick(r)} className="btn-primary btn-sm">Edit Record</button>
                      {(user.role === 'admin' || user.role === 'doctor') && (
                        <button onClick={() => handleDeleteRecord(r.id)} className="btn-danger btn-sm">Delete</button>
                      )}
                    </div>
                  )}

                  {/* Inline editor */}
                  {editingRecordId === r.id && (
                    <div style={{ marginTop:16, padding:16, background:'var(--bg)', borderRadius:'var(--radius-md)', display:'flex', flexDirection:'column', gap:12 }}>
                      <h4 style={{ margin:'0 0 8px 0', color:'var(--text)', fontSize:14, fontWeight:600 }}>Edit Record</h4>
                      {/* If patient editing own record, only allow notes/medication/allergies */}
                      {user.role === 'patient' ? (
                        <>
                          <textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Clinical notes..." style={{ minHeight:100 }} />
                          <div style={{ display:'flex', gap:8 }}>
                            <button onClick={handleSaveEdit} className="btn-primary btn-sm">Save Changes</button>
                            <button onClick={handleCancelEdit} className="btn-secondary btn-sm">Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Diagnosis / Title" />
                          <input placeholder="Medication" value={editMedication} onChange={e => setEditMedication(e.target.value)} />
                          <input placeholder="Allergies" value={editAllergies} onChange={e => setEditAllergies(e.target.value)} />
                          <textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Clinical notes..." style={{ minHeight:100 }} />
                          <div style={{ display:'flex', gap:8 }}>
                            <button onClick={handleSaveEdit} className="btn-primary btn-sm">Save Changes</button>
                            <button onClick={handleCancelEdit} className="btn-secondary btn-sm">Cancel</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );

  if (page === 'register') return (
    <div className={pageTransition ? 'page-exit' : 'page-container'} style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', padding:'20px' }}>
      {loading && <Spinner />}
      <div className="card mobile-card" style={{ width:'100%', maxWidth:420 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <img src={logo} alt="MedChain" style={{ width:40, height:40 }} />
            <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:'var(--text)' }}>MedChain</h1>
          </div>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
        <h2 style={{ color:'var(--text)', marginBottom:8, fontSize:24, fontWeight:700 }}>Create Account</h2>
        <p style={{ color:'var(--muted)', marginBottom:24, marginTop:0 }}>Join MedChain to manage your health records</p>
        {error && <div style={{ background:'var(--error)', color:'white', padding:'12px 14px', borderRadius:'var(--radius-md)', marginBottom:16, fontSize:14 }}>⚠️ {error}</div>}
        <div style={{ marginBottom:16 }}>
          <input placeholder="Full Name" value={fullName} onChange={e => { setFullName(e.target.value); setFullNameError(''); }} style={{ borderColor: fullNameError ? 'var(--error)' : undefined }} />
          {fullNameError && <p style={{ color:'var(--error)', fontSize:12, margin:'4px 0 0 0' }}>✗ {fullNameError}</p>}
        </div>
        <div style={{ marginBottom:16 }}>
          <input placeholder="Email Address" type="email" value={email} onChange={e => { setEmail(e.target.value); setEmailError(''); }} style={{ borderColor: emailError ? 'var(--error)' : undefined }} />
          {emailError && <p style={{ color:'var(--error)', fontSize:12, margin:'4px 0 0 0' }}>✗ {emailError}</p>}
        </div>
        <div style={{ marginBottom:16 }}>
          <input placeholder="Password" type="password" value={password} onChange={e => { setPassword(e.target.value); setPasswordError(''); }} style={{ borderColor: passwordError ? 'var(--error)' : undefined }} />
          {passwordError && <p style={{ color:'var(--error)', fontSize:12, margin:'4px 0 0 0' }}>✗ {passwordError}</p>}
        </div>
        <select value={role} onChange={e => setRole(e.target.value)} style={{ marginBottom:24 }}>
          <option value="patient">Patient</option>
          <option value="doctor">Doctor</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={handleRegister} className="btn-primary" style={{ width:'100%', marginBottom:16 }}>Create Account</button>
        <p style={{ textAlign:'center', margin:0, fontSize:14 }}>Already have an account? <span onClick={() => navigatePage('login')} style={{ color:'var(--brand)', cursor:'pointer', fontWeight:600, textDecoration:'none' }}>Sign In</span></p>
      </div>
    </div>
  );

  return (
    <div className={pageTransition ? 'page-exit' : 'page-container'} style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', padding:'20px' }}>
      {loading && <Spinner />}
      <div className="card mobile-card" style={{ width:'100%', maxWidth:420 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <img src={logo} alt="MedChain" style={{ width:40, height:40 }} />
            <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:'var(--text)' }}>MedChain</h1>
          </div>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
        <h2 style={{ color:'var(--text)', marginBottom:8, fontSize:24, fontWeight:700 }}>Welcome Back</h2>
        <p style={{ color:'var(--muted)', marginBottom:24, marginTop:0 }}>Secure Healthcare Records Management</p>
        {error && <div style={{ background:'var(--error)', color:'white', padding:'12px 14px', borderRadius:'var(--radius-md)', marginBottom:16, fontSize:14 }}>⚠️ {error}</div>}
        <div style={{ marginBottom:16 }}>
          <input placeholder="Email Address" type="email" value={email} onChange={e => { setEmail(e.target.value); setEmailError(''); }} style={{ borderColor: emailError ? 'var(--error)' : undefined }} />
          {emailError && <p style={{ color:'var(--error)', fontSize:12, margin:'4px 0 0 0' }}>✗ {emailError}</p>}
        </div>
        <div style={{ marginBottom:24 }}>
          <input placeholder="Password" type="password" value={password} onChange={e => { setPassword(e.target.value); setPasswordError(''); }} style={{ borderColor: passwordError ? 'var(--error)' : undefined }} />
          {passwordError && <p style={{ color:'var(--error)', fontSize:12, margin:'4px 0 0 0' }}>✗ {passwordError}</p>}
        </div>
        <button onClick={handleLogin} className="btn-primary" style={{ width:'100%', marginBottom:16 }}>Sign In</button>
        <p style={{ textAlign:'center', margin:0, fontSize:14 }}>Don't have an account? <span onClick={() => navigatePage('register')} style={{ color:'var(--brand)', cursor:'pointer', fontWeight:600, textDecoration:'none' }}>Create one</span></p>
      </div>
    </div>
  );
}

export default App;
