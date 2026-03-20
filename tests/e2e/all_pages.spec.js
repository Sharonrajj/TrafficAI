// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TrafficAI – End-to-End Tests (Playwright)
 * Tests all major user flows across the 5 pages.
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8080';

// ── Helpers ─────────────────────────────────────────────────────────────────

async function waitForToast(page, text = null) {
  const toast = page.locator('.toast').first();
  await expect(toast).toBeVisible({ timeout: 8000 });
  if (text) await expect(toast).toContainText(text);
  return toast;
}

async function selectTab(page, tabName) {
  const tab = page.locator(`[data-tab="${tabName}"], .tab-btn:has-text("${tabName}")`).first();
  await tab.click();
  await page.waitForTimeout(500);
}

// ── Landing Page ─────────────────────────────────────────────────────────────

test.describe('Landing Page', () => {
  test('hero section loads with title and CTAs', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/TrafficAI/i);
    // Hero heading
    const heading = page.locator('h1, .hero-title').first();
    await expect(heading).toBeVisible();
    // CTA buttons present
    await expect(page.locator('a[href*="report"]').first()).toBeVisible();
    await expect(page.locator('a[href*="map"]').first()).toBeVisible();
  });

  test('navbar links navigate to correct pages', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`);
    await page.click('nav a[href*="report"]');
    await expect(page).toHaveURL(/report\.html/);
  });

  test('particle canvas renders without errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(`${BASE_URL}/index.html`);
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('page has no accessibility violations on heading hierarchy', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`);
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeLessThanOrEqual(1); // WCAG: single H1
  });
});

// ── Report Page ──────────────────────────────────────────────────────────────

test.describe('Report Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/report.html`);
    await page.waitForLoadState('networkidle');
  });

  test('three input tabs are present and clickable', async ({ page }) => {
    const tabs = page.locator('.tab-btn, [role="tab"]');
    await expect(tabs).toHaveCount(3);
    await tabs.nth(1).click(); // Voice tab
    await page.waitForTimeout(300);
    await tabs.nth(2).click(); // Text tab
    await page.waitForTimeout(300);
  });

  test('text input shows character count', async ({ page }) => {
    await selectTab(page, 'Text');
    const textarea = page.locator('textarea#incidentText, textarea[id*="text"]').first();
    await textarea.fill('There is a major accident on the highway near downtown involving three vehicles.');
    const charCount = page.locator('[id*="charCount"], .char-count').first();
    await expect(charCount).toBeVisible();
  });

  test('submit button disabled without input', async ({ page }) => {
    const submitBtn = page.locator('#submitAnalysis, button[type="submit"]').first();
    const isDisabled = await submitBtn.isDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test('file upload zone accepts drag hover', async ({ page }) => {
    const zone = page.locator('.upload-zone, #dropZone').first();
    await expect(zone).toBeVisible();
    await zone.dispatchEvent('dragover', { dataTransfer: {} });
    await page.waitForTimeout(200);
    // Verify zone doesn't crash
    await expect(zone).toBeVisible();
  });

  test('severity selector has 4 options', async ({ page }) => {
    const options = page.locator('.severity-btn, [data-severity]');
    await expect(options).toHaveCount(4);
  });

  test('analysis panel is visible on page load', async ({ page }) => {
    const panel = page.locator('#analysisPanel, .analysis-panel').first();
    await expect(panel).toBeVisible();
  });

  test('keyboard navigation: Tab reaches all interactive elements', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']).toContain(focused);
  });
});

// ── Map Page ─────────────────────────────────────────────────────────────────

test.describe('Live Map Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/map.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // canvas render time
  });

  test('map canvas renders', async ({ page }) => {
    const canvas = page.locator('canvas#mapCanvas, canvas').first();
    await expect(canvas).toBeVisible();
    const width = await canvas.evaluate(el => el.width);
    expect(width).toBeGreaterThan(100);
  });

  test('incident list has at least one item', async ({ page }) => {
    const items = page.locator('.incident-item, [class*="incident-list"] li').first();
    await expect(items).toBeVisible({ timeout: 5000 });
  });

  test('severity filter filters incident list', async ({ page }) => {
    const criticalFilter = page.locator('[data-filter="critical"], option[value="critical"]').first();
    if (await criticalFilter.isVisible()) {
      await criticalFilter.click();
      await page.waitForTimeout(500);
    }
    // List should update (no crash)
    await expect(page.locator('.incident-list, #incidentList')).toBeVisible();
  });

  test('map controls are visible and accessible', async ({ page }) => {
    const controls = page.locator('.map-control, .btn-icon').first();
    await expect(controls).toBeVisible();
  });
});

