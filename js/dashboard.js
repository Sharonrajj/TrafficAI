/**
 * TrafficAI - Authority Dashboard JavaScript
 * Real-time KPIs, alert feed, activity chart, signal control,
 * active incidents, reroutes, EV corridors, audit log
 */

'use strict';

/* =============================================
   DASHBOARD DATA
   ============================================= */
const DashData = {
  signalRecommendations: [
    { id: 'sig-001', location: 'Market & Van Ness', action: 'Extend green by 15s', priority: 'critical', applied: false },
    { id: 'sig-002', location: 'Bay Bridge Toll', action: 'Reduce cycle by 20%', priority: 'high', applied: false },
    { id: 'sig-003', location: 'Highway 1 & 101', action: 'Enable emergency prio', priority: 'critical', applied: false },
    { id: 'sig-004', location: 'Mission & Valencia', action: 'Sync adjacent signals', priority: 'medium', applied: true }
  ],
  reroutes: [
    { from: 'Bay Bridge', via: 'Oakland Bay', saving: '-22 min', active: true },
    { from: 'Market St', via: 'Folsom St', saving: '-14 min', active: true },
    { from: 'Highway 1', via: 'I-280', saving: '-8 min', active: true }
  ],
  evCorridors: [
    { id: 'ev-001', route: 'Mission District → SF General Hospital', type: '🚑', status: 'Active' },
    { id: 'ev-002', route: 'Bay Bridge → Downtown Emergency', type: '🚒', status: 'Pending' }
  ],
  auditLog: [
    { ts: new Date(Date.now() - 2 * 60000), id: 'INC-20260320-003', action: 'Emergency corridor activated', actor: 'System', severity: 'critical', status: 'Active' },
    { ts: new Date(Date.now() - 6 * 60000), id: 'INC-20260320-001', action: 'Authorities alerted', actor: 'AI Engine', severity: 'high', status: 'Active' },
    { ts: new Date(Date.now() - 12 * 60000), id: 'INC-20260320-001', action: 'Signal timing adjusted', actor: 'Antigravity', severity: 'high', status: 'Applied' },
    { ts: new Date(Date.now() - 18 * 60000), id: 'INC-20260320-002', action: 'Reroute suggestion published', actor: 'Traffic API', severity: 'medium', status: 'Active' },
    { ts: new Date(Date.now() - 28 * 60000), id: 'INC-20260320-002', action: 'Incident verified', actor: 'Gemini AI', severity: 'medium', status: 'Confirmed' },
    { ts: new Date(Date.now() - 45 * 60000), id: 'INC-20260320-004', action: 'Maintenance dispatched', actor: 'System', severity: 'low', status: 'Resolved' },
    { ts: new Date(Date.now() - 60 * 60000), id: 'INC-20260320-005', action: 'Police notified', actor: 'AI Engine', severity: 'medium', status: 'Monitoring' },
    { ts: new Date(Date.now() - 95 * 60000), id: 'INC-20260320-004', action: 'Hazard detected', actor: 'Gemini AI', severity: 'low', status: 'Resolved' }
  ]
};

/* Priority alert data (derived from incidents) */
function buildAlerts() {
  const incidents = window.TrafficAI?.incidents || [];
  return incidents
    .filter(i => i.severity === 'critical' || i.severity === 'high')
    .filter(i => i.status === 'active' || i.status === 'monitoring')
    .map(i => ({
      id: i.id,
      title: i.title,
      location: i.location,
      severity: i.severity,
      time: window.TrafficAI.formatTimeAgo(i.reportedAt),
      confidence: Math.round(i.confidence * 100),
      unread: Math.random() > 0.4,
      details: i.description
    }));
}


/* =============================================
   LIVE CLOCK
   ============================================= */
function initClock() {
  const el = document.getElementById('dashTime');
  if (!el) return;
  const update = () => {
    el.textContent = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  };
  update();
  setInterval(update, 1000);
}


/* =============================================
   KPI CARDS
   ============================================= */
