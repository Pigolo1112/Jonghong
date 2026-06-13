/* ================================================
   ระบบจองห้องประชุม — Booking Module
   ================================================ */

import { supabase } from './supabase-config.js';
import { getProfile, isAdmin } from './auth.js';
import { ToastManager, DateUtils, showLoading, getStatusBadge } from './utils.js';

async function renderBooking(params = {}) {
    const content = document.getElementById('page-content');
    showLoading('page-content');

    const profile = getProfile();

    try {
        // Load rooms
        const { data: rooms, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;

        // Filter rooms by user role
        const availableRooms = (rooms || []).filter(r => 
            r.allowed_roles?.includes(profile.role) || isAdmin()
        );

        const selectedRoomId = params.room || '';
        const today = DateUtils.getToday();

        content.innerHTML = `
            <div class="fade-in">
                <div class="card">
                    <div class="card-header">
                        <h3>📅 จองห้องประชุม</h3>
                    </div>
                    <div class="card-body">
                        <form id="booking-form" onsubmit="submitBooking(event)">
                            <!-- Step 1: Room Selection -->
                            <div class="form-group">
                                <label class="form-label">ห้องประชุม <span class="required">*</span></label>
                                <select class="form-select" id="booking-room" required onchange="onRoomDateChange()">
                                    <option value="">-- เลือกห้องประชุม --</option>
                                    ${availableRooms.map(r => `
                                        <option value="${r.id}" ${r.id === selectedRoomId ? 'selected' : ''}>
                                            ${r.name} — ${r.building} (${r.capacity} ที่นั่ง)
                                        </option>
                                    `).join('')}
                                </select>
                            </div>

                            <!-- Room Info Card -->
                            <div id="room-info-card" style="display:none;margin-bottom:20px">
                            </div>

                            <!-- Step 2: Date & Time -->
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">วันที่จอง <span class="required">*</span></label>
                                    <input type="date" class="form-input" id="booking-date" min="${today}" value="${today}" required onchange="onRoomDateChange()">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">จำนวนผู้เข้าร่วม</label>
                                    <input type="number" class="form-input" id="booking-attendees" value="1" min="1">
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">เวลาเริ่มต้น <span class="required">*</span></label>
                                    <select class="form-select" id="booking-start" required onchange="onTimeChange()">
                                        ${generateTimeOptions(8, 19)}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">เวลาสิ้นสุด <span class="required">*</span></label>
                                    <select class="form-select" id="booking-end" required>
                                        ${generateTimeOptions(9, 20)}
                                    </select>
                                </div>
                            </div>

                            <!-- Timeline -->
                            <div id="booking-timeline" style="margin-bottom:20px"></div>

                            <!-- Conflict Warning -->
                            <div id="conflict-warning" style="display:none;padding:12px 16px;background:var(--danger-50);border:1px solid rgba(244,63,94,0.2);border-radius:var(--border-radius-sm);margin-bottom:20px;font-size:0.85rem;color:var(--danger-600)">
                                ⚠️ <strong>มีการจองซ้ำซ้อน!</strong> กรุณาเลือกช่วงเวลาอื่น
                            </div>

                            <!-- Step 3: Details -->
                            <div class="form-group">
                                <label class="form-label">หัวข้อการประชุม <span class="required">*</span></label>
                                <input type="text" class="form-input" id="booking-title" required placeholder="เช่น ประชุมภาควิชา ครั้งที่ 1/2568">
                            </div>

                            <div class="form-group">
                                <label class="form-label">รายละเอียด</label>
                                <textarea class="form-textarea" id="booking-description" placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"></textarea>
                            </div>

                            <!-- Summary -->
                            <div id="booking-summary" style="display:none;padding:20px;background:var(--primary-50);border-radius:var(--border-radius-sm);margin-bottom:20px">
                            </div>

                            <div style="display:flex;gap:12px;justify-content:flex-end">
                                <button type="button" class="btn btn-secondary" onclick="navigateTo('dashboard')">ยกเลิก</button>
                                <button type="submit" class="btn btn-primary btn-lg" id="submit-booking-btn">
                                    📅 ยืนยันการจอง
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // If room pre-selected, trigger load
        if (selectedRoomId) {
            onRoomDateChange();
        }

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

function generateTimeOptions(startHour, endHour) {
    let html = '';
    for (let h = startHour; h <= endHour; h++) {
        for (let m = 0; m < 60; m += 30) {
            const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            html += `<option value="${time}">${time} น.</option>`;
        }
    }
    return html;
}

// When room or date changes, load timeline
window.onRoomDateChange = async function() {
    const roomId = document.getElementById('booking-room').value;
    const date = document.getElementById('booking-date').value;
    const timelineContainer = document.getElementById('booking-timeline');
    const infoCard = document.getElementById('room-info-card');

    if (!roomId || !date) {
        timelineContainer.innerHTML = '';
        infoCard.style.display = 'none';
        return;
    }

    // Show room info
    const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    if (room) {
        const equipment = Array.isArray(room.equipment) ? room.equipment : [];
        infoCard.style.display = 'block';
        infoCard.innerHTML = `
            <div style="padding:16px;background:var(--gray-50);border-radius:var(--border-radius-sm);border:1px solid var(--border-color)">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
                    <span style="font-size:1.5rem">🏢</span>
                    <div>
                        <strong>${room.name}</strong>
                        <div style="font-size:0.8rem;color:var(--text-secondary)">📍 ${room.building} ชั้น ${room.floor} · 👥 ${room.capacity} ที่นั่ง</div>
                    </div>
                </div>
                ${equipment.length > 0 ? `
                    <div style="display:flex;flex-wrap:wrap;gap:4px">
                        ${equipment.map(eq => `<span class="equip-tag">${eq}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Load existing bookings for this room/date
    const { data: bookings } = await supabase
        .from('bookings')
        .select('*, profiles(name)')
        .eq('room_id', roomId)
        .eq('booking_date', date)
        .in('status', ['pending', 'approved']);

    renderTimeline(timelineContainer, bookings || []);
};

function renderTimeline(container, bookings) {
    const startHour = 8;
    const endHour = 20;
    const totalMinutes = (endHour - startHour) * 60;

    // Time labels
    let labels = '';
    for (let h = startHour; h <= endHour; h += 2) {
        labels += `<span>${h}:00</span>`;
    }

    // Booking slots
    let slots = '';
    bookings.forEach(b => {
        const startMin = DateUtils.timeToMinutes(b.start_time) - startHour * 60;
        const endMin = DateUtils.timeToMinutes(b.end_time) - startHour * 60;
        const left = Math.max(0, (startMin / totalMinutes) * 100);
        const width = Math.min(100 - left, ((endMin - startMin) / totalMinutes) * 100);
        
        slots += `
            <div class="timeline-slot ${b.status}" 
                 style="left:${left}%;width:${width}%"
                 title="${b.title} (${b.profiles?.name || '-'}) ${DateUtils.formatTime(b.start_time)}-${DateUtils.formatTime(b.end_time)}">
                ${b.title}
            </div>
        `;
    });

    container.innerHTML = `
        <div style="margin-bottom:8px;font-size:0.85rem;font-weight:500;color:var(--text-primary)">
            📊 Timeline การใช้งานห้อง
        </div>
        <div class="timeline">
            <div class="timeline-header">${labels}</div>
            <div class="timeline-bar">${slots}</div>
        </div>
        <div style="display:flex;gap:16px;margin-top:8px;font-size:0.7rem;color:var(--text-muted)">
            <span>🟢 อนุมัติแล้ว</span>
            <span>🟡 รออนุมัติ</span>
            <span>⬜ ว่าง</span>
        </div>
    `;
}

// Time change - update end time and check conflict
window.onTimeChange = function() {
    const startTime = document.getElementById('booking-start').value;
    const endSelect = document.getElementById('booking-end');
    
    // Set end time to 1 hour after start by default
    const startMin = DateUtils.timeToMinutes(startTime);
    const suggestedEnd = DateUtils.minutesToTime(startMin + 60);
    
    // Set end time
    for (let option of endSelect.options) {
        if (option.value === suggestedEnd) {
            option.selected = true;
            break;
        }
    }
    
    checkConflict();
};

// Check booking conflict
async function checkConflict() {
    const roomId = document.getElementById('booking-room').value;
    const date = document.getElementById('booking-date').value;
    const startTime = document.getElementById('booking-start').value;
    const endTime = document.getElementById('booking-end').value;
    const warning = document.getElementById('conflict-warning');

    if (!roomId || !date || !startTime || !endTime) {
        warning.style.display = 'none';
        return false;
    }

    if (startTime >= endTime) {
        warning.style.display = 'block';
        warning.innerHTML = '⚠️ <strong>เวลาไม่ถูกต้อง!</strong> เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด';
        return true;
    }

    const { data } = await supabase.rpc('check_room_availability', {
        p_room_id: roomId,
        p_date: date,
        p_start_time: startTime,
        p_end_time: endTime
    });

    const hasConflict = data === false;
    warning.style.display = hasConflict ? 'block' : 'none';
    if (hasConflict) {
        warning.innerHTML = '⚠️ <strong>มีการจองซ้ำซ้อน!</strong> กรุณาเลือกช่วงเวลาอื่น หรือเลือกห้องอื่น';
    }
    return hasConflict;
}

// Submit booking
window.submitBooking = async function(e) {
    e.preventDefault();

    const roomId = document.getElementById('booking-room').value;
    const date = document.getElementById('booking-date').value;
    const startTime = document.getElementById('booking-start').value;
    const endTime = document.getElementById('booking-end').value;
    const title = document.getElementById('booking-title').value.trim();
    const description = document.getElementById('booking-description').value.trim();
    const attendees = parseInt(document.getElementById('booking-attendees').value) || 1;
    const profile = getProfile();

    // Validation
    if (!roomId || !date || !startTime || !endTime || !title) {
        ToastManager.warning('กรุณากรอกข้อมูลให้ครบถ้วน');
        return;
    }

    if (startTime >= endTime) {
        ToastManager.warning('เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด');
        return;
    }

    // Check conflict
    const hasConflict = await checkConflict();
    if (hasConflict) {
        ToastManager.error('ไม่สามารถจองได้เนื่องจากมีการจองซ้ำซ้อน');
        return;
    }

    const btn = document.getElementById('submit-booking-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> กำลังจอง...';

    try {
        const { data, error } = await supabase.from('bookings').insert({
            room_id: roomId,
            user_id: profile.id,
            title,
            description,
            booking_date: date,
            start_time: startTime,
            end_time: endTime,
            attendees_count: attendees,
            status: 'pending'
        }).select().single();

        if (error) throw error;

        // Log the booking
        await supabase.from('booking_logs').insert({
            booking_id: data.id,
            action: 'สร้างการจอง',
            new_status: 'pending',
            changed_by: profile.id,
            note: `จองห้อง: ${title}`
        });

        ToastManager.success('จองห้องประชุมสำเร็จ! รอการอนุมัติจากผู้ดูแลระบบ');
        
        // Navigate to my bookings
        setTimeout(() => {
            window.navigateTo('my-bookings');
        }, 1000);

    } catch (err) {
        ToastManager.error('เกิดข้อผิดพลาด: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = '📅 ยืนยันการจอง';
    }
};

export { renderBooking };
