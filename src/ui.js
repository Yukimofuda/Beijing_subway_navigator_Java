(function () {
  // If user opens html directly with file://, auto-route to local server
  if (window.location.protocol === 'file:') {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    const ports = [3000, 3001, 3002, 3003, 3004, 3005];

    (async () => {
      for (const port of ports) {
        const base = `http://localhost:${port}`;
        try {
          const res = await fetch(`${base}/health`);
          if (!res.ok) continue;
          const target = `${base}/${path}${window.location.search || ''}${window.location.hash || ''}`;
          window.location.replace(target);
          return;
        } catch (_) {
          // try next port
        }
      }

      const hint = document.createElement('div');
      hint.style.position = 'fixed';
      hint.style.left = '12px';
      hint.style.right = '12px';
      hint.style.top = '12px';
      hint.style.padding = '12px 14px';
      hint.style.borderRadius = '12px';
      hint.style.background = 'rgba(0,0,0,.78)';
      hint.style.color = '#fff';
      hint.style.zIndex = '99999';
      hint.style.fontFamily =
        '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif';
      hint.style.fontSize = '13px';
      hint.innerHTML = '请先运行：<code>node src/Node.js</code>，再访问 <code>http://localhost:3000</code>（若占用会自动切换到 3001+）';
      document.body.appendChild(hint);
    })();
  }

  const root = document.documentElement;
  root.classList.add('js');

  // Page enter animation
  requestAnimationFrame(() => {
    root.classList.add('is-ready');
  });

  window.addEventListener('pageshow', () => {
    root.classList.remove('is-leaving');
    root.classList.add('is-ready');
  });

  // Smooth leave animation for in-app navigation
  document.addEventListener(
    'click',
    (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http')) return;

      e.preventDefault();
      root.classList.add('is-leaving');
      setTimeout(() => {
        window.location.href = href;
      }, 180);
    },
    { capture: true }
  );

  // Press feedback
  document.addEventListener('pointerdown', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('button, .btn, .chip') : null;
    if (!el) return;
    el.classList.add('is-pressed');
    const up = () => el.classList.remove('is-pressed');
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', up, { once: true });
  });

  // Subtle toast helper for non-intrusive errors
  window.showToast = function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-on'));
    setTimeout(() => toast.classList.remove('is-on'), 2600);
    setTimeout(() => toast.remove(), 3200);
  };
})();
