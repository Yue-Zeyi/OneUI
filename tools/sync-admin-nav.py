#!/usr/bin/env python3
"""OwnUI Admin · 导航同步与页面骨架生成（tools/sync-admin-nav.py）

后台是物理多页，侧栏与顶栏在每一页都有一份拷贝。
页面一多就会出现「改了这一页忘了那一页」——所以这两块以本脚本为唯一
数据源，跑一次同步到全部页面，顺带生成新页面的骨架。

用法：
    python tools/sync-admin-nav.py sync    # 只把侧栏/顶栏同步到已有页面
    python tools/sync-admin-nav.py gen     # 生成尚不存在的页面骨架
    python tools/sync-admin-nav.py all     # 先 gen 再 sync（推荐）

刻意不做 JS 注入：无 JS 时导航就没了，且脚本执行前会闪一次布局跳动。
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADMIN = os.path.join(HERE, "admin")

# 站点图标：内联 data-URI 的 O 字标，避免每个页面再去请求 favicon.ico（404）
FAVICON = (
    '<link rel="icon" href="data:image/svg+xml,'
    "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E"
    "%3Crect width='16' height='16' rx='4' fill='%2318181B'/%3E"
    "%3Ccircle cx='8' cy='8' r='4.55' fill='none' stroke='%23fff' stroke-width='1.9'/%3E"
    "%3C/svg%3E\">"
)

# ---------------------------------------------------------------- 侧栏
ICO = {
    "dash": '<rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="11" y="3" width="6" height="6" rx="1.2"/><rect x="3" y="11" width="6" height="6" rx="1.2"/><rect x="11" y="11" width="6" height="6" rx="1.2"/>',
    "chart": '<path d="M3 17V9M8 17V4M13 17v-6M18 17v-9"/>',
    "user": '<circle cx="10" cy="6.5" r="3.2"/><path d="M3.8 16.8c.9-3 3.3-4.6 6.2-4.6s5.3 1.6 6.2 4.6"/>',
    "order": '<path d="M5 3h10l1.5 3.5H3.5z"/><path d="M4.5 6.5V16a1 1 0 001 1h9a1 1 0 001-1V6.5"/><path d="M8 9.5h4"/>',
    "doc": '<rect x="4" y="2.8" width="12" height="14.4" rx="1.6"/><path d="M7 7h6M7 10h6M7 13h3.5"/>',
    "folder": '<path d="M3 6a1.5 1.5 0 011.5-1.5h3l2 2.5h8A1.5 1.5 0 0117 8.5v7A1.5 1.5 0 0115.5 17h-11A1.5 1.5 0 013 15.5z"/>',
    "bell": '<path d="M10 3a5 5 0 015 5v3l1.5 2.5H3.5L5 11V8a5 5 0 015-5z"/><path d="M8.5 16a1.5 1.5 0 003 0"/>',
    "gear": '<path d="M3 6h14M3 10h14M3 14h14"/><circle cx="7" cy="6" r="1.6" fill="currentColor" stroke="none"/><circle cx="13" cy="10" r="1.6" fill="currentColor" stroke="none"/><circle cx="8" cy="14" r="1.6" fill="currentColor" stroke="none"/>',
    "warn": '<path d="M10 3.5L18 16.5H2z"/><path d="M10 8.5v3.6M10 14.4v.2"/>',
    "login": '<path d="M12.5 3H16a1 1 0 011 1v12a1 1 0 01-1 1h-3.5"/><path d="M3 10h9M9.5 6.5L13 10l-3.5 3.5"/>',
    "person": '<circle cx="10" cy="10" r="7"/><circle cx="10" cy="7.5" r="2.4"/><path d="M4.8 16.2c.8-2.4 2.7-3.6 5.2-3.6s4.4 1.2 5.2 3.6"/>',
    "book": '<path d="M10 4.5C8.6 3.4 6.7 3 4 3v12c2.7 0 4.6.4 6 1.5 1.4-1.1 3.3-1.5 6-1.5V3c-2.7 0-4.6.4-6 1.5z"/><path d="M10 4.5v12"/>',
    "clock": '<circle cx="10" cy="10" r="7"/><path d="M10 5.8V10l3 1.8"/>',
}


def item(text, href, icon, badge=None, badge_cls="primary"):
    """一个菜单项。badge 为 None 时不渲染徽标。"""
    b = "" if badge is None else (
        '          <span class="ui-sidenav__badge ui-badge ui-badge--%s ui-badge--pill">%s</span>\n' % (badge_cls, badge))
    return (
        '        <a class="ui-sidenav__item" href="%s">\n'
        '          <svg class="adm-ico" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">%s</svg>\n'
        '          <span>%s</span>\n%s'
        '        </a>\n') % (href, ICO[icon], text, b)


def group(label, items):
    return (
        '      <div class="ui-sidenav__group">\n'
        '        <div class="ui-sidenav__label">%s</div>\n%s'
        '      </div>\n') % (label, "".join(items))


def submenu(label, icon, children):
    """带子菜单的组：组标题是 button（只展开不跳转），子项是 a。"""
    kids = "".join(
        '          <a class="ui-sidenav__item" href="%s"><span>%s</span></a>\n' % (href, text)
        for text, href in children)
    return (
        '      <div class="ui-sidenav__group adm-menu__item">\n'
        '        <button class="ui-sidenav__item" type="button" data-sub aria-expanded="false">\n'
        '          <svg class="adm-ico" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">%s</svg>\n'
        '          <span>%s</span>\n'
        '          <svg class="adm-caret" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 8l4.5 4.5L14.5 8"/></svg>\n'
        '        </button>\n'
        '        <div class="adm-sub">\n%s'
        '        </div>\n'
        '      </div>\n') % (ICO[icon], label, kids)


def side_html():
    return (
        '<!-- ==================== 侧栏（全站共用，唯一数据源是 tools/sync-admin-nav.py） ==================== -->\n'
        '<aside class="adm-side" aria-label="管理侧栏">\n'
        '  <a class="adm-side__brand" href="index.html">\n'
        '    <span class="ui-navbar__logo" aria-hidden="true">\n'
        '      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4.55" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>\n'
        '    </span>\n'
        '    <span class="adm-brand-text">OwnUI Admin</span>\n'
        '  </a>\n\n'
        '  <div class="adm-side__menu">\n'
        '    <nav class="ui-sidenav" aria-label="功能菜单">\n'
        + group("总览", [
            item("仪表盘", "index.html", "dash"),
            item("图表页", "charts.html", "chart"),
        ])
        + group("业务", [
            item("用户管理", "users.html", "user", badge="12"),
            item("订单管理", "orders.html", "order", badge="3", badge_cls="danger"),
            item("内容管理", "articles.html", "doc"),
            item("文件管理", "files.html", "folder"),
        ])
        + group("协作", [
            item("消息中心", "notifications.html", "bell", badge="5", badge_cls="danger"),
        ])
        + submenu("系统设置", "gear", [
            ("站点设置", "settings.html"),
            ("安全与登录", "settings.html#security"),
            ("个人资料", "profile.html"),
        ])
        + group("页面", [
            item("登录页", "login.html", "login"),
            item("404 页面不存在", "404.html", "warn"),
            item("500 服务异常", "500.html", "warn"),
            item("维护中", "maintenance.html", "clock"),
        ])
        + group("资源", [
            item("组件文档", "../docs/docs.html", "book"),
        ])
        + '    </nav>\n'
        '  </div>\n\n'
        '  <div class="adm-side__foot">\n'
        '    <button class="ui-btn ui-btn--ghost ui-btn--sm" type="button" data-adm-fold>\n'
        '      <svg class="adm-ico" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M8 3v14"/></svg>\n'
        '      收起侧栏\n'
        '    </button>\n'
        '    <span class="adm-side__ver">v1.0.0 · MIT</span>\n'
        '  </div>\n'
        '</aside>\n')


# ---------------------------------------------------------------- 顶栏
def top_html(crumb):
    return (
        '  <header class="adm-top">\n'
        '    <button class="ui-icon-btn adm-fold-btn" type="button" data-adm-fold aria-label="折叠侧栏">\n'
        '      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 5.5h14M3 10h14M3 14.5h14"/></svg>\n'
        '    </button>\n'
        '    <button class="ui-icon-btn adm-burger" type="button" data-adm-drawer aria-label="打开侧栏" aria-expanded="false">\n'
        '      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 5.5h14M3 10h14M3 14.5h14"/></svg>\n'
        '    </button>\n\n'
        '    <nav class="ui-breadcrumb" aria-label="面包屑">\n'
        '      <span class="ui-breadcrumb__item"><a href="index.html">首页</a></span>\n'
        '      <span class="ui-breadcrumb__sep">/</span>\n'
        '      <span class="ui-breadcrumb__item" aria-current="page">__CRUMB__</span>\n'
        '    </nav>\n\n'
        '    <div class="adm-top__spacer"></div>\n\n'
        '    <div class="ui-search adm-search--top">\n'
        '      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="9" r="5.5"/><path d="M13 13l3.5 3.5"/></svg>\n'
        '      <input class="ui-input ui-input--sm" type="search" placeholder="搜索…" aria-label="全局搜索" style="width: 180px">\n'
        '    </div>\n\n'
        '    <div class="adm-top__actions">\n'
        '      <button class="ui-icon-btn" type="button" data-adm-theme="light" aria-pressed="false" aria-label="切换浅色" data-tooltip="浅色">\n'
        '        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="10" cy="10" r="3.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4"/></svg>\n'
        '      </button>\n'
        '      <button class="ui-icon-btn" type="button" data-adm-theme="dark" aria-pressed="false" aria-label="切换深色" data-tooltip="深色">\n'
        '        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 12.2A7 7 0 017.8 3.5a7 7 0 108.7 8.7z"/></svg>\n'
        '      </button>\n\n'
        '      <div class="ui-dropdown-wrap" data-ui="dropdown">\n'
        '        <button class="ui-icon-btn" type="button" data-ui="dropdown-trigger" aria-label="切换主色" data-tooltip="主色">\n'
        '          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17a7 7 0 110-14c3.9 0 7 2.6 7 5.8 0 2-1.6 3.2-3.4 3.2h-1.4c-1 0-1.8.8-1.8 1.8 0 .5.2.9.4 1.3.2.3-.1.9-.8.9z"/><circle cx="7" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="10.5" cy="5.8" r=".9" fill="currentColor" stroke="none"/><circle cx="14" cy="7.8" r=".9" fill="currentColor" stroke="none"/></svg>\n'
        '        </button>\n'
        '        <div class="ui-menu" role="menu" aria-label="主色预设">\n'
        '          <button class="ui-menu__item" role="menuitemradio" aria-checked="true" type="button" data-adm-accent="brand" data-adm-label="墨黑"><span class="ui-dot" style="background:#18181B"></span>墨黑</button>\n'
        '          <button class="ui-menu__item" role="menuitemradio" aria-checked="false" type="button" data-adm-accent="blue" data-adm-label="品蓝"><span class="ui-dot" style="background:#2563EB"></span>品蓝</button>\n'
        '          <button class="ui-menu__item" role="menuitemradio" aria-checked="false" type="button" data-adm-accent="indigo" data-adm-label="靛蓝"><span class="ui-dot" style="background:#4F46E5"></span>靛蓝</button>\n'
        '          <button class="ui-menu__item" role="menuitemradio" aria-checked="false" type="button" data-adm-accent="emerald" data-adm-label="翠绿"><span class="ui-dot" style="background:#047857"></span>翠绿</button>\n'
        '          <button class="ui-menu__item" role="menuitemradio" aria-checked="false" type="button" data-adm-accent="orange" data-adm-label="橙"><span class="ui-dot" style="background:#C2410C"></span>橙</button>\n'
        '          <button class="ui-menu__item" role="menuitemradio" aria-checked="false" type="button" data-adm-accent="violet" data-adm-label="紫罗兰"><span class="ui-dot" style="background:#7C3AED"></span>紫罗兰</button>\n'
        '        </div>\n'
        '      </div>\n\n'
        '      <div class="ui-dropdown-wrap" data-ui="dropdown">\n'
        '        <button class="ui-icon-btn" type="button" data-ui="dropdown-trigger" aria-label="消息通知" data-tooltip="消息">\n'
        '          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3a5 5 0 015 5v3l1.5 2.5H3.5L5 11V8a5 5 0 015-5z"/><path d="M8.5 16a1.5 1.5 0 003 0"/></svg>\n'
        '          <span class="ui-badge ui-badge--danger ui-badge--pill" style="position:absolute; top:4px; right:4px; min-width:16px; height:16px; font-size:10px; line-height:16px; padding:0">5</span>\n'
        '        </button>\n'
        '        <div class="ui-menu" role="menu" aria-label="消息通知" style="min-width: 260px">\n'
        '          <button class="ui-menu__item" role="menuitem" type="button"><span class="ui-status ui-status--success"><span class="ui-dot"></span></span>订单 #20481 已支付</button>\n'
        '          <button class="ui-menu__item" role="menuitem" type="button"><span class="ui-status ui-status--warning"><span class="ui-dot"></span></span>服务器 CPU 82%，请关注</button>\n'
        '          <button class="ui-menu__item" role="menuitem" type="button"><span class="ui-status ui-status--info"><span class="ui-dot"></span></span>新用户「李清照」已注册</button>\n'
        '          <div role="separator"></div>\n'
        '          <button class="ui-menu__item" role="menuitem" type="button">查看全部消息</button>\n'
        '        </div>\n'
        '      </div>\n\n'
        '      <div class="ui-dropdown-wrap" data-ui="dropdown">\n'
        '        <button class="adm-user" type="button" data-ui="dropdown-trigger" aria-label="账户菜单">\n'
        '          <span class="ui-avatar ui-avatar--sm" aria-hidden="true">林</span>\n'
        '          <span class="adm-user__meta">\n'
        '            <span class="adm-user__name">林晚</span><br>\n'
        '            <span class="adm-user__role">管理员</span>\n'
        '          </span>\n'
        '        </button>\n'
        '        <div class="ui-menu" role="menu" aria-label="账户菜单">\n'
        '          <button class="ui-menu__item" role="menuitem" type="button">个人资料</button>\n'
        '          <button class="ui-menu__item" role="menuitem" type="button">账户设置</button>\n'
        '          <div role="separator"></div>\n'
        '          <button class="ui-menu__item" role="menuitem" type="button" data-adm-logout>退出登录</button>\n'
        '        </div>\n'
        '      </div>\n'
        '    </div>\n'
        '  </header>\n').replace('__CRUMB__', crumb)


# ---------------------------------------------------------------- 页面骨架
PAGES = {
    "orders.html":        ("订单管理", "订单管理"),
    "articles.html":      ("内容管理", "内容管理"),
    "files.html":         ("文件管理", "文件管理"),
    "notifications.html": ("消息中心", "消息中心"),
    "settings.html":      ("系统设置", "系统设置"),
    "profile.html":       ("个人资料", "个人资料"),
    "charts.html":        ("图表页", "图表页"),
    "500.html":           ("500 服务异常", "500"),
    "maintenance.html":   ("维护中", "维护中"),
}


def page_html(title, crumb):
    """骨架不用 str.format / % —— 模板里有 CSS 的花括号和百分号，
    跟格式化语法打架；直接拼接最省心。"""
    return (
        '<!DOCTYPE html>\n'
        '<html lang="zh-CN" data-ui-theme="light">\n'
        '<head>\n'
        '<meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<title>' + title + ' · OwnUI Admin</title>\n'
        '<link rel="stylesheet" href="../library/tokens.css">\n'
        '<link rel="stylesheet" href="../library/base.css">\n'
        '<link rel="stylesheet" href="../library/components.css">\n'
        '<link rel="stylesheet" href="admin.css">\n'
        '</head>\n'
        '<body class="adm">\n'
        '<div class="adm-veil"></div>\n\n'
        + side_html() + '\n\n'
        '<!-- ==================== 主区 ==================== -->\n'
        '<div class="adm-main">\n\n'
        + top_html(crumb) + '\n\n'
        '  <!-- 内容 -->\n'
        '  <main class="adm-content">\n'
        '<!--BODY-->\n'
        '  </main>\n\n'
        '  <footer class="adm-footer">OwnUI Admin · 基于 OwnUI 组件库 · MIT License</footer>\n'
        '</div>\n\n'
        '<script src="../library/components.js"></script>\n'
        '<script src="admin.js"></script>\n'
        '</body>\n'
        '</html>\n'
    )


def gen():
    for name, (title, crumb) in PAGES.items():
        path = os.path.join(ADMIN, name)
        if os.path.exists(path):
            print("已存在，跳过：", name)
            continue
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(page_html(title, crumb))
        print("生成骨架：", name)


def sync():
    side = side_html()
    n = 0
    for name in sorted(os.listdir(ADMIN)):
        if not name.endswith(".html") or name == "login.html":
            continue  # 登录页是独立布局，无侧栏
        path = os.path.join(ADMIN, name)
        text = open(path, encoding="utf-8").read()
        m = re.search(r"<!-- =+ 侧栏.*?-->\s*<aside class=\"adm-side\".*?</aside>", text, re.S)
        if not m:
            m = re.search(r"<aside class=\"adm-side\".*?</aside>", text, re.S)
        if not m:
            print("未找到侧栏块：", name)
            continue
        new = text[:m.start()] + side.rstrip("\n") + text[m.end():]
        # 顺手补 favicon：缺了浏览器会去要 /favicon.ico，控制台一条 404
        if 'rel="icon"' not in new:
            anchor = '<meta name="viewport" content="width=device-width, initial-scale=1">'
            if anchor in new:
                new = new.replace(anchor, anchor + "\n" + FAVICON, 1)
        if new != text:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(new)
            n += 1
            print("侧栏已同步：", name)
    print("同步 %d 个页面" % n)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    if mode in ("gen", "all"):
        gen()
    if mode in ("sync", "all"):
        sync()
