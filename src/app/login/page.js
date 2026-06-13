'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('student');
  const [regPhone, setRegPhone] = useState('');
  const [regStudentId, setRegStudentId] = useState('');
  const [regDepartment, setRegDepartment] = useState('');

  // Admin promote
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminCode, setAdminCode] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.push('/');
    };
    checkSession();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      toast.success('เข้าสู่ระบบสำเร็จ!');
      setTimeout(() => router.push('/'), 800);
    } catch (err) {
      toast.error(err.message === 'Invalid login credentials'
        ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          data: {
            name: regName,
            role: regRole,
            phone: regPhone,
            student_id: regStudentId,
            department: regDepartment,
          },
        },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          name: regName,
          email: regEmail,
          role: regRole,
          phone: regPhone,
          student_id: regStudentId,
          department: regDepartment,
        });
      }
      toast.success('สมัครสมาชิกสำเร็จ! กำลังเข้าสู่ระบบ...');
      setTimeout(() => router.push('/'), 1000);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/' },
      });
      if (error) throw error;
    } catch {
      toast.error('ไม่สามารถเข้าสู่ระบบด้วย Google ได้');
    }
  };

  const promoteAdmin = async () => {
    if (!adminCode) { toast.warning('กรุณากรอกรหัสผู้ดูแลระบบ'); return; }
    try {
      const { data, error } = await supabase.rpc('promote_to_admin', { secret_code: adminCode });
      if (error) throw error;
      if (data?.success) toast.success(data.message);
      else toast.error(data?.message || 'รหัสไม่ถูกต้อง');
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  return (
    <div className="login-page">
      {/* Decorative circles */}
      <div style={{ position: 'absolute', width: 200, height: 200, border: '2px solid rgba(255,255,255,0.08)', borderRadius: '50%', top: '10%', left: '5%', animation: 'float 10s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', width: 150, height: 150, border: '2px solid rgba(255,255,255,0.05)', borderRadius: '50%', bottom: '15%', right: '10%', animation: 'float 7s ease-in-out infinite reverse' }} />
      <div style={{ position: 'absolute', width: 100, height: 100, border: '2px solid rgba(255,255,255,0.04)', borderRadius: '50%', top: '50%', right: '25%', animation: 'float 12s ease-in-out infinite' }} />

      <div className="login-container">
        <div className="login-logo">
          <div className="logo-icon">🏛️</div>
          <h1>ระบบจองห้องประชุม</h1>
          <p>คณะวิทยาศาสตร์และนวัตกรรมดิจิทัล</p>
        </div>

        {/* Tab Switcher */}
        <div className="tabs" style={{ justifyContent: 'center', marginBottom: 24 }}>
          <button className={`tab-btn ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
            เข้าสู่ระบบ
          </button>
          <button className={`tab-btn ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
            สมัครสมาชิก
          </button>
        </div>

        {/* Login Form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">อีเมล <span className="required">*</span></label>
              <input type="email" className="form-input" placeholder="example@university.ac.th" required
                value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">รหัสผ่าน <span className="required">*</span></label>
              <input type="password" className="form-input" placeholder="••••••••" required minLength={6}
                value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? <><div className="spinner" /> กำลังเข้าสู่ระบบ...</> : 'เข้าสู่ระบบ'}
            </button>
          </form>
        )}

        {/* Register Form */}
        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">ชื่อ-นามสกุล <span className="required">*</span></label>
              <input type="text" className="form-input" placeholder="ชื่อ นามสกุล" required
                value={regName} onChange={e => setRegName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">อีเมล <span className="required">*</span></label>
              <input type="email" className="form-input" placeholder="example@university.ac.th" required
                value={regEmail} onChange={e => setRegEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">รหัสผ่าน <span className="required">*</span></label>
              <input type="password" className="form-input" placeholder="อย่างน้อย 6 ตัวอักษร" required minLength={6}
                value={regPassword} onChange={e => setRegPassword(e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">ประเภทผู้ใช้</label>
                <select className="form-select" value={regRole} onChange={e => setRegRole(e.target.value)}>
                  <option value="student">นิสิต</option>
                  <option value="staff">อาจารย์/บุคลากร</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">เบอร์โทรศัพท์</label>
                <input type="tel" className="form-input" placeholder="08x-xxx-xxxx"
                  value={regPhone} onChange={e => setRegPhone(e.target.value)} />
              </div>
            </div>
            {regRole === 'student' && (
              <div className="form-group">
                <label className="form-label">รหัสนิสิต</label>
                <input type="text" className="form-input" placeholder="6xxxxxxxxx"
                  value={regStudentId} onChange={e => setRegStudentId(e.target.value)} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">ภาควิชา/สาขา</label>
              <input type="text" className="form-input" placeholder="เช่น วิทยาการคอมพิวเตอร์"
                value={regDepartment} onChange={e => setRegDepartment(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? <><div className="spinner" /> กำลังสมัคร...</> : 'สมัครสมาชิก'}
            </button>
          </form>
        )}

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>หรือ</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
        </div>

        {/* Google Login */}
        <button className="btn btn-secondary btn-block" onClick={handleGoogleLogin} style={{ padding: 12 }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
          </svg>
          เข้าสู่ระบบด้วย Google
        </button>

        {/* Admin Section */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAdmin(!showAdmin)} style={{ fontSize: '0.78rem' }}>
            🔑 สำหรับผู้ดูแลระบบ
          </button>
          {showAdmin && (
            <div style={{ marginTop: 12 }}>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <input type="password" className="form-input" placeholder="กรอกรหัสผู้ดูแลระบบ"
                  style={{ textAlign: 'center', fontSize: '0.85rem' }}
                  value={adminCode} onChange={e => setAdminCode(e.target.value)} />
              </div>
              <button className="btn btn-warning btn-sm btn-block" onClick={promoteAdmin}>
                อัพเกรดเป็น Admin
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