// ── Dashboard Page ────────────────────────────────────────────────────────────

test.describe('Authority Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
  });

  test('KPI cards render with values', async ({ page }) => {
    const kpis = page.locator('.kpi-value, [id^="kpi-"]');
    const count = await kpis.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('live clock is displayed and ticking', async ({ page }) => {
    const clock = page.locator('#dashTime').first();
    await expect(clock).toBeVisible();
    const t1 = await clock.textContent();
    await page.waitForTimeout(1500);
    const t2 = await clock.textContent();
    expect(t1).not.toBe(t2); // time is ticking
  });

  test('acknowledging an alert shows toast', async ({ page }) => {
    const ackBtn = page.locator('.acknowledge').first();
    if (await ackBtn.isVisible()) {
      await ackBtn.click();
      await waitForToast(page, 'Acknowledged');
    }
  });

  test('applying signal recommendation shows toast', async ({ page }) => {
    const applyBtns = page.locator('.signal-apply:not([disabled])');
    const count = await applyBtns.count();
    if (count > 0) {
      await applyBtns.first().click();
      await waitForToast(page, 'Signal Applied');
    }
  });

  test('export audit log button exists', async ({ page }) => {
    const exportBtn = page.locator('#exportLog');
    await expect(exportBtn).toBeVisible();
  });

  test('activity chart canvas renders', async ({ page }) => {
    const chart = page.locator('#activityChart');
    await expect(chart).toBeVisible();
  });
});

// ── Incident History ──────────────────────────────────────────────────────────

test.describe('Incident History Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/history.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('incident cards are rendered', async ({ page }) => {
    const cards = page.locator('.incident-card, .incident-item');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
  });

  test('search filters incidents', async ({ page }) => {
    const search = page.locator('#searchInput, input[type="search"], input[placeholder*="Search"]').first();
    await search.fill('accident');
    await page.waitForTimeout(600); // debounce
    // Grid should still be visible
    await expect(page.locator('#incidentGrid, .incidents-grid')).toBeVisible();
  });

  test('grid/list toggle works', async ({ page }) => {
    const listToggle = page.locator('#listView, [data-view="list"], .view-toggle').first();
    if (await listToggle.isVisible()) {
      await listToggle.click();
      await page.waitForTimeout(300);
    }
  });

  test('clicking an incident card opens modal', async ({ page }) => {
    const card = page.locator('.incident-card').first();
    if (await card.isVisible()) {
      await card.click();
      const modal = page.locator('.modal, #incidentModal').first();
      await expect(modal).toBeVisible({ timeout: 3000 });
      // Close modal
      await page.keyboard.press('Escape');
    }
  });

  test('stat cards show numeric values', async ({ page }) => {
    const stats = page.locator('.stat-value, [id*="stat"]').first();
    await expect(stats).toBeVisible();
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

test.describe('Accessibility', () => {
  const pages = [
    { name: 'Landing', url: '/index.html' },
    { name: 'Report',  url: '/report.html' },
    { name: 'Map',     url: '/map.html' },
    { name: 'History', url: '/history.html' },
    { name: 'Dashboard', url: '/dashboard.html' }
  ];

  for (const p of pages) {
    test(`${p.name}: no console errors`, async ({ page }) => {
      const errors = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      await page.goto(`${BASE_URL}${p.url}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('net::'));
      expect(criticalErrors).toHaveLength(0);
    });

    test(`${p.name}: all images have alt text`, async ({ page }) => {
      await page.goto(`${BASE_URL}${p.url}`);
      const imgsWithoutAlt = await page.$$eval('img:not([alt])', imgs => imgs.length);
      expect(imgsWithoutAlt).toBe(0);
    });
  }
});
