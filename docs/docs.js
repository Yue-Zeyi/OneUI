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

  /* ---------- 主色换肤：全局唯一入口 ----------
     只有一条规则要记：**改 --ui-p-* 必须改在 <html> 上**。
     --ui-primary: var(--ui-p-600) 声明在 :root，var() 就在 :root 完成替换；
     若把 --ui-p-* 写到后代元素上，父级那份 --ui-primary 早已变成具体色值
     继承下来，子元素怎么改 L1 都不会生效（改造前的试验台就踩了这个坑：
     色块点了有反应，但旁边的按钮/开关/进度条纹丝不动）。

     两条路径：
       · 预设 —— 只写 data-ui-accent，色阶和深色模式角色全部由 tokens.css 提供；
       · 自定义色值 —— 从单个色值算出一整套 10 档色阶，并把这 19 个属性写成
         <html> 的行内样式（行内权重最高，能盖过预设块）。
     两者互斥，切回预设时必须逐个清掉行内属性。 */
  var ACCENTS = ['ink', 'blue', 'indigo', 'emerald', 'orange', 'violet'];
  var ACCENT_KEY = 'oneui-doc-accent';
  var ACCENT_HEX_KEY = 'oneui-doc-accent-hex';

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
  var BLACK = { r: 9, g: 9, b: 11 };      /* = --ui-n-950，加深方向朝它走 */

  /* WCAG 相对亮度与对比度，用来判断白字够不够、要不要自动加深 */
  function relLuminance(c) {
    var f = function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contrast(a, b) {
    var la = relLuminance(a), lb = relLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /* 自定义色值要写的 19 个属性：10 档色阶 + 浅色档状态/文字 + 7 个深色角色 */
  var RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  var DERIVED = ['--ui-primary-hover', '--ui-primary-active', '--ui-primary-text',
    '--ui-primary-dark', '--ui-primary-dark-hover', '--ui-primary-dark-active',
    '--ui-primary-dark-weak', '--ui-primary-dark-weak-hover', '--ui-primary-dark-border',
    '--ui-primary-dark-text'];
  var INLINE_PROPS = RAMP_STEPS.map(function (s) { return '--ui-p-' + s; }).concat(DERIVED);

  function clearInlineAccent() {
    INLINE_PROPS.forEach(function (p) { root.style.removeProperty(p); });
  }

  function currentAccent() { return root.getAttribute('data-ui-accent') || 'ink'; }

  /* 把选中态同步到所有入口：导航栏菜单、窄屏抽屉色点、#accent 试验台 */
  function syncAccentUI() {
    var cur = currentAccent();
    document.querySelectorAll('[data-accent-option]').forEach(function (el) {
      var on = el.getAttribute('data-accent-option') === cur;
      el.setAttribute('aria-checked', on ? 'true' : 'false');
      el.classList.toggle('is-active', on);
    });
  }

  function setAccent(name) {
    if (ACCENTS.indexOf(name) < 0) return false;
    clearInlineAccent();
    root.setAttribute('data-ui-accent', name);
    try { localStorage.setItem(ACCENT_KEY, name); } catch (e) { /* 忽略隐私模式 */ }
    syncAccentUI();
    return true;
  }

  /* 自定义色值：从一个色值推出一整套色阶。
     600 档必须压得住白字，否则按钮文字会不可读——不达标就沿加深方向走，
     并明确告诉用户改了值（不静默改），避免"我填的是亮黄，怎么变深褐了"。 */
  var LIGHT_STEPS = { 50: 0.95, 100: 0.89, 200: 0.78, 300: 0.62, 400: 0.44, 500: 0.24 };

  /* 自定义色值：从一个色值推出一整套 10 档色阶。
     主色底上到底用白字还是墨字，先定这一步——它同时决定状态档往哪个方向走。
     顺序刻意是"先换文字色，再考虑加深"：亮色（比如亮黄）压白字必然不达标，
     但把它一路压暗会得到一坨泥橄榄色，色相全丢；改用墨字既达标又保住品牌色。
     只有中间调（白字墨字都过不了）才不得已沿加深方向走。 */
  function buildRamp(base, up) {
    var ramp = {};
    Object.keys(LIGHT_STEPS).forEach(function (k) {
      ramp[k] = rgbToHex(mix(base, WHITE, LIGHT_STEPS[k]));
    });
    ramp[600] = rgbToHex(base);
    /* up = true 走"变浅"，false 走"变深"；900 只服务深色模式淡底，恒为深色 */
    ramp[700] = rgbToHex(mix(base, up ? WHITE : BLACK, up ? 0.16 : 0.14));
    ramp[800] = rgbToHex(mix(base, up ? WHITE : BLACK, up ? 0.30 : 0.28));
    ramp[900] = rgbToHex(mix(base, BLACK, 0.62));
    return ramp;
  }

  function setCustomAccent(hex) {
    if (!/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) return null;
    var wanted = rgbToHex(hexToRgb(hex.charAt(0) === '#' ? hex : '#' + hex));
    var base = hexToRgb(wanted);
    var textToken, up, note = null;

    if (contrast(WHITE, base) >= 4.5) {
      textToken = 'var(--ui-n-0)';          /* 深色主色配白字，状态往深处走 */
      up = false;
    } else if (contrast(BLACK, base) >= 4.5) {
      textToken = 'var(--ui-n-950)';        /* 亮色主色配墨字，色相完整保留 */
      /* 状态档优先"变深"（比"变浅"可见）；只有加深会把墨字对比度压破时才翻方向 */
      up = contrast(BLACK, mix(base, BLACK, 0.14)) < 4.5
        || contrast(BLACK, mix(base, BLACK, 0.28)) < 4.5;
    } else {
      /* 中间调窄带：白字墨字都过不了，只能沿加深方向走到白字达标 */
      var guard = 0;
      var from = rgbToHex(base);
      while (contrast(WHITE, base) < 4.6 && guard < 30) { base = mix(base, BLACK, 0.06); guard++; }
      textToken = 'var(--ui-n-0)';
      up = false;
      if (guard > 0) {
        note = { kind: 'darkened', from: from, to: rgbToHex(base), ratio: contrast(WHITE, hexToRgb(from)) };
      }
    }
    if (!note && textToken === 'var(--ui-n-950)') {
      note = { kind: 'darktext', wanted: wanted, ratio: contrast(BLACK, base) };
    }

    var ramp = buildRamp(base, up);

    /* 深色模式的主色恒配墨字，所以它必须自己亮到能压住墨字（≥4.5:1）。
       不能直接取 400 档：输入本身很深时（比如纯黑），400 档只有 3.9:1。
       这里沿变白方向补一段，保证任何输入色都能用。 */
    var dk = base, g2 = 0;
    while (contrast(BLACK, dk) < 4.8 && g2 < 40) { dk = mix(dk, WHITE, 0.05); g2++; }

    clearInlineAccent();
    root.setAttribute('data-ui-accent', 'custom');   /* 不匹配任何预设块 → 行内值说了算 */
    RAMP_STEPS.forEach(function (s) { root.style.setProperty('--ui-p-' + s, ramp[s]); });
    var px = function (s) { return 'var(--ui-p-' + s + ')'; };
    root.style.setProperty('--ui-primary-hover', px(700));
    root.style.setProperty('--ui-primary-active', px(800));
    root.style.setProperty('--ui-primary-text', textToken);
    root.style.setProperty('--ui-primary-dark', rgbToHex(dk));
    root.style.setProperty('--ui-primary-dark-hover', rgbToHex(mix(dk, WHITE, 0.14)));
    root.style.setProperty('--ui-primary-dark-active', rgbToHex(mix(dk, WHITE, 0.26)));
    root.style.setProperty('--ui-primary-dark-weak', px(900));
    root.style.setProperty('--ui-primary-dark-weak-hover', px(800));
    root.style.setProperty('--ui-primary-dark-border', px(700));
    root.style.setProperty('--ui-primary-dark-text', 'var(--ui-n-950)');

    try {
      localStorage.setItem(ACCENT_KEY, 'custom');
      localStorage.setItem(ACCENT_HEX_KEY, wanted);
    } catch (e) { /* 忽略 */ }
    syncAccentUI();
    return { wanted: wanted, used: ramp[600], ramp: ramp, note: note };
  }

  /* 恢复上次选择 */
  (function restoreAccent() {
    var saved = null, savedHex = null;
    try {
      saved = localStorage.getItem(ACCENT_KEY);
      savedHex = localStorage.getItem(ACCENT_HEX_KEY);
    } catch (e) { /* 忽略 */ }
    if (saved === 'custom' && savedHex) {
      setCustomAccent(savedHex);
      var input = document.querySelector('[data-accent-input]');
      if (input) input.value = savedHex;
    } else if (saved && ACCENTS.indexOf(saved) >= 0) {
      root.setAttribute('data-ui-accent', saved);
    }
    syncAccentUI();
    /* 预设与自定义是互斥的，清掉自定义留下的行内值 */
    if (currentAccent() !== 'custom') clearInlineAccent();
  })();

  /* 所有入口统一走这里：导航栏菜单项、窄屏抽屉色点、#accent 试验台色点 */
  document.addEventListener('click', function (e) {
    var opt = e.target.closest('[data-accent-option]');
    if (opt) setAccent(opt.getAttribute('data-accent-option'));
  });

  var accentInput = document.querySelector('[data-accent-input]');
  if (accentInput) {
    accentInput.addEventListener('change', function () {
      var res = setCustomAccent(accentInput.value.trim());
      if (!res) {
        UI.toast({ message: '请输入合法的十六进制色值，例如 #2563EB', type: 'warning' });
        return;
      }
      var n = res.note;
      if (n && n.kind === 'darkened') {
        UI.toast({
          message: n.from + ' 压白字只有 ' + n.ratio.toFixed(2) + ':1，已自动加深为 ' + n.to + ' 以满足 4.5:1',
          type: 'warning', duration: 4200
        });
      } else if (n && n.kind === 'darktext') {
        UI.toast({
          message: n.wanted + ' 偏亮，主色底已改用墨色文字（' + n.ratio.toFixed(1) + ':1），色相保持原样',
          type: 'success', duration: 3200
        });
      } else {
        UI.toast({ message: '已应用 ' + res.used, type: 'success', duration: 1800 });
      }
    });
  }
  document.querySelectorAll('[data-accent-reset]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setAccent('ink');
      if (accentInput) accentInput.value = '';
      UI.toast({ message: '已恢复默认中性墨黑', type: 'success', duration: 1600 });
    });
  });

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
