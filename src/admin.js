// ===== ADMIN APP =====
const API = '/api';

function getKey() { return sessionStorage.getItem('admin-key') || ''; }

async function apiFetch(url, opts = {}) {
  const headers = { ...opts.headers, 'x-admin-key': getKey() };
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) { handleLogout(); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error('Request failed');
  return res;
}

// ===== STATE =====
let materials = [];
let requests = [];
let editingMaterial = null;
let editingIndex = -1;
let isNew = false;
let activeTab = 'materials';

// ===== AUTH =====
const $authScreen = document.getElementById('auth-screen');
const $dashboard = document.getElementById('admin-dashboard');

function renderAuth() {
  $authScreen.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem">
      <div class="card" style="width:100%;max-width:400px">
        <div class="card-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" style="margin-right:.5rem;vertical-align:middle"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Admin-Bereich
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:.75rem">
          <div>
            <label for="admin-key">Admin Key</label>
            <div style="position:relative">
              <input type="password" class="input" id="admin-key" placeholder="Key eingeben...">
              <button class="btn btn-ghost btn-icon" id="toggle-key-vis" style="position:absolute;right:0;top:0;height:100%" title="Anzeigen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
            <div id="auth-error" style="color:var(--danger);font-size:.75rem;margin-top:.25rem;display:none"></div>
          </div>
          <button class="btn btn-primary" id="btn-auth" style="width:100%">Anmelden</button>
          <p style="font-size:.6875rem;color:var(--fg-muted);text-align:center">Key befindet sich in <code style="background:var(--bg-hover);padding:.125rem .25rem;border-radius:3px">data/editor-key.txt</code></p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-auth').addEventListener('click', handleLogin);
  document.getElementById('admin-key').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('toggle-key-vis').addEventListener('click', function() {
    const inp = document.getElementById('admin-key');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
}

async function handleLogin() {
  const key = document.getElementById('admin-key').value.trim();
  const errEl = document.getElementById('auth-error');
  if (!key) { errEl.textContent = 'Bitte Key eingeben'; errEl.style.display = 'block'; return; }

  try {
    const res = await fetch(`${API}/editor/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const data = await res.json();
    if (data.valid) {
      sessionStorage.setItem('admin-key', key);
      location.reload();
    } else {
      errEl.textContent = 'Ungültiger Key';
      errEl.style.display = 'block';
    }
  } catch {
    errEl.textContent = 'Fehler bei der Authentifizierung';
    errEl.style.display = 'block';
  }
}

function handleLogout() {
  sessionStorage.removeItem('admin-key');
  location.reload();
}

function checkAuth() {
  const key = getKey();
  if (!key) {
    renderAuth();
    return false;
  }
  // Validate key on load
  fetch(`${API}/editor/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key })
  }).then(r => r.json()).then(d => {
    if (!d.valid) handleLogout();
  }).catch(() => {});
  return true;
}

// ===== LOAD DATA =====
async function loadData() {
  try {
    const [matRes, reqRes] = await Promise.all([
      apiFetch(`${API}/materials`),
      apiFetch(`${API}/requests`)
    ]);
    materials = await matRes.json();
    requests = await reqRes.json();
  } catch (e) {
    console.error('Load error:', e);
  }
}

// ===== RENDER DASHBOARD =====
async function renderDashboard() {
  await loadData();

  const pendingCount = requests.filter(r => r.status === 'check').length;

  $dashboard.style.display = 'block';
  $dashboard.innerHTML = `
    <header class="header">
      <div class="header-inner">
        <div style="display:flex;align-items:center;gap:1.5rem">
          <h1 style="font-size:1.25rem;font-weight:700;text-shadow:0 0 40px rgba(34,197,94,0.3)">Admin</h1>
          <nav class="tabs">
            <button class="tab ${activeTab === 'materials' ? 'active' : ''}" data-tab="materials">Materialien (${materials.length})</button>
            <button class="tab ${activeTab === 'requests' ? 'active' : ''}" data-tab="requests">
              Anfragen
              ${pendingCount > 0 ? `<span class="count">${pendingCount}</span>` : ''}
            </button>
          </nav>
        </div>
        <div style="display:flex;gap:.5rem">
          <a class="btn btn-ghost btn-sm" href="/" title="Zur Startseite">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Startseite
          </a>
          <button class="btn btn-ghost btn-sm" id="btn-logout">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Logout
          </button>
        </div>
      </div>
    </header>
    <main class="container" style="padding-top:1.5rem">
      <div id="tab-content"></div>
    </main>
  `;

  document.getElementById('btn-logout').addEventListener('click', handleLogout);
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      renderDashboard();
    });
  });

  if (activeTab === 'materials') renderMaterialsTab();
  else renderRequestsTab();
}

