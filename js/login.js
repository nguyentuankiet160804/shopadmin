/* ═══════════════════════════════════════════════════════
   login.js — Logic đăng nhập và đăng ký tài khoản
   Accounts stored in Firestore collection "users"
   ═══════════════════════════════════════════════════════ */

// ── Firebase (CDN compat build, non-module) ───────────
const _fbApp  = firebase.initializeApp({
  apiKey:            "AIzaSyCIXKj1BHkK16fwFArXGE6OsQDpl2pYGfI",
  authDomain:        "shop-admin-7a3e1.firebaseapp.com",
  projectId:         "shop-admin-7a3e1",
  storageBucket:     "shop-admin-7a3e1.firebasestorage.app",
  messagingSenderId: "263809395097",
  appId:             "1:263809395097:web:57ebc0bcef9f2c032bcb08"
}, 'login-app');
const _db    = firebase.firestore(_fbApp);
const _colU  = _db.collection('users');

// ── Firestore helpers ─────────────────────────────────
async function findUserByUsername(username) {
  const snap = await _colU.where('username', '==', username.toLowerCase()).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}
async function createUser(data) {
  return _colU.add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
}

// Tài khoản admin mặc định (không lưu vào localStorage)
const ADMIN_USERS = [
  { username: 'admin', password: 'admin123', name: 'Quản trị viên' }
];

// ── Auto-redirect ─────────────────────────────────────
(function autoRedirect() {
  const role = sessionStorage.getItem('shopRole');
  if (role === 'admin')    window.location.href = 'admin.html';
  else if (role === 'customer') window.location.href = 'shop.html';
})();

// ── Tab switching ─────────────────────────────────────
window.switchRole = function(role) {
  document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + role).classList.add('active');
  document.getElementById('panel-' + role).classList.add('active');
};

// ── Sub-tab: login / register (customer) ──────────────
window.switchCustomerView = function(view) {
  document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('subtab-' + view).classList.add('active');
  document.getElementById('subpanel-' + view).classList.add('active');
  clearErrors();
};

// ── Password toggle ───────────────────────────────────
window.togglePwd = function(inputId, btn) {
  const inp = document.getElementById(inputId);
  const isHidden = inp.type === 'password';
  inp.type = isHidden ? 'text' : 'password';
  btn.innerHTML = `<i class="fas fa-eye${isHidden ? '-slash' : ''}"></i>`;
};

// ── Error / Success helpers ───────────────────────────
function clearErrors() {
  document.querySelectorAll('.error-msg, .success-msg').forEach(el => {
    el.classList.remove('show');
  });
}
function showError(panel, msg) {
  const el = document.getElementById(panel + '-error');
  const span = document.getElementById(panel + '-error-msg');
  if (el && span) { span.textContent = msg; el.classList.add('show'); }
  setTimeout(() => el?.classList.remove('show'), 4500);
}
function showSuccess(panel, msg) {
  const el = document.getElementById(panel + '-success');
  const span = document.getElementById(panel + '-success-msg');
  if (el && span) { span.textContent = msg; el.classList.add('show'); }
}

// ── Loading ───────────────────────────────────────────
function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<i class="fas fa-circle-notch fa-spin-custom"></i> Đang xử lý...'
    : label;
}

// ══════════════════════════════════════════════════════
// ADMIN LOGIN
// ══════════════════════════════════════════════════════
window.loginAdmin = function() {
  clearErrors();
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value;
  if (!username || !password) { showError('admin', 'Vui lòng nhập đầy đủ thông tin'); return; }
  setLoading('admin-btn', true);
  setTimeout(() => {
    const user = ADMIN_USERS.find(u => u.username === username && u.password === password);
    if (!user) {
      setLoading('admin-btn', false, '<i class="fas fa-sign-in-alt"></i> Đăng nhập Admin');
      showError('admin', 'Tên đăng nhập hoặc mật khẩu không đúng');
      return;
    }
    sessionStorage.setItem('shopRole', 'admin');
    sessionStorage.setItem('shopUser', JSON.stringify({ name: user.name, username: user.username }));
    window.location.href = 'admin.html';
  }, 600);
};

