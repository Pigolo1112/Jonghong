/* ================================================
   ระบบจองห้องประชุม — Dashboard Module
   ================================================ */

import { supabase } from './supabase-config.js';
import { getProfile, isAdmin } from './auth.js';
import { DateUtils, getStatusBadge, formatNumber, showLoading } from './utils.js';

async function renderDashboard() {
    const content = document.getElementById('page-content');
    showLoading('page-content');

    try {
        // Load all data
        const profile = getProfile();
        const today = DateUtils.getToday();

        const [roomsRes, todayBookingsRes, pendingRes, myBookingsRes, allBookingsRes] = await Promise.all([
            supabase.from('rooms').select('*').eq('is_active', true),
            supabase.from('bookings').select('*, rooms(name), profiles(name)').eq('booking_date', today).in('status', ['approved', 'pending']),
            supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
            supabase.from('bookings').select('*, rooms(name), profiles(name)').order('created_at', { ascending: false }).limit(10)
        ]);

        const totalRooms = roomsRes.data?.length || 0;
        const todayBookings = todayBookingsRes.data || [];
        const pendingCount = pendingRes.count || 0;
        const myBookingsCount = myBookingsRes.count || 0;
        const recentBookings = allBookingsRes.data || [];

        // Calculate utilization (simple: bookings today / total rooms * 100)
        const utilization = totalRooms > 0 ? Math.round((todayBookings.length / totalRooms) * 100) : 0;

        content.innerHTML = `
            <div class="fade-in">
                <!-- Welcome -->
                <div style="margin-bottom:24px">
                    <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:4px">
                        สวัสดี, ${profile.name || 'ผู้ใช้'} 👋
                    </h2>
                    <p style="color:var(--text-secondary);font-size:0.9rem">
                        ${DateUtils.formatDate(new Date(), 'long')} — ยินดีต้อนรับสู่ระบบจองห้องประชุม
                    </p>
                </div>

                <!-- Stats Cards -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon blue">🏢</div>
                        <div class="stat-info">
                            <div class="stat-label">ห้องประชุมทั้งหมด</div>
                            <div class="stat-value">${formatNumber(totalRooms)}</div>
                            <div class="stat-change up">ห้องพร้อมใช้งาน</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">📅</div>
                        <div class="stat-info">
                            <div class="stat-label">การจองวันนี้</div>
                            <div class="stat-value">${formatNumber(todayBookings.length)}</div>
                            <div class="stat-change">รายการ</div>
                        </div>
                    </div>
                    ${isAdmin() ? `
                    <div class="stat-card">
                        <div class="stat-icon yellow">⏳</div>
                        <div class="stat-info">
                            <div class="stat-label">รออนุมัติ</div>
                            <div class="stat-value">${formatNumber(pendingCount)}</div>
                            <div class="stat-change" style="color:var(--warning-500)">รายการ</div>
                        </div>
                    </div>
                    ` : `
                    <div class="stat-card">
                        <div class="stat-icon purple">📋</div>
                        <div class="stat-info">
                            <div class="stat-label">การจองของฉัน</div>
                            <div class="stat-value">${formatNumber(myBookingsCount)}</div>
                            <div class="stat-change">รายการทั้งหมด</div>
                        </div>
                    </div>
                    `}
                    <div class="stat-card">
                        <div class="stat-icon red">📊</div>
                        <div class="stat-info">
                            <div class="stat-label">อัตราการใช้งานวันนี้</div>
                            <div class="stat-value">${utilization}%</div>
                            <div class="stat-change">${utilization > 50 ? '🔥 ใช้งานเยอะ' : '✅ ยังมีห้องว่าง'}</div>
                        </div>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                    <!-- Today's Schedule -->
                    <div class="card" style="grid-column:${isAdmin() ? '1' : '1 / -1'}">
                        <div class="card-header">
                            <h3>📅 การจองวันนี้</h3>
                            <button class="btn btn-primary btn-sm" onclick="navigateTo('booking')">+ จองห้อง</button>
                        </div>
                        <div class="card-body" style="padding:0">
                            ${todayBookings.length === 0 ? `
                                <div class="empty-state" style="padding:40px">
                                    <div class="empty-icon">📭</div>
                                    <h3>ไม่มีการจองวันนี้</h3>
                                    <p>ห้องประชุมทั้งหมดว่าง พร้อมให้จอง</p>
                                </div>
                            ` : `
                                <div class="table-container" style="border:none;border-radius:0">
                                    <table class="data-table">
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
                                            ${todayBookings.map(b => `
                                                <tr>
                                                    <td><strong>${b.rooms?.name || '-'}</strong></td>
                                                    <td>${DateUtils.formatTime(b.start_time)} - ${DateUtils.formatTime(b.end_time)}</td>
                                                    <td>${b.title}</td>
                                                    <td>${b.profiles?.name || '-'}</td>
                                                    <td>${getStatusBadge(b.status)}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- Recent Bookings (Admin) or Quick Room Status -->
                    ${isAdmin() ? `
                    <div class="card">
                        <div class="card-header">
                            <h3>🕐 การจองล่าสุด</h3>
                            <button class="btn btn-ghost btn-sm" onclick="navigateTo('approval')">ดูทั้งหมด →</button>
                        </div>
                        <div class="card-body" style="padding:12px">
                            ${recentBookings.length === 0 ? '<p class="text-center text-muted">ยังไม่มีการจอง</p>' : 
                            recentBookings.slice(0, 6).map(b => `
                                <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--border-radius-sm);transition:background 0.2s" 
                                     onmouseover="this.style.background='var(--gray-50)'" 
                                     onmouseout="this.style.background='transparent'">
                                    <div style="width:40px;height:40px;border-radius:var(--border-radius-sm);background:var(--primary-50);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">
                                        📅
                                    </div>
                                    <div style="flex:1;min-width:0">
                                        <div style="font-size:0.85rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.title}</div>
                                        <div style="font-size:0.75rem;color:var(--text-secondary)">
                                            ${b.rooms?.name || '-'} · ${DateUtils.formatDate(b.booking_date, 'short')}
                                        </div>
                                    </div>
                                    <div>${getStatusBadge(b.status)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>

                <!-- Room Availability (Quick View) -->
                <div class="card mt-3">
                    <div class="card-header">
                        <h3>🏢 สถานะห้องประชุม</h3>
                        <button class="btn btn-ghost btn-sm" onclick="navigateTo('rooms')">ดูทั้งหมด →</button>
                    </div>
                    <div class="card-body">
                        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
                            ${(roomsRes.data || []).map(room => {
                                const roomBookings = todayBookings.filter(b => b.room_id === room.id && b.status === 'approved');
                                const isBusy = roomBookings.length > 0;
                                return `
                                    <div style="padding:16px;border-radius:var(--border-radius-sm);border:1px solid var(--border-color);display:flex;align-items:center;gap:12px;cursor:pointer;transition:all 0.2s"
                                         onclick="navigateTo('booking?room=${room.id}')"
                                         onmouseover="this.style.borderColor='var(--primary-300)';this.style.transform='translateY(-2px)'"
                                         onmouseout="this.style.borderColor='var(--border-color)';this.style.transform='none'">
                                        <div style="width:10px;height:10px;border-radius:50%;background:${isBusy ? 'var(--warning-500)' : 'var(--success-500)'};flex-shrink:0"></div>
                                        <div style="flex:1;min-width:0">
                                            <div style="font-size:0.85rem;font-weight:500">${room.name}</div>
                                            <div style="font-size:0.7rem;color:var(--text-secondary)">${room.building} · ${room.capacity} ที่นั่ง</div>
                                        </div>
                                        <div style="font-size:0.7rem;color:${isBusy ? 'var(--warning-600)' : 'var(--success-600)'};font-weight:500">
                                            ${isBusy ? `ใช้งาน ${roomBookings.length} รายการ` : 'ว่าง'}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
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
                <button class="btn btn-primary" onclick="location.reload()">ลองใหม่</button>
            </div>
        `;
    }
}

export { renderDashboard };