// ===== MATERIALS TAB =====
function renderMaterialsTab() {
  const $tc = document.getElementById('tab-content');
  $tc.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h2 style="font-size:1rem;font-weight:600">Materialien verwalten</h2>
      <div style="display:flex;gap:.5rem">
        <button class="btn btn-primary btn-sm" id="btn-new-mat">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Neues Material
        </button>
        <button class="btn btn-outline btn-sm" id="btn-export">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <label class="btn btn-outline btn-sm" style="cursor:pointer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Import
          <input type="file" accept=".csv" id="csv-import" style="display:none">
        </label>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem" id="mat-editor-grid">
      <div class="card" id="mat-list-panel">
        <div class="card-header">Alle Materialien (${materials.length})</div>
        <div class="card-body" style="max-height:500px;overflow-y:auto" id="mat-list"></div>
      </div>
      <div id="editor-panel"></div>
    </div>
  `;

  renderMatList();
  bindMatActions();
}

function renderMatList() {
  const el = document.getElementById('mat-list');
  if (!el) return;
  el.innerHTML = materials.map((m, i) => `
    <div class="mat-item ${editingIndex === i ? 'active' : ''}" data-idx="${i}">
      <div style="flex:1;min-width:0">
        <div class="mat-name truncate">${escHtml(m.Materialname) || '—'}</div>
        <div class="mat-sub truncate">${escHtml(m.Hersteller) || '—'}</div>
        <div class="mat-info">${m.Eigenschaften.length} Eigenschaften · ${m.Link.length} Links</div>
      </div>
      <button class="btn btn-ghost btn-icon" data-delete="${i}" style="color:var(--danger);flex-shrink:0" title="Löschen">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `).join('');

  // Click to edit
  el.querySelectorAll('.mat-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('[data-delete]')) return;
      const idx = parseInt(item.dataset.idx);
      editingMaterial = { ...materials[idx] };
      editingIndex = idx;
      isNew = false;
      renderEditor();
      renderMatList();
    });
  });

  // Delete
  el.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.delete);
      if (!confirm('Material wirklich löschen?')) return;
      materials.splice(idx, 1);
      await saveMaterials();
      editingMaterial = null;
      editingIndex = -1;
      renderMatList();
      renderEditor();
    });
  });
}

function renderEditor() {
  const el = document.getElementById('editor-panel');
  if (!editingMaterial) { el.innerHTML = ''; return; }

  const m = editingMaterial;
  el.innerHTML = `
    <div class="card">
      <div class="card-header">${isNew ? 'Neues Material' : 'Material bearbeiten'}</div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:.75rem">
        <div>
          <label for="edit-name">Materialname</label>
          <input type="text" class="input" id="edit-name" value="${escHtml(m.Materialname)}">
        </div>
        <div>
          <label for="edit-hersteller">Hersteller</label>
          <input type="text" class="input" id="edit-hersteller" value="${escHtml(m.Hersteller)}">
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem">
            <label style="margin:0">Eigenschaften</label>
            <button class="btn btn-ghost btn-sm" id="edit-add-prop">+ Hinzufügen</button>
          </div>
          <div id="edit-props">
            ${m.Eigenschaften.map((p, i) => `
              <div class="form-row" style="margin-bottom:.25rem">
                <input type="text" class="input edit-prop-name" value="${escHtml(p.name)}" placeholder="Name" style="flex:1;font-size:.75rem">
                <input type="text" class="input edit-prop-wert" value="${escHtml(p.wert)}" placeholder="Wert" style="width:80px;font-size:.75rem">
                <input type="text" class="input edit-prop-einheit" value="${escHtml(p.einheit||'')}" placeholder="Einheit" style="width:70px;font-size:.75rem">
                <button class="btn btn-ghost btn-icon remove-edit-prop"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            `).join('')}
            ${m.Eigenschaften.length === 0 ? '<div class="form-row" style="margin-bottom:.25rem"><input type="text" class="input edit-prop-name" placeholder="Name" style="flex:1;font-size:.75rem"><input type="text" class="input edit-prop-wert" placeholder="Wert" style="width:80px;font-size:.75rem"><input type="text" class="input edit-prop-einheit" placeholder="Einheit" style="width:70px;font-size:.75rem"></div>' : ''}
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem">
            <label style="margin:0">Links</label>
            <button class="btn btn-ghost btn-sm" id="edit-add-link">+ Hinzufügen</button>
          </div>
          <div id="edit-links">
            ${m.Link.map((l, i) => `
              <div class="form-row" style="margin-bottom:.25rem">
                <input type="text" class="input edit-link-text" value="${escHtml(l.text)}" placeholder="Link Text" style="flex:1;font-size:.75rem">
                <input type="text" class="input edit-link-url" value="${escHtml(l.url)}" placeholder="URL" style="flex:1;font-size:.75rem">
                <button class="btn btn-ghost btn-icon remove-edit-link"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            `).join('')}
            ${m.Link.length === 0 ? '<div class="form-row" style="margin-bottom:.25rem"><input type="text" class="input edit-link-text" placeholder="Link Text" style="flex:1;font-size:.75rem"><input type="text" class="input edit-link-url" placeholder="URL" style="flex:1;font-size:.75rem"></div>' : ''}
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary btn-sm" id="edit-save">Speichern</button>
          <button class="btn btn-outline btn-sm" id="edit-cancel">Abbrechen</button>
        </div>
      </div>
    </div>
  `;

  // Collect edited data
  document.getElementById('edit-name').addEventListener('input', e => editingMaterial.Materialname = e.target.value);
  document.getElementById('edit-hersteller').addEventListener('input', e => editingMaterial.Hersteller = e.target.value);

  document.getElementById('edit-add-prop').addEventListener('click', () => {
    document.getElementById('edit-props').insertAdjacentHTML('beforeend', `
      <div class="form-row" style="margin-bottom:.25rem">
        <input type="text" class="input edit-prop-name" placeholder="Name" style="flex:1;font-size:.75rem">
        <input type="text" class="input edit-prop-wert" placeholder="Wert" style="width:80px;font-size:.75rem">
        <input type="text" class="input edit-prop-einheit" placeholder="Einheit" style="width:70px;font-size:.75rem">
        <button class="btn btn-ghost btn-icon remove-edit-prop"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
    `);
  });

  document.getElementById('edit-props').addEventListener('click', e => {
    if (e.target.closest('.remove-edit-prop')) e.target.closest('.form-row').remove();
  });

  document.getElementById('edit-add-link').addEventListener('click', () => {
    document.getElementById('edit-links').insertAdjacentHTML('beforeend', `
      <div class="form-row" style="margin-bottom:.25rem">
        <input type="text" class="input edit-link-text" placeholder="Link Text" style="flex:1;font-size:.75rem">
        <input type="text" class="input edit-link-url" placeholder="URL" style="flex:1;font-size:.75rem">
        <button class="btn btn-ghost btn-icon remove-edit-link"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
    `);
  });

  document.getElementById('edit-links').addEventListener('click', e => {
    if (e.target.closest('.remove-edit-link')) e.target.closest('.form-row').remove();
  });

  document.getElementById('edit-save').addEventListener('click', async () => {
    // Collect properties
    const props = [];
    document.querySelectorAll('#edit-props .form-row').forEach(row => {
      const n = row.querySelector('.edit-prop-name')?.value.trim();
      const w = row.querySelector('.edit-prop-wert')?.value.trim();
      const e = row.querySelector('.edit-prop-einheit')?.value.trim();
      if (n && w !== '') props.push({ name: n, wert: w, einheit: e || '' });
    });
    editingMaterial.Eigenschaften = props;

    // Collect links
    const links = [];
    document.querySelectorAll('#edit-links .form-row').forEach(row => {
      const t = row.querySelector('.edit-link-text')?.value.trim();
      const u = row.querySelector('.edit-link-url')?.value.trim();
      if (t && u) links.push({ text: t, url: u });
    });
    editingMaterial.Link = links;

    if (isNew) {
      materials.push(editingMaterial);
    } else {
      materials[editingIndex] = editingMaterial;
    }

    await saveMaterials();
    editingMaterial = null;
    editingIndex = -1;
    isNew = false;
    renderMatList();
    renderEditor();
  });

  document.getElementById('edit-cancel').addEventListener('click', () => {
    editingMaterial = null;
    editingIndex = -1;
    isNew = false;
    renderMatList();
    renderEditor();
  });
}

function bindMatActions() {
  document.getElementById('btn-new-mat').addEventListener('click', () => {
    editingMaterial = { Materialname: '', Hersteller: '', Eigenschaften: [], Link: [] };
    editingIndex = -1;
    isNew = true;
    renderEditor();
    renderMatList();
  });

  document.getElementById('btn-export').addEventListener('click', exportCSV);

  document.getElementById('csv-import').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (materials.length > 0 && !confirm(`Alle ${materials.length} Materialien werden überschrieben. Fortfahren?`)) {
      this.value = ''; return;
    }
    const text = await file.text();
    const lines = text.trim().split('\n');
    const header = lines[0].split(';');
    const fixedCols = ['Materialname', 'Hersteller', 'Links'];
    const propCols = header.filter(c => c.trim() && !fixedCols.includes(c.trim()));

    const newMats = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';');
      const name = (cols[0] || '').trim();
      if (!name) continue;

      const eigenschaften = [];
      for (let j = 0; j < propCols.length; j++) {
        const ci = j + 2;
        const val = (cols[ci] || '').replace(',', '.').trim();
        if (!val) continue;
        let einheit = '';
        const pname = propCols[j].trim();
        const m = pname.match(/\((.*?)\)$/);
        if (m) einheit = m[1];
        else if (/stärke|dicke/i.test(pname)) einheit = 'mm';
        else if (/gewicht/i.test(pname)) einheit = 'kg/m²';
        eigenschaften.push({ name: pname.replace(/\s*\(.*?\)$/, ''), wert: val, einheit });
      }

      const links = [];
      const linkCol = cols[cols.length - 1] || '';
      if (linkCol.trim()) {
        linkCol.split('|').forEach(pair => {
          const [text, url] = pair.split(':');
          if (text && url) links.push({ text: text.trim(), url: url.trim() });
        });
      }

      newMats.push({ Materialname: name, Hersteller: (cols[1] || '').trim(), Eigenschaften: eigenschaften, Link: links });
    }

    materials = newMats;
    await saveMaterials();
    alert(`${newMats.length} Materialien importiert`);
    renderMatList();
    this.value = '';
  });
}

async function saveMaterials() {
  await apiFetch(`${API}/materials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(materials)
  });
}