// ══════════════════════════════════════════════════════
// CUSTOMER LOGIN (tài khoản đã đăng ký)
// ══════════════════════════════════════════════════════
window.loginCustomer = async function() {
  clearErrors();
  const username = document.getElementById('cust-login-username').value.trim();
  const password = document.getElementById('cust-login-password').value;
  if (!username || !password) { showError('cust-login', 'Vui lòng nhập đầy đủ thông tin'); return; }
  setLoading('cust-login-btn', true);
  try {
    const user = await findUserByUsername(username);
    if (!user || user.password !== password) {
      setLoading('cust-login-btn', false, '<i class="fas fa-store"></i> Đăng nhập');
      showError('cust-login', 'Tên đăng nhập hoặc mật khẩu không đúng');
      return;
    }
    sessionStorage.setItem('shopRole', 'customer');
    sessionStorage.setItem('shopUser', JSON.stringify({ name: user.name, username: user.username, phone: user.phone || '' }));
    window.location.href = 'shop.html';
  } catch(e) {
    setLoading('cust-login-btn', false, '<i class="fas fa-store"></i> Đăng nhập');
    showError('cust-login', 'Lỗi kết nối: ' + e.message);
  }
};

// ── Guest (không cần tài khoản) ──────────────────────
window.loginGuest = function() {
  clearErrors();
  const name  = document.getElementById('guest-name').value.trim();
  const phone = document.getElementById('guest-phone').value.trim();
  if (!name) { showError('guest', 'Vui lòng nhập họ tên của bạn'); return; }
  setLoading('guest-btn', true);
  setTimeout(() => {
    sessionStorage.setItem('shopRole', 'customer');
    sessionStorage.setItem('shopUser', JSON.stringify({ name, phone, isGuest: true }));
    window.location.href = 'shop.html';
  }, 400);
};

// ══════════════════════════════════════════════════════
// REGISTER NEW ACCOUNT
// ══════════════════════════════════════════════════════
window.registerAccount = async function() {
  clearErrors();
  const name      = document.getElementById('reg-name').value.trim();
  const username  = document.getElementById('reg-username').value.trim();
  const phone     = document.getElementById('reg-phone').value.trim();
  const password  = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;

  // Validation
  if (!name)     { showError('register', 'Vui lòng nhập họ tên'); return; }
  if (!username) { showError('register', 'Vui lòng nhập tên đăng nhập'); return; }
  if (username.length < 3) { showError('register', 'Tên đăng nhập phải có ít nhất 3 ký tự'); return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { showError('register', 'Tên đăng nhập chỉ gồm chữ, số và dấu gạch dưới'); return; }
  if (!password) { showError('register', 'Vui lòng nhập mật khẩu'); return; }
  if (password.length < 6) { showError('register', 'Mật khẩu phải có ít nhất 6 ký tự'); return; }
  if (password !== password2) { showError('register', 'Mật khẩu xác nhận không khớp'); return; }

  setLoading('register-btn', true);
  try {
    const existing = await findUserByUsername(username);
    if (existing) {
      setLoading('register-btn', false, '<i class="fas fa-user-plus"></i> Tạo tài khoản');
      showError('register', `Tên đăng nhập "${username}" đã được sử dụng`);
      return;
    }
    await createUser({ name, username: username.toLowerCase(), phone, password });
    setLoading('register-btn', false, '<i class="fas fa-user-plus"></i> Tạo tài khoản');
    // Clear form
    ['reg-name','reg-username','reg-phone','reg-password','reg-password2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    showSuccess('register', `Tài khoản "${username}" đã được tạo! Bạn có thể đăng nhập ngay.`);
    // Switch to login tab after 1.5s
    setTimeout(() => switchCustomerView('login'), 1800);
  } catch(e) {
    setLoading('register-btn', false, '<i class="fas fa-user-plus"></i> Tạo tài khoản');
    showError('register', 'Lỗi tạo tài khoản: ' + e.message);
  }
};

// ── Enter key support ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const pairs = [
    ['admin-password',      loginAdmin],
    ['cust-login-password', loginCustomer],
    ['guest-name',          loginGuest],
    ['guest-phone',         loginGuest],
    ['reg-password2',       registerAccount],
  ];
  pairs.forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') fn(); });
  });
});