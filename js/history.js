/**
 * TrafficAI - History Page JavaScript
 * Incident listing, filtering, search, modal detail view
 */

'use strict';

/* =============================================
   STATE
   ============================================= */
const HistoryState = {
  incidents: [],
  filtered: [],
  page: 0,
  pageSize: 12,
  viewMode: 'grid',
  filters: {
    search: '',
    severity: 'all',
    type: 'all',
    status: 'all',
    date: 'today'
  }
};


/* =============================================
   RENDER INCIDENT CARDS
   ============================================= */
function renderIncidents(append = false) {
  const container = document.getElementById('incidentsContainer');
  if (!container) return;

  if (!append) container.innerHTML = '';

  const start = HistoryState.page * HistoryState.pageSize;
  const end = start + HistoryState.pageSize;
  const page = HistoryState.filtered.slice(start, end);

  if (!append && !page.length) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:4rem 2rem;color:#475569">
        <div style="font-size:3rem;margin-bottom:1rem">🔍</div>
        <div style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem">No incidents found</div>
        <div style="font-size:0.875rem">Try adjusting your filters or search query</div>
      </div>
    `;
    document.getElementById('loadMoreArea').style.display = 'none';
    return;
  }

  page.forEach((incident, i) => {
    const card = document.createElement('div');
    card.className = `history-card ${incident.severity}`;
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${incident.severity} severity incident: ${incident.title}`);
    card.dataset.id = incident.id;
    card.style.animationDelay = `${i * 0.05}s`;

    const inputBadges = (incident.inputTypes || ['text'])
      .map(t => ({ photo: '📷', video: '🎥', voice: '🎙️', text: '💬' }[t] || '📄'))
      .join('');

    card.innerHTML = `
      <div class="history-card-header">
        <div>
          <div class="history-card-title">${window.TrafficAI.getTypeIcon(incident.type)} ${incident.title}</div>
          <div class="incident-meta" style="margin-top:0.25rem">
            <span class="severity-badge ${incident.severity}">${incident.severity}</span>
            <span class="tag" style="font-size:0.7rem">${incident.type}</span>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="incident-confidence">${Math.round(incident.confidence * 100)}%</div>
          <div style="font-size:0.6875rem;color:#475569;margin-top:2px">${inputBadges}</div>
        </div>
      </div>
      <div class="history-card-body">
        <div class="history-card-location">
          📍 ${incident.location}
        </div>
        <div class="history-card-desc">${incident.description}</div>
      </div>
      <div class="history-card-footer">
        <div class="history-card-time">${window.TrafficAI.formatTime(incident.reportedAt)} · ${window.TrafficAI.formatTimeAgo(incident.reportedAt)}</div>
        <div class="history-card-status ${incident.status}">${incident.status}</div>
      </div>
    `;

    card.addEventListener('click', () => openModal(incident));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(incident); });

    container.appendChild(card);
  });

  // Show/hide load more
  const loadMoreArea = document.getElementById('loadMoreArea');
  if (loadMoreArea) {
    loadMoreArea.style.display = end < HistoryState.filtered.length ? 'block' : 'none';
  }

  // Update results count
  const resultsCount = document.getElementById('resultsCount');
  if (resultsCount) {
    resultsCount.textContent = `Showing ${Math.min(end, HistoryState.filtered.length)} of ${HistoryState.filtered.length} incident${HistoryState.filtered.length !== 1 ? 's' : ''}`;
  }
}


/* =============================================
   FILTERS & SEARCH
   ============================================= */
function initFilters() {
  const search = document.getElementById('searchInput');
  const severity = document.getElementById('filterSeverity');
  const type = document.getElementById('filterType');
  const status = document.getElementById('filterStatus');
  const date = document.getElementById('filterDate');
  const clearBtn = document.getElementById('clearFilters');

  const applyFilters = () => {
    HistoryState.page = 0;
    HistoryState.filtered = window.TrafficAI.getIncidents({
      search: HistoryState.filters.search,
      severity: HistoryState.filters.severity,
      type: HistoryState.filters.type,
      status: HistoryState.filters.status
    });
    renderIncidents(false);
  };

  if (search) {
    let debounceTimer;
    search.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        HistoryState.filters.search = search.value.trim();
        applyFilters();
      }, 300);
    });
  }

  [{ el: severity, key: 'severity' }, { el: type, key: 'type' }, { el: status, key: 'status' }, { el: date, key: 'date' }]
    .forEach(({ el, key }) => {
      if (el) el.addEventListener('change', () => {
        HistoryState.filters[key] = el.value;
        applyFilters();
      });
    });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      HistoryState.filters = { search: '', severity: 'all', type: 'all', status: 'all', date: 'today' };
      if (search) search.value = '';
      if (severity) severity.value = 'all';
      if (type) type.value = 'all';
      if (status) status.value = 'all';
      if (date) date.value = 'today';
      applyFilters();
    });
  }
}


/* =============================================
   VIEW MODES (Grid / List)
   ============================================= */
