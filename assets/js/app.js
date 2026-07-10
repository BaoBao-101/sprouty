/* ═══════════════════════════════════════════
   SPROUTY app.js migration layer
   Backend-based auth · API-first architecture
   ═══════════════════════════════════════════ */

/* ── HTML escape helper (XSS prevention) ── */
function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

/* ── Product normalizer (API → display keys) ── */
function normalizeProduct(p) {
  return {
    id: p.id,
    name: p.name,
    em: p.em || p.emoji || '🎨',
    col: p.col || p.collection || '',
    cat: p.cat || p.category || '',
    age: p.age || p.ageRange || '',
    price: Number(p.price) || 0,
    old: p.old ?? p.oldPrice ?? null,
    bg: p.bg || p.bgColor || '#FEF5EA',
    desc: p.desc || p.description || '',
    inc: p.inc || p.includes || [],
    badge: p.badge || null,
    images: p.images || [],
    status: p.status || 'published',
  };
}

/* ── Cart (client-side, localStorage) ────── */
const Cart = (() => {
  let _items = [];
  let _catalog = {};
  function _load() { try { _items = JSON.parse(localStorage.getItem('sprouty_cart') || '[]'); } catch { _items = []; } }
  function _save() { localStorage.setItem('sprouty_cart', JSON.stringify(_items)); _badge(); }
  function _badge() {
    const c = _items.reduce((s,i)=>s+(i.qty||1),0);
    document.querySelectorAll('.cart-count').forEach(el=>{el.textContent=c;el.classList.toggle('show',c>0);});
  }
  // Normalize an API product (snake-ish) to the keys cart UI expects.
  function _normalize(p) {
    return {
      id: p.id,
      name: p.name,
      em: p.em || p.emoji || '📦',
      col: p.col || p.collection || '',
      cat: p.cat || p.category || '',
      age: p.age || p.ageRange || '',
      price: Number(p.price) || 0,
      old: p.old ?? p.oldPrice ?? null,
      bg: p.bg || p.bgColor || 'var(--cream)',
    };
  }
  _load();
  return {
    get items() { return _items; },
    reload: _load, updateBadge: _badge,
    register(products) {
      products.forEach(p => { _catalog[p.id] = p; });
    },
    add(pid, qty=1, product) {
      _load();
      // Caller may pass the product explicitly (preferred when sourced from API).
      // Otherwise resolve via the API-loaded catalog registered by the page.
      const src = product || _catalog[pid];
      if (!src) { Toast.show('Không tìm thấy sản phẩm', 'error'); return; }
      const p = _normalize(src);
      const ex = _items.find(x=>x.id===pid);
      if (ex) ex.qty = (ex.qty||1) + qty;
      else _items.push({ ...p, qty });
      _save(); Toast.show(`Đã thêm "${p.name}" vào giỏ`, 'success');
    },
    remove(pid) { _load(); _items=_items.filter(x=>x.id!==pid); _save(); },
    setQty(pid,qty) { _load(); const i=_items.find(x=>x.id===pid); if(i) i.qty=Math.max(1,qty); _save(); },
    total() { return _items.reduce((s,i)=>s+(Number(i.price)||0)*(i.qty||1),0); },
    count() { return _items.reduce((s,i)=>s+(i.qty||1),0); },
    clear() { _items=[]; _save(); },
  };
})();

