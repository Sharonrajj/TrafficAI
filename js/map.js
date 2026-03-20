/**
 * TrafficAI – Google Maps Integration
 * Real Google Maps JavaScript API with incident markers, info windows,
 * severity-based custom pins, traffic layer, and geolocation.
 *
 * Replace YOUR_GOOGLE_MAPS_API_KEY in map.html with your actual API key.
 */

'use strict';

/* ── Global map state ───────────────────────────────────────────────────── */
let gmap              = null;   // Google Map instance
let markers           = [];     // Array of { marker, infoWindow, incident }
let trafficLayer      = null;
let heatmapLayer      = null;
let currentFilter     = { severity: 'all', type: 'all' };
let userLocationMarker = null;

/* ── Severity → visual config ────────────────────────────────────────────── */
const SEVERITY_CONFIG = {
  critical: { color: '#FF1744', glyph: '🚨', zIndex: 100, scale: 1.4 },
  high:     { color: '#FF6B35', glyph: '⚠️',  zIndex: 80,  scale: 1.2 },
  medium:   { color: '#FFA726', glyph: '🔶', zIndex: 60,  scale: 1.0 },
  low:      { color: '#00C853', glyph: '🔹', zIndex: 40,  scale: 0.9 }
};

const TYPE_ICONS = {
  accident:         '💥',
  congestion:       '🚦',
  emergency:        '🚑',
  hazard:           '⚠️',
  stalled_vehicle:  '🚗',
  weather:          '🌧️',
  unknown:          '📍'
};

/* ── Demo incident data (replaces with Firestore in production) ────────────── */
const DEMO_INCIDENTS = [
  {
    id: 'INC-001', type: 'accident', severity: 'critical',
    title: 'Multi-vehicle collision – Highway 101',
    description: 'Severe 3-car accident blocking 2 lanes. Ambulance dispatched. EV detected at scene.',
    lat: 37.7749, lng: -122.4194,  // San Francisco
    confidence: 0.96, status: 'active', time: '2 min ago', actions: ['Signal adjusted', 'Reroute active', 'Authorities alerted']
  },
  {
    id: 'INC-002', type: 'congestion', severity: 'high',
    title: 'Heavy congestion – Bay Bridge approach',
    description: 'Traffic backed up 2.3km. Estimated 34 min delay.',
    lat: 37.7983, lng: -122.3778,
    confidence: 0.88, status: 'active', time: '8 min ago', actions: ['Reroute suggested via I-80']
  },
  {
    id: 'INC-003', type: 'hazard', severity: 'medium',
    title: 'Road debris – Market Street',
    description: 'Large debris blocking right lane. Works crew en route.',
    lat: 37.7792, lng: -122.4181,
    confidence: 0.74, status: 'monitoring', time: '15 min ago', actions: ['Maintenance alerted']
  },
  {
    id: 'INC-004', type: 'emergency', severity: 'critical',
    title: 'Emergency vehicle response – UCSF',
    description: 'Ambulance corridor activated. Signal preemption on Medical Center Drive.',
    lat: 37.7631, lng: -122.4580,
    confidence: 0.99, status: 'active', time: '5 min ago', actions: ['EV corridor active', 'All signals preempted']
  },
  {
    id: 'INC-005', type: 'accident', severity: 'high',
    title: 'Side-impact collision – Geary Blvd',
    description: 'Two vehicles, possible injuries. Police responding.',
    lat: 37.7827, lng: -122.4315,
    confidence: 0.91, status: 'active', time: '11 min ago', actions: ['Police dispatched', 'Signal adjusted']
  },
  {
    id: 'INC-006', type: 'congestion', severity: 'low',
    title: 'Minor slowdown – Castro District',
    description: 'Light congestion due to pedestrian events. Clearing shortly.',
    lat: 37.7609, lng: -122.4350,
    confidence: 0.65, status: 'monitoring', time: '20 min ago', actions: ['Monitoring']
  },
  {
    id: 'INC-007', type: 'stalled_vehicle', severity: 'medium',
    title: 'Stalled vehicle – Golden Gate Bridge approach',
    description: 'Stalled truck on right shoulder. CHP responding.',
    lat: 37.8077, lng: -122.4750,
    confidence: 0.81, status: 'active', time: '7 min ago', actions: ['CHP notified']
  }
];