function updateKPIs() {
  const incidents = window.TrafficAI?.incidents || [];
  const criticalActive = incidents.filter(i => i.severity === 'critical' && i.status === 'active').length;
  const alertsToday = incidents.filter(i => i.actions?.includes('authorities_alerted') || i.actions?.some(a => a.includes && a.includes('alert'))).length;
  const avgConf = (incidents.reduce((sum, i) => sum + i.confidence, 0) / incidents.length * 100).toFixed(0);

  const kpis = {
    'kpi-critical': criticalActive,
    'kpi-alerts': alertsToday,
    'kpi-response': '4.2s',
    'kpi-confidence': `${avgConf}%`
  };

  Object.entries(kpis).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}


/* =============================================
   PRIORITY ALERTS FEED
   ============================================= */
function renderAlertsFeed() {
  const feed = document.getElementById('alertsFeed');
  if (!feed) return;
  feed.innerHTML = '';

  const alerts = buildAlerts();
  const badge = document.getElementById('alertBadge');
  if (badge) badge.textContent = `${alerts.length} active`;

  if (!alerts.length) {
    feed.innerHTML = '<div style="text-align:center;padding:2rem;color:#475569;font-size:0.875rem">No priority alerts</div>';
    return;
  }

  alerts.forEach((alert, i) => {
    const item = document.createElement('div');
    item.className = `alert-item ${alert.unread ? 'unread' : ''}`;
    item.style.animationDelay = `${i * 0.1}s`;
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
      <div class="alert-item-header">
        <div style="display:flex;align-items:center;gap:0.5rem">
          ${alert.unread ? '<span style="width:6px;height:6px;background:var(--red);border-radius:50%;flex-shrink:0"></span>' : ''}
          <span class="alert-item-title">${alert.title}</span>
        </div>
        <span class="severity-badge ${alert.severity}">${alert.severity}</span>
      </div>
      <div class="alert-item-body">
        📍 ${alert.location}<br/>
        Confidence: ${alert.confidence}% · ${alert.time}
      </div>
      <p style="font-size:0.75rem;color:#64748b;margin:0.5rem 0;line-height:1.5">${alert.details}</p>
      <div class="alert-item-actions">
        <button class="alert-action-btn acknowledge" aria-label="Acknowledge alert for ${alert.title}">✓ Acknowledge</button>
        <button class="alert-action-btn dispatch" aria-label="Dispatch response for ${alert.title}">🚔 Dispatch</button>
      </div>
    `;

    // Acknowledge
    item.querySelector('.acknowledge')?.addEventListener('click', () => {
      item.classList.remove('unread');
      item.querySelector('.acknowledge').textContent = '✓ Acknowledged';
      item.querySelector('.acknowledge').disabled = true;
      Toast.show('Alert Acknowledged', `${alert.title} marked as acknowledged.`, 'success', 3000);
    });

    // Dispatch
    item.querySelector('.dispatch')?.addEventListener('click', () => {
      Toast.show('Dispatch Initiated', `Emergency response dispatched to ${alert.location}`, 'warning', 4000);
      item.querySelector('.dispatch').textContent = '✓ Dispatched';
      item.querySelector('.dispatch').disabled = true;
    });

    feed.appendChild(item);
  });
}


/* =============================================
   ACTIVITY CHART (Canvas)
   ============================================= */
function renderActivityChart() {
  const canvas = document.getElementById('activityChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  const W = canvas.width;
  const H = canvas.height;

  // Mock hourly data (last 12 hours shown)
  const hours = 12;
  const reports = [4, 7, 3, 9, 12, 6, 8, 11, 5, 3, 7, 9];
  const critical = [0, 1, 0, 2, 3, 1, 0, 2, 1, 0, 1, 2];

  const barW = (W - 60) / hours;
  const maxVal = Math.max(...reports);
  const chartH = H - 40;
  const chartTop = 10;

  ctx.clearRect(0, 0, W, H);

  // Gridlines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = chartTop + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Bars
  reports.forEach((val, i) => {
    const x = 48 + i * barW;
    const barH = (val / maxVal) * (chartH - 20);
    const y = chartTop + chartH - barH - 4;

    // Gradient bar
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, 'rgba(0, 212, 255, 0.8)');
    grad.addColorStop(1, 'rgba(0, 212, 255, 0.2)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW - 4, barH, 3);
    ctx.fill();

    // Critical overlay
    const cH = (critical[i] / maxVal) * (chartH - 20);
    if (cH > 0) {
      const cGrad = ctx.createLinearGradient(0, y + barH - cH, 0, y + barH);
      cGrad.addColorStop(0, 'rgba(255, 107, 53, 0.8)');
      cGrad.addColorStop(1, 'rgba(255, 107, 53, 0.3)');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.roundRect(x, y + barH - cH, barW - 4, cH, 3);
      ctx.fill();
    }

    // Hour label
    const hourLabel = new Date(Date.now() - (hours - i - 1) * 3600000).getHours();
    ctx.fillStyle = '#475569';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`${hourLabel}:00`, x + (barW - 4) / 2, H - 4);
  });

  // Y axis labels
  ctx.fillStyle = '#475569';
  ctx.font = '10px Inter';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = chartTop + (chartH / 4) * i;
    ctx.fillText(Math.round(maxVal - (maxVal / 4) * i), 36, y + 4);
  }
}


/* =============================================
   SIGNAL CONTROL
   ============================================= */
function renderSignalList() {
  const list = document.getElementById('signalList');
  if (!list) return;
  list.innerHTML = '';

  DashData.signalRecommendations.forEach(sig => {
    const item = document.createElement('div');
    item.className = 'signal-item';
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
      <span class="signal-loc">${sig.location}</span>
      <span class="signal-action">${sig.action}</span>
      <span class="signal-priority ${sig.priority}">${sig.priority}</span>
      <button class="signal-apply ${sig.applied ? 'applied' : ''}"
        aria-label="${sig.applied ? 'Already applied' : 'Apply signal change'} to ${sig.location}"
        ${sig.applied ? 'disabled' : ''}>
        ${sig.applied ? '✓ Applied' : 'Apply'}
      </button>
    `;

    if (!sig.applied) {
      item.querySelector('.signal-apply').addEventListener('click', (e) => {
        sig.applied = true;
        const btn = e.target;
        btn.textContent = '✓ Applied';
        btn.className = 'signal-apply applied';
        btn.disabled = true;
        Toast.show('Signal Applied', `${sig.location}: ${sig.action}`, 'success', 3000);

        // Add to audit log
        DashData.auditLog.unshift({
          ts: new Date(),
          id: 'SYSTEM',
          action: `Signal adjusted: ${sig.action}`,
          actor: 'Authority User',
          severity: sig.priority,
          status: 'Applied'
        });
        renderAuditLog();
      });
    }

    list.appendChild(item);
  });
}


