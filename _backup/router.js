/* ================================================
   ระบบจองห้องประชุม — SPA Router
   ================================================ */

const Router = {
    routes: {},
    currentRoute: null,

    register(path, handler) {
        this.routes[path] = handler;
    },

    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        // Initial route
        this.handleRoute();
    },

    navigate(path) {
        window.location.hash = path;
    },

    handleRoute() {
        const hash = window.location.hash.slice(1) || 'dashboard';
        const path = hash.split('?')[0];
        const params = this.getParams(hash);

        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-route') === path) {
                item.classList.add('active');
            }
        });

        // Update topbar title
        const titles = {
            'dashboard': '📊 แดชบอร์ด',
            'rooms': '🏢 ห้องประชุม',
            'booking': '📅 จองห้องประชุม',
            'my-bookings': '📋 การจองของฉัน',
            'approval': '✅ อนุมัติการจอง',
            'reports': '📈 รายงาน',
            'users': '👥 จัดการผู้ใช้'
        };
        const topbarTitle = document.getElementById('topbar-title');
        if (topbarTitle) topbarTitle.textContent = titles[path] || 'แดชบอร์ด';

        // Call route handler
        const handler = this.routes[path];
        if (handler) {
            this.currentRoute = path;
            const contentArea = document.getElementById('page-content');
            if (contentArea) contentArea.className = 'page-content fade-in';
            handler(params);
        } else {
            // Default to dashboard
            this.navigate('dashboard');
        }
    },

    getParams(hash) {
        const queryStr = hash.split('?')[1];
        if (!queryStr) return {};
        const params = {};
        queryStr.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        });
        return params;
    }
};

export { Router };
