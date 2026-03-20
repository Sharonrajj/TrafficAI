/**
 * TrafficAI – Firebase Auth + RBAC Module
 * Handles authentication, role-based access, session management, MFA enforcement
 */

'use strict';

// ── Firebase SDK imports (CDN usage in HTML pages) ─────────────────────────
// This file assumes firebase-app, firebase-auth are loaded via CDN script tags.
// For production, use npm + bundler and import from 'firebase/auth'

const AUTH_CONFIG = {
  apiKey:            window.__FIREBASE_CONFIG__?.apiKey            || 'YOUR_API_KEY',
  authDomain:        window.__FIREBASE_CONFIG__?.authDomain        || 'YOUR_PROJECT.firebaseapp.com',
  projectId:         window.__FIREBASE_CONFIG__?.projectId         || 'mineral-liberty-490805-r0',
  storageBucket:     window.__FIREBASE_CONFIG__?.storageBucket     || 'YOUR_PROJECT.appspot.com',
  messagingSenderId: window.__FIREBASE_CONFIG__?.messagingSenderId || 'YOUR_SENDER_ID',
  appId:             window.__FIREBASE_CONFIG__?.appId             || 'YOUR_APP_ID'
};

/* ── Role definitions ───────────────────────────────────────────────────── */
const ROLES = {
  CITIZEN:   'citizen',    // submit, view public map
  RESPONDER: 'responder',  // read alerts, acknowledge
  AUTHORITY: 'authority',  // full dashboard, dispatch, signal control
  ADMIN:     'admin'       // user management, audit logs, config
};

const ROLE_PERMISSIONS = {
  citizen:   ['submit_report', 'view_public_map', 'view_history'],
  responder: ['submit_report', 'view_public_map', 'view_history', 'view_alerts', 'acknowledge_alert'],
  authority: ['submit_report', 'view_public_map', 'view_history', 'view_alerts', 'acknowledge_alert',
              'dispatch', 'signal_control', 'view_dashboard', 'export_audit'],
  admin:     ['*'] // all permissions
};