function exportCSV() {
  // Build CSV from materials
  const allProps = new Set();
  materials.forEach(m => m.Eigenschaften.forEach(p => allProps.add(p.name)));
  const sortedProps = [...allProps].sort();

  let csv = ['Materialname', 'Hersteller', ...sortedProps, 'Links'].join(';') + '\n';
  materials.forEach(m => {
    const row = [m.Materialname, m.Hersteller];
    sortedProps.forEach(pn => {
      const p = m.Eigenschaften.find(e => e.name === pn);
      row.push(p ? p.wert.replace('.', ',') : '');
    });
    row.push(m.Link.map(l => `${l.text}:${l.url}`).join('|'));
    csv += row.join(';') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'materials_export.csv';
  a.click();
}

// ===== REQUESTS TAB =====
function renderRequestsTab() {
  const pending = requests.filter(r => r.status === 'check');
  const processed = requests.filter(r => r.status !== 'check');

  document.getElementById('tab-content').innerHTML = `
    <div style="margin-bottom:1.5rem">
      <h2 style="font-size:1rem;font-weight:600;margin-bottom:.75rem;display:flex;align-items:center;gap:.5rem">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Ausstehende Anfragen (${pending.length})
      </h2>
      ${pending.length === 0 ? '<div class="card"><div class="card-body" style="text-align:center;color:var(--fg-muted);padding:2rem">Keine ausstehenden Anfragen</div></div>' : ''}
      ${pending.map(req => renderRequestCard(req)).join('')}
    </div>
    ${processed.length > 0 ? `
      <div>
        <h2 style="font-size:1rem;font-weight:600;margin-bottom:.75rem">Bearbeitete Anfragen</h2>
        ${processed.map(req => renderRequestCard(req)).join('')}
      </div>
    ` : ''}
  `;

  // Bind approve/reject buttons
  document.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', () => approveRequest(btn.dataset.approve));
  });
  document.querySelectorAll('[data-reject]').forEach(btn => {
    btn.addEventListener('click', () => rejectRequest(btn.dataset.reject));
  });
}

