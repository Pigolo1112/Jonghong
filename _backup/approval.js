/* ================================================
   ระบบจองห้องประชุม — Approval Module (Admin)
   ================================================ */

import { supabase } from './supabase-config.js';
import { isAdmin, getProfile } from './auth.js';
import { ToastManager, ModalManager, DateUtils, getStatusBadge, showLoading, showConfirm } from './utils.js';

async function renderApproval() {
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
        const { data: bookings, error } = await supabase
            .from('bookings')
            .select('*, rooms(name, building, capacity), profiles(name, email, role, department, student_id)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const allBookings = bookings || [];
        const pending = allBookings.filter(b => b.status === 'pending');
        const approved = allBookings.filter(b => b.status === 'approved');
        const rejected = allBookings.filter(b => b.status === 'rejected');

        content.innerHTML = `
            <div class="fade-in">
                <!-- Stats -->
                <div class="stats-grid" style="margin-bottom:24px">
                    <div class="stat-card">
                        <div class="stat-icon yellow">⏳</div>
                        <div class="stat-info">
                            <div class="stat-label">รออนุมัติ</div>
                            <div class="stat-value">${pending.length}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">✅</div>
                        <div class="stat-info">
                            <div class="stat-label">อนุมัติแล้ว</div>
                            <div class="stat-value">${approved.length}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon red">❌</div>
                        <div class="stat-info">
                            <div class="stat-label">ปฏิเสธ</div>
                            <div class="stat-value">${rejected.length}</div>
                        </div>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="tabs">
                    <button class="tab-btn active" onclick="filterApproval('pending', this)">
                        ⏳ รออนุมัติ (${pending.length})
                    </button>
                    <button class="tab-btn" onclick="filterApproval('approved', this)">
                        ✅ อนุมัติแล้ว (${approved.length})
                    </button>
                    <button class="tab-btn" onclick="filterApproval('rejected', this)">
                        ❌ ปฏิเสธ (${rejected.length})
                    </button>
                    <button class="tab-btn" onclick="filterApproval('all', this)">
                        ทั้งหมด (${allBookings.length})
                    </button>
                </div>

                <!-- Booking List -->
                <div id="approval-list">
                    ${renderApprovalList(pending)}
                </div>
            </div>
        `;

        window._approvalBookings = allBookings;

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

function renderApprovalList(bookings) {
    if (bookings.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-icon">✨</div>
                <h3>ไม่มีรายการ</h3>
                <p>ไม่มีการจองในหมวดนี้</p>
            </div>
        `;
    }

    return `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ผู้จอง</th>
                        <th>ห้องประชุม</th>
                        <th>วันที่</th>
                        <th>เวลา</th>
                        <th>หัวข้อ</th>
                        <th>สถานะ</th>
                        <th>การจัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    ${bookings.map(b => `
                        <tr>
                            <td>
                                <div style="font-weight:500">${b.profiles?.name || '-'}</div>
                                <div style="font-size:0.75rem;color:var(--text-muted)">${b.profiles?.email || ''}</div>
                                <div style="font-size:0.7rem;color:var(--text-muted)">${
                                    b.profiles?.role === 'student' ? `นิสิต ${b.profiles?.student_id || ''}` :
                                    b.profiles?.role === 'staff' ? 'อาจารย์/บุคลากร' : ''
                                } ${b.profiles?.department ? `· ${b.profiles.department}` : ''}</div>
                            </td>
                            <td>
                                <strong>${b.rooms?.name || '-'}</strong>
                                <div style="font-size:0.75rem;color:var(--text-muted)">${b.rooms?.building || ''}</div>
                            </td>
                            <td>${DateUtils.formatDate(b.booking_date, 'short')}</td>
                            <td>${DateUtils.formatTime(b.start_time)} - ${DateUtils.formatTime(b.end_time)}</td>
                            <td>
                                <div style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${b.title}">${b.title}</div>
                                <div style="font-size:0.7rem;color:var(--text-muted)">👥 ${b.attendees_count || 1} คน</div>
                            </td>
                            <td>${getStatusBadge(b.status)}</td>
                            <td>
                                <div style="display:flex;gap:6px;flex-wrap:wrap">
                                    ${b.status === 'pending' ? `
                                        <button class="btn btn-success btn-sm" onclick="approveBooking('${b.id}')">✅ อนุมัติ</button>
                                        <button class="btn btn-danger btn-sm" onclick="rejectBooking('${b.id}')">❌ ปฏิเสธ</button>
                                    ` : ''}
                                    <button class="btn btn-ghost btn-sm" onclick="viewBookingDetail('${b.id}')">👁️</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Filter
window.filterApproval = function(status, btn) {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    const bookings = window._approvalBookings || [];
    const filtered = status === 'all' ? bookings : bookings.filter(b => b.status === status);
    document.getElementById('approval-list').innerHTML = renderApprovalList(filtered);
};

// Approve booking
window.approveBooking = async function(bookingId) {
    try {
        const profile = getProfile();
        const { error } = await supabase
            .from('bookings')
            .update({
                status: 'approved',
                approved_by: profile.id,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', bookingId);

        if (error) throw error;

        await supabase.from('booking_logs').insert({
            booking_id: bookingId,
            action: 'อนุมัติการจอง',
            old_status: 'pending',
            new_status: 'approved',
            changed_by: profile.id
        });

        ToastManager.success('อนุมัติการจองสำเร็จ!');
        renderApproval();
        
        // Update pending count badge
        updatePendingBadge();
    } catch (err) {
        ToastManager.error('เกิดข้อผิดพลาด: ' + err.message);
    }
};

// Reject booking
window.rejectBooking = function(bookingId) {
    const modal = document.getElementById('detail-modal');
    modal.innerHTML = `
        <div class="modal-header">
            <h3>❌ ปฏิเสธการจอง</h3>
            <button class="modal-close" onclick="ModalManager.close('detail-modal')">&times;</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">เหตุผลในการปฏิเสธ</label>
                <textarea class="form-textarea" id="reject-note" placeholder="ระบุเหตุผล (ไม่บังคับ)" rows="3"></textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="ModalManager.close('detail-modal')">ยกเลิก</button>
            <button class="btn btn-danger" onclick="confirmReject('${bookingId}')">ยืนยันปฏิเสธ</button>
        </div>
    `;
    ModalManager.open('detail-modal');
};

window.confirmReject = async function(bookingId) {
    const note = document.getElementById('reject-note').value.trim();
    const profile = getProfile();

    try {
        const { error } = await supabase
            .from('bookings')
            .update({
                status: 'rejected',
                admin_note: note || null,
                approved_by: profile.id,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', bookingId);

        if (error) throw error;

        await supabase.from('booking_logs').insert({
            booking_id: bookingId,
            action: 'ปฏิเสธการจอง',
            old_status: 'pending',
            new_status: 'rejected',
            changed_by: profile.id,
            note: note || null
        });

        ModalManager.close('detail-modal');
        ToastManager.success('ปฏิเสธการจองสำเร็จ');
        renderApproval();
        updatePendingBadge();
    } catch (err) {
        ToastManager.error('เกิดข้อผิดพลาด: ' + err.message);
    }
};

// View booking detail
window.viewBookingDetail = function(bookingId) {
    const booking = (window._approvalBookings || []).find(b => b.id === bookingId);
    if (!booking) return;

    const modal = document.getElementById('detail-modal');
    modal.innerHTML = `
        <div class="modal-header">
            <h3>📋 รายละเอียดการจอง</h3>
            <button class="modal-close" onclick="ModalManager.close('detail-modal')">&times;</button>
        </div>
        <div class="modal-body">
            <div class="detail-grid">
                <div class="detail-label">หัวข้อ</div>
                <div class="detail-value"><strong>${booking.title}</strong></div>
                
                <div class="detail-label">สถานะ</div>
                <div class="detail-value">${getStatusBadge(booking.status)}</div>
                
                <div class="detail-label">ผู้จอง</div>
                <div class="detail-value">${booking.profiles?.name || '-'} (${booking.profiles?.email || '-'})</div>
                
                <div class="detail-label">ประเภท</div>
                <div class="detail-value">${
                    booking.profiles?.role === 'student' ? `นิสิต ${booking.profiles?.student_id || ''}` :
                    booking.profiles?.role === 'staff' ? 'อาจารย์/บุคลากร' : 'Admin'
                }</div>
                
                <div class="detail-label">ภาควิชา</div>
                <div class="detail-value">${booking.profiles?.department || '-'}</div>
                
                <div class="detail-label">ห้องประชุม</div>
                <div class="detail-value">${booking.rooms?.name || '-'} (${booking.rooms?.building || '-'})</div>
                
                <div class="detail-label">วันที่</div>
                <div class="detail-value">${DateUtils.formatDate(booking.booking_date, 'long')}</div>
                
                <div class="detail-label">เวลา</div>
                <div class="detail-value">${DateUtils.formatTime(booking.start_time)} - ${DateUtils.formatTime(booking.end_time)}</div>
                
                <div class="detail-label">จำนวนผู้เข้าร่วม</div>
                <div class="detail-value">${booking.attendees_count || 1} คน</div>
                
                <div class="detail-label">รายละเอียด</div>
                <div class="detail-value">${booking.description || '-'}</div>
                
                <div class="detail-label">วันที่สร้าง</div>
                <div class="detail-value">${DateUtils.formatDateTime(booking.created_at)}</div>
                
                ${booking.admin_note ? `
                    <div class="detail-label">หมายเหตุ Admin</div>
                    <div class="detail-value">${booking.admin_note}</div>
                ` : ''}
            </div>
        </div>
        <div class="modal-footer">
            ${booking.status === 'pending' ? `
                <button class="btn btn-success" onclick="ModalManager.close('detail-modal');approveBooking('${booking.id}')">✅ อนุมัติ</button>
                <button class="btn btn-danger" onclick="ModalManager.close('detail-modal');rejectBooking('${booking.id}')">❌ ปฏิเสธ</button>
            ` : ''}
            <button class="btn btn-secondary" onclick="ModalManager.close('detail-modal')">ปิด</button>
        </div>
    `;
    ModalManager.open('detail-modal');
};

// Update pending badge in sidebar
async function updatePendingBadge() {
    const { count } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

    const badge = document.getElementById('pending-count');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    }
}

export { renderApproval };
