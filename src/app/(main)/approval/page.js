'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { DateUtils } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function ApprovalPage() {
  const { profile, isAdmin } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [detailModal, setDetailModal] = useState(null);

  useEffect(() => { if (isAdmin()) loadBookings(); else setLoading(false); }, []);

  const loadBookings = async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, rooms(name, building, capacity), profiles!bookings_user_id_fkey(name, email, role, department, student_id)')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setBookings(data || []);
    setLoading(false);
  };

  if (!isAdmin()) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔒</div>
        <h3>ไม่มีสิทธิ์เข้าถึง</h3>
        <p>เฉพาะผู้ดูแลระบบเท่านั้น</p>
      </div>
    );
  }

  const counts = {
    pending: bookings.filter(b => b.status === 'pending').length,
    approved: bookings.filter(b => b.status === 'approved').length,
    rejected: bookings.filter(b => b.status === 'rejected').length,
  };

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  const approveBooking = async (bookingId) => {
    try {
      const { error } = await supabase.from('bookings').update({
        status: 'approved', approved_by: profile.id,
        approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', bookingId);
      if (error) throw error;
      await supabase.from('booking_logs').insert({
        booking_id: bookingId, action: 'อนุมัติการจอง',
        old_status: 'pending', new_status: 'approved', changed_by: profile.id,
      });
      toast.success('อนุมัติการจองสำเร็จ!');
      loadBookings();
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const confirmReject = async () => {
    if (!rejectModal) return;
    try {
      const { error } = await supabase.from('bookings').update({
        status: 'rejected', admin_note: rejectNote || null,
        approved_by: profile.id, approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', rejectModal);
      if (error) throw error;
      await supabase.from('booking_logs').insert({
        booking_id: rejectModal, action: 'ปฏิเสธการจอง',
        old_status: 'pending', new_status: 'rejected',
        changed_by: profile.id, note: rejectNote || null,
      });
      setRejectModal(null);
      setRejectNote('');
      toast.success('ปฏิเสธการจองสำเร็จ');
      loadBookings();
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const viewDetail = (booking) => setDetailModal(booking);

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="fade-in">
      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon yellow">⏳</div>
          <div className="stat-info"><div className="stat-label">รออนุมัติ</div><div className="stat-value">{counts.pending}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-info"><div className="stat-label">อนุมัติแล้ว</div><div className="stat-value">{counts.approved}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">❌</div>
          <div className="stat-info"><div className="stat-label">ปฏิเสธ</div><div className="stat-value">{counts.rejected}</div></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { key: 'pending', label: `⏳ รออนุมัติ (${counts.pending})` },
          { key: 'approved', label: `✅ อนุมัติแล้ว (${counts.approved})` },
          { key: 'rejected', label: `❌ ปฏิเสธ (${counts.rejected})` },
          { key: 'all', label: `ทั้งหมด (${bookings.length})` },
        ].map(t => (
          <button key={t.key} className={`tab-btn ${filter === t.key ? 'active' : ''}`}
            onClick={() => setFilter(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* Booking List */}
      {filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">✨</div><h3>ไม่มีรายการ</h3><p>ไม่มีการจองในหมวดนี้</p></div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ผู้จอง</th><th>ห้องประชุม</th><th>วันที่</th><th>เวลา</th><th>หัวข้อ</th><th>สถานะ</th><th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{b.profiles?.name || '-'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.profiles?.email || ''}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {b.profiles?.role === 'student' ? `นิสิต ${b.profiles?.student_id || ''}` :
                        b.profiles?.role === 'staff' ? 'อาจารย์/บุคลากร' : ''}
                      {b.profiles?.department ? ` · ${b.profiles.department}` : ''}
                    </div>
                  </td>
                  <td>
                    <strong>{b.rooms?.name || '-'}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.rooms?.building || ''}</div>
                  </td>
                  <td>{DateUtils.formatDate(b.booking_date, 'short')}</td>
                  <td>{DateUtils.formatTime(b.start_time)} - {DateUtils.formatTime(b.end_time)}</td>
                  <td>
                    <div style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={b.title}>{b.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>👥 {b.attendees_count || 1} คน</div>
                  </td>
                  <td><StatusBadge status={b.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {b.status === 'pending' && (
                        <>
                          <button className="btn btn-success btn-sm" onClick={() => approveBooking(b.id)}>✅ อนุมัติ</button>
                          <button className="btn btn-danger btn-sm" onClick={() => { setRejectModal(b.id); setRejectNote(''); }}>❌ ปฏิเสธ</button>
                        </>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => viewDetail(b)}>👁️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      <Modal isOpen={!!rejectModal} onClose={() => setRejectModal(null)} title="❌ ปฏิเสธการจอง"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setRejectModal(null)}>ยกเลิก</button>
          <button className="btn btn-danger" onClick={confirmReject}>ยืนยันปฏิเสธ</button>
        </>}>
        <div className="form-group">
          <label className="form-label">เหตุผลในการปฏิเสธ</label>
          <textarea className="form-textarea" value={rejectNote} onChange={e => setRejectNote(e.target.value)}
            placeholder="ระบุเหตุผล (ไม่บังคับ)" rows={3} />
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!detailModal} onClose={() => setDetailModal(null)} title="📋 รายละเอียดการจอง" size="lg"
        footer={<>
          {detailModal?.status === 'pending' && (
            <>
              <button className="btn btn-success" onClick={() => { setDetailModal(null); approveBooking(detailModal.id); }}>✅ อนุมัติ</button>
              <button className="btn btn-danger" onClick={() => { setDetailModal(null); setRejectModal(detailModal.id); setRejectNote(''); }}>❌ ปฏิเสธ</button>
            </>
          )}
          <button className="btn btn-secondary" onClick={() => setDetailModal(null)}>ปิด</button>
        </>}>
        {detailModal && (
          <div className="detail-grid">
            <div className="detail-label">หัวข้อ</div>
            <div className="detail-value"><strong>{detailModal.title}</strong></div>
            <div className="detail-label">สถานะ</div>
            <div className="detail-value"><StatusBadge status={detailModal.status} /></div>
            <div className="detail-label">ผู้จอง</div>
            <div className="detail-value">{detailModal.profiles?.name || '-'} ({detailModal.profiles?.email || '-'})</div>
            <div className="detail-label">ประเภท</div>
            <div className="detail-value">
              {detailModal.profiles?.role === 'student' ? `นิสิต ${detailModal.profiles?.student_id || ''}` :
                detailModal.profiles?.role === 'staff' ? 'อาจารย์/บุคลากร' : 'Admin'}
            </div>
            <div className="detail-label">ภาควิชา</div>
            <div className="detail-value">{detailModal.profiles?.department || '-'}</div>
            <div className="detail-label">ห้องประชุม</div>
            <div className="detail-value">{detailModal.rooms?.name || '-'} ({detailModal.rooms?.building || '-'})</div>
            <div className="detail-label">วันที่</div>
            <div className="detail-value">{DateUtils.formatDate(detailModal.booking_date, 'long')}</div>
            <div className="detail-label">เวลา</div>
            <div className="detail-value">{DateUtils.formatTime(detailModal.start_time)} - {DateUtils.formatTime(detailModal.end_time)}</div>
            <div className="detail-label">จำนวนผู้เข้าร่วม</div>
            <div className="detail-value">{detailModal.attendees_count || 1} คน</div>
            <div className="detail-label">รายละเอียด</div>
            <div className="detail-value">{detailModal.description || '-'}</div>
            <div className="detail-label">วันที่สร้าง</div>
            <div className="detail-value">{DateUtils.formatDateTime(detailModal.created_at)}</div>
            {detailModal.admin_note && (<>
              <div className="detail-label">หมายเหตุ Admin</div>
              <div className="detail-value">{detailModal.admin_note}</div>
            </>)}
          </div>
        )}
      </Modal>
    </div>
  );
}
