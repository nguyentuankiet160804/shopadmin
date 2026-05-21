/* ═══════════════════════════════════════════════════════
   shared.js — Tiện ích dùng chung (non-module)
   ═══════════════════════════════════════════════════════ */

// ── Auth helpers ──────────────────────────────────────
window.ShopAuth = {
  getRole:  () => sessionStorage.getItem('shopRole'),
  getUser:  () => JSON.parse(sessionStorage.getItem('shopUser') || 'null'),
  logout() {
    sessionStorage.removeItem('shopRole');
    sessionStorage.removeItem('shopUser');
    window.location.href = 'login.html';
  },
  requireRole(role) {
    if (this.getRole() !== role || !this.getUser()) {
      window.location.href = 'login.html';
      return null;
    }
    return this.getUser();
  }
};

// ── Toast ─────────────────────────────────────────────
let _toastTimer;
window.showToast = function(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  const i = t.querySelector('i');
  t.className = `toast ${type}`;
  if (i) i.className = `fas fa-${type === 'error' ? 'exclamation-circle' : type === 'info' ? 'info-circle' : 'check-circle'}`;
  const s = document.getElementById('toast-msg');
  if (s) s.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
};

// ── Modal ─────────────────────────────────────────────
window.openModal  = id => document.getElementById(id)?.classList.add('open');
window.closeModal = id => document.getElementById(id)?.classList.remove('open');

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-backdrop').forEach(m =>
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); })
  );
});

// ── Formatters ────────────────────────────────────────
window.fmtPrice = p => Number(p).toLocaleString('vi-VN') + 'đ';
window.fmtDate  = ts => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ── DB Status ─────────────────────────────────────────
window.setDbStatus = (cls, text) => {
  const el = document.getElementById('db-status-bar');
  if (!el) return;
  el.className = 'db-status ' + cls;
  const span = document.getElementById('db-status-text');
  if (span) span.textContent = text;
};

// ── Navigation ────────────────────────────────────────
window.navigatePage = page => {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
};