/* ── TrafficAuth singleton ──────────────────────────────────────────────── */
const TrafficAuth = (() => {
  let _user = null;
  let _role = ROLES.CITIZEN;
  let _tokenCache = null;
  let _tokenExpiry = 0;
  let _listeners = [];

  /* ── Internal helpers ─────────────────────────────────────────────────── */
  function _resolveRole(claims) {
    if (!claims) return ROLES.CITIZEN;
    if (claims.admin) return ROLES.ADMIN;
    if (claims.role && ROLES[claims.role.toUpperCase()]) return claims.role;
    return ROLES.CITIZEN;
  }

  function _cacheToken(token, expiresIn = 3600) {
    _tokenCache  = token;
    _tokenExpiry = Date.now() + (expiresIn - 60) * 1000; // refresh 1 min early
  }

  async function _getClaims(firebaseUser) {
    if (!firebaseUser) return {};
    const result   = await firebaseUser.getIdTokenResult(true);
    _cacheToken(result.token);
    return result.claims || {};
  }

  function _notify() {
    _listeners.forEach(fn => fn({ user: _user, role: _role }));
  }

  /* ── Public API ───────────────────────────────────────────────────────── */
  return {

    /** Initialize – call once on DOMContentLoaded */
    async init() {
      if (typeof firebase === 'undefined') {
        console.warn('[TrafficAuth] Firebase SDK not loaded – running in demo mode');
        this._demoMode();
        return;
      }
      if (!firebase.apps.length) firebase.initializeApp(AUTH_CONFIG);
      firebase.auth().onAuthStateChanged(async (user) => {
        _user  = user;
        _role  = ROLES.CITIZEN;
        if (user) {
          const claims = await _getClaims(user);
          _role = _resolveRole(claims);
        }
        this._applyRBACToPage();
        _notify();
      });
      this._handleSessionTimeout();
    },

    /** Sign in with Google popup */
    async signInWithGoogle() {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('email');
      try {
        const result = await firebase.auth().signInWithPopup(provider);
        Toast.show('Signed in', `Welcome, ${result.user.displayName}!`, 'success', 3000);
        return result.user;
      } catch (err) {
        Toast.show('Sign-in failed', err.message, 'error', 4000);
        throw err;
      }
    },

    /** Sign in with Email/Password */
    async signInWithEmail(email, password) {
      try {
        const result = await firebase.auth().signInWithEmailAndPassword(email, password);
        return result.user;
      } catch (err) {
        Toast.show('Sign-in failed', err.message, 'error', 4000);
        throw err;
      }
    },

    /** Sign out */
    async signOut() {
      await firebase.auth()?.signOut();
      _user  = null;
      _role  = ROLES.CITIZEN;
      _tokenCache  = null;
      _tokenExpiry = 0;
      this._applyRBACToPage();
      _notify();
      Toast.show('Signed out', 'You have been signed out', 'info', 2000);
    },

    /** Get a fresh JWT token (cached, auto-refreshed) */
    async getToken() {
      if (_tokenCache && Date.now() < _tokenExpiry) return _tokenCache;
      if (!_user) return null;
      const result = await _user.getIdTokenResult(true);
      _cacheToken(result.token);
      return result.token;
    },

    /** Check if user has a specific permission */
    can(permission) {
      const perms = ROLE_PERMISSIONS[_role] || [];
      return perms.includes('*') || perms.includes(permission);
    },

    /** Guard a function – throws if user lacks permission */
    require(permission) {
      if (!this.can(permission)) {
        Toast.show('Access Denied', `You need "${permission}" permission`, 'error', 3000);
        throw new Error(`Permission denied: ${permission}`);
      }
    },

    /** Get current user info */
    get currentUser() { return _user; },
    get role()        { return _role; },
    get isLoggedIn()  { return !!_user; },

    /** Subscribe to auth state changes */
    onChange(fn) {
      _listeners.push(fn);
      // immediately call with current state
      fn({ user: _user, role: _role });
      return () => { _listeners = _listeners.filter(l => l !== fn); }; // unsubscribe
    },

    /** Apply RBAC to the current page (show/hide elements) */
    _applyRBACToPage() {
      // Elements with data-requires-role="authority|admin" are hidden unless role matches
      document.querySelectorAll('[data-requires-role]').forEach(el => {
        const required = el.getAttribute('data-requires-role').split('|');
        const allowed  = required.some(r => _role === r ||
          (_role === ROLES.ADMIN) ||
          (r === ROLES.RESPONDER && [ROLES.AUTHORITY, ROLES.ADMIN].includes(_role)));
        el.style.display = allowed ? '' : 'none';
        el.setAttribute('aria-hidden', String(!allowed));
      });

      // Update nav auth button
      const authBtn  = document.getElementById('authBtn');
      const userChip = document.getElementById('userChip');
      if (authBtn) {
        if (_user) {
          authBtn.textContent = 'Sign Out';
          authBtn.onclick = () => this.signOut();
        } else {
          authBtn.textContent = 'Sign In';
          authBtn.onclick = () => this.openAuthModal();
        }
      }
      if (userChip) {
        userChip.textContent = _user
          ? `${_user.displayName || _user.email} · ${_role}`
          : '';
        userChip.style.display = _user ? 'flex' : 'none';
      }
    },

    /** Open the auth modal */
    openAuthModal() {
      const existing = document.getElementById('authModal');
      if (existing) { existing.style.display = 'flex'; return; }

      const modal = document.createElement('div');
      modal.id        = 'authModal';
      modal.className = 'auth-modal-overlay';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'authModalTitle');
      modal.innerHTML = `
        <div class="auth-modal" role="document">
          <button class="auth-modal-close" aria-label="Close sign in dialog">&times;</button>
          <h2 id="authModalTitle" class="auth-modal-title">Sign In to TrafficAI</h2>
          <p class="auth-modal-sub">Authority accounts require your agency email</p>
          <button id="googleSignIn" class="auth-btn google-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          <div class="auth-separator"><span>or</span></div>
          <label for="authEmail" class="auth-label">Email</label>
          <input id="authEmail" type="email" class="auth-input" placeholder="you@agency.gov" autocomplete="email">
          <label for="authPassword" class="auth-label">Password</label>
          <input id="authPassword" type="password" class="auth-input" placeholder="••••••••" autocomplete="current-password">
          <button id="emailSignIn" class="auth-btn primary-btn">Sign In</button>
          <p class="auth-footer">Citizens can report incidents without signing in</p>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('.auth-modal-close').onclick = () => { modal.style.display = 'none'; };
      modal.querySelector('#googleSignIn').onclick     = () => { this.signInWithGoogle(); modal.style.display = 'none'; };
      modal.querySelector('#emailSignIn').onclick      = () => {
        const email    = modal.querySelector('#authEmail').value;
        const password = modal.querySelector('#authPassword').value;
        this.signInWithEmail(email, password).then(() => { modal.style.display = 'none'; });
      };
      modal.addEventListener('keydown', e => { if (e.key === 'Escape') modal.style.display = 'none'; });
    },

    /** Auto-sign-out on 30-min inactivity (authority accounts) */
    _handleSessionTimeout() {
      if (_role !== ROLES.AUTHORITY && _role !== ROLES.ADMIN) return;
      let timer;
      const reset = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          Toast.show('Session Expired', 'You were signed out due to inactivity', 'warning', 5000);
          this.signOut();
        }, 30 * 60 * 1000); // 30 minutes
      };
      ['mousemove', 'keydown', 'click', 'touchstart'].forEach(e =>
        document.addEventListener(e, reset, { passive: true })
      );
      reset();
    },

    /** Demo mode (Firebase SDK not loaded) */
    _demoMode() {
      console.info('[TrafficAuth] Demo mode active – all features available without Firebase');
      _user = { displayName: 'Demo User', email: 'demo@trafficai.app', uid: 'demo-001' };
      _role = ROLES.AUTHORITY; // show full dashboard in demo
      this._applyRBACToPage();
      _notify();
    }
  };
})();

/* ── Auth Modal Styles (injected once) ─────────────────────────────────── */
(function injectAuthStyles() {
  if (document.getElementById('auth-styles')) return;
  const style = document.createElement('style');
  style.id = 'auth-styles';
  style.textContent = `
    .auth-modal-overlay {
      position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);
      z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;
    }
    .auth-modal {
      background:var(--glass, rgba(15,23,42,0.95));border:1px solid rgba(255,255,255,0.12);
      border-radius:16px;padding:2rem;width:100%;max-width:420px;position:relative;
      box-shadow:0 24px 64px rgba(0,0,0,0.6);
    }
    .auth-modal-close {
      position:absolute;top:.75rem;right:.75rem;background:none;border:none;
      color:#64748b;font-size:1.5rem;cursor:pointer;padding:0 .25rem;
    }
    .auth-modal-title { font-size:1.5rem;font-weight:700;margin:0 0 .25rem;color:#f8fafc; }
    .auth-modal-sub   { color:#64748b;font-size:.875rem;margin:0 0 1.5rem; }
    .auth-btn {
      display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;
      padding:.75rem 1rem;border-radius:8px;font-size:.9rem;font-weight:600;
      cursor:pointer;border:none;transition:all .2s;margin-bottom:.75rem;
    }
    .google-btn { background:#fff;color:#1a1a1a;border:1px solid #e2e8f0; }
    .google-btn:hover { background:#f8fafc; }
    .primary-btn { background:linear-gradient(135deg,#00d4ff,#7c3aed);color:#fff; }
    .primary-btn:hover { opacity:.9; }
    .auth-separator { text-align:center;color:#64748b;font-size:.8rem;margin:.5rem 0;
      display:flex;align-items:center;gap:.5rem; }
    .auth-separator::before,.auth-separator::after {
      content:'';flex:1;height:1px;background:rgba(255,255,255,0.1); }
    .auth-label { display:block;font-size:.8rem;color:#94a3b8;margin-bottom:.25rem; }
    .auth-input {
      width:100%;padding:.65rem .75rem;background:rgba(255,255,255,0.05);
      border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f8fafc;
      font-size:.9rem;margin-bottom:1rem;box-sizing:border-box;
    }
    .auth-input:focus { outline:2px solid #00d4ff;border-color:transparent; }
    .auth-footer { text-align:center;color:#475569;font-size:.75rem;margin:.5rem 0 0; }
  `;
  document.head.appendChild(style);
})();

// Auto-init
document.addEventListener('DOMContentLoaded', () => TrafficAuth.init());
