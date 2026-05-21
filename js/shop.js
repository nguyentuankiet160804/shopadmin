/* ═══════════════════════════════════════════════════════
   shop.js — Logic trang cửa hàng (Firebase module)
   Import as type="module" in shop.html
   ═══════════════════════════════════════════════════════ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, doc, addDoc, updateDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Auth Guard ────────────────────────────────────────
const user = window.ShopAuth.requireRole('customer');
if (user) {
  document.getElementById('cust-name').textContent   = user.name || 'Khách hàng';
  document.getElementById('cust-avatar').textContent = (user.name || 'K')[0].toUpperCase();
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

let products = [], allOrders = [], cart = {};

// ── Helpers ───────────────────────────────────────────
function orderBadgeCls(s) {
  const map = { 'Chờ xử lý': 'badge-amber', 'Đang giao': 'badge-blue', 'Đã giao': 'badge-green', 'Hủy': 'badge-red' };
  return map[s] || 'badge-gray';
}

// ── Navigation ────────────────────────────────────────
window.navigate = page => {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  if (page === 'shop')      { renderShop(); updateCartUI(); }
  if (page === 'my-orders') { renderMyOrders(); }
};

// ── Category Filters ──────────────────────────────────
function syncCatFilters() {
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  const el = document.getElementById('shop-cat-filter'); if (!el) return;
  const v  = el.value;
  el.innerHTML = `<option value="">Tất cả danh mục</option>` +
    cats.map(c => `<option value="${c}" ${c === v ? 'selected' : ''}>${c}</option>`).join('');
}

// ── Shop ──────────────────────────────────────────────
window.renderShop = () => {
  const s   = document.getElementById('shop-search').value.toLowerCase();
  const cat = document.getElementById('shop-cat-filter').value;
  const list = products.filter(p => p.stock > 0 && (!s || p.name.toLowerCase().includes(s)) && (!cat || p.category === cat));
  const grid = document.getElementById('product-grid');
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-search"></i><p>Không có sản phẩm nào</p></div>`;
    return;
  }
  grid.innerHTML = list.map(p => {
    const qty = cart[p.id] || 0;
    return `<div class="product-card">
      <div class="product-card-img">${p.icon || '📦'}</div>
      <div class="product-card-body">
        <div class="product-card-name">${p.name}</div>
        <div style="margin:4px 0"><span class="badge badge-gray" style="font-size:11px">${p.category || ''}</span></div>
        <div class="product-card-price">${window.fmtPrice(p.price)}</div>
        <div class="product-card-stock"><i class="fas fa-warehouse" style="font-size:10px"></i> Còn ${p.stock} cái</div>
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty('${p.id}',-1)">−</button>
          <input class="qty-input" type="number" min="0" max="${p.stock}" value="${qty}" id="qty-${p.id}" onchange="setQtyInput('${p.id}',this.value)">
          <button class="qty-btn" onclick="changeQty('${p.id}',1)">+</button>
        </div>
        ${qty > 0
          ? `<button class="btn btn-success btn-sm" style="width:100%;margin-top:8px"><i class="fas fa-check"></i> Đã thêm (${qty})</button>`
          : `<button class="btn btn-primary btn-sm" style="width:100%;margin-top:8px" onclick="changeQty('${p.id}',1)"><i class="fas fa-cart-plus"></i> Thêm vào giỏ</button>`}
      </div>
    </div>`;
  }).join('');
};

window.changeQty = (id, delta) => {
  const p = products.find(x => x.id === id); if (!p) return;
  const nq = Math.max(0, Math.min(p.stock, (cart[id] || 0) + delta));
  nq === 0 ? delete cart[id] : (cart[id] = nq);
  updateCartUI(); renderShop();
};
window.setQtyInput = (id, val) => {
  const p = products.find(x => x.id === id); if (!p) return;
  const nq = Math.max(0, Math.min(p.stock, +val || 0));
  nq === 0 ? delete cart[id] : (cart[id] = nq);
  updateCartUI(); renderShop();
};

function updateCartUI() {
  const total = Object.values(cart).reduce((a, b) => a + b, 0);
  document.getElementById('cart-count').textContent     = total;
  document.getElementById('cart-bar-count').textContent = total;
  document.getElementById('cart-bar').classList.toggle('visible', total > 0);
}

window.openCart = () => {
  const items = Object.entries(cart).map(([id, qty]) => { const p = products.find(x => x.id === id); return p ? { ...p, qty } : null; }).filter(Boolean);
  if (!items.length) { window.showToast('Giỏ hàng trống', 'error'); return; }
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('cart-body').innerHTML = `
    <div class="detail-section">
      <h4>Sản phẩm đã chọn</h4>
      <table style="width:100%">
        <thead><tr>
          <th style="text-align:left;padding:6px 0;font-size:12px;color:var(--text3)">Sản phẩm</th>
          <th style="text-align:center;padding:6px 0;font-size:12px;color:var(--text3)">SL</th>
          <th style="text-align:right;padding:6px 0;font-size:12px;color:var(--text3)">Thành tiền</th>
        </tr></thead>
        <tbody>
          ${items.map(i => `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:10px 0;font-size:14px">${i.icon || '📦'} ${i.name}</td>
            <td style="text-align:center">${i.qty}</td>
            <td style="text-align:right;font-weight:600;color:var(--accent)">${window.fmtPrice(i.price * i.qty)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr>
          <td colspan="2" style="padding-top:12px;font-weight:700;font-size:15px">Tổng cộng</td>
          <td style="text-align:right;padding-top:12px;font-weight:700;font-size:16px;color:var(--accent)">${window.fmtPrice(total)}</td>
        </tr></tfoot>
      </table>
    </div>
    <div class="detail-section">
      <h4>Thông tin giao hàng</h4>
      <div class="form-row">
        <div class="form-group"><label>Họ tên <span style="color:var(--red)">*</span></label><input type="text" id="o-name" placeholder="Nguyễn Văn A" value="${user.name || ''}"></div>
        <div class="form-group"><label>Số điện thoại <span style="color:var(--red)">*</span></label><input type="text" id="o-phone" placeholder="09xxxxxxxx" value="${user.phone || ''}"></div>
      </div>
      <div class="form-group"><label>Địa chỉ <span style="color:var(--red)">*</span></label><input type="text" id="o-address" placeholder="Số nhà, đường, phường, quận, thành phố"></div>
      <div class="form-group"><label>Ghi chú</label><textarea id="o-note" placeholder="VD: Giao buổi sáng..."></textarea></div>
    </div>`;
  window.openModal('cart-modal');
};

window.placeOrder = async () => {
  const name    = document.getElementById('o-name')?.value.trim();
  const phone   = document.getElementById('o-phone')?.value.trim();
  const address = document.getElementById('o-address')?.value.trim();
  if (!name || !phone || !address) { window.showToast('Vui lòng điền đầy đủ thông tin', 'error'); return; }
  const btn = document.getElementById('place-order-btn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang đặt hàng...';
  const items = Object.entries(cart).map(([id, qty]) => {
    const p = products.find(x => x.id === id);
    return { productId: id, name: p.name, price: p.price, qty };
  });
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  try {
    const ref = await addDoc(colO, {
      customer: name, phone, address,
      note: document.getElementById('o-note')?.value.trim() || '',
      items, total, status: 'Chờ xử lý',
      createdAt: serverTimestamp(),
    });
    for (const item of items) {
      const p = products.find(x => x.id === item.productId);
      if (p) await updateDoc(doc(db, 'products', item.productId), { stock: p.stock - item.qty, updatedAt: serverTimestamp() });
    }
    cart = {};
    updateCartUI();
    window.closeModal('cart-modal');
    window.showToast(`Đặt hàng thành công! Mã: #${ref.id.slice(0, 8).toUpperCase()}`);
    setTimeout(() => navigate('my-orders'), 1500);
  } catch (e) { window.showToast('Lỗi đặt hàng: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Đặt hàng'; }
};

// ── My Orders ─────────────────────────────────────────
const STEPS = ['Chờ xử lý', 'Đang giao', 'Đã giao'];
window.renderMyOrders = () => {
  const sf = document.getElementById('my-order-filter').value;
  const myOrders = allOrders.filter(o => o.customer === user.name && (!sf || o.status === sf));
  const container = document.getElementById('my-orders-list');
  if (!myOrders.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-receipt"></i><p>${user.name ? `Chưa có đơn hàng nào cho "${user.name}"` : 'Chưa có đơn hàng nào'}</p></div>`;
    return;
  }
  container.innerHTML = myOrders.map(o => {
    const si = STEPS.indexOf(o.status);
    const statusBadge = {
      'Chờ xử lý': `<span class="badge badge-amber">Chờ xử lý</span>`,
      'Đang giao':  `<span class="badge badge-blue">Đang giao</span>`,
      'Đã giao':    `<span class="badge badge-green">Đã giao</span>`,
      'Hủy':        `<span class="badge badge-red">Đã hủy</span>`,
    }[o.status] || `<span class="badge badge-gray">${o.status}</span>`;
    const timeline = o.status === 'Hủy'
      ? `<div style="margin-top:10px"><span class="badge" style="background:var(--red-light);color:var(--red);font-size:13px;padding:5px 12px">Đơn hàng đã bị hủy</span></div>`
      : `<div class="status-steps" style="margin-top:12px">${STEPS.map((s, i) => `
          <div class="status-step ${i < si ? 'done' : i === si ? 'active' : ''}">
            <div class="status-dot">${i < si ? '<i class="fas fa-check" style="font-size:10px;color:#fff"></i>' : i + 1}</div>
            <div class="status-label">${s}</div>
          </div>`).join('')}</div>`;
    const previewItems = (o.items || []).slice(0, 2).map(i =>
      `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:12px">
        ${products.find(p=>p.id===i.productId)?.icon || '📦'} ${i.name} <span style="color:var(--text3)">x${i.qty}</span>
      </span>`
    ).join('');
    const moreCount = (o.items || []).length - 2;
    return `<div class="order-card" style="cursor:pointer" onclick="viewMyOrder('${o.id}')">
      <div class="order-card-header">
        <div>
          <div class="order-id">#${o.id.slice(0, 8).toUpperCase()}</div>
          <div class="order-date">${window.fmtDate(o.createdAt)}</div>
        </div>
        <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${statusBadge}
          <div style="font-weight:700;font-size:16px;color:var(--accent)">${window.fmtPrice(o.total)}</div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${previewItems}
        ${moreCount > 0 ? `<span style="font-size:12px;color:var(--text3);align-self:center">+${moreCount} sản phẩm khác</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:13px;color:var(--text2)"><i class="fas fa-map-marker-alt" style="width:16px;font-size:11px"></i> ${o.address}</div>
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();viewMyOrder('${o.id}')">
          <i class="fas fa-eye"></i> Chi tiết
        </button>
      </div>
      ${timeline}
    </div>`;
  }).join('');
};

// ── Order Detail Modal (customer) ─────────────────────
window.viewMyOrder = id => {
  const o = allOrders.find(x => x.id === id); if (!o) return;
  const si = STEPS.indexOf(o.status);
  const timeline = o.status === 'Hủy'
    ? `<div style="text-align:center;padding:12px"><span class="badge badge-red" style="font-size:14px;padding:6px 16px">Đơn hàng đã bị hủy</span></div>`
    : `<div class="status-steps">${STEPS.map((s, i) => `
        <div class="status-step ${i < si ? 'done' : i === si ? 'active' : ''}">
          <div class="status-dot">${i < si ? '<i class="fas fa-check" style="font-size:10px;color:#fff"></i>' : i + 1}</div>
          <div class="status-label">${s}</div>
        </div>`).join('')}</div>`;
  document.getElementById('my-order-detail-title').textContent = 'Đơn hàng #' + id.slice(0, 8).toUpperCase();
  document.getElementById('my-order-detail-body').innerHTML = `
    <div class="detail-section"><h4>Trạng thái đơn hàng</h4>${timeline}</div>
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
        <div>
          <div style="color:var(--text3);margin-bottom:3px;font-size:11px;text-transform:uppercase;letter-spacing:.5px">Số sản phẩm</div>
          <div style="font-weight:500">${(o.items||[]).length} loại · ${(o.items||[]).reduce((s,i)=>s+i.qty,0)} cái</div>
        </div>
        <div>
          <div style="color:var(--text3);margin-bottom:3px;font-size:11px;text-transform:uppercase;letter-spacing:.5px">Tổng tiền</div>
          <div style="font-weight:700;color:var(--accent);font-size:15px">${window.fmtPrice(o.total)}</div>
        </div>
      </div>
    </div>
    <div class="detail-section">
      <h4>Thông tin giao hàng</h4>
      <div style="background:var(--surface2);border-radius:10px;padding:14px;font-size:13.5px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;gap:8px;align-items:flex-start;color:var(--text2)">
          <i class="fas fa-user" style="width:16px;margin-top:2px;font-size:12px;color:var(--text3)"></i>
          <span><strong>${o.customer}</strong></span>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start;color:var(--text2)">
          <i class="fas fa-phone" style="width:16px;margin-top:2px;font-size:12px;color:var(--text3)"></i>
          <span>${o.phone}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start;color:var(--text2)">
          <i class="fas fa-map-marker-alt" style="width:16px;margin-top:2px;font-size:12px;color:var(--text3)"></i>
          <span>${o.address}</span>
        </div>
        ${o.note ? `<div style="display:flex;gap:8px;align-items:flex-start">
          <i class="fas fa-sticky-note" style="width:16px;margin-top:2px;font-size:12px;color:var(--text3)"></i>
          <span style="font-style:italic;color:var(--text3)">${o.note}</span>
        </div>` : ''}
      </div>
    </div>
    <div class="detail-section">
      <h4>Chi tiết sản phẩm</h4>
      <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <table style="width:100%;font-size:13px;border-collapse:collapse">
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
              const icon = products.find(p => p.id === item.productId)?.icon || '📦';
              return `<tr style="border-top:1px solid var(--border);${idx%2===1?'background:var(--surface2)':''}">
                <td style="padding:11px 14px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:34px;height:34px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:17px;border:1px solid var(--border);flex-shrink:0">${icon}</div>
                    <span style="font-weight:500">${item.name}</span>
                  </div>
                </td>
                <td style="text-align:center;padding:11px 8px;color:var(--text2)">${window.fmtPrice(item.price)}</td>
                <td style="text-align:center;padding:11px 8px">
                  <span style="display:inline-flex;align-items:center;justify-content:center;background:var(--accent-light);color:var(--accent);font-weight:700;min-width:26px;height:26px;border-radius:6px;font-size:12px;padding:0 6px">${item.qty}</span>
                </td>
                <td style="text-align:right;padding:11px 14px;font-weight:700;color:var(--accent)">${window.fmtPrice(item.price * item.qty)}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--border);background:var(--surface2)">
              <td colspan="3" style="padding:12px 14px;font-size:13px;color:var(--text2)">Tổng cộng</td>
              <td style="text-align:right;padding:12px 14px;font-weight:800;font-size:17px;color:var(--accent)">${window.fmtPrice(o.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>`;
  window.openModal('my-order-detail-modal');
};

// ── Real-time listeners ───────────────────────────────
function startListeners() {
  onSnapshot(query(colP, orderBy('createdAt', 'desc')), snap => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    syncCatFilters();
    renderShop();
  }, () => window.setDbStatus('error', 'Lỗi kết nối'));

  onSnapshot(query(colO, orderBy('createdAt', 'desc')), snap => {
    allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMyOrders();
  });
}

// ── Init ──────────────────────────────────────────────
(async () => {
  window.setDbStatus('connecting', 'Đang kết nối...');
  try {
    startListeners();
    window.setDbStatus('connected', 'Đã kết nối ✓');
  } catch (e) {
    window.setDbStatus('error', 'Kết nối thất bại');
    window.showToast('Lỗi Firebase: ' + e.message, 'error');
  }
})();