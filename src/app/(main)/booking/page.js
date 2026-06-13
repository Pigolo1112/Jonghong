'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { DateUtils, generateTimeOptions } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRouter, useSearchParams } from 'next/navigation';

function BookingContent() {
  const { profile, isAdmin } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [roomInfo, setRoomInfo] = useState(null);
  const [bookingDate, setBookingDate] = useState(DateUtils.getToday());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attendees, setAttendees] = useState(1);
  const [existingBookings, setExistingBookings] = useState([]);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictMsg, setConflictMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const startOptions = generateTimeOptions(8, 19);
  const endOptions = generateTimeOptions(9, 20);

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam && rooms.length > 0) {
      setSelectedRoom(roomParam);
    }
  }, [searchParams, rooms]);

  useEffect(() => {
    if (selectedRoom && bookingDate) {
      loadTimeline();
    }
  }, [selectedRoom, bookingDate]);

  useEffect(() => {
    checkConflict();
  }, [selectedRoom, bookingDate, startTime, endTime]);

  const loadRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').eq('is_active', true).order('name');
    const available = (data || []).filter(r => r.allowed_roles?.includes(profile.role) || isAdmin());
    setRooms(available);
    setLoading(false);
  };

  const loadTimeline = async () => {
    // Load room info
    const { data: room } = await supabase.from('rooms').select('*').eq('id', selectedRoom).single();
    setRoomInfo(room);

    // Load existing bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*, profiles!bookings_user_id_fkey(name)')
      .eq('room_id', selectedRoom)
      .eq('booking_date', bookingDate)
      .in('status', ['pending', 'approved']);
    setExistingBookings(bookings || []);
  };

  const checkConflict = async () => {
    if (!selectedRoom || !bookingDate || !startTime || !endTime) {
      setHasConflict(false);
      return;
    }
    if (startTime >= endTime) {
      setHasConflict(true);
      setConflictMsg('⚠️ เวลาไม่ถูกต้อง! เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด');
      return;
    }
    const { data } = await supabase.rpc('check_room_availability', {
      p_room_id: selectedRoom,
      p_date: bookingDate,
      p_start_time: startTime,
      p_end_time: endTime,
    });
    if (data === false) {
      setHasConflict(true);
      setConflictMsg('⚠️ มีการจองซ้ำซ้อน! กรุณาเลือกช่วงเวลาอื่น หรือเลือกห้องอื่น');
    } else {
      setHasConflict(false);
    }
  };

  const onStartChange = (val) => {
    setStartTime(val);
    const min = DateUtils.timeToMinutes(val);
    const suggested = DateUtils.minutesToTime(min + 60);
    setEndTime(suggested);
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    if (!selectedRoom || !bookingDate || !startTime || !endTime || !title) {
      toast.warning('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (startTime >= endTime) { toast.warning('เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด'); return; }
    if (hasConflict) { toast.error('ไม่สามารถจองได้เนื่องจากมีการจองซ้ำซ้อน'); return; }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('bookings').insert({
        room_id: selectedRoom,
        user_id: profile.id,
        title, description, booking_date: bookingDate,
        start_time: startTime, end_time: endTime,
        attendees_count: attendees, status: 'pending',
      }).select().single();
      if (error) throw error;

      await supabase.from('booking_logs').insert({
        booking_id: data.id,
        action: 'สร้างการจอง',
        new_status: 'pending',
        changed_by: profile.id,
        note: `จองห้อง: ${title}`,
      });

      toast.success('จองห้องประชุมสำเร็จ! รอการอนุมัติจากผู้ดูแลระบบ');
      setTimeout(() => router.push('/my-bookings'), 1000);
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" />;

  // Timeline rendering
  const renderTimeline = () => {
    const startHour = 8, endHour = 20;
    const totalMinutes = (endHour - startHour) * 60;
    const labels = [];
    for (let h = startHour; h <= endHour; h += 2) labels.push(`${h}:00`);

    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 8, fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
          📊 Timeline การใช้งานห้อง
        </div>
        <div className="timeline">
          <div className="timeline-header">
            {labels.map(l => <span key={l}>{l}</span>)}
          </div>
          <div className="timeline-bar">
            {existingBookings.map(b => {
              const startMin = DateUtils.timeToMinutes(b.start_time) - startHour * 60;
              const endMin = DateUtils.timeToMinutes(b.end_time) - startHour * 60;
              const left = Math.max(0, (startMin / totalMinutes) * 100);
              const width = Math.min(100 - left, ((endMin - startMin) / totalMinutes) * 100);
              return (
                <div key={b.id} className={`timeline-slot ${b.status}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${b.title} (${b.profiles?.name || '-'}) ${DateUtils.formatTime(b.start_time)}-${DateUtils.formatTime(b.end_time)}`}>
                  {b.title}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span>🟢 อนุมัติแล้ว</span>
          <span>🟡 รออนุมัติ</span>
          <span>⬜ ว่าง</span>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header"><h3>📅 จองห้องประชุม</h3></div>
        <div className="card-body">
          <form onSubmit={submitBooking}>
            <div className="form-group">
              <label className="form-label">ห้องประชุม <span className="required">*</span></label>
              <select className="form-select" value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} required>
                <option value="">-- เลือกห้องประชุม --</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.building} ({r.capacity} ที่นั่ง)
                  </option>
                ))}
              </select>
            </div>

            {roomInfo && (
              <div style={{ padding: 16, background: 'var(--gray-50)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: '1.5rem' }}>🏢</span>
                  <div>
                    <strong>{roomInfo.name}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>📍 {roomInfo.building} ชั้น {roomInfo.floor} · 👥 {roomInfo.capacity} ที่นั่ง</div>
                  </div>
                </div>
                {Array.isArray(roomInfo.equipment) && roomInfo.equipment.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {roomInfo.equipment.map((eq, i) => <span key={i} className="equip-tag">{eq}</span>)}
                  </div>
                )}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">วันที่จอง <span className="required">*</span></label>
                <input type="date" className="form-input" min={DateUtils.getToday()} value={bookingDate}
                  onChange={e => setBookingDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">จำนวนผู้เข้าร่วม</label>
                <input type="number" className="form-input" value={attendees} onChange={e => setAttendees(parseInt(e.target.value) || 1)} min="1" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">เวลาเริ่มต้น <span className="required">*</span></label>
                <select className="form-select" value={startTime} onChange={e => onStartChange(e.target.value)} required>
                  {startOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">เวลาสิ้นสุด <span className="required">*</span></label>
                <select className="form-select" value={endTime} onChange={e => setEndTime(e.target.value)} required>
                  {endOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {selectedRoom && bookingDate && renderTimeline()}

            {hasConflict && (
              <div style={{
                padding: '12px 16px', background: 'var(--danger-50)', border: '1px solid rgba(244,63,94,0.2)',
                borderRadius: 'var(--border-radius-sm)', marginBottom: 20, fontSize: '0.85rem', color: 'var(--danger-600)'
              }}>
                <strong>{conflictMsg}</strong>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">หัวข้อการประชุม <span className="required">*</span></label>
              <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)}
                required placeholder="เช่น ประชุมภาควิชา ครั้งที่ 1/2568" />
            </div>

            <div className="form-group">
              <label className="form-label">รายละเอียด</label>
              <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)" />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => router.push('/')}>ยกเลิก</button>
              <button type="submit" className="btn btn-primary btn-lg" disabled={submitting || hasConflict}>
                {submitting ? <><div className="spinner" /> กำลังจอง...</> : '📅 ยืนยันการจอง'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" />}>
      <BookingContent />
    </Suspense>
  );
}
