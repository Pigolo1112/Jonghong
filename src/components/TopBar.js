'use client';

import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const titles = {
  '/': '📊 แดชบอร์ด',
  '/rooms': '🏢 ห้องประชุม',
  '/booking': '📅 จองห้องประชุม',
  '/my-bookings': '📋 การจองของฉัน',
  '/approval': '✅ อนุมัติการจอง',
  '/reports': '📈 รายงาน',
  '/users': '👥 จัดการผู้ใช้',
};

export default function TopBar({ onMenuToggle }) {
  const { signOut } = useAuth();
  const pathname = usePathname();
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu-btn" onClick={onMenuToggle}>☰</button>
        <h1 className="topbar-title">{titles[pathname] || '📊 แดชบอร์ด'}</h1>
      </div>
      <div className="topbar-right">
        <button className="topbar-btn" onClick={toggleTheme} title="สลับธีม">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="topbar-btn" onClick={signOut} title="ออกจากระบบ">
          🚪
        </button>
      </div>
    </header>
  );
}
