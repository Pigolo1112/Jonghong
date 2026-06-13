/* ================================================
   ระบบจองห้องประชุม — Reports Module (Admin)
   ================================================ */

import { supabase } from './supabase-config.js';
import { isAdmin } from './auth.js';
import { DateUtils, showLoading, formatNumber, formatPercent, getStatusBadge, ToastManager } from './utils.js';

async function renderReports() {
    const content = document.getElementById('page-content');

    if (!isAdmin()) {
        content.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔒</div>
                <h3>ไม่มีสิทธิ์เข้าถึง</h3>
                <p>เฉพาะผู้ดูแลระบบเท่านั้น</p>
            </div>
        `;
        return;
    }

    showLoading('page-content');

    try {
        // Calculate date range (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        const [bookingsRes, roomsRes, usersRes] = await Promise.all([
            supabase.from('bookings').select('*, rooms(name), profiles(name, role)').gte('booking_date', startStr).lte('booking_date', endStr),
            supabase.from('rooms').select('*').eq('is_active', true),
            supabase.from('profiles').select('*')
        ]);

        const bookings = bookingsRes.data || [];
        const rooms = roomsRes.data || [];
        const users = usersRes.data || [];

        // Calculate stats
        const totalBookings = bookings.length;
        const approvedBookings = bookings.filter(b => b.status === 'approved').length;
        const rejectedBookings = bookings.filter(b => b.status === 'rejected').length;
        const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
        const approvalRate = totalBookings > 0 ? Math.round((approvedBookings / totalBookings) * 100) : 0;

        // Room usage stats
        const roomUsage = {};
        rooms.forEach(r => { roomUsage[r.id] = { name: r.name, count: 0, hours: 0 }; });
        bookings.filter(b => b.status === 'approved').forEach(b => {
            if (roomUsage[b.room_id]) {
                roomUsage[b.room_id].count++;
                const startMin = DateUtils.timeToMinutes(b.start_time);
                const endMin = DateUtils.timeToMinutes(b.end_time);
                roomUsage[b.room_id].hours += (endMin - startMin) / 60;
            }
        });

        // Daily booking trend (last 7 days)
        const dailyTrend = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            dailyTrend[key] = 0;
        }
        bookings.forEach(b => {
            if (dailyTrend[b.booking_date] !== undefined) {
                dailyTrend[b.booking_date]++;
            }
        });

        // Top bookers
        const bookerCount = {};
        bookings.forEach(b => {
            const name = b.profiles?.name || 'Unknown';
            bookerCount[name] = (bookerCount[name] || 0) + 1;
        });
        const topBookers = Object.entries(bookerCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Peak hours
        const hourStats = {};
        for (let h = 8; h <= 19; h++) {
            hourStats[h] = 0;
        }
        bookings.filter(b => b.status === 'approved').forEach(b => {
            const startH = parseInt(b.start_time.split(':')[0]);
            const endH = parseInt(b.end_time.split(':')[0]);
            for (let h = startH; h < endH; h++) {
                if (hourStats[h] !== undefined) hourStats[h]++;
            }
        });
        const maxHourCount = Math.max(...Object.values(hourStats), 1);

        // Room usage chart data
        const roomEntries = Object.values(roomUsage).sort((a, b) => b.count - a.count);
        const maxRoomCount = Math.max(...roomEntries.map(r => r.count), 1);

        content.innerHTML = `
            <div class="fade-in">
                <!-- Date Range Info -->
                <div style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
                    <div>
                        <h2 style="font-size:1.2rem;font-weight:600;margin-bottom:2px">📈 รายงานสรุป</h2>
                        <p style="font-size:0.85rem;color:var(--text-secondary)">
                            ข้อมูลย้อนหลัง 30 วัน (${DateUtils.formatDate(startDate, 'short')} - ${DateUtils.formatDate(endDate, 'short')})
                        </p>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="exportReport()">
                        📥 ส่งออก CSV
                    </button>
                </div>

                <!-- Summary Stats -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon blue">📊</div>
                        <div class="stat-info">
                            <div class="stat-label">การจองทั้งหมด</div>
                            <div class="stat-value">${formatNumber(totalBookings)}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">✅</div>
                        <div class="stat-info">
                            <div class="stat-label">อนุมัติ</div>
                            <div class="stat-value">${formatNumber(approvedBookings)}</div>
                            <div class="stat-change up">อัตราอนุมัติ ${approvalRate}%</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon red">❌</div>
                        <div class="stat-info">
                            <div class="stat-label">ปฏิเสธ / ยกเลิก</div>
                            <div class="stat-value">${formatNumber(rejectedBookings + cancelledBookings)}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon purple">👥</div>
                        <div class="stat-info">
                            <div class="stat-label">ผู้ใช้งานทั้งหมด</div>
                            <div class="stat-value">${formatNumber(users.length)}</div>
                        </div>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                    <!-- Room Usage Chart -->
                    <div class="card">
                        <div class="card-header">
                            <h3>🏢 การใช้งานแต่ละห้อง</h3>
                        </div>
                        <div class="card-body">
                            <div class="chart-container">
                                <div class="chart-bar-group">
                                    ${roomEntries.map((r, i) => {
                                        const height = Math.max(8, (r.count / maxRoomCount) * 180);
                                        const colors = ['var(--primary-500)', 'var(--success-500)', 'var(--accent-500)', 'var(--info-500)', 'var(--danger-500)'];
                                        return `
                                            <div class="chart-bar-item">
                                                <div class="chart-bar" style="height:${height}px;background:${colors[i % colors.length]}">
                                                    <div class="tooltip">${r.name}: ${r.count} ครั้ง (${r.hours.toFixed(1)} ชม.)</div>
                                                </div>
                                                <div class="chart-bar-label">${r.name.replace('ห้องประชุม ', '').substring(0, 6)}</div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Peak Hours Chart -->
                    <div class="card">
                        <div class="card-header">
                            <h3>🕐 ช่วงเวลาที่นิยม</h3>
                        </div>
                        <div class="card-body">
                            <div class="chart-container">
                                <div class="chart-bar-group">
                                    ${Object.entries(hourStats).map(([hour, count]) => {
                                        const height = Math.max(4, (count / maxHourCount) * 180);
                                        const intensity = count / maxHourCount;
                                        const color = intensity > 0.7 ? 'var(--danger-500)' : intensity > 0.4 ? 'var(--warning-500)' : 'var(--success-500)';
                                        return `
                                            <div class="chart-bar-item">
                                                <div class="chart-bar" style="height:${height}px;background:${color}">
                                                    <div class="tooltip">${hour}:00 - ${count} ครั้ง</div>
                                                </div>
                                                <div class="chart-bar-label">${hour}:00</div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Daily Trend -->
                    <div class="card">
                        <div class="card-header">
                            <h3>📈 แนวโน้มการจอง (7 วัน)</h3>
                        </div>
                        <div class="card-body">
                            <div class="chart-container">
                                <div class="chart-bar-group">
                                    ${Object.entries(dailyTrend).map(([date, count]) => {
                                        const maxDaily = Math.max(...Object.values(dailyTrend), 1);
                                        const height = Math.max(4, (count / maxDaily) * 180);
                                        const d = new Date(date);
                                        return `
                                            <div class="chart-bar-item">
                                                <div class="chart-bar" style="height:${height}px;background:var(--primary-400)">
                                                    <div class="tooltip">${DateUtils.formatDate(date, 'short')}: ${count} ครั้ง</div>
                                                </div>
                                                <div class="chart-bar-label">${DateUtils.getThaiDayShort(d.getDay())}</div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Top Bookers -->
                    <div class="card">
                        <div class="card-header">
                            <h3>🏆 ผู้จองบ่อยที่สุด</h3>
                        </div>
                        <div class="card-body" style="padding:12px">
                            ${topBookers.length === 0 ? '<p class="text-center text-muted">ยังไม่มีข้อมูล</p>' :
                            topBookers.map(([name, count], i) => `
                                <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--border-radius-sm)">
                                    <div style="width:32px;height:32px;border-radius:50%;background:${['var(--accent-500)','var(--gray-400)','#cd7f32','var(--primary-300)','var(--gray-300)'][i]};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;color:white">
                                        ${i + 1}
                                    </div>
                                    <div style="flex:1">
                                        <div style="font-size:0.875rem;font-weight:500">${name}</div>
                                    </div>
                                    <div style="font-size:0.85rem;font-weight:600;color:var(--primary-600)">${count} ครั้ง</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Detailed Table -->
                <div class="card mt-3">
                    <div class="card-header">
                        <h3>📋 รายการจองทั้งหมด (30 วันย้อนหลัง)</h3>
                    </div>
                    <div class="card-body" style="padding:0">
                        <div class="table-container" style="border:none;border-radius:0">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>วันที่</th>
                                        <th>ห้อง</th>
                                        <th>เวลา</th>
                                        <th>หัวข้อ</th>
                                        <th>ผู้จอง</th>
                                        <th>สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${bookings.slice(0, 50).map((b, i) => `
                                        <tr>
                                            <td>${i + 1}</td>
                                            <td>${DateUtils.formatDate(b.booking_date, 'short')}</td>
                                            <td>${b.rooms?.name || '-'}</td>
                                            <td>${DateUtils.formatTime(b.start_time)}-${DateUtils.formatTime(b.end_time)}</td>
                                            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${b.title}</td>
                                            <td>${b.profiles?.name || '-'}</td>
                                            <td>${getStatusBadge(b.status)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

    } catch (err) {
        content.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h3>เกิดข้อผิดพลาด</h3>
                <p>${err.message}</p>
            </div>
        `;
    }
}




// Export CSV
window.exportReport = async function() {
    try {
        const { data: bookings } = await supabase
            .from('bookings')
            .select('*, rooms(name, building), profiles(name, email, role)')
            .order('booking_date', { ascending: false });

        if (!bookings || bookings.length === 0) {
            ToastManager.warning('ไม่มีข้อมูลสำหรับส่งออก');
            return;
        }

        // Build CSV
        const headers = ['ลำดับ', 'วันที่', 'ห้องประชุม', 'อาคาร', 'เวลาเริ่ม', 'เวลาสิ้นสุด', 'หัวข้อ', 'ผู้จอง', 'อีเมล', 'ประเภท', 'จำนวนคน', 'สถานะ'];
        const rows = bookings.map((b, i) => [
            i + 1,
            b.booking_date,
            b.rooms?.name || '',
            b.rooms?.building || '',
            b.start_time,
            b.end_time,
            `"${(b.title || '').replace(/"/g, '""')}"`,
            b.profiles?.name || '',
            b.profiles?.email || '',
            b.profiles?.role || '',
            b.attendees_count || 1,
            b.status
        ]);

        const csv = '\ufeff' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `booking_report_${DateUtils.getToday()}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        import('./utils.js').then(m => m.ToastManager.success('ส่งออกรายงาน CSV สำเร็จ!'));
    } catch (err) {
        import('./utils.js').then(m => m.ToastManager.error('เกิดข้อผิดพลาด: ' + err.message));
    }
};

export { renderReports };
