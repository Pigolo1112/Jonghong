/* ================================================
   ระบบจองห้องประชุม — User Management Module (Admin)
   ================================================ */

import { supabase } from './supabase-config.js';
import { isAdmin, getProfile } from './auth.js';
import { ToastManager, ModalManager, DateUtils, getRoleBadge, showLoading, debounce, getInitials } from './utils.js';

async function renderUsers() {
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
        const { data: users, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const allUsers = users || [];
        const admins = allUsers.filter(u => u.role === 'admin');
        const staff = allUsers.filter(u => u.role === 'staff');
        const students = allUsers.filter(u => u.role === 'student');

        content.innerHTML = `
            <div class="fade-in">
                <!-- Stats -->
                <div class="stats-grid" style="margin-bottom:24px">
                    <div class="stat-card">
                        <div class="stat-icon blue">👥</div>
                        <div class="stat-info">
                            <div class="stat-label">ผู้ใช้ทั้งหมด</div>
                            <div class="stat-value">${allUsers.length}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon red">🛡️</div>
                        <div class="stat-info">
                            <div class="stat-label">Admin</div>
                            <div class="stat-value">${admins.length}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon blue">👨‍🏫</div>
                        <div class="stat-info">
                            <div class="stat-label">อาจารย์/บุคลากร</div>
                            <div class="stat-value">${staff.length}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">🎓</div>
                        <div class="stat-info">
                            <div class="stat-label">นิสิต</div>
                            <div class="stat-value">${students.length}</div>
                        </div>
                    </div>
                </div>

                <!-- Search -->
                <div class="search-bar">
                    <div class="search-input-group">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="user-search" placeholder="ค้นหาผู้ใช้..." oninput="filterUsers()">
                    </div>
                    <div class="filter-group">
                        <select id="user-role-filter" onchange="filterUsers()">
                            <option value="">ทุกบทบาท</option>
                            <option value="admin">Admin</option>
                            <option value="staff">อาจารย์/บุคลากร</option>
                            <option value="student">นิสิต</option>
                        </select>
                    </div>
                </div>

                <!-- Users Table -->
                <div id="users-table-container">
                    ${renderUsersTable(allUsers)}
                </div>
            </div>
        `;

        window._allUsers = allUsers;

        window.filterUsers = debounce(() => {
            const search = document.getElementById('user-search').value.toLowerCase();
            const role = document.getElementById('user-role-filter').value;

            let filtered = window._allUsers;

            if (search) {
                filtered = filtered.filter(u =>
                    (u.name || '').toLowerCase().includes(search) ||
                    (u.email || '').toLowerCase().includes(search) ||
                    (u.department || '').toLowerCase().includes(search) ||
                    (u.student_id || '').toLowerCase().includes(search)
                );
            }

            if (role) {
                filtered = filtered.filter(u => u.role === role);
            }

            document.getElementById('users-table-container').innerHTML = renderUsersTable(filtered);
        }, 200);

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

function renderUsersTable(users) {
    if (users.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <h3>ไม่พบผู้ใช้</h3>
                <p>ลองเปลี่ยนเงื่อนไขการค้นหา</p>
            </div>
        `;
    }

    return `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ผู้ใช้</th>
                        <th>อีเมล</th>
                        <th>บทบาท</th>
                        <th>ภาควิชา</th>
                        <th>เบอร์โทร</th>
                        <th>เข้าร่วมเมื่อ</th>
                        <th>การจัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td>
                                <div style="display:flex;align-items:center;gap:10px">
                                    <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--primary-400),var(--primary-600));display:flex;align-items:center;justify-content:center;color:white;font-weight:600;font-size:0.8rem;flex-shrink:0">
                                        ${getInitials(u.name)}
                                    </div>
                                    <div>
                                        <div style="font-weight:500">${u.name || '-'}</div>
                                        ${u.student_id ? `<div style="font-size:0.7rem;color:var(--text-muted)">รหัส: ${u.student_id}</div>` : ''}
                                    </div>
                                </div>
                            </td>
                            <td style="font-size:0.85rem">${u.email || '-'}</td>
                            <td>${getRoleBadge(u.role)}</td>
                            <td style="font-size:0.85rem">${u.department || '-'}</td>
                            <td style="font-size:0.85rem">${u.phone || '-'}</td>
                            <td style="font-size:0.8rem;color:var(--text-secondary)">${DateUtils.formatDate(u.created_at, 'short')}</td>
                            <td>
                                <div style="display:flex;gap:6px">
                                    <button class="btn btn-secondary btn-sm" onclick="changeUserRole('${u.id}', '${u.name}', '${u.role}')">
                                        🔄 เปลี่ยนบทบาท
                                    </button>
                                    <button class="btn btn-ghost btn-sm" onclick="viewUserBookings('${u.id}', '${u.name}')">
                                        📋
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Change user role
window.changeUserRole = function(userId, userName, currentRole) {
    const currentProfile = getProfile();
    if (userId === currentProfile.id) {
        ToastManager.warning('ไม่สามารถเปลี่ยนบทบาทตนเองได้');
        return;
    }

    const modal = document.getElementById('detail-modal');
    modal.innerHTML = `
        <div class="modal-header">
            <h3>🔄 เปลี่ยนบทบาทผู้ใช้</h3>
            <button class="modal-close" onclick="ModalManager.close('detail-modal')">&times;</button>
        </div>
        <div class="modal-body">
            <p style="margin-bottom:16px">เปลี่ยนบทบาทของ <strong>${userName}</strong></p>
            <div class="form-group">
                <label class="form-label">บทบาทใหม่</label>
                <select class="form-select" id="new-role">
                    <option value="student" ${currentRole === 'student' ? 'selected' : ''}>🎓 นิสิต</option>
                    <option value="staff" ${currentRole === 'staff' ? 'selected' : ''}>👨‍🏫 อาจารย์/บุคลากร</option>
                    <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>🛡️ ผู้ดูแลระบบ</option>
                </select>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="ModalManager.close('detail-modal')">ยกเลิก</button>
            <button class="btn btn-primary" onclick="confirmRoleChange('${userId}')">บันทึก</button>
        </div>
    `;
    ModalManager.open('detail-modal');
};

window.confirmRoleChange = async function(userId) {
    const newRole = document.getElementById('new-role').value;

    try {
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (error) throw error;

        ModalManager.close('detail-modal');
        ToastManager.success('เปลี่ยนบทบาทสำเร็จ!');
        renderUsers();
    } catch (err) {
        ToastManager.error('เกิดข้อผิดพลาด: ' + err.message);
    }
};

// View user's bookings
window.viewUserBookings = async function(userId, userName) {
    const modal = document.getElementById('detail-modal');
    modal.innerHTML = `
        <div class="modal-header">
            <h3>📋 ประวัติการจอง — ${userName}</h3>
            <button class="modal-close" onclick="ModalManager.close('detail-modal')">&times;</button>
        </div>
        <div class="modal-body">
            <div class="page-loader"><div class="spinner"></div><p>กำลังโหลด...</p></div>
        </div>
    `;
    ModalManager.open('detail-modal');

    try {
        const { data: bookings } = await supabase
            .from('bookings')
            .select('*, rooms(name)')
            .eq('user_id', userId)
            .order('booking_date', { ascending: false })
            .limit(20);

        const body = modal.querySelector('.modal-body');

        if (!bookings || bookings.length === 0) {
            body.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3>ยังไม่มีการจอง</h3></div>';
            return;
        }

        const { getStatusBadge } = await import('./utils.js');

        body.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>วันที่</th>
                            <th>ห้อง</th>
                            <th>เวลา</th>
                            <th>หัวข้อ</th>
                            <th>สถานะ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bookings.map(b => `
                            <tr>
                                <td>${DateUtils.formatDate(b.booking_date, 'short')}</td>
                                <td>${b.rooms?.name || '-'}</td>
                                <td>${DateUtils.formatTime(b.start_time)}-${DateUtils.formatTime(b.end_time)}</td>
                                <td>${b.title}</td>
                                <td>${getStatusBadge(b.status)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        modal.querySelector('.modal-body').innerHTML = `<p class="text-danger">เกิดข้อผิดพลาด: ${err.message}</p>`;
    }
};

export { renderUsers };