/* ── Initialize Google Map ─────────────────────────────────────────────── */
window.initTrafficMap = async function () {
  const { Map, TrafficLayer } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary('marker');

  const mapEl = document.getElementById('mapContainer');

  gmap = new Map(mapEl, {
    center: { lat: 37.7749, lng: -122.4194 }, // San Francisco
    zoom: 13,
    mapId: 'trafficai_map',
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: false,            // we use custom controls
    gestureHandling: 'greedy',
    styles: DARK_MAP_STYLES        // Custom dark theme
  });

  // Live traffic layer from Google
  trafficLayer = new TrafficLayer();
  trafficLayer.setMap(gmap);

  // Remove the old canvas element if present
  const canvas = document.getElementById('mapCanvas');
  if (canvas) canvas.remove();

  // Render incidents
  renderIncidentMarkers({ Map, AdvancedMarkerElement, PinElement });
  renderIncidentList(DEMO_INCIDENTS);

  // Wire up controls
  initMapControls();
  initFilters();
  initGeolocation();
  startLiveRefresh();
};

/* ── Create custom styled markers ─────────────────────────────────────────── */
function renderIncidentMarkers({ AdvancedMarkerElement, PinElement }) {
  // Clear old markers
  markers.forEach(m => m.marker.map = null);
  markers = [];

  const filtered = DEMO_INCIDENTS.filter(inc =>
    (currentFilter.severity === 'all' || inc.severity === currentFilter.severity) &&
    (currentFilter.type === 'all' || inc.type === currentFilter.type)
  );

  filtered.forEach(incident => {
    const cfg = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.low;

    // Build pin element
    const pin = new PinElement({
      background:  cfg.color,
      borderColor: '#fff',
      glyphColor:  '#fff',
      glyph:       TYPE_ICONS[incident.type] || '📍',
      scale:       cfg.scale
    });

    const marker = new AdvancedMarkerElement({
      map:      gmap,
      position: { lat: incident.lat, lng: incident.lng },
      title:    incident.title,
      content:  pin.element,
      zIndex:   cfg.zIndex
    });

    // Info window content
    const infoContent = buildInfoWindowContent(incident);
    const infoWindow = new google.maps.InfoWindow({
      content:     infoContent,
      maxWidth:    320,
      ariaLabel:   incident.title
    });

    marker.addListener('click', () => {
      // Close all other info windows first
      markers.forEach(m => m.infoWindow.close());
      infoWindow.open({ map: gmap, anchor: marker });
      highlightListItem(incident.id);
    });

    // Animate in
    marker.content.style.opacity = '0';
    marker.content.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      marker.content.style.transition = 'all 0.4s ease';
      marker.content.style.opacity = '1';
      marker.content.style.transform = 'translateY(0)';
    }, Math.random() * 600);

    markers.push({ marker, infoWindow, incident });
  });
}

