'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { DateUtils, formatNumber } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function ReportsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => { if (isAdmin()) loadReports(); else setLoading(false); }, []);

  const loadReports = async () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const [bookingsRes, roomsRes, usersRes] = await Promise.all([
      supabase.from('bookings').select('*, rooms(name), profiles!bookings_user_id_fkey(name, role)').gte('booking_date', startStr).lte('booking_date', endStr),
      supabase.from('rooms').select('*').eq('is_active', true),
      supabase.from('profiles').select('*'),
    ]);

    const bookings = bookingsRes.data || [];
    const rooms = roomsRes.data || [];
    const users = usersRes.data || [];

    const approved = bookings.filter(b => b.status === 'approved');
    const rejected = bookings.filter(b => b.status === 'rejected');
    const cancelled = bookings.filter(b => b.status === 'cancelled');
    const approvalRate = bookings.length > 0 ? Math.round((approved.length / bookings.length) * 100) : 0;

    // Room usage
    const roomUsage = {};
    rooms.forEach(r => { roomUsage[r.id] = { name: r.name, count: 0, hours: 0 }; });
    approved.forEach(b => {
      if (roomUsage[b.room_id]) {
        roomUsage[b.room_id].count++;
        roomUsage[b.room_id].hours += (DateUtils.timeToMinutes(b.end_time) - DateUtils.timeToMinutes(b.start_time)) / 60;
      }
    });

    // Daily trend (7 days)
    const dailyTrend = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dailyTrend[d.toISOString().split('T')[0]] = 0;
    }
    bookings.forEach(b => { if (dailyTrend[b.booking_date] !== undefined) dailyTrend[b.booking_date]++; });

    // Top bookers
    const bookerCount = {};
    bookings.forEach(b => { const name = b.profiles?.name || 'Unknown'; bookerCount[name] = (bookerCount[name] || 0) + 1; });
    const topBookers = Object.entries(bookerCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Peak hours
    const hourStats = {};
    for (let h = 8; h <= 19; h++) hourStats[h] = 0;
    approved.forEach(b => {
      const startH = parseInt(b.start_time.split(':')[0]);
      const endH = parseInt(b.end_time.split(':')[0]);
      for (let h = startH; h < endH; h++) { if (hourStats[h] !== undefined) hourStats[h]++; }
    });

    setData({
      bookings, rooms, users, approved, rejected, cancelled, approvalRate,
      roomUsage: Object.values(roomUsage).sort((a, b) => b.count - a.count),
      dailyTrend, topBookers, hourStats, startDate, endDate,
    });
    setLoading(false);
  };

  const exportCSV = async () => {
    try {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, rooms(name, building), profiles!bookings_user_id_fkey(name, email, role)')
        .order('booking_date', { ascending: false });
      if (!bookings?.length) { toast.warning('ไม่มีข้อมูลสำหรับส่งออก'); return; }
      const headers = ['ลำดับ', 'วันที่', 'ห้องประชุม', 'อาคาร', 'เวลาเริ่ม', 'เวลาสิ้นสุด', 'หัวข้อ', 'ผู้จอง', 'อีเมล', 'ประเภท', 'จำนวนคน', 'สถานะ'];
      const rows = bookings.map((b, i) => [
        i + 1, b.booking_date, b.rooms?.name || '', b.rooms?.building || '',
        b.start_time, b.end_time, `"${(b.title || '').replace(/"/g, '""')}"`,
        b.profiles?.name || '', b.profiles?.email || '', b.profiles?.role || '',
        b.attendees_count || 1, b.status,
      ]);
      const csv = '\ufeff' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `booking_report_${DateUtils.getToday()}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('ส่งออกรายงาน CSV สำเร็จ!');
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  if (!isAdmin()) {
    return <div className="empty-state"><div className="empty-icon">🔒</div><h3>ไม่มีสิทธิ์เข้าถึง</h3></div>;
  }

  if (loading) return <LoadingSpinner size="lg" />;
  if (!data) return null;

  const { bookings, users, approved, rejected, cancelled, approvalRate, roomUsage, dailyTrend, topBookers, hourStats, startDate, endDate } = data;
  const maxRoomCount = Math.max(...roomUsage.map(r => r.count), 1);
  const maxHourCount = Math.max(...Object.values(hourStats), 1);
  const maxDaily = Math.max(...Object.values(dailyTrend), 1);
  const colors = ['var(--primary-500)', 'var(--success-500)', 'var(--accent-500)', 'var(--info-500)', 'var(--danger-500)'];

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 2 }}>📈 รายงานสรุป</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            ข้อมูลย้อนหลัง 30 วัน ({DateUtils.formatDate(startDate, 'short')} - {DateUtils.formatDate(endDate, 'short')})
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={exportCSV}>📥 ส่งออก CSV</button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue">📊</div><div className="stat-info"><div className="stat-label">การจองทั้งหมด</div><div className="stat-value">{formatNumber(bookings.length)}</div></div></div>
        <div className="stat-card"><div className="stat-icon green">✅</div><div className="stat-info"><div className="stat-label">อนุมัติ</div><div className="stat-value">{formatNumber(approved.length)}</div><div className="stat-change up">อัตราอนุมัติ {approvalRate}%</div></div></div>
        <div className="stat-card"><div className="stat-icon red">❌</div><div className="stat-info"><div className="stat-label">ปฏิเสธ / ยกเลิก</div><div className="stat-value">{formatNumber(rejected.length + cancelled.length)}</div></div></div>
        <div className="stat-card"><div className="stat-icon purple">👥</div><div className="stat-info"><div className="stat-label">ผู้ใช้งานทั้งหมด</div><div className="stat-value">{formatNumber(users.length)}</div></div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Room Usage */}
        <div className="card">
          <div className="card-header"><h3>🏢 การใช้งานแต่ละห้อง</h3></div>
          <div className="card-body">
            <div className="chart-container">
              <div className="chart-bar-group">
                {roomUsage.map((r, i) => (
                  <div key={i} className="chart-bar-item">
                    <div className="chart-bar" style={{ height: Math.max(8, (r.count / maxRoomCount) * 180), background: colors[i % colors.length] }}>
                      <div className="tooltip">{r.name}: {r.count} ครั้ง ({r.hours.toFixed(1)} ชม.)</div>
                    </div>
                    <div className="chart-bar-label">{r.name.replace('ห้องประชุม ', '').substring(0, 8)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Peak Hours */}
        <div className="card">
          <div className="card-header"><h3>🕐 ช่วงเวลาที่นิยม</h3></div>
          <div className="card-body">
            <div className="chart-container">
              <div className="chart-bar-group">
                {Object.entries(hourStats).map(([hour, count]) => {
                  const intensity = count / maxHourCount;
                  const color = intensity > 0.7 ? 'var(--danger-500)' : intensity > 0.4 ? 'var(--warning-500)' : 'var(--success-500)';
                  return (
                    <div key={hour} className="chart-bar-item">
                      <div className="chart-bar" style={{ height: Math.max(4, (count / maxHourCount) * 180), background: color }}>
                        <div className="tooltip">{hour}:00 - {count} ครั้ง</div>
                      </div>
                      <div className="chart-bar-label">{hour}:00</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Trend */}
        <div className="card">
          <div className="card-header"><h3>📈 แนวโน้มการจอง (7 วัน)</h3></div>
          <div className="card-body">
            <div className="chart-container">
              <div className="chart-bar-group">
                {Object.entries(dailyTrend).map(([date, count]) => (
                  <div key={date} className="chart-bar-item">
                    <div className="chart-bar" style={{ height: Math.max(4, (count / maxDaily) * 180), background: 'var(--primary-400)' }}>
                      <div className="tooltip">{DateUtils.formatDate(date, 'short')}: {count} ครั้ง</div>
                    </div>
                    <div className="chart-bar-label">{DateUtils.getThaiDayShort(new Date(date).getDay())}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top Bookers */}
        <div className="card">
          <div className="card-header"><h3>🏆 ผู้จองบ่อยที่สุด</h3></div>
          <div className="card-body" style={{ padding: 12 }}>
            {topBookers.length === 0 ? <p className="text-center text-muted">ยังไม่มีข้อมูล</p> :
              topBookers.map(([name, count], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--border-radius-sm)' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: ['var(--accent-500)', 'var(--gray-400)', '#cd7f32', 'var(--primary-300)', 'var(--gray-300)'][i],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.8rem', color: 'white'
                  }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{name}</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-600)' }}>{count} ครั้ง</div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="card mt-3">
        <div className="card-header"><h3>📋 รายการจองทั้งหมด (30 วันย้อนหลัง)</h3></div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>วันที่</th><th>ห้อง</th><th>เวลา</th><th>หัวข้อ</th><th>ผู้จอง</th><th>สถานะ</th></tr>
              </thead>
              <tbody>
                {bookings.slice(0, 50).map((b, i) => (
                  <tr key={b.id}>
                    <td>{i + 1}</td>
                    <td>{DateUtils.formatDate(b.booking_date, 'short')}</td>
                    <td>{b.rooms?.name || '-'}</td>
                    <td>{DateUtils.formatTime(b.start_time)}-{DateUtils.formatTime(b.end_time)}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</td>
                    <td>{b.profiles?.name || '-'}</td>
                    <td><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
