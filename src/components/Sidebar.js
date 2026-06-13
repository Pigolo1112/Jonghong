'use client';

import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getInitials } from '@/lib/utils';

const mainMenu = [
  { path: '/', icon: '📊', label: 'แดชบอร์ด' },
  { path: '/rooms', icon: '🏢', label: 'ห้องประชุม' },
  { path: '/booking', icon: '📅', label: 'จองห้องประชุม' },
  { path: '/my-bookings', icon: '📋', label: 'การจองของฉัน' },
];

const adminMenu = [
  { path: '/approval', icon: '✅', label: 'อนุมัติการจอง', hasBadge: true },
  { path: '/reports', icon: '📈', label: 'รายงาน' },
  { path: '/users', icon: '👥', label: 'จัดการผู้ใช้' },
];

export default function Sidebar({ isOpen, onClose }) {
  const { profile, isAdmin } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (isAdmin()) {
      loadPendingCount();
    }
  }, [isAdmin]);

  const loadPendingCount = async () => {
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingCount(count || 0);
  };

  const navigateTo = (path) => {
    router.push(path);
    onClose?.();
  };

  const roleNames = { admin: 'ผู้ดูแลระบบ', staff: 'อาจารย์/บุคลากร', student: 'นิสิต' };

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-sm">🏛️</div>
          <div>
            <h2>จองห้องประชุม</h2>
            <span>คณะวิทย์ฯ & นวัตกรรม</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">เมนูหลัก</div>
            {mainMenu.map(item => (
              <button
                key={item.path}
                className={`nav-item ${pathname === item.path ? 'active' : ''}`}
                onClick={() => navigateTo(item.path)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {isAdmin() && (
            <div className="nav-section">
              <div className="nav-section-title">ผู้ดูแลระบบ</div>
              {adminMenu.map(item => (
                <button
                  key={item.path}
                  className={`nav-item ${pathname === item.path ? 'active' : ''}`}
                  onClick={() => navigateTo(item.path)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {item.hasBadge && pendingCount > 0 && (
                    <span className="badge" style={{ marginLeft: 'auto' }}>{pendingCount}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">{getInitials(profile?.name)}</div>
            <div className="user-info">
              <div className="user-name">{profile?.name || 'ผู้ใช้'}</div>
              <div className="user-role">{roleNames[profile?.role] || profile?.role}</div>
            </div>
          </div>
        </div>
      </aside>
      {isOpen && <div className="sidebar-overlay active" onClick={onClose} />}
    </>
  );
}
