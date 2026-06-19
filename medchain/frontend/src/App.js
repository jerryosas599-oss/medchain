import React, { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_BASE_URL || 'http://localhost:5000/api';

function App() {
  const [page, setPage] = useState('login');
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('patient');
  const [error, setError] = useState('');
  // const [dbStatus, setDbStatus] = useState('checking...');
  const [records, setRecords] = useState([]);
  const [recordTitle, setRecordTitle] = useState('');
  const [recordContent, setRecordContent] = useState('');
  const [recordMsg, setRecordMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/health`)
      .then(r => r.json())
      // .then(() => setDbStatus('Connected ✅'))
      // .catch(() => setDbStatus('Not connected ❌'));
  }, []);

  
  const token = () => localStorage.getItem('token');
  const storedUser = () => JSON.parse(localStorage.getItem('user') || 'null');
  
  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch(`${API}/records`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (Array.isArray(data.records)) setRecords(data.records);
      else if (Array.isArray(data)) setRecords(data);
    } catch {}
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
    } catch {
      setError('Server error. Is backend running?');
    }
  };

  const handleRegister = async () => {
    setError('');
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, role })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      alert('Registered successfully! Please login.');
      setPage('login');
    } catch {
      setError('Server error. Is backend running?');
    }
  };

  const handleAddRecord = async () => {
    setRecordMsg('');
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
      fetchRecords();
    } catch {
      setRecordMsg('Failed to add record.');
    }
  };

  // Profile edit
  const [editingName, setEditingName] = useState(false);
  const [profileName, setProfileName] = useState('');

  const handleStartEdit = () => {
    setProfileName(user?.name || user?.full_name || '');
    setEditingName(true);
  };

  const handleSaveProfile = async () => {
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
  };

  if (user) return (
    <div style={{ fontFamily:'sans-serif', minHeight:'100vh', background:'#EEF2F7' }}>
      <div style={{ background:'#0B1F3A', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2 style={{ color:'white', margin:0 }}>🏥 MedChain</h2>
        <div>
          <span style={{ color:'rgba(255,255,255,0.7)', fontSize:14 }}>{user.name} · {user.role}</span>
          <button onClick={handleStartEdit} style={{ background:'#116980', color:'white', border:'none', padding:'6px 10px', borderRadius:6, marginLeft:8, cursor:'pointer' }}>Edit Name</button>
          <button onClick={() => { setUser(null); localStorage.removeItem('token'); localStorage.removeItem('user'); setPage('login'); }} style={{ background:'#0E7C7B', color:'white', border:'none', padding:'8px 16px', borderRadius:6, marginLeft:16, cursor:'pointer' }}>Logout</button>
        </div>
      </div>
      {editingName && (
        <div style={{ padding:16, display:'flex', gap:8 }}>
          <input value={profileName} onChange={e => setProfileName(e.target.value)} style={{ padding:8, borderRadius:6 }} />
          <button onClick={handleSaveProfile} style={{ background:'#0E7C7B', color:'white', border:'none', padding:'8px 12px', borderRadius:6 }}>Save</button>
          <button onClick={() => setEditingName(false)} style={{ background:'#ccc', border:'none', padding:'8px 12px', borderRadius:6 }}>Cancel</button>
        </div>
      )}
      <div style={{ padding:32 }}>
        <div style={{ background:'linear-gradient(135deg,#0B1F3A,#0E7C7B)', borderRadius:14, padding:32, marginBottom:24 }}>
          <div style={{ fontSize:13, opacity:0.7, color:'white' }}>Welcome back</div>
          <div style={{ fontSize:24, fontWeight:700, color:'white' }}>{user.name}</div>
          <div style={{ fontSize:13, opacity:0.6, color:'white', marginTop:4 }}>{user.role} · MedChain Secure System</div>
        </div>

        {/* <div style={{ background:'white', borderRadius:12, padding:24, marginBottom:24 }}>
          <h3 style={{ color:'#0B1F3A', marginTop:0 }}>System Status</h3>
          <p>✅ Backend running on port 5000</p>
          <p>✅ Frontend running on port 3000</p>
          <p>✅ SHA-256 hashing active</p>
          <p>🗄️ Database: {dbStatus}</p>
        </div> */}

        <div style={{ background:'white', borderRadius:12, padding:24, marginBottom:24 }}>
          <h3 style={{ color:'#0B1F3A', marginTop:0 }}>➕ Add Medical Record</h3>
          {recordMsg && <p style={{ color: recordMsg.includes('success') ? 'green' : 'red' }}>{recordMsg}</p>}
          <input placeholder="Record Title" value={recordTitle} onChange={e => setRecordTitle(e.target.value)} style={{ width:'100%', padding:10, marginBottom:12, borderRadius:8, border:'1px solid #ccc', boxSizing:'border-box' }} />
          <textarea placeholder="Record Content" value={recordContent} onChange={e => setRecordContent(e.target.value)} rows={4} style={{ width:'100%', padding:10, marginBottom:12, borderRadius:8, border:'1px solid #ccc', boxSizing:'border-box' }} />
          <button onClick={handleAddRecord} style={{ background:'#0E7C7B', color:'white', border:'none', padding:'10px 24px', borderRadius:8, cursor:'pointer' }}>Save Record</button>
        </div>

        <div style={{ background:'white', borderRadius:12, padding:24 }}>
          <h3 style={{ color:'#0B1F3A', marginTop:0 }}>📋 Medical Records ({records.length})</h3>
          {records.length === 0 ? <p style={{ color:'#6B7A99' }}>No records yet.</p> :
            records.map(r => {
              const rec = r.record_data || { diagnosis: r.title, notes: r.content };
              const hash = r.record_hash || r.hash;
              return (
                <div key={r.id} style={{ border:'1px solid #eee', borderRadius:8, padding:16, marginBottom:12 }}>
                  <div style={{ fontWeight:700, color:'#0B1F3A' }}>{rec.diagnosis || rec.title || 'Record'}</div>
                  <div style={{ color:'#6B7A99', fontSize:13, marginTop:4 }}>{rec.notes || rec.content || 'No details available.'}</div>
                  <div style={{ color:'#aaa', fontSize:11, fontWeight:500, marginTop:8 }}>Patient: {r.patient_name || r.patientName || 'Unknown'}</div>
                  <div style={{ color:'#aaa', fontSize:11, marginTop:4 }}>🔒 Hash: {hash?.substring(0,20)}...</div>
                  <div style={{ color:'#aaa', fontSize:11 }}>📅 {new Date(r.created_at).toLocaleDateString()}</div>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );

  if (page === 'register') return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#EEF2F7' }}>
      <div style={{ background:'white', padding:40, borderRadius:16, width:380 }}>
        <h2 style={{ color:'#0B1F3A' }}>🏥 MedChain Register</h2>
        {error && <p style={{ color:'red', fontSize:13 }}>{error}</p>}
        <input placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} style={{ width:'100%', padding:10, marginBottom:12, borderRadius:8, border:'1px solid #ccc', boxSizing:'border-box' }} />
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width:'100%', padding:10, marginBottom:12, borderRadius:8, border:'1px solid #ccc', boxSizing:'border-box' }} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width:'100%', padding:10, marginBottom:12, borderRadius:8, border:'1px solid #ccc', boxSizing:'border-box' }} />
        <select value={role} onChange={e => setRole(e.target.value)} style={{ width:'100%', padding:10, marginBottom:16, borderRadius:8, border:'1px solid #ccc', boxSizing:'border-box' }}>
          <option value="patient">Patient</option>
          <option value="doctor">Doctor</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={handleRegister} style={{ width:'100%', padding:12, background:'#0E7C7B', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:15 }}>Register</button>
        <p style={{ textAlign:'center', marginTop:16 }}>Already have an account? <span onClick={() => setPage('login')} style={{ color:'#0E7C7B', cursor:'pointer' }}>Login</span></p>
      </div>
    </div>
  );

  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#EEF2F7' }}>
      <div style={{ background:'white', padding:40, borderRadius:16, width:380 }}>
        <h2 style={{ color:'#0B1F3A' }}>🏥 MedChain Login</h2>
        <p style={{ color:'#6B7A99' }}>Secure Healthcare Records</p>
        {error && <p style={{ color:'red', fontSize:13 }}>{error}</p>}
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width:'100%', padding:10, marginBottom:12, borderRadius:8, border:'1px solid #ccc', boxSizing:'border-box' }} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width:'100%', padding:10, marginBottom:16, borderRadius:8, border:'1px solid #ccc', boxSizing:'border-box' }} />
        <button onClick={handleLogin} style={{ width:'100%', padding:12, background:'#0E7C7B', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:15 }}>Sign In</button>
        <p style={{ textAlign:'center', marginTop:16 }}>No account? <span onClick={() => setPage('register')} style={{ color:'#0E7C7B', cursor:'pointer' }}>Register</span></p>
      </div>
    </div>
  );
}

export default App;
