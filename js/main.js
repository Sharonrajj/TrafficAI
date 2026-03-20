/**
 * TrafficAI - Main JavaScript
 * Shared utilities, navigation, toast system, data store
 */

'use strict';

/* =============================================
   INCIDENT DATA STORE (Mock Firestore)
   In production: Replaced by Firestore SDK
   ============================================= */
const TrafficAI = {
  version: '1.0.0',

  /**
   * Mock incident database
   * In production: Cloud Firestore with real-time listeners
   */
  incidents: [
    {
      id: 'INC-20260320-001',
      type: 'accident',
      severity: 'high',
      status: 'active',
      title: 'Multi-vehicle collision',
      location: 'Highway 1, near Bay Bridge',
      coordinates: { lat: 37.798, lng: -122.378 },
      confidence: 0.94,
      description: 'Three-car pileup blocking two lanes, debris on road. Emergency services en route.',
      reportedAt: new Date(Date.now() - 12 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 60000).toISOString(),
      inputTypes: ['photo', 'text'],
      geminiAnalysis: {
        incidentType: 'Multi-vehicle collision',
        vehicleCount: 3,
        injuryLikelihood: 'high',
        laneBlocked: 2,
        debrisDetected: true,
        emergencyVehiclesNeeded: ['ambulance', 'police']
      },
      actions: ['signal_adjusted', 'reroute_suggested', 'authorities_alerted'],
      reportSource: 'citizen',
      weatherCondition: 'Clear',
      trafficImpactRadius: 2.1
    },
    {
      id: 'INC-20260320-002',
      type: 'congestion',
      severity: 'medium',
      status: 'monitoring',
      title: 'Severe traffic backup',
      location: 'Market Street & 5th Avenue intersection',
      coordinates: { lat: 37.784, lng: -122.408 },
      confidence: 0.88,
      description: 'Heavy congestion extending 1.5km. Signal timing issue detected.',
      reportedAt: new Date(Date.now() - 28 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 8 * 60000).toISOString(),
      inputTypes: ['voice', 'text'],
      geminiAnalysis: {
        incidentType: 'Traffic congestion',
        queueLength: '1.5km',
        estimatedDelay: '18 min',
        cause: 'signal_timing'
      },
      actions: ['signal_adjusted', 'reroute_suggested'],
      reportSource: 'citizen',
      weatherCondition: 'Cloudy',
      trafficImpactRadius: 1.5
    },
    {
      id: 'INC-20260320-003',
      type: 'emergency',
      severity: 'critical',
      status: 'active',
      title: 'Emergency vehicle corridor needed',
      location: 'Mission District, Valencia Street',
      coordinates: { lat: 37.759, lng: -122.421 },
      confidence: 0.97,
      description: 'Ambulance responding to cardiac emergency. Priority corridor required.',
      reportedAt: new Date(Date.now() - 6 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 60000).toISOString(),
      inputTypes: ['photo'],
      geminiAnalysis: {
        incidentType: 'Emergency vehicle response',
        vehicleType: 'ambulance',
        emergencyType: 'medical',
        corridorStatus: 'active'
      },
      actions: ['ev_corridor_opened', 'signal_adjusted', 'authorities_alerted', 'nearby_vehicles_warned'],
      reportSource: 'authority',
      weatherCondition: 'Clear',
      trafficImpactRadius: 0.8
    },
    {
      id: 'INC-20260320-004',
      type: 'hazard',
      severity: 'low',
      status: 'resolved',
      title: 'Road debris - right lane',
      location: 'I-280 Northbound, Mile 42',
      coordinates: { lat: 37.721, lng: -122.453 },
      confidence: 0.79,
      description: 'Tire debris in right lane. Cleared by maintenance crew.',
      reportedAt: new Date(Date.now() - 95 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 45 * 60000).toISOString(),
      inputTypes: ['photo'],
      geminiAnalysis: {
        incidentType: 'Road hazard - debris',
        hazardType: 'tire',
        lanesAffected: ['right'],
        clearanceRequired: true
      },
      actions: ['maintenance_dispatched', 'warning_signs_activated'],
      reportSource: 'citizen',
      weatherCondition: 'Sunny',
      trafficImpactRadius: 0.3
    },
    {
      id: 'INC-20260320-005',
      type: 'accident',
      severity: 'medium',
      status: 'monitoring',
      title: 'Fender bender, partial obstruction',
      location: 'Lombard Street & Van Ness Avenue',
      coordinates: { lat: 37.801, lng: -122.422 },
      confidence: 0.86,
      description: 'Two vehicles involved, minor damage. Road partially blocked.',
      reportedAt: new Date(Date.now() - 42 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 20 * 60000).toISOString(),
      inputTypes: ['video', 'text'],
      geminiAnalysis: {
        incidentType: 'Minor collision',
        vehicleCount: 2,
        injuryLikelihood: 'low',
        laneBlocked: 1,
        debrisDetected: false
      },
      actions: ['police_notified', 'reroute_suggested'],
      reportSource: 'citizen',
      weatherCondition: 'Foggy',
      trafficImpactRadius: 0.6
    },
    {
      id: 'INC-20260320-006',
      type: 'vehicle',
      severity: 'low',
      status: 'monitoring',
      title: 'Stalled vehicle, right shoulder',
      location: 'Bay Bridge, Westbound Deck',
      coordinates: { lat: 37.798, lng: -122.362 },
      confidence: 0.91,
      description: 'Vehicle stalled on right shoulder. No traffic impact currently.',
      reportedAt: new Date(Date.now() - 15 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
      inputTypes: ['text'],
      geminiAnalysis: {
        incidentType: 'Stalled vehicle',
        position: 'right shoulder',
        hazardLevel: 'low',
        towtruck: 'recommended'
      },
      actions: ['tow_truck_dispatched', 'warning_posted'],
      reportSource: 'citizen',
      weatherCondition: 'Windy',
      trafficImpactRadius: 0.2
    }
  ],

  /**
   * Get all incidents, optionally filtered
   */
  getIncidents(filters = {}) {
    let results = [...this.incidents];
    if (filters.severity && filters.severity !== 'all') {
      results = results.filter(i => i.severity === filters.severity);
    }
    if (filters.type && filters.type !== 'all') {
      results = results.filter(i => i.type === filters.type);
    }
    if (filters.status && filters.status !== 'all') {
      results = results.filter(i => i.status === filters.status);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q)
      );
    }
    return results;
  },

  /**
   * Get incident by ID
   */
  getIncident(id) {
    return this.incidents.find(i => i.id === id);
  },

  /**
   * Add a new mock incident (simulates Firestore write)
   */
  addIncident(incident) {
    const newIncident = {
      id: `INC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(this.incidents.length + 1).padStart(3,'0')}`,
      status: 'active',
      reportedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportSource: 'citizen',
      ...incident
    };
    this.incidents.unshift(newIncident);
    return newIncident;
  },

  /**
   * Format relative time
   */
  formatTimeAgo(dateStr) {
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  },

  /**
   * Format time as HH:MM
   */
  formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  },

  /**
   * Get severity color
   */
  getSeverityColor(severity) {
    const map = {
      critical: '#ff3366',
      high: '#ff6b35',
      medium: '#fbbf24',
      low: '#00ff88'
    };
    return map[severity] || '#64748b';
  },

  /**
   * Get type icon
   */
  getTypeIcon(type) {
    const map = {
      accident: '💥',
      congestion: '🚗',
      emergency: '🚑',
      hazard: '⚠️',
      vehicle: '🚙',
      weather: '🌧️'
    };
    return map[type] || '📍';
  },

  /**
   * Simulate Gemini AI analysis
   * In production: calls /api/analyze via Cloud Run → Gemini API
   */
  async simulateAnalysis(input) {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1500));

    const types = ['accident', 'congestion', 'hazard', 'emergency', 'vehicle'];
    const severities = ['low', 'medium', 'high', 'critical'];
    const type = types[Math.floor(Math.random() * types.length)];
    const severityIdx = Math.floor(Math.random() * severities.length);
    const severity = severities[severityIdx];
    const confidence = 0.72 + Math.random() * 0.26;

    const responses = {
      accident: {
        title: 'Vehicle Collision Detected',
        description: 'Multi-vehicle accident identified with lane obstruction. Emergency services recommended.',
        details: { 'Incident Type': 'Collision', 'Vehicles Involved': Math.floor(2 + Math.random() * 3), 'Injury Risk': severity === 'critical' ? 'High' : 'Moderate', 'Lane Impact': severity === 'high' || severity === 'critical' ? '2 lanes blocked' : '1 lane blocked' },
        actions: [
          { type: 'signal', icon: '🚦', text: 'Signal timing adjusted for incident zone' },
          { type: 'reroute', icon: '🗺️', text: 'Alternative routes suggested to drivers' },
          { type: 'alert', icon: '🚨', text: 'Police and EMS notified' },
          { type: 'warning', icon: '⚠️', text: 'Nearby vehicles warned via traffic API' }
        ]
      },
      congestion: {
        title: 'Traffic Congestion Identified',
        description: 'Significant traffic buildup detected. Signal optimization initiated.',
        details: { 'Incident Type': 'Congestion', 'Queue Length': `${(0.5 + Math.random() * 2.5).toFixed(1)} km`, 'Estimated Delay': `${Math.floor(5 + Math.random() * 25)} min`, 'Cause': 'High traffic volume' },
        actions: [
          { type: 'signal', icon: '🚦', text: 'Signal cycle extended to improve flow' },
          { type: 'reroute', icon: '🗺️', text: 'Reroute advice published to navigation apps' }
        ]
      },
      hazard: {
        title: 'Road Hazard Detected',
        description: 'Object on roadway creating danger. Maintenance crew dispatched.',
        details: { 'Incident Type': 'Road Hazard', 'Hazard Type': 'Debris', 'Lane': 'Right lane', 'Visibility Impact': 'Moderate' },
        actions: [
          { type: 'warning', icon: '⚠️', text: 'Variable message signs activated' },
          { type: 'alert', icon: '🚔', text: 'Maintenance crew dispatched' }
        ]
      },
      emergency: {
        title: 'Emergency Response Detected',
        description: 'Emergency vehicle activity identified. Priority corridor created.',
        details: { 'Incident Type': 'Emergency', 'Vehicle Type': 'Ambulance', 'Priority Level': 'Maximum', 'Corridor Length': `${(0.5 + Math.random()).toFixed(1)} km` },
        actions: [
          { type: 'signal', icon: '🚦', text: 'Priority green corridor activated' },
          { type: 'alert', icon: '🚑', text: 'Emergency dispatch notified' },
          { type: 'warning', icon: '⚠️', text: 'All nearby vehicles warned' }
        ]
      },
      vehicle: {
        title: 'Stalled Vehicle Detected',
        description: 'Disabled vehicle on roadway. Tow service requested.',
        details: { 'Incident Type': 'Stalled Vehicle', 'Position': 'Right shoulder', 'Hazard Risk': 'Low', 'Action': 'Tow truck dispatched' },
        actions: [
          { type: 'warning', icon: '⚠️', text: 'Warning signs activated' },
          { type: 'alert', icon: '🔧', text: 'Tow service dispatched' }
        ]
      }
    };

    const response = responses[type];
    const location = input.location || 'Location detected from content';

    return {
      id: `INC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random() * 900) + 100)}`,
      type,
      severity,
      confidence: parseFloat(confidence.toFixed(2)),
      title: response.title,
      description: response.description,
      location,
      coordinates: { lat: 37.75 + (Math.random() - 0.5) * 0.1, lng: -122.42 + (Math.random() - 0.5) * 0.1 },
      details: response.details,
      actions: response.actions,
      reportedAt: new Date().toISOString(),
      requiresEmergencyResponse: severity === 'critical' || (severity === 'high' && confidence > 0.85),
      geminiModel: 'gemini-2.0-flash',
      verifiedAgainst: ['Google Maps Traffic API', 'Weather API', 'Historical Incident DB'],
      structuredJSON: {
        schema_version: '1.0',
        incident_id: `INC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random() * 900) + 100)}`,
        timestamp: new Date().toISOString(),
        source: 'TrafficAI Gemini Engine',
        incident: {
          type,
          title: response.title,
          severity,
          confidence: parseFloat(confidence.toFixed(2)),
          location: {
            address: location,
            coordinates: { lat: 37.75 + (Math.random() - 0.5) * 0.1, lng: -122.42 + (Math.random() - 0.5) * 0.1 }
          },
          details: response.details,
          ai_extracted: true,
          live_verified: true
        },
        actions_triggered: response.actions.map(a => a.text),
        emergency_escalated: severity === 'critical' || (severity === 'high' && confidence > 0.85),
        processing_time_ms: Math.floor(800 + Math.random() * 1200)
      }
    };
  }
};


