/* ============================================================
   OwnUI Admin · 布局层脚本（admin/admin.js）
   ------------------------------------------------------------
   组件行为全部由 library/components.js 的 data-ui 声明负责；
   这里只做布局层自己的事：

   1. 当前页菜单高亮：按路径匹配 ui-sidenav 的 href，自动
      aria-current，命中的子菜单自动展开
   2. 子菜单手风琴展开/收起
   3. 侧栏折叠（桌面）与抽屉（窄屏），localStorage 记忆
   4. 深浅色主题与主色预设切换（写 <html> 属性 + 记忆）
   5. 退出登录：二次确认 + toast

   铁律：不改组件内部状态，不碰 L1/L2 Token，只写自己的键。
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var KEY_THEME = 'ownui-admin-theme';
  var KEY_ACCENT = 'ownui-admin-accent';
  var KEY_FOLD = 'ownui-admin-folded';

  /* ---------- 1. 当前页高亮 ---------- */
  var here = location.pathname.split('/').pop() || 'index.html';
  var full = here + (location.hash || '');
  /* 先试「路径 + 锚点」精确匹配（如 forms.html#advanced），
     命中就只标它；否则回退到纯路径匹配。
     不这样做的话，/forms.html 会同时点亮主菜单和两个子菜单。 */
  var links = document.querySelectorAll('.adm-side .ui-sidenav__item[href]');
  var exact = Array.prototype.filter.call(links, function (a) {
    return a.getAttribute('href') === full && full !== here;
  });
  links.forEach(function (a) {
    var target = (a.getAttribute('href') || '').split(/[#?]/)[0];
    var hit = exact.length
      ? exact.indexOf(a) > -1
      : target === here;
    if (hit) {
      a.setAttribute('aria-current', 'page');
      var group = a.closest('.adm-menu__item');
      if (group) group.classList.add('is-open');
    }
  });

  /* ---------- 2. 子菜单手风琴 ---------- */
  document.querySelectorAll('.adm-menu__item > .ui-sidenav__item[data-sub]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      /* 顶层的组标题本身不是跳转链接：阻止默认，只做展开 */
      btn.setAttribute('aria-expanded', btn.closest('.adm-menu__item').classList.toggle('is-open') ? 'true' : 'false');
    });
  });

  /* ---------- 3. 折叠 / 抽屉 ---------- */
  var adm = document.querySelector('.adm');
  function setFolded(on) {
    adm.classList.toggle('is-folded', on);
    try { localStorage.setItem(KEY_FOLD, on ? '1' : ''); } catch (e) {}
  }
  try { if (localStorage.getItem(KEY_FOLD)) adm.classList.add('is-folded'); } catch (e) {}

  document.querySelectorAll('[data-adm-fold]').forEach(function (btn) {
    btn.addEventListener('click', function () { setFolded(!adm.classList.contains('is-folded')); });
  });
  document.querySelectorAll('[data-adm-drawer]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      adm.classList.toggle('is-drawer-open');
      btn.setAttribute('aria-expanded', adm.classList.contains('is-drawer-open') ? 'true' : 'false');
    });
  });
  document.querySelectorAll('.adm-veil').forEach(function (veil) {
    veil.addEventListener('click', function () { adm.classList.remove('is-drawer-open'); });
  });

  /* ---------- 4. 主题与主色 ---------- */
  function setTheme(mode) {
    root.setAttribute('data-ui-theme', mode);
    try { localStorage.setItem(KEY_THEME, mode); } catch (e) {}
    document.querySelectorAll('[data-adm-theme]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-adm-theme') === mode ? 'true' : 'false');
    });
  }
  try {
    var savedTheme = localStorage.getItem(KEY_THEME);
    if (savedTheme) setTheme(savedTheme);
  } catch (e) {}
  document.querySelectorAll('[data-adm-theme]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setTheme(btn.getAttribute('data-adm-theme') === 'dark' ? 'dark' : 'light');
    });
  });

  function setAccent(name) {
    if (name && name !== 'brand') root.setAttribute('data-ui-accent', name);
    else root.removeAttribute('data-ui-accent');
    try { localStorage.setItem(KEY_ACCENT, name || ''); } catch (e) {}
    document.querySelectorAll('[data-adm-accent]').forEach(function (o) {
      o.setAttribute('aria-checked', o.getAttribute('data-adm-accent') === (name || 'brand') ? 'true' : 'false');
    });
  }
  try {
    var savedAccent = localStorage.getItem(KEY_ACCENT);
    if (savedAccent) setAccent(savedAccent);
  } catch (e) {}
  document.querySelectorAll('[data-adm-accent]').forEach(function (o) {
    o.addEventListener('click', function () {
      setAccent(o.getAttribute('data-adm-accent'));
      if (window.UI && UI.toast) {
        UI.toast({ message: '主色已切换为「' + (o.getAttribute('data-adm-label') || o.textContent.trim()) + '」', type: 'success' });
      }
    });
  });

  /* ---------- 5. 退出登录 ---------- */
  document.querySelectorAll('[data-adm-logout]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (window.UI && UI.toast) {
        UI.toast({ message: '已退出登录（演示环境，不会真的登出）', type: 'success' });
      }
    });
  });
})();
