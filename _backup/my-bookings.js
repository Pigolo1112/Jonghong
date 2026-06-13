/* ================================================
   ระบบจองห้องประชุม — My Bookings Module
   ================================================ */

import { supabase } from './supabase-config.js';
import { getProfile } from './auth.js';
import { ToastManager, DateUtils, getStatusBadge, showLoading, showEmpty, showConfirm } from './utils.js';

async function renderMyBookings() {
    const content = document.getElementById('page-content');
    showLoading('page-content');

    const profile = getProfile();

    try {
        const { data: bookings, error } = await supabase
            .from('bookings')
            .select('*, rooms(name, building, capacity), profiles(name)')
            .eq('user_id', profile.id)
            .order('booking_date', { ascending: false })
            .order('start_time', { ascending: false });

        if (error) throw error;

        const allBookings = bookings || [];

        content.innerHTML = `
            <div class="fade-in">
                <!-- Tabs for filtering -->
                <div class="tabs">
                    <button class="tab-btn active" data-filter="all" onclick="filterMyBookings('all', this)">
                        ทั้งหมด (${allBookings.length})
                    </button>
                    <button class="tab-btn" data-filter="pending" onclick="filterMyBookings('pending', this)">
                        🟡 รออนุมัติ (${allBookings.filter(b => b.status === 'pending').length})
                    </button>
                    <button class="tab-btn" data-filter="approved" onclick="filterMyBookings('approved', this)">
                        🟢 อนุมัติแล้ว (${allBookings.filter(b => b.status === 'approved').length})
                    </button>
                    <button class="tab-btn" data-filter="rejected" onclick="filterMyBookings('rejected', this)">
                        🔴 ปฏิเสธ (${allBookings.filter(b => b.status === 'rejected').length})
                    </button>
                    <button class="tab-btn" data-filter="cancelled" onclick="filterMyBookings('cancelled', this)">
                        ⚫ ยกเลิก (${allBookings.filter(b => b.status === 'cancelled').length})
                    </button>
                </div>

                <!-- Bookings List -->
                <div id="my-bookings-list">
                    ${renderBookingsList(allBookings)}
                </div>
            </div>
        `;

        // Store bookings for filtering
        window._myBookings = allBookings;

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

function renderBookingsList(bookings) {
    if (bookings.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3>ยังไม่มีการจอง</h3>
                <p>คุณยังไม่มีการจองห้องประชุม</p>
                <button class="btn btn-primary" onclick="navigateTo('booking')">📅 จองห้องประชุม</button>
            </div>
        `;
    }

    return `
        <div style="display:flex;flex-direction:column;gap:12px">
            ${bookings.map(b => {
                const isPast = DateUtils.isPast(b.booking_date);
                const canCancel = ['pending', 'approved'].includes(b.status) && !isPast;

                return `
                    <div class="card" style="transition:all 0.2s" 
                         onmouseover="this.style.boxShadow='var(--shadow-md)'" 
                         onmouseout="this.style.boxShadow='var(--shadow-sm)'">
                        <div style="padding:20px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
                            <!-- Date Badge -->
                            <div style="width:64px;height:64px;border-radius:var(--border-radius-sm);background:linear-gradient(135deg,var(--primary-600),var(--primary-800));color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">
                                <div style="font-size:1.3rem;font-weight:700;line-height:1">${new Date(b.booking_date).getDate()}</div>
                                <div style="font-size:0.65rem;opacity:0.8">${DateUtils.getThaiMonth(new Date(b.booking_date).getMonth()).slice(0,3)}</div>
                            </div>
                            
                            <!-- Info -->
                            <div style="flex:1;min-width:200px">
                                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
                                    <strong style="font-size:1rem">${b.title}</strong>
                                    ${getStatusBadge(b.status)}
                                    ${isPast ? '<span class="badge badge-cancelled">ผ่านไปแล้ว</span>' : ''}
                                </div>
                                <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px">
                                    🏢 ${b.rooms?.name || '-'} · ${b.rooms?.building || '-'}
                                </div>
                                <div style="display:flex;gap:16px;font-size:0.8rem;color:var(--text-secondary);flex-wrap:wrap">
                                    <span>📅 ${DateUtils.formatDate(b.booking_date, 'short')}</span>
                                    <span>🕐 ${DateUtils.formatTime(b.start_time)} - ${DateUtils.formatTime(b.end_time)}</span>
                                    <span>👥 ${b.attendees_count || 1} คน</span>
                                </div>
                                ${b.admin_note ? `
                                    <div style="margin-top:8px;padding:8px 12px;background:var(--gray-50);border-radius:var(--border-radius-sm);font-size:0.8rem">
                                        💬 <strong>หมายเหตุจาก Admin:</strong> ${b.admin_note}
                                    </div>
                                ` : ''}
                                ${b.description ? `
                                    <div style="margin-top:6px;font-size:0.8rem;color:var(--text-muted)">${b.description}</div>
                                ` : ''}
                            </div>

                            <!-- Actions -->
                            <div style="display:flex;gap:8px;flex-shrink:0">
                                ${canCancel ? `
                                    <button class="btn btn-danger btn-sm" onclick="cancelBooking('${b.id}', '${b.title.replace(/'/g, "\\'")}')">
                                        ❌ ยกเลิก
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Filter bookings by status
window.filterMyBookings = function(status, btn) {
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    const bookings = window._myBookings || [];
    const filtered = status === 'all' ? bookings : bookings.filter(b => b.status === status);
    document.getElementById('my-bookings-list').innerHTML = renderBookingsList(filtered);
};

// Cancel booking
window.cancelBooking = function(bookingId, title) {
    showConfirm(
        'ยกเลิกการจอง',
        `ต้องการยกเลิกการจอง "<strong>${title}</strong>" หรือไม่?`,
        async () => {
            try {
                const profile = getProfile();
                const { error } = await supabase
                    .from('bookings')
                    .update({ 
                        status: 'cancelled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', bookingId);

                if (error) throw error;

                // Log
                await supabase.from('booking_logs').insert({
                    booking_id: bookingId,
                    action: 'ยกเลิกการจอง',
                    old_status: 'pending',
                    new_status: 'cancelled',
                    changed_by: profile.id,
                    note: 'ผู้ใช้ยกเลิกการจอง'
                });

                ToastManager.success('ยกเลิกการจองสำเร็จ!');
                renderMyBookings();
            } catch (err) {
                ToastManager.error('เกิดข้อผิดพลาด: ' + err.message);
            }
        }
    );
};

export { renderMyBookings };