function renderRequestCard(req) {
  const isPending = req.status === 'check';
  const borderClass = req.status === 'active' ? 'approved' : req.status === 'rejected' ? 'rejected' : '';
  const actionBadge = req.action === 'new'
    ? '<span class="badge badge-new">Neu</span>'
    : '<span class="badge badge-change">Änderung</span>';
  const statusBadge = req.status === 'check'
    ? '<span class="badge badge-check">Zur Prüfung</span>'
    : req.status === 'active'
      ? '<span class="badge badge-active">Genehmigt</span>'
      : '<span class="badge badge-rejected">Abgelehnt</span>';

  return `
    <div class="req-card ${borderClass}">
      <div class="req-header">${actionBadge}${statusBadge}</div>
      <div class="req-name">${escHtml(req.material.Materialname)}</div>
      <div class="req-meta">${escHtml(req.material.Hersteller) || '—'} · ${new Date(req.createdAt).toLocaleString('de-DE')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:.25rem">
        ${req.material.Eigenschaften.map(p => `
          <span class="prop-tag">${escHtml(p.name)}: ${escHtml(p.wert)}${p.einheit ? ' ' + escHtml(p.einheit) : ''}</span>
        `).join('')}
      </div>
      ${req.material.Link.length > 0 ? `<div style="font-size:.75rem;color:var(--fg-muted);margin-top:.25rem">Links: ${req.material.Link.map(l => escHtml(l.text)).join(', ')}</div>` : ''}
      ${req.note ? `<div style="font-size:.75rem;color:var(--fg-muted);font-style:italic;margin-top:.25rem">Notiz: ${escHtml(req.note)}</div>` : ''}
      ${isPending ? `
        <div class="req-actions">
          <button class="btn btn-primary btn-sm" data-approve="${req.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Genehmigen
          </button>
          <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:rgba(239,68,68,0.3)" data-reject="${req.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Ablehnen
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

async function approveRequest(id) {
  try {
    await apiFetch(`${API}/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approveRequestId: id })
    });
    renderDashboard();
  } catch {
    alert('Fehler beim Genehmigen');
  }
}

async function rejectRequest(id) {
  try {
    await apiFetch(`${API}/requests`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'rejected' })
    });
    renderDashboard();
  } catch {
    alert('Fehler beim Ablehnen');
  }
}

// ===== UTILS =====
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== START =====
if (checkAuth()) {
  renderDashboard();
}