/* ── Info window HTML ────────────────────────────────────────────────────── */
function buildInfoWindowContent(incident) {
  const cfg = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.low;
  return `
    <div style="font-family:'Inter',sans-serif;padding:8px;max-width:300px;color:#1e293b">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:1.2rem">${TYPE_ICONS[incident.type] || '📍'}</span>
        <span style="background:${cfg.color};color:#fff;padding:2px 8px;border-radius:12px;font-size:0.7rem;font-weight:700;text-transform:uppercase">${incident.severity}</span>
        <span style="color:#64748b;font-size:0.75rem">${incident.time}</span>
      </div>
      <h3 style="margin:0 0 6px;font-size:0.9rem;font-weight:700;line-height:1.3">${incident.title}</h3>
      <p style="margin:0 0 8px;font-size:0.8rem;color:#475569;line-height:1.4">${incident.description}</p>
      <div style="margin:0 0 8px">
        <div style="font-size:0.75rem;color:#64748b;margin-bottom:3px">AI Confidence</div>
        <div style="background:#e2e8f0;border-radius:8px;height:6px;overflow:hidden">
          <div style="background:${cfg.color};width:${Math.round(incident.confidence * 100)}%;height:100%;border-radius:8px"></div>
        </div>
        <div style="font-size:0.7rem;color:#475569;margin-top:2px">${Math.round(incident.confidence * 100)}%</div>
      </div>
      ${incident.actions.map(a =>
        `<span style="display:inline-block;background:#f1f5f9;color:#334155;padding:2px 8px;border-radius:10px;font-size:0.7rem;margin:2px 2px 0 0">✓ ${a}</span>`
      ).join('')}
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid #e2e8f0">
        <span style="font-size:0.7rem;color:#94a3b8">ID: ${incident.id}</span>
        <span style="float:right;font-size:0.7rem;background:${incident.status === 'active' ? '#dcfce7' : '#fef9c3'};color:${incident.status === 'active' ? '#166534' : '#854d0e'};padding:1px 6px;border-radius:8px">${incident.status}</span>
      </div>
    </div>
  `;
}

/* ── Incident Sidebar List ─────────────────────────────────────────────── */
function renderIncidentList(incidents) {
  const list = document.getElementById('incidentList');
  if (!list) return;

  const filtered = incidents.filter(inc =>
    (currentFilter.severity === 'all' || inc.severity === currentFilter.severity) &&
    (currentFilter.type === 'all' || inc.type === currentFilter.type)
  );

  document.getElementById('liveCount').textContent = `${filtered.length} Active Incidents`;
  document.getElementById('totalCount').textContent = filtered.length;
  document.getElementById('criticalCount').textContent = filtered.filter(i => i.severity === 'critical').length;
  document.getElementById('resolvedCount').textContent = DEMO_INCIDENTS.filter(i => i.status === 'resolved').length;

  list.innerHTML = filtered.length === 0
    ? `<div style="text-align:center;padding:2rem;color:var(--text-muted)">No incidents match current filters</div>`
    : filtered.map(inc => {
        const cfg = SEVERITY_CONFIG[inc.severity] || SEVERITY_CONFIG.low;
        return `
          <div class="incident-item" role="listitem" data-id="${inc.id}"
               tabindex="0" aria-label="${inc.title}, ${inc.severity} severity"
               style="cursor:pointer">
            <div class="incident-item-header">
              <div class="incident-item-icon" style="background:${cfg.color}22;color:${cfg.color}">
                ${TYPE_ICONS[inc.type] || '📍'}
              </div>
              <div class="incident-item-info">
                <div class="incident-item-title">${inc.title}</div>
                <div class="incident-item-meta">
                  <span class="severity-badge severity-${inc.severity}">${inc.severity}</span>
                  <span class="incident-item-time">${inc.time}</span>
                </div>
              </div>
            </div>
            <div class="incident-item-confidence">
              <div class="confidence-bar">
                <div class="confidence-fill" style="width:${Math.round(inc.confidence * 100)}%;background:${cfg.color}"></div>
              </div>
              <span class="confidence-label">${Math.round(inc.confidence * 100)}% confidence</span>
            </div>
          </div>
        `;
      }).join('');

  // Click to pan map and open info window
  list.querySelectorAll('.incident-item').forEach(el => {
    const onClick = () => {
      const id = el.dataset.id;
      const found = markers.find(m => m.incident.id === id);
      if (found) {
        gmap.panTo(found.marker.position);
        gmap.setZoom(15);
        markers.forEach(m => m.infoWindow.close());
        found.infoWindow.open({ map: gmap, anchor: found.marker });
      }
    };
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') onClick(); });
  });
}