/* ── Auth (backend session-based) ────────── */
const Auth = (() => {
  let _user = null;
  let _ready = false;
  const _callbacks = [];

  function _updateUI() {
    const loginBtns = document.querySelectorAll('.btn-login');
    const userBtns  = document.querySelectorAll('.nav-user');
    if (_user) {
      loginBtns.forEach(b => b.style.display = 'none');
      userBtns.forEach(b => {
        b.classList.add('visible');
        const av = b.querySelector('.nav-user-avatar');
        const nm = b.querySelector('.nav-user-name');
        if (av) av.textContent = _user.name.charAt(0).toUpperCase();
        if (nm) nm.textContent = _user.name.split(' ').slice(-1)[0];
      });
    } else {
      loginBtns.forEach(b => b.style.display = '');
      userBtns.forEach(b => b.classList.remove('visible'));
    }
  }

  // Initialize from server session on page load
  async function _init() {
    if (_ready) return;
    try {
      if (typeof API !== 'undefined') {
        const data = await API.auth.me();
        _user = data.user || null;
      }
    } catch { _user = null; }
    _ready = true;
    _updateUI();
    _callbacks.forEach(fn => fn(_user));
  }

  return {
    get user() { return _user; },
    isLoggedIn() { return !!_user; },
    isAdmin()    { return _user?.role === 'admin'; },
    isEmployee() { return _user?.role === 'employee' || _user?.role === 'admin'; },

    init: _init,

    onReady(fn) {
      if (_ready) fn(_user);
      else _callbacks.push(fn);
    },

    async login(email, password) {
      const data = await API.auth.login(email, password);
      _user = data.user;
      _updateUI();
      if (typeof onAuthChange === 'function') onAuthChange(_user);
      return data;
    },

    async logout() {
      // Treat 401 as "already logged out" — the session cookie is invalid,
      // which is the state we want anyway. API.auth.logout() already retries
      // once on 403 (CSRF mismatch) with a freshly-fetched token, so a 403
      // that still reaches here means the retry also failed — the session on
      // the server is very likely still alive, so don't lie about being signed out.
      let cleared = true;
      try {
        await API.auth.logout();
      } catch (err) {
        if (err.status !== 401) {
          cleared = false;
        }
      }
      if (!cleared) {
        Toast.show('Đăng xuất thất bại — vui lòng thử lại. Phiên đăng nhập vẫn còn.', 'error');
        return;
      }
      _user = null;
      _updateUI();
      if (typeof onAuthChange === 'function') onAuthChange(null);
      Toast.show('Đã đăng xuất. Hẹn gặp lại!');
      // Hard navigation to home so any in-memory page state (admin tables,
      // employee dashboards) is wiped and not just hidden. location.replace
      // avoids leaving a gated page in browser history.
      setTimeout(() => { window.location.replace('/'); }, 400);
    },

    setUser(user) { _user = user; _updateUI(); },
    updateUI: _updateUI,
  };
})();

