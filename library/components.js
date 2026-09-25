/* ============================================================
   OneUI · components.js
   ------------------------------------------------------------
   零依赖行为层（原生 ES5+ 语法，无构建步骤）。
   全局导出 window.OneUI（window.UI 保留为兼容别名）。
   用法：
     声明式：<button data-ui="modal" data-target="#demo">打开</button>
     命令式：OneUI.toast('已保存'); OneUI.modal.open('#demo'); await OneUI.confirm({...})
   特性：焦点陷阱 / ESC 关闭 / 遮罩点击关闭 / 焦点归还 / 键盘导航 /
         prefers-reduced-motion 降级 / 事件派发（便于与任意框架集成）。
   ============================================================ */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  /* ---------------- 基础工具 ---------------- */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function isEl(v) { return v && v.nodeType === 1; }
  function resolve(target, root) { return typeof target === 'string' ? qs(target, root || document) : target; }
  function uid(prefix) { return (prefix || 'ui') + '-' + Math.random().toString(36).slice(2, 9); }
  function emit(el, name, detail) {
    if (!el) return;
    el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail }));
  }
  function reducedMotion() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  /* 幂等标记。
     必须用 hasAttribute / setAttribute，不能用 el.dataset[key]：
     kind 里只要带连字符（popconfirm-trigger / dropdown-trigger / table-sort），
     dataset['uiBound' + kind] 就不是合法的属性名，会抛
     SyntaxError: 'uiBoundpopconfirm-trigger' is not a valid property name，
     而 once() 在 switch 之前调用 → 整个 init 循环当场中断。 */
  function once(el, key) {
    if (!el) return false;
    var name = 'data-once-' + key;
    if (el.hasAttribute(name)) return false;
    el.setAttribute(name, '1');
    return true;
  }

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function focusables(root) {
    return qsa(FOCUSABLE, root).filter(function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  /* 滚动锁：补偿滚动条宽度，避免布局跳动 */
  var scrollLockCount = 0;
  function lockScroll() {
    if (scrollLockCount === 0) {
      var gap = global.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (gap > 0) document.body.style.paddingRight = gap + 'px';
    }
    scrollLockCount++;
  }
  function unlockScroll() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  }

  /* 焦点陷阱：Tab 循环 + 焦点归还 */
  function createFocusTrap(container) {
    var previous = document.activeElement;
    function onKeydown(e) {
      if (e.key !== 'Tab') return;
      var items = focusables(container);
      if (!items.length) { e.preventDefault(); return; }
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    container.addEventListener('keydown', onKeydown);
    var target = focusables(container)[0] || container;
    if (!reducedMotion()) {
      try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
    } else { target.focus(); }
    return {
      release: function () {
        container.removeEventListener('keydown', onKeydown);
        if (previous && previous.focus) {
          try { previous.focus({ preventScroll: true }); } catch (err) { previous.focus(); }
        }
      }
    };
  }

  /* 浮层定位（tooltip / popconfirm / menu） */
  function positionFloating(floating, anchor, placement, offset) {
    var a = anchor.getBoundingClientRect();
    var f = floating.getBoundingClientRect();
    var gap = offset == null ? 8 : offset;
    var top, left;
    var vw = global.innerWidth, vh = global.innerHeight;
    if (placement === 'bottom') { top = a.bottom + gap; left = a.left + a.width / 2 - f.width / 2; }
    else if (placement === 'left') { top = a.top + a.height / 2 - f.height / 2; left = a.left - f.width - gap; }
    else if (placement === 'right') { top = a.top + a.height / 2 - f.height / 2; left = a.right + gap; }
    else { top = a.top - f.height - gap; left = a.left + a.width / 2 - f.width / 2; }
    left = Math.max(8, Math.min(left, vw - f.width - 8));
    top = Math.max(8, Math.min(top, vh - f.height - 8));
    floating.style.top = Math.round(top) + 'px';
    floating.style.left = Math.round(left) + 'px';
  }

  /* ---------------- Toast ---------------- */
  var ICONS = {
    info: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="7.5"/><path d="M10 9v4.5M10 6.4v.6"/></svg>',
    success: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><path d="M6.6 10.3l2.4 2.4 4.4-4.8"/></svg>',
    warning: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.2l7 12.3H3L10 3.2z"/><path d="M10 8.4v3.2M10 13.6v.4"/></svg>',
    danger: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><path d="M7.4 7.4l5.2 5.2M12.6 7.4l-5.2 5.2"/></svg>'
  };

  function toastRegion(position) {
    var id = position === 'bottom' ? 'ui-toast-bottom' : 'ui-toast-top';
    var region = document.getElementById(id);
    if (!region) {
      region = document.createElement('div');
      region.id = id;
      region.className = 'ui-toast-region';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      if (position === 'bottom') { region.style.top = 'auto'; region.style.bottom = 'var(--ui-space-6)'; }
      document.body.appendChild(region);
    }
    return region;
  }

  function toast(input) {
    var opts = typeof input === 'string' ? { message: input } : (input || {});
    var position = opts.position || 'top';
    var region = toastRegion(position);
    var el = document.createElement('div');
    el.className = 'ui-toast' + (opts.type && opts.type !== 'info' ? ' ui-toast--' + opts.type : '');

    var icon = document.createElement('span');
    icon.className = 'ui-toast__icon';
    icon.innerHTML = ICONS[opts.type] || ICONS.info;

    var body = document.createElement('div');
    body.className = 'ui-toast__body';
    var msg = document.createElement('div');
    msg.textContent = opts.message || '';
    body.appendChild(msg);
    if (opts.description) {
      var desc = document.createElement('div');
      desc.className = 'ui-toast__desc';
      desc.textContent = opts.description;
      body.appendChild(desc);
    }

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'ui-toast__close';
    close.setAttribute('aria-label', '关闭提示');
    close.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg>';

    el.appendChild(icon);
    el.appendChild(body);
    el.appendChild(close);
    region.appendChild(el);

    var timer = null;
    function destroy() {
      if (!el.parentNode) return;
      el.classList.add('is-leaving');
      var remove = function () { if (el.parentNode) el.parentNode.removeChild(el); };
      if (reducedMotion()) remove();
      else setTimeout(remove, 200);
    }
    close.addEventListener('click', destroy);
    if (opts.duration !== 0) timer = setTimeout(destroy, opts.duration || 3000);
    el.addEventListener('mouseenter', function () { clearTimeout(timer); });
    el.addEventListener('mouseleave', function () {
      if (opts.duration !== 0) timer = setTimeout(destroy, 1200);
    });
    emit(el, 'ui:toast:show', { message: opts.message });
    return { el: el, close: destroy };
  }

  /* ---------------- 浮层基类（modal / drawer） ---------------- */
  function createLayer(el, options) {
    var opts = options || {};
    if (opts.maskClosable === undefined && el.getAttribute('data-mask-closable') === 'false') opts.maskClosable = false;
    var state = { open: false, trap: null, backdrop: null };

    function onKey(e) { if (e.key === 'Escape' && opts.esc !== false) { e.stopPropagation(); close(); } }

    function open() {
      if (state.open) return;
      state.open = true;
      if (opts.backdrop !== false) {
        var backdrop = document.createElement('div');
        state.backdrop = backdrop;
        backdrop.className = 'ui-backdrop';
        backdrop.addEventListener('click', function () { if (opts.maskClosable !== false) close(); });
        document.body.appendChild(backdrop);
        /* 闭包里必须用局部引用。state.backdrop 会被 close() 置 null，而 rAF 是延后执行的：
           同一帧内先 open() 再 close()（点开就被 Esc 关掉、或程序里连调两下），
           回调跑到时 state.backdrop 已是 null，当场抛 TypeError 并中断后续脚本。
           再加一道 isConnected：已被摘掉的遮罩，不该被上一帧的旧回调补上 is-open。 */
        requestAnimationFrame(function () {
          if (backdrop.isConnected) backdrop.classList.add('is-open');
        });
      }
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
      if (opts.modal !== false) state.trap = createFocusTrap(el);
      lockScroll();
      document.addEventListener('keydown', onKey);
      emit(el, 'ui:open', {});
    }

    function close(reason) {
      if (!state.open) return;
      state.open = false;
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      if (state.trap) { state.trap.release(); state.trap = null; }
      unlockScroll();
      document.removeEventListener('keydown', onKey);
      var backdrop = state.backdrop;
      state.backdrop = null;
      if (backdrop) {
        backdrop.classList.remove('is-open');
        var remove = function () { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
        if (reducedMotion()) remove(); else setTimeout(remove, 300);
      }
      emit(el, 'ui:close', { reason: reason || 'api' });
    }

    function toggle() { state.open ? close('toggle') : open(); }

    qsa('[data-ui-close]', el).forEach(function (btn) {
      btn.addEventListener('click', function () { close('close-button'); });
    });
    el.addEventListener('click', function (e) {
      if (e.target === el && opts.maskClosable !== false && opts.selfClose !== false) close('mask');
    });

    return { open: open, close: close, toggle: toggle, isOpen: function () { return state.open; } };
  }

  var modalRegistry = new WeakMap();
  function getLayer(el, kind) {
    el = resolve(el);
    if (!el) return null;
    if (!modalRegistry.has(el)) modalRegistry.set(el, createLayer(el, { modal: true }));
    return modalRegistry.get(el);
  }

  var modal = {
    open: function (target) { var l = getLayer(target); if (l) l.open(); },
    close: function (target) {
      if (!target) { qsa('.ui-modal.is-open').forEach(function (el) { getLayer(el).close(); }); return; }
      var l = getLayer(target); if (l) l.close();
    },
    toggle: function (target) { var l = getLayer(target); if (l) l.toggle(); }
  };

  var drawer = {
    open: function (target) { var l = getLayer(target); if (l) l.open(); },
    close: function (target) {
      if (!target) { qsa('.ui-drawer.is-open').forEach(function (el) { getLayer(el).close(); }); return; }
      var l = getLayer(target); if (l) l.close();
    },
    toggle: function (target) { var l = getLayer(target); if (l) l.toggle(); }
  };

  /* ---------------- 命令式确认框 ---------------- */
  function confirmDialog(options) {
    var opts = options || {};
    return new Promise(function (resolve) {
      var wrap = document.createElement('div');
      wrap.className = 'ui-modal';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');
      wrap.setAttribute('aria-hidden', 'true');
      var titleId = uid('ui-confirm-title');
      wrap.innerHTML =
        '<div class="ui-modal__dialog ui-modal--sm" style="max-width:400px">' +
          '<div class="ui-modal__header">' +
            '<div class="ui-modal__title" id="' + titleId + '"></div>' +
          '</div>' +
          '<div class="ui-modal__body"></div>' +
          '<div class="ui-modal__footer">' +
            '<button type="button" class="ui-btn ui-btn--default" data-ui-close>取消</button>' +
            '<button type="button" class="ui-btn ui-btn--danger" data-confirm>确认</button>' +
          '</div>' +
        '</div>';
      wrap.setAttribute('aria-labelledby', titleId);
      qs('.ui-modal__title', wrap).textContent = opts.title || '确认操作';
      qs('.ui-modal__body', wrap).textContent = opts.description || '';
      var confirmBtn = qs('[data-confirm]', wrap);
      confirmBtn.textContent = opts.confirmText || '确认';
      if (opts.danger === false) { confirmBtn.className = 'ui-btn ui-btn--primary'; }
      document.body.appendChild(wrap);

      var layer = createLayer(wrap, { modal: true });
      layer.open();
      var done = false;
      function finish(value) {
        if (done) return;
        done = true;
        layer.close('confirm');
        var remove = function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
        if (reducedMotion()) remove(); else setTimeout(remove, 300);
        resolve(value);
      }
      confirmBtn.addEventListener('click', function () { finish(true); });
      wrap.addEventListener('ui:close', function () { finish(false); });
    });
  }

  /* ---------------- 复制 ---------------- */
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'readonly');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  /* ---------------- 声明式初始化 ---------------- */
  function initDropdown(el) {
    var trigger = qs('[data-ui="dropdown-trigger"]', el) || el.firstElementChild;
    var menu = qs('.ui-menu', el);
    if (!trigger || !menu) return;
    function closeMenu() { menu.classList.remove('is-open'); trigger.setAttribute('aria-expanded', 'false'); }
    function openMenu() {
      qsa('.ui-menu.is-open').forEach(function (m) { if (m !== menu) m.classList.remove('is-open'); });
      menu.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    }
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      menu.classList.contains('is-open') ? closeMenu() : openMenu();
    });
    menu.addEventListener('click', function (e) {
      var item = e.target.closest('.ui-menu__item');
      if (item && !item.disabled) {
        emit(el, 'ui:select', { value: item.dataset.value || item.textContent.trim(), item: item });
        closeMenu();
      }
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
      if (e.key === 'ArrowDown') { e.preventDefault(); var items = qsa('.ui-menu__item:not([disabled])', menu); if (items[0]) items[0].focus(); }
    });
    document.addEventListener('click', function (e) { if (!el.contains(e.target)) closeMenu(); });
  }

  function initTooltip(el) {
    var text = el.getAttribute('data-tooltip') || el.getAttribute('aria-label');
    if (!text) return;
    var placement = el.getAttribute('data-tooltip-placement') || 'top';
    var tip = document.createElement('div');
    tip.className = 'ui-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.textContent = text;
    document.body.appendChild(tip);
    var a11yId = uid('ui-tip');
    tip.id = a11yId;
    el.setAttribute('aria-describedby', a11yId);

    function show() {
      tip.classList.add('is-open');
      positionFloating(tip, el, placement, 8);
    }
    function hide() { tip.classList.remove('is-open'); }
    el.addEventListener('mouseenter', show);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focus', show);
    el.addEventListener('blur', hide);
    el.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    emit(el, 'ui:tooltip:ready', { tip: tip });
  }

  function initPopconfirm(el) {
    /* 面板只认「后代」里的 .ui-popconfirm。
       不能写成 el.classList.contains('ui-popconfirm') ? el : ... ：
       宿主本身也可能带这个类（声明式写法常这么写），
       那样宿主会被当成浮层面板 —— 它会被套上 position:fixed / opacity:0 /
       visibility:hidden，整个触发按钮跟着消失；而且宿主里没有
       [data-popconfirm-ok]，下面的 qs(...).addEventListener 会抛
       TypeError，把整个 init 循环打断。两道坑都在这。 */
    var panel = qs('.ui-popconfirm', el);
    var complete = panel && qs('[data-popconfirm-cancel]', panel) && qs('[data-popconfirm-ok]', panel);
    if (!complete) {
      if (panel && panel.parentNode === document.body) panel.parentNode.removeChild(panel);
      panel = document.createElement('div');
      panel.className = 'ui-popconfirm';
      panel.innerHTML =
        '<div class="ui-popconfirm__title"></div><div class="ui-popconfirm__desc"></div>' +
        '<div class="ui-popconfirm__actions">' +
        '<button type="button" class="ui-btn ui-btn--default ui-btn--sm" data-popconfirm-cancel>取消</button>' +
        '<button type="button" class="ui-btn ui-btn--danger ui-btn--sm" data-popconfirm-ok>确认</button>' +
        '</div>';
      qs('.ui-popconfirm__title', panel).textContent = el.getAttribute('data-popconfirm-title') || '确认执行该操作？';
      qs('.ui-popconfirm__desc', panel).textContent = el.getAttribute('data-popconfirm-desc') || '';
      qs('[data-popconfirm-ok]', panel).textContent = el.getAttribute('data-popconfirm-ok') || '确认';
      document.body.appendChild(panel);
    }

    var trigger = qs('[data-ui="popconfirm-trigger"]', el) || el.firstElementChild || el;
    function open() { panel.classList.add('is-open'); positionFloating(panel, trigger, 'bottom', 8); }
    function close() { panel.classList.remove('is-open'); }
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      panel.classList.contains('is-open') ? close() : open();
    });
    var cancelBtn = qs('[data-popconfirm-cancel]', panel);
    var okBtn = qs('[data-popconfirm-ok]', panel);
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    if (okBtn) okBtn.addEventListener('click', function () {
      emit(el, 'ui:confirm', {});
      close();
    });
    document.addEventListener('click', function (e) { if (!el.contains(e.target) && !panel.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  function initTabs(el) {
    var tabs = qsa('[role="tab"]', el);
    var panels = qsa('[role="tabpanel"]', el);
    if (!tabs.length) return;
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      emit(el, 'ui:change', { value: tab.dataset.value || tab.textContent.trim(), tab: tab });
    }
    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
        if (e.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') next = tabs[0];
        if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });
    var current = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
    select(current);
    if (!panels.length) return;
  }

  function initSegmented(el) {
    var items = qsa('.ui-segment', el);
    items.forEach(function (item) {
      item.setAttribute('role', item.getAttribute('role') || 'radio');
      item.addEventListener('click', function () {
        items.forEach(function (i) { i.setAttribute('aria-selected', i === item ? 'true' : 'false'); });
        emit(el, 'ui:change', { value: item.dataset.value || item.textContent.trim() });
      });
      item.addEventListener('keydown', function (e) {
        var idx = items.indexOf(item);
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = items[(idx + 1) % items.length];
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = items[(idx - 1 + items.length) % items.length];
        if (next) { e.preventDefault(); next.click(); next.focus(); }
      });
    });
  }

  function initCollapse(el) {
    var single = el.hasAttribute('data-accordion');
    qsa('.ui-collapse__header', el).forEach(function (header) {
      var panel = document.getElementById(header.getAttribute('aria-controls')) || header.nextElementSibling;
      if (!panel) return;
      function setOpen(open) {
        header.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.hidden = !open;
        emit(el, 'ui:toggle', { open: open, panel: panel });
      }
      setOpen(header.getAttribute('aria-expanded') === 'true');
      header.addEventListener('click', function () {
        var willOpen = header.getAttribute('aria-expanded') !== 'true';
        if (willOpen && single) {
          qsa('.ui-collapse__header', el).forEach(function (h) {
            if (h !== header) { h.setAttribute('aria-expanded', 'false'); var p = document.getElementById(h.getAttribute('aria-controls')) || h.nextElementSibling; if (p) p.hidden = true; }
          });
        }
        setOpen(willOpen);
      });
      header.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); header.click(); }
      });
    });
  }

  function initPagination(el) {
    el.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      var page = parseInt(btn.getAttribute('data-page'), 10);
      qsa('[data-page]', el).forEach(function (b) { b.removeAttribute('aria-current'); });
      btn.setAttribute('aria-current', 'page');
      emit(el, 'ui:change', { page: page });
    });
  }

  function initTableSort(el) {
    var table = el.tagName === 'TABLE' ? el : qs('table', el);
    if (!table) return;
    var tbody = qs('tbody', table);
    qsa('[data-sort]', table).forEach(function (btn) {
      btn.setAttribute('aria-sort', 'none');
      btn.addEventListener('click', function () {
        var index = parseInt(btn.getAttribute('data-sort'), 10);
        var dir = btn.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
        qsa('[data-sort]', table).forEach(function (b) { b.setAttribute('aria-sort', 'none'); });
        btn.setAttribute('aria-sort', dir);
        var rows = qsa('tr', tbody);
        rows.sort(function (a, b) {
          var av = cellValue(a, index), bv = cellValue(b, index);
          if (av === bv) return 0;
          return (av > bv ? 1 : -1) * (dir === 'ascending' ? 1 : -1);
        });
        rows.forEach(function (row) { tbody.appendChild(row); });
        emit(el, 'ui:sort', { index: index, direction: dir });
      });
    });
    function cellValue(row, index) {
      var cell = row.children[index];
      if (!cell) return '';
      var raw = cell.getAttribute('data-value');
      if (raw !== null) return isNaN(parseFloat(raw)) ? raw : parseFloat(raw);
      var text = cell.textContent.trim();
      return isNaN(parseFloat(text)) ? text : parseFloat(text);
    }
  }

  function initDropzone(el) {
    var input = qs('input[type="file"]', el);
    var list = qs('[data-ui-file-list]', el.parentNode) || qs('[data-ui-file-list]', el);
    ['dragenter', 'dragover'].forEach(function (type) {
      el.addEventListener(type, function (e) { e.preventDefault(); el.classList.add('is-dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      el.addEventListener(type, function (e) { e.preventDefault(); el.classList.remove('is-dragover'); });
    });
    el.addEventListener('click', function () { if (input) input.click(); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (input) input.click(); } });
    el.addEventListener('drop', function (e) {
      if (input && e.dataTransfer && e.dataTransfer.files) {
        emit(el, 'ui:file', { files: Array.prototype.slice.call(e.dataTransfer.files) });
      }
    });
    if (input) {
      input.addEventListener('change', function () {
        var files = Array.prototype.slice.call(input.files || []);
        emit(el, 'ui:file', { files: files });
        if (list) renderFiles(list, files);
      });
    }
  }

  function renderFiles(list, files) {
    list.innerHTML = '';
    files.forEach(function (file) {
      var row = document.createElement('div');
      row.className = 'ui-file';
      row.innerHTML =
        '<span class="ui-file__icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M9 2v3h3"/></svg></span>' +
        '<span class="ui-file__name"></span>' +
        '<span class="ui-file__meta"></span>';
      qs('.ui-file__name', row).textContent = file.name;
      qs('.ui-file__meta', row).textContent = formatSize(file.size);
      list.appendChild(row);
    });
  }
  function formatSize(bytes) {
    if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) return '';
    if (bytes === 0) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = 0, value = bytes;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
    return (i === 0 ? value : value.toFixed(1)) + ' ' + units[i];
  }

  function initBacktop(el) {
    function onScroll() {
      el.classList.toggle('is-open', global.scrollY > 400);
    }
    global.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    el.addEventListener('click', function () {
      global.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    });
  }

  function initCopy(el) {
    el.addEventListener('click', function () {
      var target = el.getAttribute('data-copy-target');
      var text = target ? (qs(target) ? qs(target).innerText : '') : (el.getAttribute('data-copy') || el.innerText);
      copy(text).then(function (ok) {
        toast({ message: ok ? (el.getAttribute('data-copy-toast') || '已复制') : '复制失败，请手动选择文本', type: ok ? 'success' : 'danger', duration: 1800 });
        emit(el, 'ui:copy', { ok: ok, text: text });
      });
    });
  }

  function initNavbar(el) {
    var toggle = qs('[data-ui-navbar-toggle]', el);
    var drawerEl = resolve(el.getAttribute('data-navbar-drawer'));
    if (toggle && drawerEl) {
      toggle.addEventListener('click', function () {
        var layer = getLayer(drawerEl);
        toggle.setAttribute('aria-expanded', String(!layer.isOpen()));
        layer.toggle();
      });
      drawerEl.addEventListener('ui:close', function () { toggle.setAttribute('aria-expanded', 'false'); });
    }
  }

  /* 表单校验：即时校验（失焦）+ 提交前统一校验 */
  function initValidate(form) {
    var fields = qsa('[data-validate]', form);
    function errorEl(field) {
      var wrap = field.closest('.ui-field') || field.parentNode;
      return qs('.ui-error', wrap) || qs('[data-error-for="' + (field.id || field.name) + '"]');
    }
    function validateField(field) {
      var rules = (field.getAttribute('data-validate') || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
      var value = (field.value || '').trim();
      var message = '';
      rules.forEach(function (rule) {
        if (message) return;
        var parts = rule.split(':');
        var name = parts[0], arg = parts[1];
        if (name === 'required' && !value) message = field.getAttribute('data-message-required') || '此项为必填';
        else if (name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) message = '邮箱格式不正确';
        else if (name === 'phone' && value && !/^1\d{10}$/.test(value)) message = '手机号应为 11 位数字';
        else if (name === 'min' && value && value.length < parseInt(arg, 10)) message = '至少输入 ' + arg + ' 个字符';
        else if (name === 'max' && value && value.length > parseInt(arg, 10)) message = '最多输入 ' + arg + ' 个字符';
        else if (name === 'code' && value && !/^[A-Za-z0-9-]{4,}$/.test(value)) message = '仅支持字母、数字与短横线';
      });
      var err = errorEl(field);
      field.setAttribute('aria-invalid', message ? 'true' : 'false');
      field.classList.toggle('is-invalid', !!message);
      if (err) {
        err.hidden = !message;
        var text = qs('[data-error-text]', err) || err;
        if (text && message) {
          var span = qs('[data-error-text]', err);
          if (span) span.textContent = message; else err.lastChild && (err.lastChild.textContent = ' ' + message);
        }
        if (err.id) field.setAttribute('aria-describedby', err.id);
      }
      return !message;
    }
    fields.forEach(function (field) {
      field.addEventListener('blur', function () { validateField(field); });
      field.addEventListener('input', function () {
        if (field.getAttribute('aria-invalid') === 'true') validateField(field);
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true, firstInvalid = null;
      fields.forEach(function (field) {
        var ok = validateField(field);
        if (!ok && !firstInvalid) firstInvalid = field;
        valid = valid && ok;
      });
      if (!valid) {
        if (firstInvalid) firstInvalid.focus();
        emit(form, 'ui:invalid', {});
        return;
      }
      emit(form, 'ui:submit', { formData: new FormData(form) });
    });
    return { validate: function () { return fields.every(validateField); } };
  }

  /* ---------------- 统一初始化 ---------------- */
  var INIT_BY_KIND = {
    dropdown: initDropdown,
    popconfirm: initPopconfirm,
    tabs: initTabs,
    segmented: initSegmented,
    collapse: initCollapse,
    pagination: initPagination,
    'table-sort': initTableSort,
    dropzone: initDropzone,
    backtop: initBacktop,
    copy: initCopy,
    navbar: initNavbar,
    validate: initValidate
  };

  function init(root) {
    root = root || document;

    /* 单个组件标记失败不得影响其余组件：
       一次 DOM 结构写错（少一个按钮、少一个 data 属性）就会让整个页面
       后半部分组件全部不工作，且现场只有一行 TypeError，极难定位。
       现在改为逐个隔离 + 派发 ui:error + 控制台点名。 */
    function bind(fn, el, kind) {
      try {
        fn(el);
      } catch (err) {
        emit(el, 'ui:error', { component: kind, error: err });
        if (global.console && global.console.error) {
          global.console.error('[OneUI] 组件 "' + kind + '" 初始化失败，已跳过：', err, el);
        }
      }
    }

    qsa('[data-ui]', root).forEach(function (el) {
      var kind = el.getAttribute('data-ui');
      /* tooltip 不在这里处理：声明式写法习惯只写 data-tooltip，
         没有 data-ui="tooltip"，见下方专项扫描。先返回再 once()，
         否则 data-once-tooltip 会被这里提前占掉，专项扫描反而跳过。 */
      if (kind === 'tooltip') return;
      if (!once(el, kind)) return;
      var fn = INIT_BY_KIND[kind];
      if (!fn) return;
      bind(fn, el, kind);
    });

    /* 气泡提示：data-tooltip 单独扫一遍。
       此前 tooltip 只能通过 data-ui="tooltip" 触发，而文档与 README 的
       声明式示例写的是纯 data-tooltip → 全站 tooltip 从未初始化过。 */
    qsa('[data-tooltip], [data-ui="tooltip"]', root).forEach(function (el) {
      if (!once(el, 'tooltip')) return;
      bind(initTooltip, el, 'tooltip');
    });

    /* 触发器类：data-ui="modal|drawer" data-target="#id" */
    qsa('[data-ui="modal"], [data-ui="drawer"]', root).forEach(function (trigger) {
      if (!trigger.hasAttribute('data-target')) return;
      if (!once(trigger, 'layer-trigger')) return;
      bind(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var kind = btn.getAttribute('data-ui');
          var target = resolve(btn.getAttribute('data-target'));
          if (!target) return;
          var layer = getLayer(target, kind);
          if (!layer) return;
          btn.getAttribute('data-toggle') === 'true' ? layer.toggle() : layer.open();
        });
      }, trigger, 'layer-trigger');
    });

    /* 关闭按钮（弹层内的 data-ui-close 已在 createLayer 中绑定） */
    qsa('[data-ui-dismiss]', root).forEach(function (btn) {
      if (!once(btn, 'dismiss')) return;
      bind(function (el) {
        el.addEventListener('click', function () {
          var spec = (el.getAttribute('data-ui-dismiss') || '').trim();
          /* 值可以是指向弹层的选择器；留空表示「关掉我所在的那条提示」，
             这是 .ui-alert__close 的惯用写法，省得给每条提示起 id。
             注意不能把空串喂给 resolve：querySelector('') 会抛 SyntaxError。 */
          var target = spec ? resolve(spec) : el.closest('.ui-alert, [data-dismissible]');
          if (!target) return;
          var layer = modalRegistry.get(target);
          if (layer && layer.isOpen()) { layer.close('dismiss'); return; }
          /* 普通元素（提示条）从没 open 过，close() 会因为 state.open 为假直接 return，
             所以这里自己收尾：先广播 ui:dismiss 让页面能拦，再摘节点。
             这里刻意用 modalRegistry.get 而不是 getLayer：后者会顺手给提示条
             注册一个弹层对象，属于无谓的副作用。 */
          emit(target, 'ui:dismiss', {});
          target.remove();
        });
      }, btn, 'dismiss');
    });

    /* 拖拽排序 / 自定义下拉等可选能力的挂载点 */
    emit(document, 'ui:ready', { version: VERSION });
  }

  var UI = {
    version: VERSION,
    init: init,
    toast: toast,
    modal: modal,
    drawer: drawer,
    confirm: confirmDialog,
    copy: copy,
    lockScroll: lockScroll,
    unlockScroll: unlockScroll,
    position: positionFloating,
    formatSize: formatSize,
    qs: qs,
    qsa: qsa
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }

  global.OneUI = UI;   /* 主命名 */
  global.UI = UI;      /* 兼容别名，等价于 OneUI */
})(typeof window !== 'undefined' ? window : this);