function highlightListItem(id) {
  document.querySelectorAll('.incident-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
}

/* ── Custom map controls ─────────────────────────────────────────────────── */
function initMapControls() {
  document.getElementById('zoomIn')?.addEventListener('click', () => gmap.setZoom(gmap.getZoom() + 1));
  document.getElementById('zoomOut')?.addEventListener('click', () => gmap.setZoom(gmap.getZoom() - 1));
  document.getElementById('refreshMap')?.addEventListener('click', () => {
    renderIncidentMarkers({ AdvancedMarkerElement: google.maps.marker.AdvancedMarkerElement,
                            PinElement: google.maps.marker.PinElement });
    renderIncidentList(DEMO_INCIDENTS);
    if (window.Toast) Toast.show('Map Refreshed', 'Incident data updated', 'success', 2000);
  });

  // Traffic layer toggle button (if exists)
  const trafficToggle = document.getElementById('trafficToggle');
  if (trafficToggle) {
    let trafficOn = true;
    trafficToggle.addEventListener('click', () => {
      trafficOn = !trafficOn;
      trafficLayer.setMap(trafficOn ? gmap : null);
      trafficToggle.setAttribute('aria-pressed', String(trafficOn));
      trafficToggle.title = trafficOn ? 'Hide traffic layer' : 'Show traffic layer';
    });
  }
}

/* ── Filters ─────────────────────────────────────────────────────────────── */
function initFilters() {
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      currentFilter.severity = btn.dataset.filter;
      refreshMapData();
    });
  });

  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('[data-type]').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      currentFilter.type = btn.dataset.type;
      refreshMapData();
    });
  });
}

async function refreshMapData() {
  const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary('marker');
  renderIncidentMarkers({ AdvancedMarkerElement, PinElement });
  renderIncidentList(DEMO_INCIDENTS);
}

/* ── Geolocation ─────────────────────────────────────────────────────────── */
function initGeolocation() {
  const btn = document.getElementById('myLocation');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      if (window.Toast) Toast.show('Not Available', 'Geolocation not supported by your browser', 'warning', 3000);
      return;
    }
    btn.setAttribute('aria-label', 'Locating...');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        gmap.panTo(loc);
        gmap.setZoom(14);
        // Add user location marker
        if (userLocationMarker) userLocationMarker.map = null;
        const pulse = document.createElement('div');
        pulse.style.cssText = `
          width:20px;height:20px;border-radius:50%;
          background:#4285F4;border:3px solid #fff;
          box-shadow:0 0 0 0 #4285F4;
          animation:pulse-blue 2s infinite;
        `;
        const style = document.createElement('style');
        style.textContent = `@keyframes pulse-blue {
          0%   { box-shadow: 0 0 0 0 rgba(66,133,244,0.6); }
          70%  { box-shadow: 0 0 0 14px rgba(66,133,244,0); }
          100% { box-shadow: 0 0 0 0 rgba(66,133,244,0); }
        }`;
        document.head.appendChild(style);

        google.maps.importLibrary('marker').then(({ AdvancedMarkerElement }) => {
          userLocationMarker = new AdvancedMarkerElement({
            map: gmap, position: loc, content: pulse, title: 'You are here', zIndex: 200
          });
        });
        btn.setAttribute('aria-label', 'Center map on my location');
        if (window.Toast) Toast.show('Location Found', 'Map centered on your current position', 'success', 2000);
      },
      err => {
        btn.setAttribute('aria-label', 'Center map on my location');
        if (window.Toast) Toast.show('Location Error', err.message, 'error', 3000);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

/* ── Live refresh simulation (polls every 30s in production → Firestore) ── */
function startLiveRefresh() {
  setInterval(() => {
    const badge = document.getElementById('liveCount');
    if (badge) {
      badge.textContent = `${markers.length} Active Incidents · Updated just now`;
    }
    // In production: this would call firebase onSnapshot listener
  }, 30000);
}

/* ── Dark map style ──────────────────────────────────────────────────────── */
const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f2027' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#1e3a5f' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c1a2e' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1e3a5f' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#0c1a2e' }] }
];
