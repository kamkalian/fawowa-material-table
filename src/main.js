// ===== API =====
const API = '/api';

async function fetchMaterials() {
  const res = await fetch(`${API}/materials`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

async function submitRequest(data) {
  const res = await fetch(`${API}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to submit');
  return res.json();
}

async function fetchLinkStatus() {
  try {
    const res = await fetch(`${API}/links/status`);
    if (!res.ok) return {};
    return res.json();
  } catch { return {}; }
}

// ===== STATE =====
let materials = [];
let linkStatus = {};
let hiddenProps = new Set();
let propertyNames = [];
let currentSort = { column: '', direction: 'asc' };
let currentPropSort = { property: '', direction: 'asc' };
let searchTags = [];
let propFilterTags = [];
let currentPage = 1;
let pageSize = 10;

// ===== DOM REFS =====
const $count = document.getElementById('mat-count');
const $search = document.getElementById('global-search');
const $tagsRow = document.getElementById('tags-row');
const $propFilters = document.getElementById('prop-filters');
const $tableContainer = document.getElementById('table-container');
const $pagination = document.getElementById('pagination');
const $resultsInfo = document.getElementById('results-info');
const $requestModal = document.getElementById('request-modal');
const $requestFormContainer = document.getElementById('request-form-container');
const $btnRequest = document.getElementById('btn-request');
const $btnAddFilter = document.getElementById('btn-add-filter');
const $btnTheme = document.getElementById('btn-theme');

// ===== DARK MODE TOGGLE =====
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

$btnTheme.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);
});

function updateThemeIcon(theme) {
  const sun = document.getElementById('icon-sun');
  const moon = document.getElementById('icon-moon');
  if (theme === 'dark') { sun.style.display = 'none'; moon.style.display = 'block'; }
  else { sun.style.display = 'block'; moon.style.display = 'none'; }
}

// ===== INIT =====
async function init() {
  initTheme();
  // Show admin button if authenticated
  if (sessionStorage.getItem('admin-key')) {
    const btn = document.getElementById('btn-admin');
    if (btn) btn.style.display = 'inline-flex';
  }
  try {
    [materials, linkStatus] = await Promise.all([
      fetchMaterials(),
      fetchLinkStatus()
    ]);
    extractPropertyNames();
  } catch (e) {
    materials = [];
    linkStatus = {};
  }
  render();
}

function extractPropertyNames() {
  const names = new Set();
  materials.forEach(m => Object.keys(m.eigenschaften).forEach(k => names.add(k)));
  propertyNames = [...names].sort();
}

function render() {
  $count.textContent = materials.length + ' Materialien verf\u00fcgbar';
  renderTags();
  renderTable();
  renderPagination();
}

// ===== TAGS =====
function renderTags() {
  const allTags = [
    ...searchTags.map(t => ({ type: 'search', label: t, id: 's_' + t })),
    ...propFilterTags.map((pf, i) => ({
      type: 'prop',
      label: pf.name + ' ' + pf.operator + ' ' + pf.value,
      id: 'p_' + i,
      idx: i
    }))
  ];

  if (allTags.length === 0) {
    $tagsRow.innerHTML = '';
    return;
  }

  $tagsRow.innerHTML = allTags.map(t =>
    '<span class="tag ' + (t.type === 'prop' ? 'tag-prop' : '') + '">' +
      escHtml(t.label) +
      '<button class="tag-remove" data-remove="' + t.id + '" data-idx="' + (t.idx ?? '') + '" data-type="' + t.type + '">' +
        '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
    '</span>'
  ).join('');

  $tagsRow.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type === 'search') {
        const label = btn.dataset.remove.replace('s_', '');
        searchTags = searchTags.filter(t => t !== label);
      } else {
        const idx = parseInt(btn.dataset.idx);
        propFilterTags.splice(idx, 1);
      }
      currentPage = 1;
      render();
    });
  });
}

// ===== PROPERTY FILTER BUTTON =====
$btnAddFilter.addEventListener('click', () => {
  $propFilters.innerHTML = renderPropFilterForm();
  bindPropFilterForm();
});

function renderPropFilterForm() {
  return '<div class="card" style="margin-bottom:.75rem"><div class="card-body">' +
    '<div style="font-size:.75rem;color:var(--fg-muted);margin-bottom:.5rem">Eigenschaftsfilter hinzuf\u00fcgen</div>' +
    '<div class="filter-row">' +
      '<select class="input" id="pf-name" style="font-size:.75rem"><option value="">Eigenschaft w\u00e4hlen...</option>' +
        propertyNames.map(n => '<option value="' + escHtml(n) + '">' + escHtml(n) + '</option>').join('') +
      '</select>' +
      '<select class="input" id="pf-op" style="max-width:80px;font-size:.75rem">' +
        '<option value="=">=</option><option value="!=">!=</option><option value="<">&lt;</option><option value="<=">&lt;=</option><option value=">">&gt;</option><option value=">=">&gt;=</option><option value="contains">enth\u00e4lt</option>' +
      '</select>' +
      '<div id="pf-value-wrap"><input type="text" class="input" id="pf-value" placeholder="Wert" style="font-size:.75rem"></div>' +
      '<button class="btn btn-primary btn-sm" id="pf-add">Hinzuf\u00fcgen</button>' +
      '<button class="btn btn-ghost btn-sm" id="pf-cancel">Abbrechen</button>' +
    '</div></div></div>';
}

function getPropValues(propName) {
  const vals = new Set();
  materials.forEach(m => {
    const p = m.eigenschaften[propName];
    if (p && p.wert !== undefined && p.wert !== '') vals.add(String(p.wert));
  });
  return [...vals].sort((a, b) => {
    const na = parseFloat(a), nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

function allNumeric(values) {
  return values.length > 0 && values.every(v => !isNaN(parseFloat(v)) && isFinite(v));
}

function updatePfValueInput() {
  const name = document.getElementById('pf-name').value;
  const op = document.getElementById('pf-op').value;
  const wrap = document.getElementById('pf-value-wrap');
  if (!wrap) return;

  const values = name ? getPropValues(name) : [];

  // Only show dropdown for = / != on string (non-numeric) values
  if ((op === '=' || op === '!=') && values.length > 0 && !allNumeric(values)) {
    wrap.innerHTML = '<select class="input" id="pf-value" style="font-size:.75rem">' +
      '<option value="">Wert w\u00e4hlen...</option>' +
      values.map(v => '<option value="' + escHtml(v) + '">' + escHtml(v) + '</option>').join('') +
    '</select>';
  } else {
    wrap.innerHTML = '<input type="text" class="input" id="pf-value" placeholder="Wert" style="font-size:.75rem">';
  }

  // Re-bind Enter key for the new input
  const pfVal = document.getElementById('pf-value');
  if (pfVal) {
    pfVal.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('pf-add').click();
    });
  }
}

function bindPropFilterForm() {
  document.getElementById('pf-cancel').addEventListener('click', () => { $propFilters.innerHTML = ''; });

  // When property name or operator changes, update value input type
  document.getElementById('pf-name').addEventListener('change', updatePfValueInput);
  document.getElementById('pf-op').addEventListener('change', updatePfValueInput);

  document.getElementById('pf-add').addEventListener('click', () => {
    const name = document.getElementById('pf-name').value;
    const op = document.getElementById('pf-op').value;
    const pfVal = document.getElementById('pf-value');
    const value = pfVal?.value?.trim() || '';
    if (!name || !value) return;
    propFilterTags.push({ name, operator: op, value });
    $propFilters.innerHTML = '';
    currentPage = 1;
    render();
  });
}

// ===== SEARCH (Enter = tag) =====
$search.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const val = $search.value.trim();
    if (val && !searchTags.includes(val)) {
      searchTags.push(val);
      $search.value = '';
      currentPage = 1;
      render();
    }
  }
});

// ===== FILTERING =====
function getFilteredMaterials() {
  let filtered = [...materials];

  for (const tag of searchTags) {
    const q = tag.toLowerCase();
    filtered = filtered.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.hersteller.toLowerCase().includes(q) ||
      Object.entries(m.eigenschaften).some(([k, p]) =>
        k.toLowerCase().includes(q) ||
        String(p.wert).toLowerCase().includes(q) ||
        (p.einheit && p.einheit.toLowerCase().includes(q))
      )
    );
  }

  for (const pf of propFilterTags) {
    filtered = filtered.filter(m => {
      const prop = m.eigenschaften[pf.name];
      if (!prop) return false;
      switch (pf.operator) {
        case '=': return String(prop.wert) === pf.value;
        case '!=': return String(prop.wert) !== pf.value;
        case '<': { const a = parseFloat(prop.wert), b = parseFloat(pf.value); return !isNaN(a) && !isNaN(b) && a < b; }
        case '<=': { const a = parseFloat(prop.wert), b = parseFloat(pf.value); return !isNaN(a) && !isNaN(b) && a <= b; }
        case '>': { const a = parseFloat(prop.wert), b = parseFloat(pf.value); return !isNaN(a) && !isNaN(b) && a > b; }
        case '>=': { const a = parseFloat(prop.wert), b = parseFloat(pf.value); return !isNaN(a) && !isNaN(b) && a >= b; }
        case 'contains': return String(prop.wert).toLowerCase().includes(pf.value.toLowerCase());
        default: return true;
      }
    });
  }

  if (currentSort.column) {
    filtered.sort((a, b) => {
      const va = (a[currentSort.column] || '').toString();
      const vb = (b[currentSort.column] || '').toString();
      return currentSort.direction === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  } else if (currentPropSort.property) {
    filtered.sort((a, b) => {
      const pa = a.eigenschaften[currentPropSort.property];
      const pb = b.eigenschaften[currentPropSort.property];
      if (!pa && !pb) return 0;
      if (!pa) return 1;
      if (!pb) return -1;
      const na = parseFloat(pa.wert), nb = parseFloat(pb.wert);
      if (!isNaN(na) && !isNaN(nb)) return currentPropSort.direction === 'asc' ? na - nb : nb - na;
      return currentPropSort.direction === 'asc' ? String(pa.wert).localeCompare(String(pb.wert)) : String(pb.wert).localeCompare(String(pa.wert));
    });
  }

  return filtered;
}

// ===== TABLE =====
function renderTable() {
  const filtered = getFilteredMaterials();
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  $resultsInfo.textContent = filtered.length + ' Materialien — Seite ' + currentPage + ' von ' + totalPages;

  const sortArrow = (col) => {
    if (currentSort.column !== col) return '<span class="sort-icon">\u2195</span>';
    return '<span class="sort-icon active">' + (currentSort.direction === 'asc' ? '\u2191' : '\u2193') + '</span>';
  };

  $tableContainer.innerHTML =
    '<table><thead><tr>' +
      '<th class="sortable" data-sort="name">Materialname ' + sortArrow('name') + '</th>' +
      '<th class="sortable" data-sort="hersteller">Hersteller ' + sortArrow('hersteller') + '</th>' +
      '<th>' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
          '<span>Eigenschaften</span>' +
          '<div class="vis-dropdown">' +
            '<button class="btn btn-ghost btn-sm" id="btn-vis-toggle">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Spalten' +
            '</button>' +
            '<div class="vis-dropdown-menu" id="vis-menu" style="display:none">' +
              '<div style="font-size:.6875rem;color:var(--fg-muted);padding:.25rem .5rem">Eigenschaften anzeigen</div>' +
              propertyNames.map(pn => '<label><input type="checkbox" ' + (!hiddenProps.has(pn) ? 'checked' : '') + ' data-prop="' + escHtml(pn) + '"> ' + escHtml(pn) + '</label>').join('') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:.25rem;margin-top:.375rem">' +
          '<select class="input" style="font-size:.6875rem;padding:.25rem" id="prop-sort-select">' +
            '<option value="">Nach Eigenschaft sort.</option>' +
            propertyNames.map(pn => '<option value="' + escHtml(pn) + '">' + escHtml(pn) + '</option>').join('') +
          '</select>' +
          '<button class="btn btn-ghost btn-sm" id="sort-asc">\u2191</button>' +
          '<button class="btn btn-ghost btn-sm" id="sort-desc">\u2193</button>' +
        '</div>' +
      '</th>' +
      '<th>Links</th>' +
    '</tr></thead><tbody>' +
    (pageItems.length === 0
      ? '<tr><td colspan="4" class="empty-row">Keine Materialien gefunden</td></tr>'
      : pageItems.map(m =>
        '<tr>' +
          '<td style="font-weight:500">' + escHtml(m.name) + '</td>' +
          '<td style="color:var(--fg-muted)">' + (escHtml(m.hersteller) || '\u2014') + '</td>' +
          '<td><div style="display:flex;flex-wrap:wrap;gap:2px">' +
            (Object.keys(m.eigenschaften).length === 0 ? '<span style="color:var(--fg-muted);font-size:.6875rem">\u2014</span>' : '') +
            Object.entries(m.eigenschaften).map(([name, p]) => '<span class="prop-tag ' + (hiddenProps.has(name) ? 'hidden' : '') + '">' + escHtml(name) + ': ' + escHtml(p.wert) + (p.einheit ? ' ' + escHtml(p.einheit) : '') + '</span>').join('') +
          '</div></td>' +
          '<td><div style="display:flex;flex-wrap:wrap;gap:2px">' +
            (m.links.length === 0 ? '<span style="color:var(--fg-muted);font-size:.6875rem">\u2014</span>' : '') +
            m.links.map(l => {
              const ls = linkStatus[l.url];
              const dot = ls
                ? (ls.status === 'ok' ? '<span class="link-dot link-ok" title="Erreichbar (HTTP ' + ls.code + ')"></span>'
                  : ls.status === 'timeout' ? '<span class="link-dot link-warn" title="Zeitüberschreitung"></span>'
                  : ls.status === 'redirect' ? '<span class="link-dot link-warn" title="Weiterleitung (HTTP ' + ls.code + ')"></span>'
                  : '<span class="link-dot link-err" title="Nicht erreichbar"></span>')
                : '<span class="link-dot link-unknown" title="Noch nicht geprüft"></span>';
              return '<a href="' + escHtml(l.url) + '" target="_blank" rel="noopener" class="link-btn">' + dot + escHtml(l.text) + '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>';
            }).join('') +
          '</div></td>' +
        '</tr>'
      ).join('')
    ) +
    '</tbody></table>';

  // Bind sort
  $tableContainer.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (currentSort.column === col) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort = { column: col, direction: 'asc' };
      }
      currentPropSort = { property: '', direction: 'asc' };
      renderTable();
    });
  });

  // Property visibility
  const btnVis = document.getElementById('btn-vis-toggle');
  const visMenu = document.getElementById('vis-menu');
  if (btnVis && visMenu) {
    btnVis.addEventListener('click', e => { e.stopPropagation(); visMenu.style.display = visMenu.style.display === 'none' ? 'block' : 'none'; });
    visMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const prop = cb.dataset.prop;
        if (cb.checked) hiddenProps.delete(prop); else hiddenProps.add(prop);
        renderTable();
      });
    });
    document.addEventListener('click', () => { visMenu.style.display = 'none'; });
  }

  // Property sort
  const propSortSelect = document.getElementById('prop-sort-select');
  document.getElementById('sort-asc')?.addEventListener('click', () => {
    if (propSortSelect.value) { currentPropSort = { property: propSortSelect.value, direction: 'asc' }; currentSort = { column: '', direction: 'asc' }; renderTable(); }
  });
  document.getElementById('sort-desc')?.addEventListener('click', () => {
    if (propSortSelect.value) { currentPropSort = { property: propSortSelect.value, direction: 'desc' }; currentSort = { column: '', direction: 'asc' }; renderTable(); }
  });
}

// ===== PAGINATION =====
function renderPagination() {
  const filtered = getFilteredMaterials();
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;

  let html = '<div class="pagination">';
  html += '<div class="pagination-info">' + (filtered.length === 0 ? 'Keine Eintr&auml;ge' : ('Zeige ' + ((currentPage-1)*pageSize+1) + '–' + Math.min(currentPage*pageSize, filtered.length) + ' von ' + filtered.length)) + '</div>';

  html += '<div class="pagination-controls">';
  // Page size selector
  html += '<select class="input pagination-size" id="page-size">';
  [10, 20, 50].forEach(n => {
    html += '<option value="' + n + '" ' + (pageSize === n ? 'selected' : '') + '>' + n + ' pro Seite</option>';
  });
  html += '</select>';

  // Prev button
  html += '<button class="btn btn-ghost btn-sm pagination-btn" ' + (currentPage <= 1 ? 'disabled' : '') + ' data-page="' + (currentPage - 1) + '">&laquo;</button>';

  // Page numbers
  const maxButtons = 7;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) startPage = Math.max(1, endPage - maxButtons + 1);

  for (let p = startPage; p <= endPage; p++) {
    html += '<button class="btn btn-sm pagination-btn ' + (p === currentPage ? 'btn-primary' : 'btn-ghost') + '" data-page="' + p + '">' + p + '</button>';
  }

  // Next button
  html += '<button class="btn btn-ghost btn-sm pagination-btn" ' + (currentPage >= totalPages ? 'disabled' : '') + ' data-page="' + (currentPage + 1) + '">&raquo;</button>';
  html += '</div></div>';

  $pagination.innerHTML = html;

  // Bind events
  document.getElementById('page-size').addEventListener('change', function() {
    pageSize = parseInt(this.value);
    currentPage = 1;
    render();
  });

  $pagination.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.disabled) return;
      currentPage = parseInt(this.dataset.page);
      render();
    });
  });
}

// ===== REQUEST FORM MODAL =====
$btnRequest.addEventListener('click', () => {
  $requestModal.style.display = 'flex';
  renderRequestForm();
});

$requestModal.addEventListener('click', (e) => {
  if (e.target === $requestModal) $requestModal.style.display = 'none';
});

function renderRequestForm() {
  $requestFormContainer.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">' +
      '<h2>Neue Anfrage</h2>' +
      '<button class="btn btn-ghost btn-icon" id="close-request"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
    '</div>' +
    '<div style="display:flex;gap:.5rem;margin-bottom:1rem">' +
      '<button class="btn btn-sm" id="req-action-new" style="background:var(--primary);color:#0a0a0b">Neues Material</button>' +
      '<button class="btn btn-sm btn-outline" id="req-action-change">\u00c4nderung vorschlagen</button>' +
    '</div>' +
    '<div style="margin-bottom:.75rem"><label for="req-name">Materialname *</label><input type="text" class="input" id="req-name" placeholder="z.B. Evazote 4mm"></div>' +
    '<div style="margin-bottom:.75rem"><label for="req-hersteller">Hersteller</label><input type="text" class="input" id="req-hersteller" placeholder="z.B. Firma Zotefoams plc"></div>' +
    '<div style="margin-bottom:.75rem">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem"><label style="margin:0">Eigenschaften</label><button class="btn btn-ghost btn-sm" id="add-prop">+ Hinzuf\u00fcgen</button></div>' +
      '<div id="req-props"><div class="form-row" style="margin-bottom:.25rem"><input type="text" class="input req-prop-name" placeholder="Name (z.B. Gewicht)" style="flex:1"><input type="text" class="input req-prop-wert" placeholder="Wert" style="width:80px"><input type="text" class="input req-prop-einheit" placeholder="Einheit" style="width:70px"></div></div>' +
    '</div>' +
    '<div style="margin-bottom:.75rem">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem"><label style="margin:0">Links</label><button class="btn btn-ghost btn-sm" id="add-link">+ Hinzuf\u00fcgen</button></div>' +
      '<div id="req-links"><div class="form-row" style="margin-bottom:.25rem"><input type="text" class="input req-link-text" placeholder="Link Text" style="flex:1"><input type="text" class="input req-link-url" placeholder="URL" style="flex:1"></div></div>' +
    '</div>' +
    '<div style="margin-bottom:1rem"><label for="req-note">Anmerkung (optional)</label><input type="text" class="input" id="req-note" placeholder="Zus\u00e4tzliche Informationen..."></div>' +
    '<div id="req-error" style="color:var(--danger);font-size:.8125rem;margin-bottom:.5rem;display:none"></div>' +
    '<button class="btn btn-primary" style="width:100%" id="submit-request"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Anfrage senden</button>';

  let action = 'new';
  document.getElementById('close-request').addEventListener('click', () => $requestModal.style.display = 'none');

  document.getElementById('req-action-new').addEventListener('click', function() {
    action = 'new';
    this.style.background = 'var(--primary)'; this.style.color = '#0a0a0b'; this.className = 'btn btn-sm';
    const other = document.getElementById('req-action-change');
    other.style.background = 'transparent'; other.style.color = ''; other.className = 'btn btn-sm btn-outline';
  });
  document.getElementById('req-action-change').addEventListener('click', function() {
    action = 'change';
    this.style.background = 'var(--primary)'; this.style.color = '#0a0a0b'; this.className = 'btn btn-sm';
    const other = document.getElementById('req-action-new');
    other.style.background = 'transparent'; other.style.color = ''; other.className = 'btn btn-sm btn-outline';
  });

  document.getElementById('add-prop').addEventListener('click', () => {
    document.getElementById('req-props').insertAdjacentHTML('beforeend',
      '<div class="form-row" style="margin-bottom:.25rem"><input type="text" class="input req-prop-name" placeholder="Name" style="flex:1"><input type="text" class="input req-prop-wert" placeholder="Wert" style="width:80px"><input type="text" class="input req-prop-einheit" placeholder="Einheit" style="width:70px"><button class="btn btn-ghost btn-icon remove-prop"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>');
  });
  document.getElementById('req-props').addEventListener('click', e => {
    if (e.target.closest('.remove-prop')) e.target.closest('.form-row').remove();
  });
  document.getElementById('add-link').addEventListener('click', () => {
    document.getElementById('req-links').insertAdjacentHTML('beforeend',
      '<div class="form-row" style="margin-bottom:.25rem"><input type="text" class="input req-link-text" placeholder="Link Text" style="flex:1"><input type="text" class="input req-link-url" placeholder="URL" style="flex:1"><button class="btn btn-ghost btn-icon remove-link"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>');
  });
  document.getElementById('req-links').addEventListener('click', e => {
    if (e.target.closest('.remove-link')) e.target.closest('.form-row').remove();
  });

  document.getElementById('submit-request').addEventListener('click', async () => {
    const name = document.getElementById('req-name').value.trim();
    if (!name) {
      document.getElementById('req-error').textContent = 'Bitte geben Sie einen Materialnamen ein.';
      document.getElementById('req-error').style.display = 'block';
      return;
    }
    const propsObj = {};
    document.querySelectorAll('#req-props .form-row').forEach(row => {
      const n = row.querySelector('.req-prop-name')?.value.trim();
      const w = row.querySelector('.req-prop-wert')?.value.trim();
      const e = row.querySelector('.req-prop-einheit')?.value.trim();
      if (n && w) propsObj[n] = { wert: w, einheit: e || '' };
    });
    const links = [];
    document.querySelectorAll('#req-links .form-row').forEach(row => {
      const t = row.querySelector('.req-link-text')?.value.trim();
      const u = row.querySelector('.req-link-url')?.value.trim();
      if (t && u) links.push({ text: t, url: u });
    });
    const note = document.getElementById('req-note').value.trim();
    const material = {
      name,
      hersteller: document.getElementById('req-hersteller').value.trim(),
      eigenschaften: propsObj,
      links
    };
    try {
      await submitRequest({ action, material, note: note || undefined });
      $requestModal.style.display = 'none';
      showToast('Anfrage gesendet! Wird von einem Admin gepr\u00fcft.', 'success');
    } catch {
      document.getElementById('req-error').textContent = 'Fehler beim Senden. Bitte versuchen Sie es erneut.';
      document.getElementById('req-error').style.display = 'block';
    }
  });
}

// ===== TOAST =====
function showToast(msg, type) {
  type = type || 'success';
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 200); }, 3000);
}

// ===== UTILS =====
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== START =====
init();