/* =============================================
   TOAST NOTIFICATION SYSTEM
   ============================================= */
const Toast = {
  container: null,

  init() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-live', 'polite');
    this.container.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(this.container);
  },

  /**
   * @param {string} title
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration ms
   */
  show(title, message, type = 'info', duration = 5000) {
    const icons = { success: '✅', error: '🚨', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <div class="toast-icon" aria-hidden="true">${icons[type]}</div>
      <div class="toast-body">
        <div class="toast-title">${this._sanitize(title)}</div>
        ${message ? `<div class="toast-msg">${this._sanitize(message)}</div>` : ''}
      </div>
    `;
    this.container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
    return toast;
  },

  _sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};


/* =============================================
   NAVIGATION
   ============================================= */
const Nav = {
  init() {
    const toggle = document.getElementById('navToggle');
    const menu = document.getElementById('navMenu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', () => {
      const isOpen = toggle.classList.toggle('open');
      menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen.toString());
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        toggle.classList.remove('open');
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on link click (mobile)
    menu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        toggle.classList.remove('open');
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
      const navbar = document.querySelector('.navbar');
      if (navbar) {
        navbar.style.background = window.scrollY > 50
          ? 'rgba(6, 13, 26, 0.98)'
          : 'rgba(6, 13, 26, 0.85)';
      }
    });
  }
};


/* =============================================
   COUNTER ANIMATION
   ============================================= */
function animateCounter(el, target, duration = 1500) {
  const start = 0;
  const startTime = performance.now();
  const isDecimal = target % 1 !== 0;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * ease;

    el.textContent = isDecimal
      ? current.toFixed(1)
      : Math.floor(current).toLocaleString();

    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = isDecimal ? target.toFixed(1) : target.toLocaleString();
  }
  requestAnimationFrame(update);
}

function initCounters() {
  const counters = document.querySelectorAll('[data-target]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.animated) {
        entry.target.dataset.animated = 'true';
        const target = parseFloat(entry.target.dataset.target);
        animateCounter(entry.target, target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => observer.observe(counter));
}


/* =============================================
   SCROLL ANIMATIONS
   ============================================= */
function initScrollAnimations() {
  const animateable = document.querySelectorAll(
    '.feature-card, .flow-step, .tech-item, .activity-item, .stat-card, .kpi-card'
  );
  if (!animateable.length) return;

  // Initial state
  animateable.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, i * 60);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  animateable.forEach(el => observer.observe(el));
}


/* =============================================
   KEYBOARD SHORTCUTS
   ============================================= */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Escape: close any open modals/overlays
    if (e.key === 'Escape') {
      const modal = document.getElementById('modalOverlay');
      const popup = document.getElementById('incidentPopup');
      if (modal && !modal.hidden) {
        modal.hidden = true;
        document.body.style.overflow = '';
      }
      if (popup && !popup.hidden) {
        popup.hidden = true;
      }
    }
  });
}


/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  Nav.init();
  Toast.init();
  initCounters();
  initScrollAnimations();
  initKeyboardShortcuts();

  // Expose globally
  window.TrafficAI = TrafficAI;
  window.Toast = Toast;
});
