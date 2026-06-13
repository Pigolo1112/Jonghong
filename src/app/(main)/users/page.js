'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { DateUtils, getInitials } from '@/lib/utils';
import RoleBadge from '@/components/ui/RoleBadge';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function UsersPage() {
  const { profile, isAdmin } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [roleModal, setRoleModal] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [bookingsModal, setBookingsModal] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  useEffect(() => { if (isAdmin()) loadUsers(); else setLoading(false); }, []);

  const loadUsers = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setUsers(data || []);
    setLoading(false);
  };

  if (!isAdmin()) {
    return <div className="empty-state"><div className="empty-icon">🔒</div><h3>ไม่มีสิทธิ์เข้าถึง</h3></div>;
  }

  let filtered = users;
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(u =>
      (u.name || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s) ||
      (u.department || '').toLowerCase().includes(s) ||
      (u.student_id || '').toLowerCase().includes(s)
    );
  }
  if (roleFilter) filtered = filtered.filter(u => u.role === roleFilter);

  const counts = {
    total: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    staff: users.filter(u => u.role === 'staff').length,
    student: users.filter(u => u.role === 'student').length,
  };

  const changeRole = (user) => {
    if (user.id === profile.id) { toast.warning('ไม่สามารถเปลี่ยนบทบาทตนเองได้'); return; }
    setRoleModal(user);
    setNewRole(user.role);
  };

  const confirmRoleChange = async () => {
    if (!roleModal) return;
    try {
      const { error } = await supabase.from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', roleModal.id);
      if (error) throw error;
      setRoleModal(null);
      toast.success('เปลี่ยนบทบาทสำเร็จ!');
      loadUsers();
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const viewUserBookings = async (userId, userName) => {
    setBookingsModal({ name: userName });
    setBookingsLoading(true);
    const { data } = await supabase.from('bookings').select('*, rooms(name)')
      .eq('user_id', userId).order('booking_date', { ascending: false }).limit(20);
    setUserBookings(data || []);
    setBookingsLoading(false);
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="fade-in">
      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-icon blue">👥</div><div className="stat-info"><div className="stat-label">ผู้ใช้ทั้งหมด</div><div className="stat-value">{counts.total}</div></div></div>
        <div className="stat-card"><div className="stat-icon red">🛡️</div><div className="stat-info"><div className="stat-label">Admin</div><div className="stat-value">{counts.admin}</div></div></div>
        <div className="stat-card"><div className="stat-icon blue">👨‍🏫</div><div className="stat-info"><div className="stat-label">อาจารย์/บุคลากร</div><div className="stat-value">{counts.staff}</div></div></div>
        <div className="stat-card"><div className="stat-icon green">🎓</div><div className="stat-info"><div className="stat-label">นิสิต</div><div className="stat-value">{counts.student}</div></div></div>
      </div>

      {/* Search */}
      <div className="search-bar">
        <div className="search-input-group">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="ค้นหาผู้ใช้..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-group">
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">ทุกบทบาท</option>
            <option value="admin">Admin</option>
            <option value="staff">อาจารย์/บุคลากร</option>
            <option value="student">นิสิต</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">👥</div><h3>ไม่พบผู้ใช้</h3></div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr><th>ผู้ใช้</th><th>อีเมล</th><th>บทบาท</th><th>ภาควิชา</th><th>เบอร์โทร</th><th>เข้าร่วมเมื่อ</th><th>การจัดการ</th></tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary-400), var(--primary-600))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0
                      }}>{getInitials(u.name)}</div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{u.name || '-'}</div>
                        {u.student_id && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>รหัส: {u.student_id}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{u.email || '-'}</td>
                  <td><RoleBadge role={u.role} /></td>
                  <td style={{ fontSize: '0.85rem' }}>{u.department || '-'}</td>
                  <td style={{ fontSize: '0.85rem' }}>{u.phone || '-'}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{DateUtils.formatDate(u.created_at, 'short')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => changeRole(u)}>🔄 เปลี่ยนบทบาท</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => viewUserBookings(u.id, u.name)}>📋</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Change Role Modal */}
      <Modal isOpen={!!roleModal} onClose={() => setRoleModal(null)} title="🔄 เปลี่ยนบทบาทผู้ใช้"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setRoleModal(null)}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={confirmRoleChange}>บันทึก</button>
        </>}>
        <p style={{ marginBottom: 16 }}>เปลี่ยนบทบาทของ <strong>{roleModal?.name}</strong></p>
        <div className="form-group">
          <label className="form-label">บทบาทใหม่</label>
          <select className="form-select" value={newRole} onChange={e => setNewRole(e.target.value)}>
            <option value="student">🎓 นิสิต</option>
            <option value="staff">👨‍🏫 อาจารย์/บุคลากร</option>
            <option value="admin">🛡️ ผู้ดูแลระบบ</option>
          </select>
        </div>
      </Modal>

      {/* User Bookings Modal */}
      <Modal isOpen={!!bookingsModal} onClose={() => setBookingsModal(null)} title={`📋 ประวัติการจอง — ${bookingsModal?.name}`} size="lg"
        footer={<button className="btn btn-secondary" onClick={() => setBookingsModal(null)}>ปิด</button>}>
        {bookingsLoading ? <LoadingSpinner /> : userBookings.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📭</div><h3>ยังไม่มีการจอง</h3></div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>วันที่</th><th>ห้อง</th><th>เวลา</th><th>หัวข้อ</th><th>สถานะ</th></tr></thead>
              <tbody>
                {userBookings.map(b => (
                  <tr key={b.id}>
                    <td>{DateUtils.formatDate(b.booking_date, 'short')}</td>
                    <td>{b.rooms?.name || '-'}</td>
                    <td>{DateUtils.formatTime(b.start_time)}-{DateUtils.formatTime(b.end_time)}</td>
                    <td>{b.title}</td>
                    <td><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
