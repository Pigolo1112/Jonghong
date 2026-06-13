/* ================================================
   ระบบจองห้องประชุม — Shared Utilities
   ================================================ */

// ===== TOAST NOTIFICATIONS =====
const ToastManager = {
    container: null,

    init() {
        if (this.container) return;
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    },

    show(message, type = 'info', duration = 4000) {
        this.init();
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
        `;
        this.container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, duration);

        return toast;
    },

    success(msg) { return this.show(msg, 'success'); },
    error(msg) { return this.show(msg, 'error'); },
    warning(msg) { return this.show(msg, 'warning'); },
    info(msg) { return this.show(msg, 'info'); }
};

// ===== MODAL HELPERS =====
const ModalManager = {
    open(modalId) {
        const backdrop = document.getElementById(modalId + '-backdrop');
        const modal = document.getElementById(modalId);
        if (backdrop) backdrop.classList.add('active');
        if (modal) modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    close(modalId) {
        const backdrop = document.getElementById(modalId + '-backdrop');
        const modal = document.getElementById(modalId);
        if (backdrop) backdrop.classList.remove('active');
        if (modal) modal.classList.remove('active');
        document.body.style.overflow = '';
    },

    closeAll() {
        document.querySelectorAll('.modal-backdrop.active').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        document.body.style.overflow = '';
    }
};

// ===== DATE & TIME UTILITIES =====
const DateUtils = {
    formatDate(date, format = 'long') {
        const d = new Date(date);
        const options = {
            short: { day: 'numeric', month: 'short', year: 'numeric' },
            long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
            iso: null
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

// ===== STATUS BADGE GENERATOR =====
function getStatusBadge(status) {
    const config = {
        pending: { label: 'รออนุมัติ', class: 'badge-pending', icon: '🟡' },
        approved: { label: 'อนุมัติแล้ว', class: 'badge-approved', icon: '🟢' },
        rejected: { label: 'ปฏิเสธ', class: 'badge-rejected', icon: '🔴' },
        cancelled: { label: 'ยกเลิก', class: 'badge-cancelled', icon: '⚫' }
    };
    const s = config[status] || config.pending;
    return `<span class="badge ${s.class}">${s.icon} ${s.label}</span>`;
}

function getRoleBadge(role) {
    const config = {
        admin: { label: 'ผู้ดูแลระบบ', class: 'badge-admin' },
        staff: { label: 'อาจารย์/บุคลากร', class: 'badge-staff' },
        student: { label: 'นิสิต', class: 'badge-student' }
    };
    const r = config[role] || config.student;
    return `<span class="badge ${r.class}">${r.label}</span>`;
}

// ===== FORM VALIDATION =====
const Validator = {
    required(value, fieldName) {
        if (!value || !value.toString().trim()) {
            return `กรุณากรอก${fieldName}`;
        }
        return null;
    },

    email(value) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!re.test(value)) return 'รูปแบบอีเมลไม่ถูกต้อง';
        return null;
    },

    minLength(value, min, fieldName) {
        if (value.length < min) return `${fieldName}ต้องมีอย่างน้อย ${min} ตัวอักษร`;
        return null;
    },

    number(value, fieldName) {
        if (isNaN(value) || value === '') return `${fieldName}ต้องเป็นตัวเลข`;
        return null;
    },

    timeRange(startTime, endTime) {
        if (startTime >= endTime) return 'เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด';
        return null;
    },

    showError(inputEl, message) {
        inputEl.classList.add('error');
        let errorEl = inputEl.parentElement.querySelector('.form-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'form-error';
            inputEl.parentElement.appendChild(errorEl);
        }
        errorEl.textContent = message;
    },

    clearError(inputEl) {
        inputEl.classList.remove('error');
        const errorEl = inputEl.parentElement.querySelector('.form-error');
        if (errorEl) errorEl.remove();
    },

    clearAll(formEl) {
        formEl.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        formEl.querySelectorAll('.form-error').forEach(el => el.remove());
    }
};

// ===== LOADING HELPERS =====
function showLoading(containerId, message = 'กำลังโหลดข้อมูล...') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
        <div class="page-loader">
            <div class="spinner lg"></div>
            <p>${message}</p>
        </div>
    `;
}

function showEmpty(containerId, icon = '📭', title = 'ไม่พบข้อมูล', message = '', buttonText = '', buttonAction = '') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <h3>${title}</h3>
            <p>${message}</p>
            ${buttonText ? `<button class="btn btn-primary" onclick="${buttonAction}">${buttonText}</button>` : ''}
        </div>
    `;
}

// ===== CONFIRM DIALOG =====
function showConfirm(title, message, onConfirm, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก') {
    const id = 'confirm-dialog';
    
    // Remove existing
    document.getElementById(id + '-backdrop')?.remove();
    document.getElementById(id)?.remove();

    const backdrop = document.createElement('div');
    backdrop.id = id + '-backdrop';
    backdrop.className = 'modal-backdrop active';
    backdrop.onclick = () => ModalManager.close(id);

    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal active';
    modal.style.maxWidth = '420px';
    modal.innerHTML = `
        <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" onclick="ModalManager.close('${id}')">&times;</button>
        </div>
        <div class="modal-body">
            <p>${message}</p>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="ModalManager.close('${id}')">${cancelText}</button>
            <button class="btn btn-danger" id="${id}-confirm">${confirmText}</button>
        </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    document.getElementById(`${id}-confirm`).onclick = () => {
        ModalManager.close(id);
        backdrop.remove();
        modal.remove();
        onConfirm();
    };
}

// ===== THEME TOGGLE =====
const ThemeManager = {
    init() {
        const saved = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', saved);
    },

    toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    },

    get() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }
};

// ===== DEBOUNCE =====
function debounce(func, wait = 300) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// ===== NUMBER FORMATTING =====
function formatNumber(num) {
    return new Intl.NumberFormat('th-TH').format(num);
}

function formatPercent(num) {
    return new Intl.NumberFormat('th-TH', { style: 'percent', minimumFractionDigits: 1 }).format(num / 100);
}

// ===== AVATAR HELPER =====
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
}

// ===== EXPORT =====
export {
    ToastManager,
    ModalManager,
    DateUtils,
    Validator,
    ThemeManager,
    getStatusBadge,
    getRoleBadge,
    showLoading,
    showEmpty,
    showConfirm,
    debounce,
    formatNumber,
    formatPercent,
    getInitials
};
