'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { DateUtils, formatNumber } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { profile, isAdmin } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const today = DateUtils.getToday();
      const [roomsRes, todayBookingsRes, pendingRes, myBookingsRes, allBookingsRes] = await Promise.all([
        supabase.from('rooms').select('*').eq('is_active', true),
        supabase.from('bookings').select('*, rooms(name), profiles!bookings_user_id_fkey(name)').eq('booking_date', today).in('status', ['approved', 'pending']),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('bookings').select('*, rooms(name), profiles!bookings_user_id_fkey(name)').order('created_at', { ascending: false }).limit(10),
      ]);

      setData({
        rooms: roomsRes.data || [],
        todayBookings: todayBookingsRes.data || [],
        pendingCount: pendingRes.count || 0,
        myBookingsCount: myBookingsRes.count || 0,
        recentBookings: allBookingsRes.data || [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" />;
  if (!data) return null;

  const { rooms, todayBookings, pendingCount, myBookingsCount, recentBookings } = data;
  const utilization = rooms.length > 0 ? Math.round((todayBookings.length / rooms.length) * 100) : 0;

  return (
    <div className="fade-in">
      {/* Welcome */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>
          สวัสดี, {profile?.name || 'ผู้ใช้'} 👋
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {DateUtils.formatDate(new Date(), 'long')} — ยินดีต้อนรับสู่ระบบจองห้องประชุม
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">🏢</div>
          <div className="stat-info">
            <div className="stat-label">ห้องประชุมทั้งหมด</div>
            <div className="stat-value">{formatNumber(rooms.length)}</div>
            <div className="stat-change up">ห้องพร้อมใช้งาน</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📅</div>
          <div className="stat-info">
            <div className="stat-label">การจองวันนี้</div>
            <div className="stat-value">{formatNumber(todayBookings.length)}</div>
            <div className="stat-change">รายการ</div>
          </div>
        </div>
        {isAdmin() ? (
          <div className="stat-card">
            <div className="stat-icon yellow">⏳</div>
            <div className="stat-info">
              <div className="stat-label">รออนุมัติ</div>
              <div className="stat-value">{formatNumber(pendingCount)}</div>
              <div className="stat-change" style={{ color: 'var(--warning-500)' }}>รายการ</div>
            </div>
          </div>
        ) : (
          <div className="stat-card">
            <div className="stat-icon purple">📋</div>
            <div className="stat-info">
              <div className="stat-label">การจองของฉัน</div>
              <div className="stat-value">{formatNumber(myBookingsCount)}</div>
              <div className="stat-change">รายการทั้งหมด</div>
            </div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-icon red">📊</div>
          <div className="stat-info">
            <div className="stat-label">อัตราการใช้งานวันนี้</div>
            <div className="stat-value">{utilization}%</div>
            <div className="stat-change">{utilization > 50 ? '🔥 ใช้งานเยอะ' : '✅ ยังมีห้องว่าง'}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isAdmin() ? '1fr 1fr' : '1fr', gap: 20 }}>
        {/* Today's Schedule */}
        <div className="card">
          <div className="card-header">
            <h3>📅 การจองวันนี้</h3>
            <button className="btn btn-primary btn-sm" onClick={() => router.push('/booking')}>+ จองห้อง</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {todayBookings.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-icon">📭</div>
                <h3>ไม่มีการจองวันนี้</h3>
                <p>ห้องประชุมทั้งหมดว่าง พร้อมให้จอง</p>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ห้อง</th>
                      <th>เวลา</th>
                      <th>หัวข้อ</th>
                      <th>ผู้จอง</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayBookings.map(b => (
                      <tr key={b.id}>
                        <td><strong>{b.rooms?.name || '-'}</strong></td>
                        <td>{DateUtils.formatTime(b.start_time)} - {DateUtils.formatTime(b.end_time)}</td>
                        <td>{b.title}</td>
                        <td>{b.profiles?.name || '-'}</td>
                        <td><StatusBadge status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recent Bookings (Admin) */}
        {isAdmin() && (
          <div className="card">
            <div className="card-header">
              <h3>🕐 การจองล่าสุด</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => router.push('/approval')}>ดูทั้งหมด →</button>
            </div>
            <div className="card-body" style={{ padding: 12 }}>
              {recentBookings.length === 0 ? (
                <p className="text-center text-muted">ยังไม่มีการจอง</p>
              ) : (
                recentBookings.slice(0, 6).map(b => (
                  <div key={b.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    borderRadius: 'var(--border-radius-sm)', transition: 'background 0.2s', cursor: 'pointer'
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 'var(--border-radius-sm)',
                      background: 'var(--primary-50)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0
                    }}>📅</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {b.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {b.rooms?.name || '-'} · {DateUtils.formatDate(b.booking_date, 'short')}
                      </div>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Room Status */}
      <div className="card mt-3">
        <div className="card-header">
          <h3>🏢 สถานะห้องประชุม</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/rooms')}>ดูทั้งหมด →</button>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {rooms.map(room => {
              const roomBookings = todayBookings.filter(b => b.room_id === room.id && b.status === 'approved');
              const isBusy = roomBookings.length > 0;
              return (
                <div key={room.id}
                  style={{
                    padding: 16, borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                  onClick={() => router.push(`/booking?room=${room.id}`)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-300)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: isBusy ? 'var(--warning-500)' : 'var(--success-500)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{room.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{room.building} · {room.capacity} ที่นั่ง</div>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: isBusy ? 'var(--warning-600)' : 'var(--success-600)', fontWeight: 500 }}>
                    {isBusy ? `ใช้งาน ${roomBookings.length} รายการ` : 'ว่าง'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
