/* ============================================================
   OneUI · 文档站脚本（docs.js）
   仅服务文档站：主题切换、导航搜索、滚动定位、主色试验台。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 亮暗模式（验证 Token 语义层可翻转） ---------- */
  var STORE_KEY = 'oneui-doc-theme';
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch (e) { saved = null; }
  if (saved) root.setAttribute('data-ui-theme', saved);

  function currentTheme() {
    return root.getAttribute('data-ui-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function applyTheme(theme) {
    root.setAttribute('data-ui-theme', theme);
    try { localStorage.setItem(STORE_KEY, theme); } catch (e) { /* 忽略隐私模式 */ }
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      var label = btn.querySelector('[data-theme-label]');
      if (label) label.textContent = theme === 'dark' ? '切换浅色' : '切换深色';
    });
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });
  applyTheme(currentTheme());

  /* ---------- 移动端目录：把侧栏克隆进抽屉 ----------
     必须放在搜索与滚动高亮之前：这两处都会在初始化时一次性抓取
     [data-nav-item]，克隆晚了抽屉那份就漏掉，两份目录状态会不一致。 */
  var sideNav = document.querySelector('[data-side-nav]');
  var drawerNav = document.querySelector('[data-drawer-nav]');
  if (sideNav && drawerNav) {
    var clone = sideNav.cloneNode(true);
    clone.removeAttribute('data-side-nav');
    drawerNav.appendChild(clone);
    /* 抽屉里点击目录项后自动收起 */
    clone.addEventListener('click', function (e) {
      if (e.target.closest('[data-nav-item]')) UI.drawer.close('#docDrawer');
    });
  }

  /* ---------- 侧栏搜索 ---------- */
  var search = document.querySelector('[data-doc-search]');
  var empty = document.querySelector('[data-doc-empty]');
  if (search) {
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-nav-item]'));
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      var hits = 0;
      items.forEach(function (item) {
        var text = (item.getAttribute('data-nav-item') + ' ' + item.textContent).toLowerCase();
        var match = !q || text.indexOf(q) >= 0;
        item.style.display = match ? '' : 'none';
        if (match) hits++;
      });
      if (empty) empty.classList.toggle('is-show', hits === 0);
      /* 搜索时展开被折叠的分组标题 */
      document.querySelectorAll('[data-nav-group]').forEach(function (group) {
        var visible = false;
        group.querySelectorAll('[data-nav-item]').forEach(function (link) {
          if (link.style.display !== 'none') visible = true;
        });
        group.style.display = visible ? '' : 'none';
      });
    });
  }

  /* ---------- 滚动定位（scrollspy） ----------
     改用滚动位置直接计算当前分区，而不是 IntersectionObserver：
     · IO 在首屏内容尚未进入观察带时不会触发，刚打开页面侧栏一项高亮都没有；
     · 多个分区同时相交时是"后到者胜"，高亮会来回跳。
     现在显式取"最后一个越过判定线"的分区，任何时刻都有且只有一项高亮。 */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-nav-item]'));
  var side = document.querySelector('.doc-side');
  var sectionPairs = [];
  navLinks.forEach(function (link) {
    var id = (link.getAttribute('href') || '').slice(1);
    if (!id || !document.getElementById(id)) return;
    var dup = sectionPairs.some(function (p) { return p.id === id; });
    if (!dup) sectionPairs.push({ id: id, el: document.getElementById(id) });
  });

  var activeId = null;
  function setActive(id) {
    if (!id || id === activeId) return;
    activeId = id;
    navLinks.forEach(function (link) {
      var on = link.getAttribute('href') === '#' + id;
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    /* 长目录里高亮项很容易滚出侧栏可视区，做最小幅度的回带 */
    if (!side) return;
    var hit = side.querySelector('.ui-sidenav__item.is-active');
    if (!hit) return;
    var hr = hit.getBoundingClientRect();
    var sr = side.getBoundingClientRect();
    var headroom = 56;   /* 吸附的分组标题大约占这么高 */
    if (hr.top < sr.top + headroom) side.scrollTop -= (sr.top + headroom) - hr.top;
    else if (hr.bottom > sr.bottom - 12) side.scrollTop += hr.bottom - (sr.bottom - 12);
  }

  /* 不加 rAF / 时间戳节流：本函数只做 45 次 getBoundingClientRect 读取，
     中间不穿插任何样式写入，浏览器会复用同一份布局，开销极低。
     反过来，rAF 一旦被节流（后台标签页、部分无头环境）节流标志就永远卡在
     true，高亮会直接停止更新——这个坑不值得为省那点开销去踩。 */
  function spy() {
    if (!sectionPairs.length) return;
    var line = window.innerHeight * 0.28;
    var current = sectionPairs[0].id;
    for (var i = 0; i < sectionPairs.length; i++) {
      if (sectionPairs[i].el.getBoundingClientRect().top <= line) current = sectionPairs[i].id;
    }
    /* 滚到底时强制选最后一项，否则页尾那些短分区永远选不中 */
    var atBottom = (window.scrollY || window.pageYOffset || 0) + window.innerHeight
      >= document.documentElement.scrollHeight - 4;
    if (atBottom) current = sectionPairs[sectionPairs.length - 1].id;
    setActive(current);
  }
  if (sectionPairs.length) {
    window.addEventListener('scroll', spy, { passive: true });
    window.addEventListener('resize', spy);
    /* 点击目录后浏览器需要一帧才更新滚动位置，延后一拍再算 */
    navLinks.forEach(function (link) {
      link.addEventListener('click', function () { window.setTimeout(spy, 0); });
    });
    spy();
  }

  /* ---------- 主色试验台：改的是 L1 主色阶，组件零改动 ---------- */
  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function rgbToHex(c) {
    var f = function (v) { return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); };
    return '#' + f(c.r) + f(c.g) + f(c.b);
  }
  function mix(a, b, ratio) {
    return {
      r: a.r + (b.r - a.r) * ratio,
      g: a.g + (b.g - a.g) * ratio,
      b: a.b + (b.b - a.b) * ratio
    };
  }
  var WHITE = { r: 255, g: 255, b: 255 };
  var BLACK = { r: 9, g: 9, b: 11 };

  /* WCAG 相对亮度，用来决定 hover/active 往哪个方向走 */
  function relLuminance(c) {
    var f = function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  function applyAccent(el, hex) {
    if (!el || !/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) return false;
    var base = hexToRgb(hex.charAt(0) === '#' ? hex : '#' + hex);
    var steps;
    if (relLuminance(base) < 0.10) {
      /* 近黑主色（含默认的中性墨黑）：继续加深肉眼不可见，状态档改向浅处走 */
      steps = { 50: 0.94, 100: 0.88, 200: 0.74, 300: 0.52, 400: 0.28, 500: 0.13, 600: 0, 700: -0.22 };
    } else {
      /* 品牌色：加深更符合直觉，白字对比度也更稳（浅向会掉到 4.5:1 以下） */
      steps = { 50: 0.94, 100: 0.88, 200: 0.74, 300: 0.52, 400: -0.28, 500: -0.13, 600: 0, 700: -0.22 };
    }
    Object.keys(steps).forEach(function (key) {
      var ratio = steps[key];
      var color = ratio >= 0 ? mix(base, WHITE, ratio) : mix(base, BLACK, -ratio);
      el.style.setProperty('--ui-p-' + key, rgbToHex(color));
    });
    return true;
  }

  var lab = document.querySelector('[data-accent-preview]');
  if (lab) {
    var input = document.querySelector('[data-accent-input]');
    var saved2 = null;
    try { saved2 = localStorage.getItem('oneui-doc-accent'); } catch (e) { saved2 = null; }
    if (saved2) { applyAccent(lab, saved2); if (input) input.value = saved2; }

    document.addEventListener('click', function (e) {
      var dot = e.target.closest('[data-accent]');
      if (!dot) return;
      var hex = dot.getAttribute('data-accent');
      applyAccent(lab, hex);
      if (input) input.value = hex;
      try { localStorage.setItem('oneui-doc-accent', hex); } catch (err) { /* 忽略 */ }
    });
    if (input) {
      input.addEventListener('change', function () {
        if (applyAccent(lab, input.value.trim())) {
          try { localStorage.setItem('oneui-doc-accent', input.value.trim()); } catch (err) { /* 忽略 */ }
        } else {
          UI.toast({ message: '请输入合法的十六进制色值，例如 #2563EB', type: 'warning' });
        }
      });
    }
  }

  /* ---------- 表单演示：把提交事件接到 Toast ---------- */
  document.querySelectorAll('[data-doc-form]').forEach(function (form) {
    form.addEventListener('ui:submit', function () {
      UI.toast({ message: '校验通过，已提交（演示）', type: 'success' });
    });
    form.addEventListener('ui:invalid', function () {
      UI.toast({ message: '请先修正标红的字段', type: 'danger' });
    });
  });

  /* ---------- 表格演示：排序后提示 ---------- */
  var sortDemo = document.querySelector('[data-doc-table]');
  if (sortDemo) {
    sortDemo.addEventListener('ui:sort', function (e) {
      UI.toast({ message: '已按第 ' + (e.detail.index + 1) + ' 列' + (e.detail.direction === 'ascending' ? '升序' : '降序') + '排列', duration: 1600 });
    });
  }

  /* ---------- 分页演示 ---------- */
  var pager = document.querySelector('[data-doc-pagination]');
  if (pager) {
    pager.addEventListener('ui:change', function (e) {
      var info = document.querySelector('[data-pagination-info]');
      if (info) info.textContent = '第 ' + e.detail.page + ' 页';
    });
  }

  /* ---------- 文件上传演示 ---------- */
  var dz = document.querySelector('[data-doc-dropzone]');
  if (dz) {
    dz.addEventListener('ui:file', function (e) {
      var n = e.detail.files.length;
      UI.toast({ message: n ? '已选择 ' + n + ' 个文件' : '未选择文件', type: n ? 'success' : 'warning' });
    });
  }
})();
