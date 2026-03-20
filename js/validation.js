/**
 * TrafficAI – Input Validation Module
 * Client-side validation for all report inputs: files, text, location, voice
 * Mirrors server-side validation for fast UX feedback.
 */

'use strict';

const Validator = (() => {

  /* ── Configuration ──────────────────────────────────────────────────── */
  const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/webm'
  ]);
  const MAX_FILE_SIZE_MB   = 100;
  const MAX_FILES          = 5;
  const MAX_TEXT_LENGTH    = 2000;
  const MIN_TEXT_LENGTH    = 10;

  /* ── Magic-byte checks (MIME sniffing) ──────────────────────────────── */
  const MAGIC_BYTES = [
    { signature: [0xFF, 0xD8, 0xFF],             type: 'image/jpeg' },
    { signature: [0x89, 0x50, 0x4E, 0x47],       type: 'image/png'  },
    { signature: [0x52, 0x49, 0x46, 0x46],       type: 'image/webp' }, // partial
    { signature: [0x00, 0x00, 0x00, 0x18],       type: 'video/mp4'  }, // partial ftyp
    { signature: [0x00, 0x00, 0x00, 0x1C],       type: 'video/mp4'  },
    { signature: [0x1A, 0x45, 0xDF, 0xA3],       type: 'video/webm' },
    { signature: [0x52, 0x49, 0x46, 0x46],       type: 'audio/wav'  },
    { signature: [0xFF, 0xFB],                   type: 'audio/mpeg' },
    { signature: [0x4F, 0x67, 0x67, 0x53],       type: 'audio/ogg'  }
  ];

  async function _checkMagicBytes(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const bytes = new Uint8Array(e.target.result);
        const matched = MAGIC_BYTES.some(m =>
          m.signature.every((b, i) => bytes[i] === b)
        );
        resolve(matched);
      };
      reader.readAsArrayBuffer(file.slice(0, 16));
    });
  }

  /* ── PII detection in text ──────────────────────────────────────────── */
  const PII_PATTERNS = [
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/,                  label: 'SSN' },
    { pattern: /\b[A-Z]{2}\d{6,9}\b/,                     label: 'Passport/ID' },
    { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, label: 'Credit card' },
    { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, label: 'Email address' },
    { pattern: /\b\d{10}\b|\+\d{1,2}[\s-]?\d{10}\b/,     label: 'Phone number' }
  ];

  function _detectPII(text) {
    const found = PII_PATTERNS.filter(p => p.pattern.test(text));
    return found.map(p => p.label);
  }

  /* ── Sanitize text (strip HTML tags, trim) ──────────────────────────── */
  function _sanitizeText(text) {
    return text
      .replace(/<[^>]*>/g, '')           // strip HTML
      .replace(/[<>"'`]/g, '')           // strip dangerous chars
      .trim();
  }

  /* ── Result builder ─────────────────────────────────────────────────── */
  function _result(valid, errors = [], warnings = []) {
    return { valid, errors, warnings };
  }

  /* ── Public API ─────────────────────────────────────────────────────── */
  return {

    /**
     * Validate a FileList or array of Files
     * @returns {Promise<{valid: boolean, errors: string[], warnings: string[]}>}
     */
    async validateFiles(files) {
      const errors   = [];
      const warnings = [];
      const fileArr  = Array.from(files || []);

      if (fileArr.length === 0) {
        return _result(false, ['Please select at least one file.']);
      }
      if (fileArr.length > MAX_FILES) {
        errors.push(`Maximum ${MAX_FILES} files allowed. You selected ${fileArr.length}.`);
      }

      for (const file of fileArr.slice(0, MAX_FILES)) {
        const sizeMB = file.size / (1024 * 1024);

        // Size check
        if (sizeMB > MAX_FILE_SIZE_MB) {
          errors.push(`"${file.name}" is ${sizeMB.toFixed(1)}MB — maximum is ${MAX_FILE_SIZE_MB}MB.`);
          continue;
        }

        // MIME type declared type check
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
          errors.push(`"${file.name}" has unsupported file type (${file.type || 'unknown'}).`);
          continue;
        }

        // Magic bytes verification
        const magicOk = await _checkMagicBytes(file);
        if (!magicOk) {
          errors.push(`"${file.name}" failed content verification — file may be corrupted or disguised.`);
        }

        // Large file warning
        if (sizeMB > 50) {
          warnings.push(`"${file.name}" is large (${sizeMB.toFixed(1)}MB). Upload may take longer.`);
        }
      }

      return _result(errors.length === 0, errors, warnings);
    },

    /**
     * Validate text report input
     * @returns {{valid: boolean, sanitized: string, errors: string[], warnings: string[]}}
     */
    validateText(rawText) {
      const errors   = [];
      const warnings = [];
      const text     = _sanitizeText(rawText || '');

      if (text.length < MIN_TEXT_LENGTH) {
        errors.push(`Description too short — please provide at least ${MIN_TEXT_LENGTH} characters.`);
      }
      if (text.length > MAX_TEXT_LENGTH) {
        errors.push(`Description too long — maximum ${MAX_TEXT_LENGTH} characters.`);
      }

      // PII warning
      const piiFound = _detectPII(text);
      if (piiFound.length > 0) {
        warnings.push(`Your text may contain personal information (${piiFound.join(', ')}). It will be anonymized before submission.`);
      }

      return { ..._result(errors.length === 0, errors, warnings), sanitized: text };
    },

    /**
     * Validate location input
     */
    validateLocation(location) {
      const errors = [];
      if (!location || (!location.coords && !location.manualText)) {
        errors.push('Please provide an incident location (GPS or description).');
        return _result(false, errors);
      }
      if (location.manualText && location.manualText.trim().length < 4) {
        errors.push('Location description is too vague. Please include a street name or landmark.');
      }
      if (location.coords) {
        const { lat, lng } = location.coords;
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          errors.push('Invalid GPS coordinates detected. Please re-enable location access.');
        }
      }
      return _result(errors.length === 0, errors);
    },

    /**
     * Validate severity selection
     */
    validateSeverity(severity) {
      const valid = ['low', 'medium', 'high', 'critical'];
      if (!severity || !valid.includes(severity)) {
        return _result(false, ['Please select an incident severity level.']);
      }
      return _result(true);
    },

    /**
     * Full form validation orchestrator
     */
    async validateReportForm({ files, text, voiceTranscript, location, severity }) {
      const allErrors   = [];
      const allWarnings = [];
      let hasContent    = false;

      // Must have at least one content type
      if (files?.length > 0) {
        const r = await this.validateFiles(files);
        allErrors.push(...r.errors);
        allWarnings.push(...r.warnings);
        if (r.valid) hasContent = true;
      }
      if (text?.trim()?.length >= MIN_TEXT_LENGTH) {
        const r = this.validateText(text);
        allErrors.push(...r.errors);
        allWarnings.push(...r.warnings);
        if (r.valid) hasContent = true;
      }
      if (voiceTranscript?.trim()?.length >= MIN_TEXT_LENGTH) hasContent = true;

      if (!hasContent) {
        allErrors.push('Please provide at least one input: photo/video, voice recording, or text description.');
      }

      const locResult = this.validateLocation(location);
      allErrors.push(...locResult.errors);

      const sevResult = this.validateSeverity(severity);
      allErrors.push(...sevResult.errors);

      return _result(allErrors.length === 0, allErrors, allWarnings);
    },

    /**
     * Display validation errors in the UI
     */
    displayErrors(errors, warnings, containerId = 'validationErrors') {
      let el = document.getElementById(containerId);
      if (!el) {
        el = document.createElement('div');
        el.id = containerId;
        el.setAttribute('role', 'alert');
        el.setAttribute('aria-live', 'assertive');
        document.querySelector('.report-form')?.prepend(el);
      }
      el.innerHTML = '';
      if (errors.length > 0) {
        el.innerHTML += `<ul class="validation-errors" aria-label="Form errors">
          ${errors.map(e => `<li>⚠️ ${e}</li>`).join('')}</ul>`;
      }
      if (warnings.length > 0) {
        el.innerHTML += `<ul class="validation-warnings" aria-label="Form warnings">
          ${warnings.map(w => `<li>ℹ️ ${w}</li>`).join('')}</ul>`;
      }
    },

    /** Clear displayed validation messages */
    clearErrors(containerId = 'validationErrors') {
      document.getElementById(containerId)?.remove();
    },

    /** Sanitize text publicly */
    sanitize: _sanitizeText
  };
})();
