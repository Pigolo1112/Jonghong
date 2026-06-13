'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRouter } from 'next/navigation';

export default function RoomsPage() {
  const { profile, isAdmin } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allRooms, setAllRooms] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [capacityFilter, setCapacityFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editRoom, setEditRoom] = useState(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formBuilding, setFormBuilding] = useState('');
  const [formFloor, setFormFloor] = useState(1);
  const [formCapacity, setFormCapacity] = useState(10);
  const [formActive, setFormActive] = useState('true');
  const [formEquipment, setFormEquipment] = useState('');
  const [formRoles, setFormRoles] = useState(['admin', 'staff', 'student']);
  const [formDescription, setFormDescription] = useState('');
  const [formImage, setFormImage] = useState('');

  const loadRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('building', { ascending: true })
      .order('name', { ascending: true });
    if (error) { toast.error(error.message); return; }
    setAllRooms(data || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  useEffect(() => {
    let result = allRooms;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r =>
        r.name.toLowerCase().includes(s) ||
        r.building.toLowerCase().includes(s) ||
        (r.description || '').toLowerCase().includes(s)
      );
    }
    if (buildingFilter) result = result.filter(r => r.building === buildingFilter);
    if (capacityFilter) {
      const cap = parseInt(capacityFilter);
      if (cap === 999) result = result.filter(r => r.capacity > 50);
      else result = result.filter(r => r.capacity <= cap);
    }
    setFiltered(result);
  }, [allRooms, search, buildingFilter, capacityFilter]);

  const buildings = [...new Set(allRooms.map(r => r.building))];

  const openModal = (room = null) => {
    setEditRoom(room);
    setFormName(room?.name || '');
    setFormBuilding(room?.building || '');
    setFormFloor(room?.floor || 1);
    setFormCapacity(room?.capacity || 10);
    setFormActive(room?.is_active !== false ? 'true' : 'false');
    setFormEquipment(Array.isArray(room?.equipment) ? room.equipment.join(', ') : '');
    setFormRoles(room?.allowed_roles || ['admin', 'staff', 'student']);
    setFormDescription(room?.description || '');
    setFormImage(room?.image_url || '');
    setModalOpen(true);
  };

  const saveRoom = async () => {
    if (!formName || !formBuilding) { toast.warning('กรุณากรอกชื่อห้องและอาคาร'); return; }
    const equipment = formEquipment ? formEquipment.split(',').map(s => s.trim()).filter(Boolean) : [];
    const roomData = {
      name: formName, building: formBuilding, floor: formFloor, capacity: formCapacity,
      equipment, is_active: formActive === 'true', allowed_roles: formRoles,
      description: formDescription, image_url: formImage || null,
      updated_at: new Date().toISOString(),
    };
    try {
      let error;
      if (editRoom) {
        ({ error } = await supabase.from('rooms').update(roomData).eq('id', editRoom.id));
      } else {
        ({ error } = await supabase.from('rooms').insert(roomData));
      }
      if (error) throw error;
      setModalOpen(false);
      toast.success(editRoom ? 'แก้ไขห้องประชุมสำเร็จ!' : 'เพิ่มห้องประชุมสำเร็จ!');
      loadRooms();
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const deleteRoom = async (roomId, roomName) => {
    if (!confirm(`ต้องการลบห้อง "${roomName}" หรือไม่?`)) return;
    try {
      const { error } = await supabase.from('rooms').delete().eq('id', roomId);
      if (error) throw error;
      toast.success('ลบห้องประชุมสำเร็จ!');
      loadRooms();
    } catch (err) {
      toast.error('ไม่สามารถลบห้องประชุมได้: ' + err.message);
    }
  };

  const toggleRole = (role) => {
    setFormRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="fade-in">
      {/* Search & Filter */}
      <div className="search-bar">
        <div className="search-input-group">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="ค้นหาห้องประชุม..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-group">
          <select value={buildingFilter} onChange={e => setBuildingFilter(e.target.value)}>
            <option value="">ทุกอาคาร</option>
            {buildings.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={capacityFilter} onChange={e => setCapacityFilter(e.target.value)}>
            <option value="">ทุกขนาด</option>
            <option value="10">≤ 10 คน</option>
            <option value="20">≤ 20 คน</option>
            <option value="30">≤ 30 คน</option>
            <option value="50">≤ 50 คน</option>
            <option value="999">50+ คน</option>
          </select>
          {isAdmin() && (
            <button className="btn btn-primary" onClick={() => openModal()}>+ เพิ่มห้องประชุม</button>
          )}
        </div>
      </div>

      {/* Rooms Grid */}
      <div className="rooms-grid">
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1/-1' }}>
            <div className="empty-state">
              <div className="empty-icon">🏢</div>
              <h3>ไม่พบห้องประชุม</h3>
              <p>ลองเปลี่ยนเงื่อนไขการค้นหา</p>
            </div>
          </div>
        ) : (
          filtered.map(room => {
            const equipment = Array.isArray(room.equipment) ? room.equipment : [];
            const canBook = room.allowed_roles?.includes(profile.role) || isAdmin();
            return (
              <div key={room.id} className="room-card">
                <div className="room-image">
                  {room.image_url ? <img src={room.image_url} alt={room.name} /> : '🏛️'}
                  <span className={`room-status ${room.is_active ? 'available' : 'unavailable'}`}>
                    {room.is_active ? 'พร้อมใช้งาน' : 'ปิดให้บริการ'}
                  </span>
                </div>
                <div className="room-info">
                  <div className="room-name">{room.name}</div>
                  <div className="room-location">📍 {room.building} ชั้น {room.floor}</div>
                  <div className="room-meta">
                    <div className="meta-item">👥 {room.capacity} ที่นั่ง</div>
                    <div className="meta-item">🏷️ {room.allowed_roles?.map(r => {
                      const n = { admin: 'Admin', staff: 'อาจารย์', student: 'นิสิต' };
                      return n[r] || r;
                    }).join(', ') || 'ทุกคน'}</div>
                  </div>
                  {equipment.length > 0 && (
                    <div className="room-equipment">
                      {equipment.slice(0, 4).map((eq, i) => <span key={i} className="equip-tag">{eq}</span>)}
                      {equipment.length > 4 && <span className="equip-tag">+{equipment.length - 4}</span>}
                    </div>
                  )}
                  {room.description && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
                      {room.description}
                    </p>
                  )}
                  <div className="room-actions">
                    {canBook && room.is_active && (
                      <button className="btn btn-primary btn-sm" onClick={() => router.push(`/booking?room=${room.id}`)}>
                        📅 จองห้องนี้
                      </button>
                    )}
                    {isAdmin() && (
                      <>
                        <button className="btn btn-secondary btn-sm" onClick={() => openModal(room)}>✏️ แก้ไข</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => deleteRoom(room.id, room.name)}>🗑️</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRoom ? '✏️ แก้ไขห้องประชุม' : '➕ เพิ่มห้องประชุมใหม่'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={saveRoom}>{editRoom ? 'บันทึกการแก้ไข' : 'เพิ่มห้องประชุม'}</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">ชื่อห้องประชุม <span className="required">*</span></label>
          <input type="text" className="form-input" value={formName} onChange={e => setFormName(e.target.value)}
            placeholder="เช่น SC1220" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">อาคาร <span className="required">*</span></label>
            <input type="text" className="form-input" value={formBuilding} onChange={e => setFormBuilding(e.target.value)}
              placeholder="เช่น อาคาร SC" />
          </div>
          <div className="form-group">
            <label className="form-label">ชั้น</label>
            <input type="number" className="form-input" value={formFloor} onChange={e => setFormFloor(parseInt(e.target.value) || 1)} min="1" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">ความจุ (คน) <span className="required">*</span></label>
            <input type="number" className="form-input" value={formCapacity} onChange={e => setFormCapacity(parseInt(e.target.value) || 10)} min="1" />
          </div>
          <div className="form-group">
            <label className="form-label">สถานะ</label>
            <select className="form-select" value={formActive} onChange={e => setFormActive(e.target.value)}>
              <option value="true">พร้อมใช้งาน</option>
              <option value="false">ปิดให้บริการ</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">อุปกรณ์ (คั่นด้วยเครื่องหมาย ,)</label>
          <input type="text" className="form-input" value={formEquipment} onChange={e => setFormEquipment(e.target.value)}
            placeholder="เช่น โปรเจกเตอร์, ไวท์บอร์ด" />
        </div>
        <div className="form-group">
          <label className="form-label">สิทธิ์การใช้งาน</label>
          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            {['admin', 'staff', 'student'].map(role => (
              <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formRoles.includes(role)} onChange={() => toggleRole(role)} />
                {{ admin: 'Admin', staff: 'อาจารย์', student: 'นิสิต' }[role]}
              </label>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">รายละเอียด</label>
          <textarea className="form-textarea" value={formDescription} onChange={e => setFormDescription(e.target.value)}
            placeholder="รายละเอียดเพิ่มเติม" />
        </div>
        <div className="form-group">
          <label className="form-label">URL รูปภาพ</label>
          <input type="url" className="form-input" value={formImage} onChange={e => setFormImage(e.target.value)} placeholder="https://..." />
        </div>
      </Modal>
    </div>
  );
}