/* =============================================
   ACTIVE INCIDENTS
   ============================================= */
function renderActiveIncidents() {
  const container = document.getElementById('activeIncidents');
  if (!container) return;
  container.innerHTML = '';

  const active = (window.TrafficAI?.incidents || [])
    .filter(i => i.status === 'active' || i.status === 'monitoring')
    .slice(0, 6);

  active.forEach((incident, i) => {
    const item = document.createElement('div');
    item.className = 'active-incident-item';
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
      <div class="active-incident-dot" style="background:${window.TrafficAI.getSeverityColor(incident.severity)};box-shadow:0 0 6px ${window.TrafficAI.getSeverityColor(incident.severity)}"></div>
      <div class="active-incident-info">
        <div class="active-incident-title">${incident.title}</div>
        <div class="active-incident-sub">
          <span class="severity-badge ${incident.severity}">${incident.severity}</span>
          <span>· ${window.TrafficAI.formatTimeAgo(incident.reportedAt)}</span>
          <span style="color:var(--cyan)">· ${Math.round(incident.confidence * 100)}%</span>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}


/* =============================================
   REROUTES
   ============================================= */
function renderReroutes() {
  const list = document.getElementById('rerouteList');
  if (!list) return;
  list.innerHTML = '';

  DashData.reroutes.forEach(r => {
    const item = document.createElement('div');
    item.className = 'reroute-item';
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
      <span class="reroute-arrow">🔀</span>
      <div class="reroute-info">
        <div class="reroute-from">Avoid: ${r.from}</div>
        <div class="reroute-via">Via: ${r.via}</div>
      </div>
      <div class="reroute-saving">${r.saving}</div>
    `;
    list.appendChild(item);
  });
}


/* =============================================
   EV CORRIDORS
   ============================================= */
function renderEVCorridors() {
  const container = document.getElementById('evCorridors');
  if (!container) return;
  container.innerHTML = '';

  DashData.evCorridors.forEach(ev => {
    const item = document.createElement('div');
    item.className = 'ev-corridor';
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
      <span class="ev-icon">${ev.type}</span>
      <div class="ev-info">
        <div class="ev-route">${ev.route}</div>
        <div class="ev-status">${ev.status === 'Active' ? '🟢 Corridor active' : '🟡 Awaiting clearance'}</div>
      </div>
      ${ev.status === 'Active' ? '<span class="ev-priority-badge">PRIORITY</span>' : ''}
    `;
    container.appendChild(item);
  });

  const badge = document.getElementById('evBadge');
  const active = DashData.evCorridors.filter(e => e.status === 'Active').length;
  if (badge) badge.textContent = `${active} active corridor${active !== 1 ? 's' : ''}`;
}


/* =============================================
   AUDIT LOG
   ============================================= */
function renderAuditLog() {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  DashData.auditLog.slice(0, 20).forEach(entry => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="timestamp">${entry.ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
      <td class="incident-id">${entry.id}</td>
      <td>${entry.action}</td>
      <td style="color:var(--text-muted)">${entry.actor}</td>
      <td><span class="severity-badge ${entry.severity}">${entry.severity}</span></td>
      <td><span style="font-size:0.75rem;color:${getStatusColor(entry.status)}">${entry.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function getStatusColor(status) {
  const map = { Active: '#ff6b35', Applied: '#00ff88', Resolved: '#00ff88', Confirmed: '#00d4ff', Monitoring: '#fbbf24' };
  return map[status] || '#64748b';
}


/* =============================================
   EXPORT AUDIT LOG
   ============================================= */
function initExportLog() {
  document.getElementById('exportLog')?.addEventListener('click', () => {
    const headers = ['Timestamp', 'Incident ID', 'Action', 'Actor', 'Severity', 'Status'];
    const rows = DashData.auditLog.map(e => [
      e.ts.toISOString(), e.id, e.action, e.actor, e.severity, e.status
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trafficai-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.show('Exported', 'Audit log downloaded as CSV', 'success', 3000);
  });
}


/* =============================================
   MANUAL REFRESH
   ============================================= */
function initRefresh() {
  document.getElementById('refreshDash')?.addEventListener('click', () => {
    renderAlertsFeed();
    renderActiveIncidents();
    updateKPIs();
    Toast.show('Dashboard Refreshed', 'All data updated', 'success', 2000);
  });
}


/* =============================================
   AUTO REFRESH
   ============================================= */
function startAutoRefresh() {
  setInterval(() => {
    renderAlertsFeed();
    renderActiveIncidents();
    updateKPIs();
  }, 15000);
}


/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initClock();
    updateKPIs();
    renderAlertsFeed();
    renderActivityChart();
    renderSignalList();
    renderActiveIncidents();
    renderReroutes();
    renderEVCorridors();
    renderAuditLog();
    initExportLog();
    initRefresh();
    startAutoRefresh();

    // Resize chart on window resize
    window.addEventListener('resize', renderActivityChart);
  }, 100);
});
