/* ═══════════════════════════════════════════════════════
   admin.js — Logic trang quản trị viên (Firebase module)
   Import as type="module" in admin.html
   ═══════════════════════════════════════════════════════ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Auth Guard ────────────────────────────────────────
const user = window.ShopAuth.requireRole('admin');
if (user) {
  document.getElementById('admin-name').textContent   = user.name || 'Admin';
  document.getElementById('admin-avatar').textContent = (user.name || 'A')[0].toUpperCase();
}
window.logout = () => window.ShopAuth.logout();

// ── Firebase Config ───────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyCIXKj1BHkK16fwFArXGE6OsQDpl2pYGfI",
  authDomain:        "shop-admin-7a3e1.firebaseapp.com",
  projectId:         "shop-admin-7a3e1",
  storageBucket:     "shop-admin-7a3e1.firebasestorage.app",
  messagingSenderId: "263809395097",
  appId:             "1:263809395097:web:57ebc0bcef9f2c032bcb08"
};
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const colP = collection(db, 'products');
const colO = collection(db, 'orders');

let products = [], orders = [];

// ── UI Helpers ────────────────────────────────────────
function stockBadge(s) {
  if (s === 0) return '<span class="badge badge-red">Hết hàng</span>';
  if (s <= 5)  return '<span class="badge badge-amber">Sắp hết</span>';
  return '<span class="badge badge-green">Còn hàng</span>';
}
function orderBadge(s) {
  const map = { 'Chờ xử lý': 'badge-amber', 'Đang giao': 'badge-blue', 'Đã giao': 'badge-green', 'Hủy': 'badge-red' };
  return `<span class="badge ${map[s] || 'badge-gray'}">${s}</span>`;
}

// ── Navigation ────────────────────────────────────────
window.navigate = page => {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  if (page === 'products')     { updateStats(); renderProductTable(); }
  if (page === 'orders-admin') { updateOrderStats(); renderOrderTable(); }
};

// ── Category Filters ──────────────────────────────────
function syncCatFilters() {
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  const el = document.getElementById('product-cat-filter');
  if (!el) return;
  const v = el.value;
  el.innerHTML = `<option value="">Tất cả danh mục</option>` +
    cats.map(c => `<option value="${c}" ${c === v ? 'selected' : ''}>${c}</option>`).join('');
}

// ── Stats ─────────────────────────────────────────────
function updateStats() {
  document.getElementById('stat-total').textContent   = products.length;
  document.getElementById('stat-instock').textContent = products.filter(p => p.stock > 5).length;
  document.getElementById('stat-low').textContent     = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  document.getElementById('stat-cats').textContent    = [...new Set(products.map(p => p.category))].length;
  syncCatFilters();
}
function updateOrderStats() {
  document.getElementById('o-stat-total').textContent   = orders.length;
  document.getElementById('o-stat-pending').textContent = orders.filter(o => o.status === 'Chờ xử lý').length;
  document.getElementById('o-stat-done').textContent    = orders.filter(o => o.status === 'Đã giao').length;
  const rev = orders.filter(o => o.status !== 'Hủy').reduce((s, o) => s + (o.total || 0), 0);
  document.getElementById('o-stat-rev').textContent = window.fmtPrice(rev);
}

// ── Product Table ─────────────────────────────────────
window.renderProductTable = () => {
  const s   = document.getElementById('product-search').value.toLowerCase();
  const cat = document.getElementById('product-cat-filter').value;
  const list = products.filter(p =>
    (!s || p.name.toLowerCase().includes(s) || (p.sku || '').toLowerCase().includes(s)) &&
    (!cat || p.category === cat)
  );
  const tbody = document.getElementById('product-table-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-box-open"></i><p>Không có sản phẩm nào</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((p, i) => `
    <tr>
      <td style="color:var(--text3);font-size:12px">${i + 1}</td>
      <td><div class="product-info">
        <div class="product-thumb">${p.icon || '📦'}</div>
        <div><div class="product-name">${p.name}</div><div class="product-sku">${p.sku || ''}</div></div>
      </div></td>
      <td><span class="badge badge-gray">${p.category || '—'}</span></td>
      <td style="font-weight:600;color:var(--accent)">${window.fmtPrice(p.price)}</td>
      <td>${p.stock} cái</td>
      <td>${stockBadge(p.stock)}</td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-sm btn-secondary btn-icon" onclick="viewProduct('${p.id}')" title="Chi tiết"><i class="fas fa-eye"></i></button>
        <button class="btn btn-sm btn-secondary btn-icon" onclick="editProduct('${p.id}')" title="Sửa"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-danger btn-icon" onclick="confirmDeleteProduct('${p.id}')" title="Xóa"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`).join('');
};

// ── Add / Edit Product ────────────────────────────────
window.openAddProduct = () => {
  document.getElementById('product-modal-title').textContent = 'Thêm sản phẩm mới';
  document.getElementById('edit-id').value = '';
  ['f-name', 'f-sku', 'f-price', 'f-stock', 'f-icon', 'f-desc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-category').value = 'Thời trang';
  window.openModal('product-modal');
};
window.editProduct = id => {
  const p = products.find(x => x.id === id); if (!p) return;
  document.getElementById('product-modal-title').textContent = 'Chỉnh sửa sản phẩm';
  document.getElementById('edit-id').value    = id;
  document.getElementById('f-name').value     = p.name;
  document.getElementById('f-sku').value      = p.sku || '';
  document.getElementById('f-price').value    = p.price;
  document.getElementById('f-stock').value    = p.stock;
  document.getElementById('f-category').value = p.category || 'Thời trang';
  document.getElementById('f-icon').value     = p.icon || '';
  document.getElementById('f-desc').value     = p.desc || '';
  window.closeModal('detail-modal');
  window.openModal('product-modal');
};
window.saveProduct = async () => {
  const name  = document.getElementById('f-name').value.trim();
  const price = +document.getElementById('f-price').value;
  const stock = +document.getElementById('f-stock').value;
  if (!name)         { window.showToast('Vui lòng nhập tên sản phẩm', 'error'); return; }
  if (!price || price <= 0) { window.showToast('Vui lòng nhập giá hợp lệ', 'error'); return; }
  const btn = document.getElementById('save-product-btn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
  const data = {
    name, price, stock,
    sku:      document.getElementById('f-sku').value.trim(),
    category: document.getElementById('f-category').value,
    icon:     document.getElementById('f-icon').value.trim() || '📦',
    desc:     document.getElementById('f-desc').value.trim(),
    updatedAt: serverTimestamp(),
  };
  try {
    const editId = document.getElementById('edit-id').value;
    if (editId) {
      await updateDoc(doc(db, 'products', editId), data);
      window.showToast('Đã cập nhật sản phẩm ✓');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(colP, data);
      window.showToast('Đã thêm sản phẩm mới vào Firebase ✓');
    }
    window.closeModal('product-modal');
  } catch (e) { window.showToast('Lỗi Firebase: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Lưu sản phẩm'; }
};

// ── View Product ──────────────────────────────────────
window.viewProduct = id => {
  const p = products.find(x => x.id === id); if (!p) return;
  document.getElementById('detail-modal-body').innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:56px;margin-bottom:8px">${p.icon || '📦'}</div>
      <h2 style="font-size:18px;font-weight:700">${p.name}</h2>
      <span class="badge badge-gray" style="margin-top:6px">${p.category || '—'}</span>
    </div>
    <div style="background:var(--surface2);border-radius:10px;padding:16px;margin-bottom:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:12px;color:var(--text3);margin-bottom:3px">Mã SKU</div><div style="font-weight:600">${p.sku || '—'}</div></div>
        <div><div style="font-size:12px;color:var(--text3);margin-bottom:3px">Giá bán</div><div style="font-weight:700;color:var(--accent);font-size:16px">${window.fmtPrice(p.price)}</div></div>
        <div><div style="font-size:12px;color:var(--text3);margin-bottom:3px">Tồn kho</div><div style="font-weight:600">${p.stock} cái</div></div>
        <div><div style="font-size:12px;color:var(--text3);margin-bottom:3px">Trạng thái</div>${stockBadge(p.stock)}</div>
      </div>
    </div>
    ${p.desc ? `<div><div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Mô tả</div><p style="font-size:14px;color:var(--text2);line-height:1.6">${p.desc}</p></div>` : ''}`;
  document.getElementById('detail-edit-btn').onclick = () => editProduct(id);
  window.openModal('detail-modal');
};

// ── Delete Product ────────────────────────────────────
window.confirmDeleteProduct = id => {
  const p = products.find(x => x.id === id); if (!p) return;
  document.getElementById('confirm-name').textContent = p.name;
  document.getElementById('confirm-delete-btn').onclick = async () => {
    try {
      await deleteDoc(doc(db, 'products', id));
      window.closeModal('confirm-modal');
      window.showToast('Đã xóa sản phẩm khỏi Firebase');
    } catch (e) { window.showToast('Lỗi xóa: ' + e.message, 'error'); }
  };
  window.openModal('confirm-modal');
};

// ── Order Table ───────────────────────────────────────
window.renderOrderTable = () => {
  const sf   = document.getElementById('order-status-filter').value;
  const list = orders.filter(o => !sf || o.status === sf);
  updateOrderStats();
  const tbody = document.getElementById('order-table-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-receipt"></i><p>Không có đơn hàng nào</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(o => `
    <tr>
      <td style="font-weight:600;color:var(--accent);font-size:12px">#${o.id.slice(0, 8).toUpperCase()}</td>
      <td><div style="font-weight:500">${o.customer}</div><div style="font-size:12px;color:var(--text3)">${o.phone}</div></td>
      <td style="font-size:13px;color:var(--text2)">${(o.items || []).length} sản phẩm</td>
      <td style="font-weight:600">${window.fmtPrice(o.total)}</td>
      <td>${orderBadge(o.status)}</td>
      <td style="font-size:12px;color:var(--text3)">${window.fmtDate(o.createdAt)}</td>
      <td><button class="btn btn-sm btn-secondary" onclick="viewOrder('${o.id}')"><i class="fas fa-eye"></i> Chi tiết</button></td>
    </tr>`).join('');
};

// ── Order Detail ──────────────────────────────────────
const STEPS = ['Chờ xử lý', 'Đang giao', 'Đã giao'];
window.viewOrder = id => {
  const o = orders.find(x => x.id === id); if (!o) return;
  document.getElementById('order-detail-title').textContent = 'Đơn hàng #' + id.slice(0, 8).toUpperCase();
  const si = STEPS.indexOf(o.status);
  const timeline = o.status === 'Hủy'
    ? `<div style="text-align:center;padding:12px"><span class="badge badge-red" style="font-size:14px;padding:6px 16px">Đơn hàng đã bị hủy</span></div>`
    : `<div class="status-steps">${STEPS.map((s, i) => `
        <div class="status-step ${i < si ? 'done' : i === si ? 'active' : ''}">
          <div class="status-dot">${i < si ? '<i class="fas fa-check" style="font-size:10px;color:#fff"></i>' : i + 1}</div>
          <div class="status-label">${s}</div>
        </div>`).join('')}</div>`;

  const subtotal = (o.items || []).reduce((s, i) => s + i.price * i.qty, 0);

  document.getElementById('order-detail-body').innerHTML = `
    <!-- Trạng thái -->
    <div class="detail-section"><h4>Trạng thái đơn hàng</h4>${timeline}</div>

    <!-- Thông tin chung -->
    <div class="detail-section">
      <h4>Thông tin đơn hàng</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:var(--surface2);border-radius:10px;padding:14px;font-size:13px">
        <div>
          <div style="color:var(--text3);margin-bottom:3px;font-size:11px;text-transform:uppercase;letter-spacing:.5px">Mã đơn</div>
          <div style="font-weight:700;color:var(--accent)">#${o.id.slice(0,8).toUpperCase()}</div>
        </div>
        <div>
          <div style="color:var(--text3);margin-bottom:3px;font-size:11px;text-transform:uppercase;letter-spacing:.5px">Thời gian đặt</div>
          <div style="font-weight:500">${window.fmtDate(o.createdAt)}</div>
        </div>
        ${o.updatedAt ? `<div>
          <div style="color:var(--text3);margin-bottom:3px;font-size:11px;text-transform:uppercase;letter-spacing:.5px">Cập nhật lần cuối</div>
          <div style="font-weight:500">${window.fmtDate(o.updatedAt)}</div>
        </div>` : ''}
        <div>
          <div style="color:var(--text3);margin-bottom:3px;font-size:11px;text-transform:uppercase;letter-spacing:.5px">Số sản phẩm</div>
          <div style="font-weight:500">${(o.items || []).length} loại · ${(o.items || []).reduce((s,i)=>s+i.qty,0)} cái</div>
        </div>
      </div>
    </div>

    <!-- Thông tin khách hàng -->
    <div class="detail-section">
      <h4>Thông tin khách hàng</h4>
      <div style="background:var(--surface2);border-radius:10px;padding:14px;font-size:14px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:15px;flex-shrink:0">
            ${(o.customer || 'K')[0].toUpperCase()}
          </div>
          <div>
            <div style="font-weight:600;font-size:15px">${o.customer}</div>
            <div style="font-size:12px;color:var(--text3)">Khách hàng</div>
          </div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:10px;display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;gap:8px;align-items:flex-start;color:var(--text2)">
            <i class="fas fa-phone" style="width:16px;margin-top:2px;font-size:12px;color:var(--text3)"></i>
            <span>${o.phone}</span>
          </div>
          <div style="display:flex;gap:8px;align-items:flex-start;color:var(--text2)">
            <i class="fas fa-map-marker-alt" style="width:16px;margin-top:2px;font-size:12px;color:var(--text3)"></i>
            <span>${o.address}</span>
          </div>
          ${o.note ? `<div style="display:flex;gap:8px;align-items:flex-start;color:var(--text2)">
            <i class="fas fa-sticky-note" style="width:16px;margin-top:2px;font-size:12px;color:var(--text3)"></i>
            <span style="font-style:italic;color:var(--text3)">${o.note}</span>
          </div>` : ''}
        </div>
      </div>
    </div>

    <!-- Sản phẩm -->
    <div class="detail-section">
      <h4>Chi tiết sản phẩm</h4>
      <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <table style="width:100%;font-size:13.5px;border-collapse:collapse">
          <thead>
            <tr style="background:var(--surface2)">
              <th style="text-align:left;padding:10px 14px;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.4px">Sản phẩm</th>
              <th style="text-align:center;padding:10px 8px;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.4px">Đơn giá</th>
              <th style="text-align:center;padding:10px 8px;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.4px">SL</th>
              <th style="text-align:right;padding:10px 14px;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.4px">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${(o.items || []).map((item, idx) => {
              const prod = products.find(p => p.id === item.productId);
              const icon = prod?.icon || item.icon || '📦';
              const lineTotal = item.price * item.qty;
              return `<tr style="border-top:1px solid var(--border);${idx % 2 === 1 ? 'background:var(--surface2)' : ''}">
                <td style="padding:12px 14px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:36px;height:36px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:18px;border:1px solid var(--border);flex-shrink:0">${icon}</div>
                    <div>
                      <div style="font-weight:500">${item.name}</div>
                      ${item.productId ? `<div style="font-size:11px;color:var(--text3)">ID: ${item.productId.slice(0,8)}</div>` : ''}
                    </div>
                  </div>
                </td>
                <td style="text-align:center;padding:12px 8px;color:var(--text2)">${window.fmtPrice(item.price)}</td>
                <td style="text-align:center;padding:12px 8px">
                  <span style="display:inline-flex;align-items:center;justify-content:center;background:var(--accent-light);color:var(--accent);font-weight:700;min-width:28px;height:28px;border-radius:6px;font-size:13px;padding:0 6px">${item.qty}</span>
                </td>
                <td style="text-align:right;padding:12px 14px;font-weight:700;color:var(--accent)">${window.fmtPrice(lineTotal)}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--border);background:var(--surface2)">
              <td colspan="3" style="padding:12px 14px;font-size:13px;color:var(--text2)">Tổng cộng</td>
              <td style="text-align:right;padding:12px 14px;font-weight:800;font-size:17px;color:var(--accent)">${window.fmtPrice(o.total || subtotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>`;

  const sel = document.getElementById('order-status-select');
  sel.innerHTML = ['Chờ xử lý', 'Đang giao', 'Đã giao', 'Hủy'].map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('');
  sel.dataset.orderId = id;
  window.openModal('order-detail-modal');
};
window.updateOrderStatus = async () => {
  const id  = document.getElementById('order-status-select').dataset.orderId;
  const ns  = document.getElementById('order-status-select').value;
  const btn = document.getElementById('update-status-btn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang cập nhật...';
  try {
    await updateDoc(doc(db, 'orders', id), { status: ns, updatedAt: serverTimestamp() });
    window.closeModal('order-detail-modal');
    window.showToast('Đã cập nhật trạng thái đơn hàng ✓');
  } catch (e) { window.showToast('Lỗi: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> Cập nhật'; }
};

// ── Seed sample data if empty ─────────────────────────
async function seedIfEmpty() {
  return new Promise(resolve => {
    const unsub = onSnapshot(query(colP, orderBy('createdAt', 'desc')), async snap => {
      unsub();
      if (snap.empty) {
        window.showToast('Đang tạo dữ liệu mẫu...', 'info');
        const samples = [
          { name: 'Áo thun basic',      sku: 'AT001', price: 150000, stock: 45, category: 'Thời trang', icon: '👕', desc: 'Cotton 100%, nhiều màu' },
          { name: 'Tai nghe không dây', sku: 'TN002', price: 890000, stock: 12, category: 'Điện tử',    icon: '🎧', desc: 'Bluetooth 5.0, pin 20h' },
          { name: 'Sách kỹ năng mềm',   sku: 'SK003', price:  95000, stock:  3, category: 'Sách',       icon: '📚', desc: '10 kỹ năng quan trọng' },
          { name: 'Nước hoa hồng',      sku: 'MC004', price: 220000, stock: 28, category: 'Mỹ phẩm',    icon: '🌹', desc: 'Dưỡng da, cân bằng độ ẩm' },
          { name: 'Bình nước thể thao', sku: 'TT005', price: 185000, stock:  0, category: 'Thể thao',   icon: '🍶', desc: 'Inox 304, giữ nhiệt 12h' },
          { name: 'Mì hảo hảo thùng',  sku: 'TP006', price: 135000, stock: 60, category: 'Thực phẩm',  icon: '🍜', desc: 'Thùng 30 gói' },
        ];
        for (const p of samples) await addDoc(colP, { ...p, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        window.showToast('Đã tạo 6 sản phẩm mẫu vào Firestore ✓');
      }
      resolve();
    }, err => { console.error(err); resolve(); });
  });
}

// ── Real-time listeners ───────────────────────────────
function startListeners() {
  onSnapshot(query(colP, orderBy('createdAt', 'desc')), snap => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateStats();
    renderProductTable();
  }, () => window.setDbStatus('error', 'Lỗi kết nối'));

  onSnapshot(query(colO, orderBy('createdAt', 'desc')), snap => {
    orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateOrderStats();
    renderOrderTable();
  });
}

// ── Init ──────────────────────────────────────────────
(async () => {
  window.setDbStatus('connecting', 'Đang kết nối Firebase...');
  try {
    await seedIfEmpty();
    startListeners();
    window.setDbStatus('connected', 'Firebase đã kết nối ✓');
  } catch (e) {
    window.setDbStatus('error', 'Kết nối thất bại');
    window.showToast('Lỗi Firebase: ' + e.message, 'error');
  }
})();