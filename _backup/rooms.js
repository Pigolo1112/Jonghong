/* ================================================
   ระบบจองห้องประชุม — Room Management Module
   ================================================ */

import { supabase } from './supabase-config.js';
import { isAdmin, getProfile } from './auth.js';
import { ToastManager, ModalManager, showLoading, showEmpty, debounce } from './utils.js';

let allRooms = [];

async function renderRooms() {
    const content = document.getElementById('page-content');
    showLoading('page-content');

    try {
        const { data: rooms, error } = await supabase
            .from('rooms')
            .select('*')
            .order('building', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;
        allRooms = rooms || [];

        content.innerHTML = `
            <div class="fade-in">
                <!-- Search & Filter Bar -->
                <div class="search-bar">
                    <div class="search-input-group">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="room-search" placeholder="ค้นหาห้องประชุม..." oninput="filterRooms()">
                    </div>
                    <div class="filter-group">
                        <select id="room-building-filter" onchange="filterRooms()">
                            <option value="">ทุกอาคาร</option>
                            ${[...new Set(allRooms.map(r => r.building))].map(b => 
                                `<option value="${b}">${b}</option>`
                            ).join('')}
                        </select>
                        <select id="room-capacity-filter" onchange="filterRooms()">
                            <option value="">ทุกขนาด</option>
                            <option value="10">≤ 10 คน</option>
                            <option value="20">≤ 20 คน</option>
                            <option value="30">≤ 30 คน</option>
                            <option value="50">≤ 50 คน</option>
                            <option value="999">50+ คน</option>
                        </select>
                        ${isAdmin() ? `
                            <button class="btn btn-primary" onclick="showRoomModal()">
                                + เพิ่มห้องประชุม
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Rooms Grid -->
                <div class="rooms-grid" id="rooms-grid">
                    ${renderRoomCards(allRooms)}
                </div>
            </div>
        `;

        // Make filter function available
        window.filterRooms = debounce(() => {
            const search = document.getElementById('room-search').value.toLowerCase();
            const building = document.getElementById('room-building-filter').value;
            const capacity = document.getElementById('room-capacity-filter').value;

            let filtered = allRooms;

            if (search) {
                filtered = filtered.filter(r => 
                    r.name.toLowerCase().includes(search) || 
                    r.building.toLowerCase().includes(search) ||
                    (r.description || '').toLowerCase().includes(search)
                );
            }

            if (building) {
                filtered = filtered.filter(r => r.building === building);
            }

            if (capacity) {
                const cap = parseInt(capacity);
                if (cap === 999) {
                    filtered = filtered.filter(r => r.capacity > 50);
                } else {
                    filtered = filtered.filter(r => r.capacity <= cap);
                }
            }

            document.getElementById('rooms-grid').innerHTML = renderRoomCards(filtered);
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

function renderRoomCards(rooms) {
    if (rooms.length === 0) {
        return `
            <div style="grid-column:1/-1">
                <div class="empty-state">
                    <div class="empty-icon">🏢</div>
                    <h3>ไม่พบห้องประชุม</h3>
                    <p>ลองเปลี่ยนเงื่อนไขการค้นหา</p>
                </div>
            </div>
        `;
    }

    const profile = getProfile();

    return rooms.map(room => {
        const equipment = Array.isArray(room.equipment) ? room.equipment : [];
        const canBook = room.allowed_roles?.includes(profile.role) || isAdmin();
        
        return `
            <div class="room-card">
                <div class="room-image">
                    ${room.image_url 
                        ? `<img src="${room.image_url}" alt="${room.name}">` 
                        : '🏛️'}
                    <span class="room-status ${room.is_active ? 'available' : 'unavailable'}">
                        ${room.is_active ? 'พร้อมใช้งาน' : 'ปิดให้บริการ'}
                    </span>
                </div>
                <div class="room-info">
                    <div class="room-name">${room.name}</div>
                    <div class="room-location">📍 ${room.building} ชั้น ${room.floor}</div>
                    <div class="room-meta">
                        <div class="meta-item">👥 ${room.capacity} ที่นั่ง</div>
                        <div class="meta-item">🏷️ ${room.allowed_roles?.map(r => {
                            const n = {admin:'Admin',staff:'อาจารย์',student:'นิสิต'};
                            return n[r]||r;
                        }).join(', ') || 'ทุกคน'}</div>
                    </div>
                    ${equipment.length > 0 ? `
                        <div class="room-equipment">
                            ${equipment.slice(0, 4).map(eq => `<span class="equip-tag">${eq}</span>`).join('')}
                            ${equipment.length > 4 ? `<span class="equip-tag">+${equipment.length - 4}</span>` : ''}
                        </div>
                    ` : ''}
                    ${room.description ? `<p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px;line-height:1.4">${room.description}</p>` : ''}
                    <div class="room-actions">
                        ${canBook && room.is_active ? `
                            <button class="btn btn-primary btn-sm" onclick="navigateTo('booking?room=${room.id}')">
                                📅 จองห้องนี้
                            </button>
                        ` : ''}
                        ${isAdmin() ? `
                            <button class="btn btn-secondary btn-sm" onclick="showRoomModal('${room.id}')">✏️ แก้ไข</button>
                            <button class="btn btn-ghost btn-sm" onclick="deleteRoom('${room.id}', '${room.name}')">🗑️</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Show Room Modal (Add/Edit)
window.showRoomModal = function(roomId = null) {
    const room = roomId ? allRooms.find(r => r.id === roomId) : null;
    const isEdit = !!room;
    const equipment = room ? (Array.isArray(room.equipment) ? room.equipment.join(', ') : '') : '';

    const modal = document.getElementById('room-modal');
    modal.innerHTML = `
        <div class="modal-header">
            <h3>${isEdit ? '✏️ แก้ไขห้องประชุม' : '➕ เพิ่มห้องประชุมใหม่'}</h3>
            <button class="modal-close" onclick="ModalManager.close('room-modal')">&times;</button>
        </div>
        <div class="modal-body">
            <form id="room-form">
                <div class="form-group">
                    <label class="form-label">ชื่อห้องประชุม <span class="required">*</span></label>
                    <input type="text" class="form-input" id="room-name" value="${room?.name || ''}" required placeholder="เช่น ห้องประชุม SC101">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">อาคาร <span class="required">*</span></label>
                        <input type="text" class="form-input" id="room-building" value="${room?.building || ''}" required placeholder="เช่น อาคารวิทยาศาสตร์ 1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">ชั้น</label>
                        <input type="number" class="form-input" id="room-floor" value="${room?.floor || 1}" min="1">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">ความจุ (คน) <span class="required">*</span></label>
                        <input type="number" class="form-input" id="room-capacity" value="${room?.capacity || 10}" min="1" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">สถานะ</label>
                        <select class="form-select" id="room-active">
                            <option value="true" ${room?.is_active !== false ? 'selected' : ''}>พร้อมใช้งาน</option>
                            <option value="false" ${room?.is_active === false ? 'selected' : ''}>ปิดให้บริการ</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">อุปกรณ์ (คั่นด้วยเครื่องหมาย ,)</label>
                    <input type="text" class="form-input" id="room-equipment" value="${equipment}" placeholder="เช่น โปรเจกเตอร์, ไวท์บอร์ด, ไมโครโฟน">
                    <div class="form-hint">ใส่ชื่ออุปกรณ์แยกด้วยเครื่องหมายจุลภาค</div>
                </div>
                <div class="form-group">
                    <label class="form-label">สิทธิ์การใช้งาน</label>
                    <div style="display:flex;gap:16px;margin-top:4px">
                        <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer">
                            <input type="checkbox" class="role-check" value="admin" ${!room || room.allowed_roles?.includes('admin') ? 'checked' : ''}> Admin
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer">
                            <input type="checkbox" class="role-check" value="staff" ${!room || room.allowed_roles?.includes('staff') ? 'checked' : ''}> อาจารย์
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer">
                            <input type="checkbox" class="role-check" value="student" ${!room || room.allowed_roles?.includes('student') ? 'checked' : ''}> นิสิต
                        </label>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">รายละเอียด</label>
                    <textarea class="form-textarea" id="room-description" placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับห้องประชุม">${room?.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">URL รูปภาพ</label>
                    <input type="url" class="form-input" id="room-image" value="${room?.image_url || ''}" placeholder="https://...">
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="ModalManager.close('room-modal')">ยกเลิก</button>
            <button class="btn btn-primary" onclick="saveRoom('${roomId || ''}')">${isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มห้องประชุม'}</button>
        </div>
    `;

    ModalManager.open('room-modal');
};

// Save Room
window.saveRoom = async function(roomId) {
    const name = document.getElementById('room-name').value.trim();
    const building = document.getElementById('room-building').value.trim();
    const floor = parseInt(document.getElementById('room-floor').value) || 1;
    const capacity = parseInt(document.getElementById('room-capacity').value) || 10;
    const isActive = document.getElementById('room-active').value === 'true';
    const equipmentStr = document.getElementById('room-equipment').value.trim();
    const equipment = equipmentStr ? equipmentStr.split(',').map(s => s.trim()).filter(Boolean) : [];
    const allowedRoles = [...document.querySelectorAll('.role-check:checked')].map(c => c.value);
    const description = document.getElementById('room-description').value.trim();
    const imageUrl = document.getElementById('room-image').value.trim();

    if (!name || !building) {
        ToastManager.warning('กรุณากรอกชื่อห้องและอาคาร');
        return;
    }

    const roomData = {
        name, building, floor, capacity,
        equipment, is_active: isActive,
        allowed_roles: allowedRoles,
        description, image_url: imageUrl || null,
        updated_at: new Date().toISOString()
    };

    try {
        let error;
        if (roomId) {
            ({ error } = await supabase.from('rooms').update(roomData).eq('id', roomId));
        } else {
            ({ error } = await supabase.from('rooms').insert(roomData));
        }
        if (error) throw error;

        ModalManager.close('room-modal');
        ToastManager.success(roomId ? 'แก้ไขห้องประชุมสำเร็จ!' : 'เพิ่มห้องประชุมสำเร็จ!');
        renderRooms();
    } catch (err) {
        ToastManager.error('เกิดข้อผิดพลาด: ' + err.message);
    }
};

// Delete Room
window.deleteRoom = function(roomId, roomName) {
    const { showConfirm } = window;
    if (typeof showConfirm === 'undefined') {
        // Inline confirm
        if (!confirm(`ต้องการลบห้อง "${roomName}" หรือไม่?`)) return;
        doDeleteRoom(roomId);
    } else {
        showConfirm('ลบห้องประชุม', `ต้องการลบห้อง "<strong>${roomName}</strong>" หรือไม่?<br>การจองที่เกี่ยวข้องจะถูกลบทั้งหมด`, () => doDeleteRoom(roomId));
    }
};

async function doDeleteRoom(roomId) {
    try {
        const { error } = await supabase.from('rooms').delete().eq('id', roomId);
        if (error) throw error;
        ToastManager.success('ลบห้องประชุมสำเร็จ!');
        renderRooms();
    } catch (err) {
        ToastManager.error('ไม่สามารถลบห้องประชุมได้: ' + err.message);
    }
}

export { renderRooms };
