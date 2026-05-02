(function () {
    try {
        var t = JSON.parse(localStorage.getItem('tui-tab-title') || '"~"');
        if (typeof t === 'string') document.title = t.trim() || '~';
    } catch (e) {
        document.title = '~';
    }
    try {
        var href = JSON.parse(localStorage.getItem('tui-tab-favicon') || '""');
        if (typeof href === 'string' && href.trim()) {
            var link = document.createElement('link');
            link.rel = 'icon';
            link.href = href.trim();
            link.setAttribute('data-tui-favicon', '1');
            document.head.appendChild(link);
        }
    } catch (e) {}
})();
