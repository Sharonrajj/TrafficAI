/**
 * TrafficAI - Live Map JavaScript
 * Canvas-based traffic visualization map with incident pins
 * In production: Google Maps Platform with Traffic Layer
 */

'use strict';

/* =============================================
   MAP STATE
   ============================================= */
const MapState = {
  zoom: 1.0,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  lastX: 0,
  lastY: 0,
  selectedIncident: null,
  incidents: [],
  filteredIncidents: [],
  filterSeverity: 'all',
  filterType: 'all',
  animFrame: null,
  pulsePhase: 0
};


/* =============================================
   FAKE "MAP" RENDERER (Canvas)
   Replaces with Google Maps if API key available
   ============================================= */
const MapRenderer = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setupInteraction();
    this.render();
  },

  resize() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
  },

  // Convert lat/lng to canvas coords (approximation for SF area)
  latLngToCanvas(lat, lng) {
    // SF bounding box approx: lat 37.7-37.82, lng -122.35 to -122.52
    const centerLat = 37.77;
    const centerLng = -122.43;
    const scale = 1800;

    const x = this.width / 2 + (lng - centerLng) * scale * this.width / 800 * this.zoom + MapState.offsetX;
    const y = this.height / 2 - (lat - centerLat) * scale * this.height / 600 * this.zoom + MapState.offsetY;
    return { x, y };
  },

  drawBackground() {
    const ctx = this.ctx;
    // Dark map background
    ctx.fillStyle = '#0a1422';
    ctx.fillRect(0, 0, this.width, this.height);

    // Grid lines (streets simulation)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;

    const cols = 20;
    const rows = 15;
    const colW = this.width / cols;
    const rowH = this.height / rows;

    for (let i = 0; i <= cols; i++) {
      const x = i * colW + MapState.offsetX * 0.1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      const y = j * rowH + MapState.offsetY * 0.1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Major roads
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 3;
    const roadPaths = [
      [[0, this.height * 0.42], [this.width, this.height * 0.42]],
      [[0, this.height * 0.62], [this.width, this.height * 0.62]],
      [[this.width * 0.3, 0], [this.width * 0.3, this.height]],
      [[this.width * 0.65, 0], [this.width * 0.65, this.height]],
      [[0, this.height * 0.25], [this.width * 0.5, this.height * 0.55]],
      [[this.width * 0.4, 0], [this.width, this.height * 0.7]]
    ];
    roadPaths.forEach(([start, end]) => {
      ctx.beginPath();
      ctx.moveTo(start[0] + MapState.offsetX * 0.05, start[1] + MapState.offsetY * 0.05);
      ctx.lineTo(end[0] + MapState.offsetX * 0.05, end[1] + MapState.offsetY * 0.05);
      ctx.stroke();
    });

    // Traffic flow lines (animated)
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.15)';
    ctx.lineWidth = 2;
    const t = Date.now() / 2000;
    for (let i = 0; i < 5; i++) {
      const y = (this.height * (0.3 + i * 0.1) + Math.sin(t + i) * 5 + MapState.offsetY * 0.05);
      ctx.beginPath();
      ctx.setLineDash([15, 25]);
      ctx.lineDashOffset = -((Date.now() / 100 + i * 50) % 40);
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // City area overlay (greenish)
    const gradient = ctx.createRadialGradient(
      this.width * 0.45, this.height * 0.5, 20,
      this.width * 0.45, this.height * 0.5, this.width * 0.42
    );
    gradient.addColorStop(0, 'rgba(0, 50, 30, 0.08)');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  },

  drawIncidentPin(incident) {
    const ctx = this.ctx;
    const pos = this.latLngToCanvas(incident.coordinates.lat, incident.coordinates.lng);
    const color = window.TrafficAI.getSeverityColor(incident.severity);
    const isSelected = MapState.selectedIncident?.id === incident.id;
    const pulse = (Math.sin(MapState.pulsePhase + Math.random() * 0.5) + 1) / 2;
    const radius = isSelected ? 14 : 10;

    // Pulse ring
    if (incident.severity === 'critical' || incident.status === 'active') {
      const ringRadius = radius + 8 + pulse * 12;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ringRadius, 0, Math.PI * 2);
      ctx.fillStyle = `${color}${Math.floor(20 * (1 - pulse)).toString(16).padStart(2, '0')}`;
      ctx.fill();
    }

    // Outer circle
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = `${color}33`;
    ctx.fill();

    // Main dot
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    const pinGrad = ctx.createRadialGradient(pos.x - 2, pos.y - 2, 0, pos.x, pos.y, radius);
    pinGrad.addColorStop(0, color);
    pinGrad.addColorStop(1, `${color}88`);
    ctx.fillStyle = pinGrad;
    ctx.fill();

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = isSelected ? 20 : 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Icon
    ctx.fillStyle = 'white';
    ctx.font = `${radius - 2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(window.TrafficAI.getTypeIcon(incident.type), pos.x, pos.y);

    // Label on hover/select
    if (isSelected) {
      ctx.fillStyle = 'rgba(10, 22, 40, 0.9)';
      const labelW = 140;
      const labelH = 36;
      const lx = pos.x - labelW / 2;
      const ly = pos.y - radius - labelH - 8;
      this.roundRect(ctx, lx, ly, labelW, labelH, 6);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = 'white';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(incident.title.substring(0, 18) + '...', pos.x, ly + 14);
      ctx.fillStyle = color;
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText(incident.severity.toUpperCase(), pos.x, ly + 27);
    }

    // Store click target
    incident._canvasPos = pos;
    incident._canvasRadius = radius + 5;
  },

  drawReroutes() {
    const ctx = this.ctx;
    const t = Date.now() / 3000;

    // Draw 3 sample reroute paths
    const routes = [
      { from: { lat: 37.798, lng: -122.378 }, to: { lat: 37.780, lng: -122.450 }, via: { lat: 37.810, lng: -122.420 } },
      { from: { lat: 37.784, lng: -122.408 }, to: { lat: 37.760, lng: -122.395 }, via: { lat: 37.770, lng: -122.425 } }
    ];

    routes.forEach((route, idx) => {
      const from = this.latLngToCanvas(route.from.lat, route.from.lng);
      const via = this.latLngToCanvas(route.via.lat, route.via.lng);
      const to = this.latLngToCanvas(route.to.lat, route.to.lng);

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(via.x, via.y, to.x, to.y);
      ctx.strokeStyle = '#7c3aed44';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 12]);
      ctx.lineDashOffset = -(t * 50 + idx * 30);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrow at end
      ctx.fillStyle = '#7c3aed';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('→', to.x, to.y);
    });
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  },

  setupInteraction() {
    const canvas = this.canvas;

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Check incident hits
      let hit = null;
      for (const inc of MapState.filteredIncidents) {
        if (!inc._canvasPos) continue;
        const dx = mx - inc._canvasPos.x;
        const dy = my - inc._canvasPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < (inc._canvasRadius || 15)) {
          hit = inc;
          break;
        }
      }

      if (hit) {
        MapState.selectedIncident = hit;
        showIncidentPopup(hit);
        selectIncidentInList(hit.id);
      } else {
        MapState.selectedIncident = null;
        const popup = document.getElementById('incidentPopup');
        if (popup) popup.hidden = true;
      }
    });

    // Pan support
    canvas.addEventListener('mousedown', (e) => {
      MapState.isDragging = true;
      MapState.lastX = e.clientX;
      MapState.lastY = e.clientY;
    });
    canvas.addEventListener('mousemove', (e) => {
      if (!MapState.isDragging) return;
      MapState.offsetX += e.clientX - MapState.lastX;
      MapState.offsetY += e.clientY - MapState.lastY;
      MapState.lastX = e.clientX;
      MapState.lastY = e.clientY;
    });
    canvas.addEventListener('mouseup', () => MapState.isDragging = false);
    canvas.addEventListener('mouseleave', () => MapState.isDragging = false);
  },

  render() {
    MapState.pulsePhase += 0.04;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawBackground();
    this.drawReroutes();

    MapState.filteredIncidents.forEach(inc => this.drawIncidentPin(inc));

    MapState.animFrame = requestAnimationFrame(() => this.render());
  }
};


/* =============================================
   INCIDENT LIST (Sidebar)
   ============================================= */
function renderIncidentList() {
  const list = document.getElementById('incidentList');
  if (!list) return;

  list.innerHTML = '';
  if (!MapState.filteredIncidents.length) {
    list.innerHTML = '<div style="text-align:center;color:#475569;font-size:0.875rem;padding:2rem">No matching incidents</div>';
    return;
  }

  MapState.filteredIncidents.forEach((incident, i) => {
    const item = document.createElement('div');
    item.className = `map-incident-item ${incident.severity}`;
    item.setAttribute('role', 'listitem');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `${incident.severity} severity: ${incident.title} at ${incident.location}`);
    item.dataset.id = incident.id;
    item.style.animationDelay = `${i * 0.05}s`;
    item.style.opacity = '0';
    item.style.animation = `fadeIn 0.3s ${i * 0.05}s ease both`;

    item.innerHTML = `
      <div class="map-incident-title">
        <span>${incident.title}</span>
        <span class="severity-badge ${incident.severity}">${incident.severity}</span>
      </div>
      <div class="map-incident-sub">
        <span>${window.TrafficAI.getTypeIcon(incident.type)}</span>
        <span>${incident.location}</span>
        <span class="incident-time">· ${window.TrafficAI.formatTimeAgo(incident.reportedAt)}</span>
      </div>
    `;

    item.addEventListener('click', () => {
      MapState.selectedIncident = incident;
      showIncidentPopup(incident);
      selectIncidentInList(incident.id);
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') item.click();
    });

    list.appendChild(item);
  });

  // Update counts
  const total = MapState.incidents.filter(i => i.status === 'active' || i.status === 'monitoring').length;
  const critical = MapState.incidents.filter(i => i.severity === 'critical' && i.status === 'active').length;
  const resolved = MapState.incidents.filter(i => i.status === 'resolved').length;

  const el = (id) => document.getElementById(id);
  if (el('totalCount')) el('totalCount').textContent = total;
  if (el('criticalCount')) el('criticalCount').textContent = critical;
  if (el('resolvedCount')) el('resolvedCount').textContent = resolved;
  if (el('liveCount')) el('liveCount').textContent = `${MapState.filteredIncidents.length} incident${MapState.filteredIncidents.length !== 1 ? 's' : ''}`;
}

function selectIncidentInList(id) {
  document.querySelectorAll('.map-incident-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.id === id);
  });
}


/* =============================================
   INCIDENT POPUP
   ============================================= */
function showIncidentPopup(incident) {
  const popup = document.getElementById('incidentPopup');
  const content = document.getElementById('popupContent');
  if (!popup || !content) return;

  content.innerHTML = `
    <div style="margin-bottom:0.75rem">
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
        <span>${window.TrafficAI.getTypeIcon(incident.type)}</span>
        <span style="font-weight:700;font-size:0.9375rem">${incident.title}</span>
        <span class="severity-badge ${incident.severity}">${incident.severity}</span>
      </div>
      <div style="font-size:0.75rem;color:#94a3b8">📍 ${incident.location}</div>
    </div>
    <p style="font-size:0.8125rem;color:#94a3b8;margin-bottom:0.75rem;line-height:1.6">${incident.description}</p>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem">
      <span class="tag">Confidence: ${Math.round(incident.confidence * 100)}%</span>
      <span class="tag">${incident.status}</span>
      <span class="tag">${window.TrafficAI.formatTimeAgo(incident.reportedAt)}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:0.375rem">
      ${(incident.actions || []).map(action => `
        <div style="font-size:0.75rem;color:#64748b;padding:0.25rem 0;border-bottom:1px solid rgba(255,255,255,0.05)">
          ✓ ${typeof action === 'string' ? action.replace(/_/g, ' ') : action.text || action}
        </div>
      `).join('')}
    </div>
  `;

  popup.hidden = false;
}


/* =============================================
   FILTERS
   ============================================= */
function initFilters() {
  // Severity chips
  document.querySelectorAll('.chip[data-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-filter]').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-pressed', 'true');
      MapState.filterSeverity = chip.dataset.filter;
      applyFilters();
    });
  });

  // Type chips
  document.querySelectorAll('.chip[data-type]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-type]').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-pressed', 'true');
      MapState.filterType = chip.dataset.type;
      applyFilters();
    });
  });
}

function applyFilters() {
  MapState.filteredIncidents = window.TrafficAI.getIncidents({
    severity: MapState.filterSeverity,
    type: MapState.filterType
  }).filter(i => i.status !== 'resolved' || MapState.filterSeverity !== 'all');
  renderIncidentList();
}


/* =============================================
   MAP CONTROLS
   ============================================= */
function initMapControls() {
  document.getElementById('zoomIn')?.addEventListener('click', () => {
    MapState.zoom = Math.min(MapState.zoom * 1.3, 5);
  });
  document.getElementById('zoomOut')?.addEventListener('click', () => {
    MapState.zoom = Math.max(MapState.zoom / 1.3, 0.4);
  });
  document.getElementById('myLocation')?.addEventListener('click', () => {
    MapState.offsetX = 0;
    MapState.offsetY = 0;
    MapState.zoom = 1;
    Toast.show('Map Reset', 'Centered on current area', 'info', 2000);
  });
  document.getElementById('refreshMap')?.addEventListener('click', () => {
    loadIncidents();
    Toast.show('Map Refreshed', 'Live data updated', 'success', 2000);
  });

  // Popup close
  document.getElementById('popupClose')?.addEventListener('click', () => {
    const popup = document.getElementById('incidentPopup');
    if (popup) popup.hidden = true;
    MapState.selectedIncident = null;
  });
}


/* =============================================
   LOAD DATA
   ============================================= */
function loadIncidents() {
  MapState.incidents = window.TrafficAI.incidents;
  MapState.filteredIncidents = MapState.incidents.filter(i => i.status !== 'resolved');
  renderIncidentList();
}


/* =============================================
   AUTO REFRESH
   ============================================= */
function startAutoRefresh() {
  setInterval(() => {
    // Simulate occasional new incident
    if (Math.random() < 0.3) {
      loadIncidents();
    }
  }, 30000);
}


/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  // Wait for TrafficAI to load
  setTimeout(() => {
    loadIncidents();
    initFilters();
    initMapControls();
    MapRenderer.init('mapCanvas');
    startAutoRefresh();
  }, 100);
});