/* ── Toast ───────────────────────────────── */
const Toast = {
  show(msg, type='') {
    let c = document.querySelector('.toast-container');
    if (!c) { c = document.createElement('div'); c.className='toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = `toast ${type}`; t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.classList.add('out'); t.addEventListener('animationend',()=>t.remove(),{once:true}); }, 3200);
  }
};

/* ── Video Modal ─────────────────────────── */
const VideoModal = {
  init() {
    if (document.getElementById('videoModal')) return;
    const div = document.createElement('div');
    div.className = 'modal-overlay'; div.id = 'videoModal';
    div.innerHTML = `
      <div class="modal video-modal-body" style="max-width:680px;padding:0">
        <button class="modal-close" onclick="VideoModal.close()" style="position:absolute;top:10px;right:10px;z-index:10;background:rgba(0,0,0,.5);color:#fff;border-color:transparent">✕</button>
        <div class="video-player-wrap">
          <div class="video-player-sim" id="vSim">
            <div class="video-sim-play" id="vPlay" onclick="VideoModal._toggle()">▶</div>
            <p id="vSimTitle" style="font-size:.86rem;color:rgba(250,246,240,.7);text-align:center;padding:0 24px;max-width:400px"></p>
          </div>
        </div>
        <div class="video-info-bar">
          <h3 id="vTitle"></h3>
          <p id="vMeta" style="font-size:.78rem;color:var(--ink-3);margin-top:3px"></p>
        </div>
      </div>`;
    div.addEventListener('click', e => { if(e.target===div) VideoModal.close(); });
    document.body.appendChild(div);
  },
  open(title, duration, kitName) {
    this.init();
    document.getElementById('vTitle').textContent = title;
    document.getElementById('vSimTitle').textContent = title;
    document.getElementById('vMeta').textContent = `${kitName} · ${duration}`;
    document.getElementById('vPlay').textContent = '▶';
    document.getElementById('videoModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  },
  close() {
    const el = document.getElementById('videoModal');
    if(el){ el.classList.remove('open'); document.body.style.overflow=''; }
  },
  _toggle() {
    const btn = document.getElementById('vPlay');
    const isPlaying = btn.textContent === '⏸';
    btn.textContent = isPlaying ? '▶' : '⏸';
    btn.style.background = isPlaying ? 'var(--terracotta)' : 'var(--sage)';
    if(!isPlaying) Toast.show('Đang phát video...', 'success');
  }
};

/* ── Header ──────────────────────────────── */
function renderHeader(active, base='') {
  const links = [
    { href:`${base}index.html`,             label:'Trang chủ',  key:'home' },
    { href:`${base}pages/shop.html`,        label:'Sản phẩm',   key:'shop' },
    { href:`${base}pages/workshop.html`,    label:'Workshop',   key:'workshop' },
    { href:`${base}pages/ai.html`,          label:'Trợ lý AI',  key:'ai' },
    { href:`${base}pages/blog.html`,        label:'Blog',       key:'blog' },
    { href:`${base}pages/about.html`,       label:'Giới thiệu', key:'about' },
    { href:`${base}pages/account.html`,     label:'Của tôi',    key:'account' },
  ];
  const navItems    = links.map(l=>`<a href="${l.href}" class="${active===l.key?'active':''}">${l.label}</a>`).join('');
  const drawerItems = links.map(l=>`<a href="${l.href}" class="${active===l.key?'active':''}">${l.label}</a>`).join('');
  return `
  <header class="site-header">
    <div class="container navbar">
      <a class="brand" href="${base}index.html">
        <img class="brand-logo" src="${base}assets/images/logo.png" alt="Sprouty" loading="eager"
          onerror="this.style.display='none'">
      </a>
      <nav class="nav-links">${navItems}</nav>
      <div class="nav-right">
        <button class="nav-cart-btn" onclick="location.href='${base}pages/cart.html'" title="Giỏ hàng">
          🛒<span class="cart-count">0</span>
        </button>
        <button class="btn-login" onclick="LoginModal.open()">Đăng nhập</button>
        <button class="nav-user" id="navUser" onclick="showUserMenu()">
          <span class="nav-user-avatar">U</span>
          <span class="nav-user-name">Người dùng</span>
        </button>
        <button class="nav-hamburger" id="hamburger" onclick="toggleDrawer()" aria-label="Mở menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </header>
  <nav class="nav-drawer" id="navDrawer">
    ${drawerItems}
    <div class="nav-drawer-divider"></div>
    <div id="drawerAuthArea">
      <button class="btn-login" style="width:100%;text-align:center" onclick="LoginModal.open();toggleDrawer()">Đăng nhập</button>
    </div>
  </nav>`;
}

function toggleDrawer() {
  const d = document.getElementById('navDrawer'), h = document.getElementById('hamburger');
  if(d&&h){ d.classList.toggle('open'); h.classList.toggle('open'); }
}

function showUserMenu() {
  if (!Auth.isLoggedIn()) { LoginModal.open(); return; }
  const existing = document.getElementById('userMenuPopup');
  if (existing) { existing.remove(); return; }
  const btn = document.getElementById('navUser');
  const menu = document.createElement('div');
  menu.id = 'userMenuPopup';
  menu.style.cssText = `position:fixed;top:${btn.getBoundingClientRect().bottom+6}px;right:${window.innerWidth-btn.getBoundingClientRect().right}px;background:var(--surface);border:1px solid var(--parchment);border-radius:var(--r-lg);box-shadow:var(--sh-lg);z-index:999;min-width:180px;overflow:hidden`;

  const isAdmin = Auth.isAdmin();
  const isEmp = Auth.isEmployee();
  const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
  const items = [
    { label:'📦 Đơn hàng của tôi', href:`${prefix}account.html` },
    { label:'🛒 Giỏ hàng', href:`${prefix}cart.html` },
    ...(isEmp ? [{ label:'👷 Cổng nhân viên', href:`${prefix}employee/orders.html` }] : []),
    ...(isAdmin ? [{ label:'⚙️ Quản trị', href:`${prefix}admin/index.html` }] : []),
    { label:'🚪 Đăng xuất', action:'Auth.logout()' },
  ];

  menu.innerHTML = `
    <div style="padding:12px 16px 8px;border-bottom:1px solid var(--parchment);font-size:.82rem">
      <strong>${esc(Auth.user.name)}</strong>
      <div style="font-size:.72rem;color:var(--ink-3);margin-top:2px">${esc(Auth.user.email)}</div>
      <div style="font-size:.68rem;color:var(--orange);font-weight:700;margin-top:3px;text-transform:uppercase">${esc(Auth.user.role)}</div>
    </div>
    ${items.map(i=>`<div onclick="${i.href?`location.href='${i.href}'`:i.action};document.getElementById('userMenuPopup')?.remove()" style="padding:10px 16px;font-size:.84rem;cursor:pointer;transition:background .15s" onmouseover="this.style.background='var(--cream-2)'" onmouseout="this.style.background=''">${i.label}</div>`).join('')}`;

  document.body.appendChild(menu);
  const close = e => { if(!menu.contains(e.target)&&!btn.contains(e.target)){ menu.remove(); document.removeEventListener('click',close); } };
  setTimeout(()=>document.addEventListener('click',close), 10);
}

/* ── Footer ──────────────────────────────── */
function renderFooter(base='') {
  return `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="footer-logo-wrap">
            <img class="footer-logo" src="${base}assets/images/logo.png" alt="Sprouty"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <span class="footer-logo-fallback" style="display:none">
              <span class="footer-logo-fallback-mark">🌱</span>
              <span class="footer-logo-fallback-name">Sprouty</span>
            </span>
          </div>
          <p class="footer-desc">Gieo hạt thật, lưu kỷ niệm số.<br>Mỗi mầm cây nhỏ đều có câu chuyện.</p>
          <div class="footer-socials">
            <a class="footer-social" title="Liên hệ Sprouty" aria-label="Liên hệ Sprouty" href="${base}pages/contact.html">🌱</a>
            <a class="footer-social" title="Workshop Sprouty" aria-label="Workshop Sprouty" href="${base}pages/workshop.html">🎨</a>
            <a class="footer-social" title="Trợ lý AI Sprouty" aria-label="Trợ lý AI Sprouty" href="${base}pages/ai.html">🤖</a>
            <a class="footer-social" title="Cây Kỷ Niệm" aria-label="Cây Kỷ Niệm" href="${base}pages/my-products.html">🌳</a>
          </div>
        </div>
        <div class="footer-col">
          <h4>Sản phẩm</h4>
          <a href="${base}pages/shop.html">Standard Kit</a>
          <a href="${base}pages/shop.html">Smart Kit IoT</a>
          <a href="${base}pages/workshop.html">Workshop trồng cây</a>
        </div>
        <div class="footer-col">
          <h4>Hỗ trợ</h4>
          <a href="${base}pages/ai.html">Trợ lý AI</a>
          <a href="${base}pages/faq.html">Câu hỏi thường gặp</a>
          <a href="${base}pages/contact.html">Liên hệ</a>
          <a href="${base}pages/privacy.html">Chính sách bảo mật</a>
        </div>
        <div class="footer-col">
          <h4>Về chúng tôi</h4>
          <a href="${base}pages/about.html">Câu chuyện Sprouty</a>
          <a href="${base}pages/about.html#doi-ngu">Đội ngũ</a>
          <a href="${base}pages/contact.html">Liên hệ</a>
        </div>
      </div>
      <hr class="footer-divider">
      <div class="footer-bottom">
        <span>© 2026 Sprouty · TP. Hồ Chí Minh, Việt Nam 🇻🇳</span>
        <span>Thiết kế với ❤️ bởi nhóm FPT University</span>
      </div>
    </div>
  </footer>`;
}

/* ── Login Modal (backend auth) ───────────── */
const LoginModal = {
  _rendered: false,
  open(tab='login') {
    if (!this._rendered) this._render();
    document.getElementById('lm-overlay').classList.add('open');
    this._show(tab);
  },
  close() { document.getElementById('lm-overlay')?.classList.remove('open'); },
  _show(view) {
    document.getElementById('lm-login').style.display = view==='login' ? 'block' : 'none';
    document.getElementById('lm-reg').style.display   = view==='register' ? 'block' : 'none';
  },
  _render() {
    this._rendered = true;
    const mount = document.getElementById('login-modal-mount');
    if (!mount) return;
    mount.innerHTML = `
    <div class="modal-overlay" id="lm-overlay">
      <div class="modal" style="max-width:420px">
        <button class="modal-close" onclick="LoginModal.close()">✕</button>
        <!-- Login -->
        <div id="lm-login">
          <div style="text-align:center;margin-bottom:22px">
            <div style="font-size:2.8rem;margin-bottom:8px">👋</div>
            <p class="modal-title" style="margin-bottom:4px">Chào mừng trở lại</p>
            <p class="modal-subtitle">Đăng nhập để xem đơn hàng và dùng trợ lý AI</p>
          </div>
          <div class="form-group">
            <label class="form-label">Email <span class="required">*</span></label>
            <input class="form-input" type="email" id="lm-email" placeholder="email@example.com" autocomplete="email" onkeydown="if(event.key==='Enter')document.getElementById('lm-pass').focus()">
          </div>
          <div class="form-group">
            <label class="form-label">Mật khẩu <span class="required">*</span></label>
            <div class="input-group">
              <input class="form-input" type="password" id="lm-pass" placeholder="Nhập mật khẩu" autocomplete="current-password" onkeydown="if(event.key==='Enter')LoginModal._doLogin()">
              <button class="input-group-btn" type="button" onclick="LoginModal._togglePass('lm-pass',this)" tabindex="-1" title="Hiện/ẩn mật khẩu">👁</button>
            </div>
          </div>
          <div id="lm-err" style="display:none" class="form-error mb-12"></div>
          <button class="btn btn-primary btn-block" id="lm-submit" style="margin-top:4px" onclick="LoginModal._doLogin()">Đăng nhập →</button>
          <div class="form-divider">chưa có tài khoản?</div>
          <button class="btn btn-ghost btn-block" onclick="LoginModal._show('register')">Tạo tài khoản miễn phí</button>
        </div>
        <!-- Register -->
        <div id="lm-reg" style="display:none">
          <div style="text-align:center;margin-bottom:22px">
            <div style="font-size:2.8rem;margin-bottom:8px">🎉</div>
            <p class="modal-title" style="margin-bottom:4px">Tạo tài khoản</p>
            <p class="modal-subtitle">Tham gia Sprouty — bắt đầu vườn kỷ niệm của bé</p>
          </div>
          <div class="form-group">
            <label class="form-label">Họ và tên <span class="required">*</span></label>
            <input class="form-input" type="text" id="lm-rname" placeholder="Nguyễn Văn A" autocomplete="name">
          </div>
          <div class="form-group">
            <label class="form-label">Email <span class="required">*</span></label>
            <input class="form-input" type="email" id="lm-remail" placeholder="email@example.com" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">Mật khẩu <span class="required">*</span></label>
            <div class="input-group">
              <input class="form-input" type="password" id="lm-rpass" placeholder="Tối thiểu 6 ký tự" autocomplete="new-password">
              <button class="input-group-btn" type="button" onclick="LoginModal._togglePass('lm-rpass',this)" tabindex="-1">👁</button>
            </div>
            <div class="form-hint">Ít nhất 6 ký tự</div>
          </div>
          <div id="lm-rerr" style="display:none" class="form-error mb-12"></div>
          <button class="btn btn-primary btn-block" id="lm-rsubmit" style="margin-top:4px" onclick="LoginModal._doReg()">Đăng ký ngay →</button>
          <div class="form-divider">đã có tài khoản?</div>
          <button class="btn btn-ghost btn-block" onclick="LoginModal._show('login')">← Đăng nhập</button>
        </div>
      </div>
    </div>`;
    document.getElementById('lm-overlay').addEventListener('click', e => { if(e.target.id==='lm-overlay') LoginModal.close(); });
  },
  _togglePass(id, btn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.type = el.type === 'text' ? 'password' : 'text';
    btn.style.opacity = el.type === 'password' ? '1' : '0.5';
  },
  async _doLogin() {
    const email  = document.getElementById('lm-email').value.trim();
    const pass   = document.getElementById('lm-pass').value;
    const errEl  = document.getElementById('lm-err');
    const submit = document.getElementById('lm-submit');
    errEl.style.display = 'none';
    if (!email || !pass) { errEl.textContent='Vui lòng điền đầy đủ thông tin.'; errEl.style.display='block'; return; }
    submit.disabled = true; submit.textContent = 'Đang xử lý...';
    try {
      const { user } = await Auth.login(email, pass);
      Cart.updateBadge();
      this.close();
      Toast.show(`Chào ${user.name}!`, 'success');
      if (user.role === 'admin') {
        setTimeout(() => {
          if (confirm('Bạn đang đăng nhập với quyền Admin. Chuyển đến trang quản trị?')) {
            const pre = window.location.pathname.includes('/pages/') ? '' : 'pages/';
            location.href = pre + 'admin/index.html';
          }
        }, 400);
      } else if (user.role === 'employee') {
        setTimeout(() => {
          if (confirm('Bạn đang đăng nhập với quyền nhân viên. Chuyển đến cổng nhân viên?')) {
            const pre = window.location.pathname.includes('/pages/') ? '' : 'pages/';
            location.href = pre + 'employee/orders.html';
          }
        }, 400);
      }
    } catch(err) {
      errEl.textContent = err.message || 'Đăng nhập thất bại.';
      errEl.style.display = 'block';
    } finally {
      submit.disabled = false; submit.textContent = 'Đăng nhập →';
    }
  },
  async _doReg() {
    const name   = document.getElementById('lm-rname').value.trim();
    const email  = document.getElementById('lm-remail').value.trim();
    const pass   = document.getElementById('lm-rpass').value;
    const errEl  = document.getElementById('lm-rerr');
    const submit = document.getElementById('lm-rsubmit');
    errEl.style.display = 'none';
    if (!name||!email||!pass) { errEl.textContent='Vui lòng điền đầy đủ thông tin.'; errEl.style.display='block'; return; }
    if (pass.length < 6) { errEl.textContent='Mật khẩu phải có ít nhất 6 ký tự.'; errEl.style.display='block'; return; }
    if (!/\S+@\S+\.\S+/.test(email)) { errEl.textContent='Email không đúng định dạng.'; errEl.style.display='block'; return; }
    submit.disabled = true; submit.textContent = 'Đang tạo tài khoản...';
    try {
      const { user } = await API.auth.register(name, email, pass);
      Auth.setUser(user);
      Cart.updateBadge();
      this.close();
      Toast.show(`Đăng ký thành công! Chào ${name} 🎉`, 'success');
      if (typeof onAuthChange === 'function') onAuthChange(user);
    } catch(err) {
      errEl.textContent = err.message || 'Đăng ký thất bại.';
      errEl.style.display = 'block';
    } finally {
      submit.disabled = false; submit.textContent = 'Đăng ký ngay →';
    }
  },
};

/* ── Product Card HTML ───────────────────── */
function productCardHTML(p, base='') {
  const badgeLabel = p.badge==='hot'?'🔥 Bán chạy':p.badge==='new'?'✨ Mới':p.badge==='sale'?'🏷 Giảm giá':'';
  const firstImage = Array.isArray(p.images) && p.images[0] && !p.images[0].includes('product-images') ? p.images[0].replace(/^\//, '') : '';
  const svgSrc = `${base}assets/images/products/kit-${p.id}.svg`;
  const imageSrc = firstImage ? `${base}${firstImage}` : svgSrc;
  return `
  <div class="product-card" onclick="location.href='${base}pages/product-detail.html?id=${p.id}'" role="article" tabindex="0" onkeydown="if(event.key==='Enter')this.click()">
    <div class="product-card-img" style="background:${p.bg||'#FEF5EA'}">
      <img src="${imageSrc}" alt="${esc(p.name)}" loading="lazy" class="product-svg-img"
        onerror="this.src='${svgSrc}';this.onerror=function(){this.style.display='none';this.nextElementSibling.style.display='flex'};this.className='product-svg-img'">
      <span class="product-emoji" style="display:none">${esc(p.em)}</span>
      ${p.badge ? `<span class="product-badge ${p.badge}">${badgeLabel}</span>` : ''}
    </div>
    <div class="product-card-body">
      <div class="product-age">${esc(p.col)} · ${esc(p.age)}</div>
      <div class="product-name">${esc(p.name)}</div>
      <div class="product-desc">${esc(p.desc)}</div>
      <div class="product-footer">
        <div>
          ${p.old ? `<span class="product-old-price">${p.old.toLocaleString('vi-VN')}đ</span>` : ''}
          <span class="product-price">${p.price.toLocaleString('vi-VN')}đ</span>
        </div>
        <button class="add-btn" onclick="event.stopPropagation();Cart.add(${p.id})" title="Thêm vào giỏ" aria-label="Thêm ${esc(p.name)} vào giỏ">+</button>
      </div>
    </div>
  </div>`;
}

/* ── Init ────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  Cart.updateBadge();
  // Load auth state from backend session cookie
  await Auth.init();
});
