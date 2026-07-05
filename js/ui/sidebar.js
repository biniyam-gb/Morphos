
export function buildSidebar(container, systems, onSelect) {
  const groups = {};
  for (const s of systems) {
    if (!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s);
  }
  container.innerHTML = '';
  for (const [grp, items] of Object.entries(groups)) {
    const title = document.createElement('div');
    title.className = 'sys-group-title';
    title.textContent = grp;
    container.appendChild(title);
    for (const sys of items) {
      const el = document.createElement('div');
      el.className = 'sys-item';
      el.dataset.id = sys.id;
      el.innerHTML = `
        <div class="sys-dot" style="background:${sys.dot}"></div>
        <div class="sys-label">
          <div class="sys-name">${sys.name}</div>
          ${sys.sub ? `<div class="sys-sub">${sys.sub}</div>` : ''}
        </div>`;
      el.addEventListener('click', () => onSelect(sys.id));
      container.appendChild(el);
    }
  }
}

export function setSidebarActive(id) {
  document.querySelectorAll('.sys-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === id));
}