function initViewToggle() {
  const gridBtn = document.getElementById('gridView');
  const listBtn = document.getElementById('listView');
  const container = document.getElementById('incidentsContainer');

  gridBtn?.addEventListener('click', () => {
    HistoryState.viewMode = 'grid';
    container?.classList.remove('list-view');
    container?.classList.add('grid-view');
    gridBtn.classList.add('active');
    gridBtn.setAttribute('aria-pressed', 'true');
    listBtn?.classList.remove('active');
    listBtn?.setAttribute('aria-pressed', 'false');
  });

  listBtn?.addEventListener('click', () => {
    HistoryState.viewMode = 'list';
    container?.classList.remove('grid-view');
    container?.classList.add('list-view');
    listBtn.classList.add('active');
    listBtn.setAttribute('aria-pressed', 'true');
    gridBtn?.classList.remove('active');
    gridBtn?.setAttribute('aria-pressed', 'false');
  });
}


/* =============================================
   LOAD MORE
   ============================================= */
function initLoadMore() {
  const btn = document.getElementById('loadMoreBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    HistoryState.page++;
    renderIncidents(true);
  });
}


/* =============================================
   MODAL DETAIL VIEW
   ============================================= */
function openModal(incident) {
  const overlay = document.getElementById('modalOverlay');
  const body = document.getElementById('modalBody');
  if (!overlay || !body) return;

  const actions = (incident.actions || []).map(a =>
    typeof a === 'string' ? a.replace(/_/g, ' ') : a.text || a
  );

  body.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:0.75rem;margin-bottom:1.25rem">
      <span style="font-size:2rem">${window.TrafficAI.getTypeIcon(incident.type)}</span>
      <div>
        <h2>${incident.title}</h2>
        <div style="display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap">
          <span class="severity-badge ${incident.severity}">${incident.severity}</span>
          <span class="tag">${incident.type}</span>
          <span class="history-card-status ${incident.status}" style="display:inline-block">${incident.status}</span>
        </div>
      </div>
    </div>

    <div class="modal-section">
      <h3>Incident Details</h3>
      <div class="modal-detail-grid">
        <div class="modal-detail-item"><div class="modal-detail-label">Incident ID</div><div class="modal-detail-value" style="font-family:var(--font-mono);font-size:0.8125rem;color:var(--cyan)">${incident.id}</div></div>
        <div class="modal-detail-item"><div class="modal-detail-label">Confidence</div><div class="modal-detail-value">${Math.round(incident.confidence * 100)}%</div></div>
        <div class="modal-detail-item"><div class="modal-detail-label">Reported</div><div class="modal-detail-value">${window.TrafficAI.formatTime(incident.reportedAt)}</div></div>
        <div class="modal-detail-item"><div class="modal-detail-label">Last Updated</div><div class="modal-detail-value">${window.TrafficAI.formatTimeAgo(incident.updatedAt)}</div></div>
        <div class="modal-detail-item" style="grid-column:span 2"><div class="modal-detail-label">Location</div><div class="modal-detail-value">📍 ${incident.location}</div></div>
      </div>
    </div>

    <div class="modal-section">
      <h3>AI Analysis</h3>
      <p style="font-size:0.875rem;color:#94a3b8;line-height:1.7;margin-bottom:0.75rem">${incident.description}</p>
      ${incident.geminiAnalysis ? `
        <div class="modal-detail-grid">
          ${Object.entries(incident.geminiAnalysis).map(([k, v]) => `
            <div class="modal-detail-item">
              <div class="modal-detail-label">${k.replace(/([A-Z])/g, ' $1').trim()}</div>
              <div class="modal-detail-value">${Array.isArray(v) ? v.join(', ') : v}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <div class="modal-section">
      <h3>Actions Triggered</h3>
      <div style="display:flex;flex-direction:column;gap:0.5rem">
        ${actions.map(a => `
          <div style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;color:#94a3b8">
            <span style="color:var(--green)">✓</span> ${a}
          </div>
        `).join('')}
      </div>
    </div>

    <div class="modal-section">
      <h3>Structured JSON Output</h3>
      <pre class="json-output"><code style="font-size:0.75rem">${JSON.stringify({
        incident_id: incident.id,
        type: incident.type,
        severity: incident.severity,
        confidence: incident.confidence,
        location: incident.location,
        coordinates: incident.coordinates,
        status: incident.status,
        actions: actions,
        reported_at: incident.reportedAt,
        ai_model: 'gemini-2.0-flash',
        source: 'TrafficAI'
      }, null, 2)}</code></pre>
    </div>
  `;

  overlay.hidden = false;
  document.body.style.overflow = 'hidden';

  // Trap focus in modal
  const closeBtn = document.getElementById('modalClose');
  closeBtn?.focus();
}

function initModal() {
  const overlay = document.getElementById('modalOverlay');
  const closeBtn = document.getElementById('modalClose');

  closeBtn?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.hidden = true;
  document.body.style.overflow = '';
}


/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  // Wait for TrafficAI
  setTimeout(() => {
    HistoryState.incidents = window.TrafficAI.incidents;
    HistoryState.filtered = [...HistoryState.incidents];

    initFilters();
    initViewToggle();
    initLoadMore();
    initModal();
    renderIncidents(false);
  }, 100);
});
