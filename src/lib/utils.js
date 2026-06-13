/* ================================================
   ระบบจองห้องประชุม — Shared Utilities
   ================================================ */

// ===== DATE & TIME UTILITIES =====
export const DateUtils = {
  formatDate(date, format = 'long') {
    const d = new Date(date);
    const options = {
      short: { day: 'numeric', month: 'short', year: 'numeric' },
      long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    };
    if (format === 'iso') return d.toISOString().split('T')[0];
    return d.toLocaleDateString('th-TH', options[format] || options.long);
  },

  formatTime(time) {
    if (!time) return '';
    const [h, m] = time.split(':');
    return `${h}:${m} น.`;
  },

  formatDateTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  getToday() {
    return new Date().toISOString().split('T')[0];
  },

  isToday(dateStr) {
    return dateStr === this.getToday();
  },

  isPast(dateStr) {
    return new Date(dateStr) < new Date(this.getToday());
  },

  getThaiMonth(monthIndex) {
    const months = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    return months[monthIndex];
  },

  getThaiDay(dayIndex) {
    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    return days[dayIndex];
  },

  getThaiDayShort(dayIndex) {
    const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    return days[dayIndex];
  },

  timeToMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  },

  minutesToTime(minutes) {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }
};

// ===== NUMBER FORMATTING =====
export function formatNumber(num) {
  return new Intl.NumberFormat('th-TH').format(num);
}

export function formatPercent(num) {
  return new Intl.NumberFormat('th-TH', { style: 'percent', minimumFractionDigits: 1 }).format(num / 100);
}

// ===== AVATAR HELPER =====
export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
}

// ===== DEBOUNCE =====
export function debounce(func, wait = 300) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ===== TIME OPTIONS GENERATOR =====
export function generateTimeOptions(startHour, endHour) {
  const options = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      options.push({ value: time, label: `${time} น.` });
    }
  }
  return options;
}
