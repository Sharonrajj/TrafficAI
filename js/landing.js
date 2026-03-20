/**
 * TrafficAI - Landing Page JavaScript
 * Particle system, animated stats, live activity feed
 */

'use strict';

/* =============================================
   PARTICLE SYSTEM
   ============================================= */
function initParticles() {
  const container = document.getElementById('heroParticles');
  if (!container) return;

  const COUNT = window.innerWidth < 768 ? 15 : 30;

  for (let i = 0; i < COUNT; i++) {
    const particle = document.createElement('div');
    particle.className = 'hero-particle';

    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const size = 1 + Math.random() * 2;
    const duration = 8 + Math.random() * 12;
    const delay = Math.random() * 8;

    particle.style.cssText = `
      left: ${x}%;
      top: ${y}%;
      width: ${size}px;
      height: ${size}px;
      opacity: ${0.2 + Math.random() * 0.5};
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
      animation-name: float;
      background: ${Math.random() > 0.6 ? '#00d4ff' : '#7c3aed'};
    `;

    container.appendChild(particle);
  }
}


/* =============================================
   PREVIEW CARD ANIMATION
   ============================================= */
function initPreviewAnimation() {
  const tags = document.querySelectorAll('.preview-tag');
  if (!tags.length) return;

  // Cycle through showing/hiding tags to simulate analysis
  let cycle = 0;
  setInterval(() => {
    tags.forEach((tag, idx) => {
      tag.style.opacity = '0';
      tag.style.transform = 'translateX(-8px)';
      tag.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        tag.style.opacity = '1';
        tag.style.transform = 'translateX(0)';
      }, idx * 150 + (cycle % 2 === 0 ? 800 : 400));
    });
    cycle++;
  }, 4000);
}


/* =============================================
   LIVE ACTIVITY FEED
   ============================================= */
function initActivityFeed() {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;

  const activities = [
    { icon: '💥', title: 'Accident Detected & Verified', desc: 'Highway 1, Bay Bridge approach — Authorities alerted', time: '2m ago', severity: 'high', confidence: '94%' },
    { icon: '🚑', title: 'Emergency Corridor Activated', desc: 'Valencia Street — Priority signals green for ambulance', time: '6m ago', severity: 'critical', confidence: '97%' },
    { icon: '🚗', title: 'Congestion Resolved', desc: 'Market & 5th Avenue — Signal timing optimized', time: '18m ago', severity: 'medium', confidence: '88%' },
    { icon: '⚠️', title: 'Road Hazard Cleared', desc: 'I-280 Northbound, Mile 42 — Debris removed', time: '45m ago', severity: 'low', confidence: '79%' },
    { icon: '💥', title: 'Minor Collision Reported', desc: 'Lombard & Van Ness — Police en route', time: '42m ago', severity: 'medium', confidence: '86%' }
  ];

  activities.forEach((activity, i) => {
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.style.animationDelay = `${i * 0.1}s`;
    item.innerHTML = `
      <div class="activity-icon" aria-hidden="true">${activity.icon}</div>
      <div class="activity-body">
        <div class="activity-title">${activity.title}</div>
        <div class="activity-desc">${activity.desc}</div>
      </div>
      <div class="activity-right">
        <div class="activity-time">${activity.time}</div>
        <div class="severity-badge ${activity.severity}">${activity.severity}</div>
      </div>
    `;
    feed.appendChild(item);
  });

  // Simulate new incident coming in after 8 seconds
  setTimeout(() => {
    const newItem = document.createElement('div');
    newItem.className = 'activity-item';
    newItem.style.animation = 'fadeIn 0.4s ease both';
    newItem.innerHTML = `
      <div class="activity-icon" aria-hidden="true">🆕</div>
      <div class="activity-body">
        <div class="activity-title">New Report Received — AI Analyzing...</div>
        <div class="activity-desc">Unnamed user — Submitted photo</div>
      </div>
      <div class="activity-right">
        <div class="activity-time">just now</div>
        <div class="severity-badge medium">analyzing</div>
      </div>
    `;
    feed.insertBefore(newItem, feed.firstChild);

    // Remove last item for brevity
    if (feed.children.length > 5) {
      feed.lastChild && feed.removeChild(feed.lastChild);
    }
  }, 8000);
}


/* =============================================
   INTERSECTION OBSERVER - Section Entrance
   ============================================= */
function initSectionAnimations() {
  const sections = document.querySelectorAll('.how-it-works, .features, .tech-stack, .live-activity, .cta-section');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  sections.forEach(s => observer.observe(s));
}


/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initPreviewAnimation();
  initActivityFeed();
  initSectionAnimations();

  // Smooth scroll for any anchor links
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});
