/**
 * TrafficAI – Internationalization (i18n) Module
 * Multilingual support for 7 languages.
 * Usage: <span data-i18n="hero.title"></span>
 */

'use strict';

const I18n = (() => {
  const SUPPORTED = ['en', 'es', 'fr', 'hi', 'zh', 'ar', 'ta'];
  const RTL_LANGS = ['ar'];

  // Embedded locale data (no fetch needed for offline/demo)
  const LOCALES = {
    en: {
      'nav.report':       'Report Incident',
      'nav.map':          'Live Map',
      'nav.history':      'History',
      'nav.dashboard':    'Dashboard',
      'nav.signin':       'Sign In',
      'hero.title':       'Traffic Chaos',
      'hero.subtitle':    'Real-Time Intervention AI',
      'hero.tagline':     'From unstructured chaos to life-saving action in seconds',
      'hero.cta.report':  'Report an Incident',
      'hero.cta.map':     'View Live Map',
      'report.tab.upload':'Photo / Video',
      'report.tab.voice': 'Voice Report',
      'report.tab.text':  'Text Report',
      'report.submit':    'Analyze with Gemini AI',
      'report.location':  'Incident Location',
      'report.severity':  'Severity',
      'severity.low':     'Low',
      'severity.medium':  'Medium',
      'severity.high':    'High',
      'severity.critical':'Critical',
      'analysis.waiting': 'Ready to analyze your report',
      'analysis.loading': 'Analyzing with Gemini AI...',
      'map.title':        'Live Incident Map',
      'map.filter.all':   'All Incidents',
      'history.title':    'Incident History',
      'history.search':   'Search incidents...',
      'dashboard.title':  'Authority Dashboard',
      'dashboard.kpi.critical': 'Critical Incidents',
      'dashboard.kpi.alerts':   'Alerts Sent',
      'dashboard.kpi.response': 'Avg Response Time',
      'dashboard.kpi.confidence': 'AI Confidence',
      'footer.tagline':   'Powered by Google Gemini & Antigravity'
    },
    es: {
      'nav.report':       'Reportar Incidente',
      'nav.map':          'Mapa en Vivo',
      'nav.history':      'Historial',
      'nav.dashboard':    'Panel de Control',
      'nav.signin':       'Iniciar Sesión',
      'hero.title':       'Caos de Tráfico',
      'hero.subtitle':    'IA de Intervención en Tiempo Real',
      'hero.tagline':     'Del caos desestructurado a la acción salvavidas en segundos',
      'hero.cta.report':  'Reportar un Incidente',
      'hero.cta.map':     'Ver Mapa en Vivo',
      'report.tab.upload':'Foto / Video',
      'report.tab.voice': 'Reporte de Voz',
      'report.tab.text':  'Reporte de Texto',
      'report.submit':    'Analizar con Gemini IA',
      'report.location':  'Ubicación del Incidente',
      'report.severity':  'Severidad',
      'severity.low':     'Baja',
      'severity.medium':  'Media',
      'severity.high':    'Alta',
      'severity.critical':'Crítica',
      'analysis.waiting': 'Listo para analizar su reporte',
      'analysis.loading': 'Analizando con Gemini IA...',
      'map.title':        'Mapa de Incidentes en Vivo',
      'map.filter.all':   'Todos los Incidentes',
      'history.title':    'Historial de Incidentes',
      'history.search':   'Buscar incidentes...',
      'dashboard.title':  'Panel de Autoridades',
      'footer.tagline':   'Impulsado por Google Gemini y Antigravity'
    },
    fr: {
      'nav.report':       'Signaler un Incident',
      'nav.map':          'Carte en Direct',
      'nav.history':      'Historique',
      'nav.dashboard':    'Tableau de Bord',
      'nav.signin':       'Se Connecter',
      'hero.title':       'Chaos Traffic',
      'hero.subtitle':    "IA d'Intervention en Temps Réel",
      'hero.tagline':     "Du chaos non structuré à l'action vitale en secondes",
      'hero.cta.report':  'Signaler un Incident',
      'hero.cta.map':     'Voir la Carte en Direct',
      'report.tab.upload':'Photo / Vidéo',
      'report.tab.voice': 'Rapport Vocal',
      'report.tab.text':  'Rapport Texte',
      'report.submit':    'Analyser avec Gemini IA',
      'map.title':        'Carte des Incidents en Direct',
      'history.title':    "Historique des Incidents",
      'dashboard.title':  'Tableau de Bord des Autorités',
      'footer.tagline':   'Propulsé par Google Gemini et Antigravity'
    },
    hi: {
      'nav.report':       'घटना रिपोर्ट करें',
      'nav.map':          'लाइव मैप',
      'nav.history':      'इतिहास',
      'nav.dashboard':    'डैशबोर्ड',
      'nav.signin':       'साइन इन',
      'hero.title':       'यातायात अव्यवस्था',
      'hero.subtitle':    'रियल-टाइम हस्तक्षेप AI',
      'hero.tagline':     'अव्यवस्थित इनपुट से जीवन बचाने वाली कार्रवाई तक – सेकंडों में',
      'hero.cta.report':  'घटना रिपोर्ट करें',
      'hero.cta.map':     'लाइव मैप देखें',
      'report.tab.upload':'फ़ोटो / वीडियो',
      'report.tab.voice': 'आवाज़ रिपोर्ट',
      'report.tab.text':  'टेक्स्ट रिपोर्ट',
      'report.submit':    'Gemini AI से विश्लेषण करें',
      'map.title':        'लाइव घटना मैप',
      'history.title':    'घटना इतिहास',
      'dashboard.title':  'अधिकारी डैशबोर्ड',
      'footer.tagline':   'Google Gemini और Antigravity द्वारा संचालित'
    },
    zh: {
      'nav.report':       '报告事故',
      'nav.map':          '实时地图',
      'nav.history':      '历史记录',
      'nav.dashboard':    '管理控制台',
      'nav.signin':       '登录',
      'hero.title':       '交通混乱',
      'hero.subtitle':    '实时干预AI系统',
      'hero.tagline':     '从非结构化混乱到拯救生命的行动，只需数秒',
      'hero.cta.report':  '报告事故',
      'hero.cta.map':     '查看实时地图',
      'report.tab.upload':'照片 / 视频',
      'report.tab.voice': '语音报告',
      'report.tab.text':  '文字报告',
      'report.submit':    '使用Gemini AI分析',
      'map.title':        '实时事故地图',
      'history.title':    '事故历史',
      'dashboard.title':  '管理控制台',
      'footer.tagline':   '由Google Gemini和Antigravity提供支持'
    },
    ar: {
      'nav.report':       'الإبلاغ عن حادث',
      'nav.map':          'الخريطة المباشرة',
      'nav.history':      'السجل',
      'nav.dashboard':    'لوحة التحكم',
      'nav.signin':       'تسجيل الدخول',
      'hero.title':       'فوضى المرور',
      'hero.subtitle':    'نظام التدخل الفوري بالذكاء الاصطناعي',
      'hero.tagline':     'من الفوضى غير المنظمة إلى إجراءات إنقاذ الأرواح في ثوانٍ',
      'hero.cta.report':  'الإبلاغ عن حادث',
      'hero.cta.map':     'عرض الخريطة المباشرة',
      'report.submit':    'التحليل باستخدام Gemini AI',
      'map.title':        'خريطة الحوادث المباشرة',
      'history.title':    'سجل الحوادث',
      'dashboard.title':  'لوحة تحكم السلطات',
      'footer.tagline':   'مدعوم بـ Google Gemini و Antigravity'
    },
    ta: {
      'nav.report':       'சம்பவம் புகாரளி',
      'nav.map':          'நேரடி வரைபடம்',
      'nav.history':      'வரலாறு',
      'nav.dashboard':    'டாஷ்போர்டு',
      'nav.signin':       'உள்நுழை',
      'hero.title':       'போக்குவரத்து குழப்பம்',
      'hero.subtitle':    'நிகழ்நேர தலையீட்டு AI',
      'hero.tagline':     'ஒழுங்கற்ற உள்ளீட்டிலிருந்து உயிர்காக்கும் நடவடிக்கை வரை – நொடிகளில்',
      'hero.cta.report':  'சம்பவம் புகாரளி',
      'hero.cta.map':     'நேரடி வரைபடம் பார்',
      'report.submit':    'Gemini AI மூலம் பகுப்பாய்வு',
      'map.title':        'நேரடி சம்பவ வரைபடம்',
      'history.title':    'சம்பவ வரலாறு',
      'dashboard.title':  'அதிகார டாஷ்போர்டு',
      'footer.tagline':   'Google Gemini மற்றும் Antigravity ஆல் இயக்கப்படுகிறது'
    }
  };

  let _currentLang = 'en';

  function _detectLang() {
    // Priority: URL param > localStorage > browser
    const param   = new URLSearchParams(window.location.search).get('lang');
    const stored  = localStorage.getItem('trafficai_lang');
    const browser = (navigator.language || 'en').slice(0, 2);
    const lang    = param || stored || browser;
    return SUPPORTED.includes(lang) ? lang : 'en';
  }

  function _applyTranslations(lang) {
    const messages = LOCALES[lang] || LOCALES['en'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (messages[key]) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = messages[key];
        } else {
          el.textContent = messages[key];
        }
      }
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (messages[key]) el.setAttribute('aria-label', messages[key]);
    });
  }

  function _applyRTL(lang) {
    const isRTL = RTL_LANGS.includes(lang);
    document.documentElement.dir  = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.body.classList.toggle('rtl', isRTL);
  }

  function _renderLangPicker() {
    const existing = document.getElementById('langPicker');
    if (existing) return;

    const LABELS = { en:'🇺🇸 EN', es:'🇪🇸 ES', fr:'🇫🇷 FR', hi:'🇮🇳 HI', zh:'🇨🇳 ZH', ar:'🇸🇦 AR', ta:'🇮🇳 TA' };
    const picker = document.createElement('div');
    picker.id        = 'langPicker';
    picker.className = 'lang-picker';
    picker.setAttribute('role', 'navigation');
    picker.setAttribute('aria-label', 'Language selector');
    picker.innerHTML = `
      <button class="lang-current" id="langToggle" aria-expanded="false" aria-haspopup="listbox">
        ${LABELS[_currentLang] || '🌐'}
      </button>
      <ul class="lang-dropdown" role="listbox" aria-label="Select language" id="langDropdown">
        ${SUPPORTED.map(l => `
          <li role="option" aria-selected="${l === _currentLang}" tabindex="0"
              data-lang="${l}" class="lang-option ${l === _currentLang ? 'active' : ''}">
            ${LABELS[l]}
          </li>`).join('')}
      </ul>
    `;

    // Append to navbar
    const nav = document.querySelector('.nav-actions') || document.querySelector('nav') || document.body;
    nav.appendChild(picker);

    // Toggle dropdown
    const toggle   = picker.querySelector('#langToggle');
    const dropdown = picker.querySelector('#langDropdown');
    toggle.addEventListener('click', () => {
      const open = dropdown.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    // Select language
    picker.querySelectorAll('.lang-option').forEach(li => {
      li.addEventListener('click', () => {
        I18n.setLang(li.dataset.lang);
        dropdown.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
      li.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') li.click();
      });
    });

    document.addEventListener('click', e => {
      if (!picker.contains(e.target)) {
        dropdown.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Styles
    if (!document.getElementById('i18n-styles')) {
      const style = document.createElement('style');
      style.id = 'i18n-styles';
      style.textContent = `
        .lang-picker { position:relative;display:inline-flex;align-items:center; }
        .lang-current {
          background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
          color:#f8fafc;padding:.35rem .65rem;border-radius:8px;cursor:pointer;
          font-size:.8rem;font-weight:600;white-space:nowrap;
          transition:background .2s;
        }
        .lang-current:hover { background:rgba(255,255,255,0.15); }
        .lang-dropdown {
          position:absolute;top:calc(100% + 6px);right:0;
          background:rgba(15,23,42,0.98);border:1px solid rgba(255,255,255,0.12);
          border-radius:10px;list-style:none;margin:0;padding:.25rem;
          min-width:110px;z-index:9990;display:none;flex-direction:column;gap:2px;
          box-shadow:0 8px 32px rgba(0,0,0,0.5);
        }
        .lang-dropdown.open { display:flex; }
        .lang-option {
          padding:.45rem .65rem;border-radius:6px;cursor:pointer;color:#cbd5e1;
          font-size:.8rem;transition:background .15s;
        }
        .lang-option:hover,.lang-option.active { background:rgba(0,212,255,0.15);color:#fff; }
        body.rtl { direction:rtl; }
      `;
      document.head.appendChild(style);
    }
  }

  return {
    /** Initialize i18n */
    init() {
      _currentLang = _detectLang();
      this.setLang(_currentLang, false);
      _renderLangPicker();
    },

    /** Change the active language */
    setLang(lang, save = true) {
      if (!SUPPORTED.includes(lang)) lang = 'en';
      _currentLang = lang;
      _applyTranslations(lang);
      _applyRTL(lang);
      if (save) localStorage.setItem('trafficai_lang', lang);

      // Update active states in picker
      document.querySelectorAll('.lang-option').forEach(li => {
        const active = li.dataset.lang === lang;
        li.classList.toggle('active', active);
        li.setAttribute('aria-selected', String(active));
      });
      const toggle = document.getElementById('langToggle');
      if (toggle) {
        const LABELS = { en:'🇺🇸 EN', es:'🇪🇸 ES', fr:'🇫🇷 FR', hi:'🇮🇳 HI', zh:'🇨🇳 ZH', ar:'🇸🇦 AR', ta:'🇮🇳 TA' };
        toggle.textContent = LABELS[lang] || '🌐';
      }
    },

    /** Translate a key */
    t(key, fallback = key) {
      return LOCALES[_currentLang]?.[key] || LOCALES['en']?.[key] || fallback;
    },

    get lang()      { return _currentLang; },
    get supported() { return SUPPORTED; }
  };
})();

document.addEventListener('DOMContentLoaded', () => I18n.init());
