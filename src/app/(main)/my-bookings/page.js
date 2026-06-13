'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { DateUtils } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRouter } from 'next/navigation';

export default function MyBookingsPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadBookings(); }, []);

  const loadBookings = async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, rooms(name, building, capacity), profiles!bookings_user_id_fkey(name)')
      .eq('user_id', profile.id)
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false });
    if (error) toast.error(error.message);
    setBookings(data || []);
    setLoading(false);
  };

  const cancelBooking = async (bookingId, title) => {
    if (!confirm(`ต้องการยกเลิกการจอง "${title}" หรือไม่?`)) return;
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', bookingId);
      if (error) throw error;
      await supabase.from('booking_logs').insert({
        booking_id: bookingId, action: 'ยกเลิกการจอง',
        old_status: 'pending', new_status: 'cancelled',
        changed_by: profile.id, note: 'ผู้ใช้ยกเลิกการจอง',
      });
      toast.success('ยกเลิกการจองสำเร็จ!');
      loadBookings();
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);
  const counts = {
    all: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    approved: bookings.filter(b => b.status === 'approved').length,
    rejected: bookings.filter(b => b.status === 'rejected').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="fade-in">
      <div className="tabs">
        {[
          { key: 'all', label: `ทั้งหมด (${counts.all})` },
          { key: 'pending', label: `🟡 รออนุมัติ (${counts.pending})` },
          { key: 'approved', label: `🟢 อนุมัติแล้ว (${counts.approved})` },
          { key: 'rejected', label: `🔴 ปฏิเสธ (${counts.rejected})` },
          { key: 'cancelled', label: `⚫ ยกเลิก (${counts.cancelled})` },
        ].map(t => (
          <button key={t.key} className={`tab-btn ${filter === t.key ? 'active' : ''}`}
            onClick={() => setFilter(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>ยังไม่มีการจอง</h3>
          <p>คุณยังไม่มีการจองห้องประชุม</p>
          <button className="btn btn-primary" onClick={() => router.push('/booking')}>📅 จองห้องประชุม</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(b => {
            const isPast = DateUtils.isPast(b.booking_date);
            const canCancel = ['pending', 'approved'].includes(b.status) && !isPast;
            return (
              <div key={b.id} className="card" style={{ transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}>
                <div style={{ padding: 20, display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Date Badge */}
                  <div style={{
                    width: 64, height: 64, borderRadius: 'var(--border-radius-sm)',
                    background: 'linear-gradient(135deg, var(--primary-600), var(--primary-800))',
                    color: 'white', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, lineHeight: 1 }}>
                      {new Date(b.booking_date).getDate()}
                    </div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                      {DateUtils.getThaiMonth(new Date(b.booking_date).getMonth()).slice(0, 3)}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1rem' }}>{b.title}</strong>
                      <StatusBadge status={b.status} />
                      {isPast && <span className="badge badge-cancelled">ผ่านไปแล้ว</span>}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                      🏢 {b.rooms?.name || '-'} · {b.rooms?.building || '-'}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span>📅 {DateUtils.formatDate(b.booking_date, 'short')}</span>
                      <span>🕐 {DateUtils.formatTime(b.start_time)} - {DateUtils.formatTime(b.end_time)}</span>
                      <span>👥 {b.attendees_count || 1} คน</span>
                    </div>
                    {b.admin_note && (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.8rem' }}>
                        💬 <strong>หมายเหตุจาก Admin:</strong> {b.admin_note}
                      </div>
                    )}
                    {b.description && (
                      <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.description}</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {canCancel && (
                      <button className="btn btn-danger btn-sm" onClick={() => cancelBooking(b.id, b.title)}>
                        ❌ ยกเลิก
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
