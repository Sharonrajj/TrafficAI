/**
 * TrafficAI – Enhanced Voice Module (voice-first accessibility)
 * Speech Recognition + Text-to-Speech feedback + multilingual support
 */

'use strict';

const VoiceEngine = (() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;

  let _recognition  = null;
  let _isRecording  = false;
  let _fullTranscript = '';
  let _interimText    = '';
  let _onResult       = null;
  let _onStateChange  = null;

  /* ── TTS: speak a message aloud ─────────────────────────────────────── */
  function speak(text, lang = navigator.language || 'en-US', interrupt = true) {
    if (!synth) return;
    if (interrupt) synth.cancel();
    const utter  = new SpeechSynthesisUtterance(text);
    utter.lang   = lang;
    utter.rate   = 1.0;
    utter.pitch  = 1.0;
    utter.volume = 0.85;
    synth.speak(utter);
  }

  /* ── Build recognition instance ─────────────────────────────────────── */
  function _buildRecognition(lang) {
    if (!SpeechRecognition) return null;
    const r             = new SpeechRecognition();
    r.continuous        = true;
    r.interimResults    = true;
    r.maxAlternatives   = 1;
    r.lang              = lang;

    r.onresult = (event) => {
      _interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          _fullTranscript += transcript + ' ';
        } else {
          _interimText += transcript;
        }
      }
      _onResult?.({
        final:   _fullTranscript.trim(),
        interim: _interimText.trim(),
        combined: (_fullTranscript + _interimText).trim()
      });
    };

    r.onerror = (event) => {
      const msgs = {
        'not-allowed':     'Microphone access was denied. Please allow access in browser settings.',
        'no-speech':       'No speech detected. Please try again.',
        'audio-capture':   'No microphone found. Please connect a microphone.',
        'network':         'Network error. Voice recognition requires an internet connection.',
        'aborted':         'Recording stopped.',
        'service-not-allowed': 'Voice recognition is not enabled on this device.'
      };
      const msg = msgs[event.error] || `Voice error: ${event.error}`;
      Toast.show('Voice Error', msg, 'error', 4000);
      speak(msg);
      _setState('error');
    };

    r.onend = () => {
      if (_isRecording) {
        // Auto-restart if still recording (handles 60s browser limits)
        try { r.start(); } catch(e) { /* Already stopped */ }
      }
    };

    return r;
  }

  function _setState(state) {
    _isRecording = state === 'recording';
    _onStateChange?.(state);
  }

  /* ── Public API ─────────────────────────────────────────────────────── */
  return {
    /**
     * Initialize and start recording
     * @param {object} opts
     * @param {string} opts.lang - BCP 47 language tag e.g. 'en-US', 'hi-IN', 'ar-SA'
     * @param {function} opts.onResult  - called with { final, interim, combined }
     * @param {function} opts.onState   - called with 'recording'|'stopped'|'error'
     */
    start({ lang = navigator.language || 'en-US', onResult, onState } = {}) {
      if (!SpeechRecognition) {
        Toast.show('Voice Not Supported',
          'Your browser does not support voice input. Please use Chrome or Edge.', 'warning', 5000);
        return false;
      }
      _onResult      = onResult;
      _onStateChange = onState;
      _fullTranscript = '';
      _interimText    = '';

      _recognition = _buildRecognition(lang);
      try {
        _recognition.start();
        _setState('recording');
        speak('Recording started. Describe the incident clearly.', lang);
        return true;
      } catch (e) {
        Toast.show('Could not start recording', e.message, 'error', 3000);
        return false;
      }
    },

    /** Stop recording and return final transcript */
    stop() {
      _isRecording = false;
      _recognition?.stop();
      _setState('stopped');
      const text = _fullTranscript.trim() || _interimText.trim();
      if (text) speak('Recording complete. Your report has been captured.');
      return text;
    },

    /** Get current transcript */
    get transcript() { return _fullTranscript.trim(); },
    get isRecording() { return _isRecording; },

    /**
     * Speak a UI notification (screen-reader supplement)
     * @param {string} text - Content to speak
     * @param {string} lang - Optional BCP 47 tag
     */
    announce(text, lang) {
      speak(text, lang);
    },

    /** Check if voice is available */
    get isAvailable() { return !!SpeechRecognition; },

    /** Map TrafficAI language code → BCP 47 speech code */
    langToBCP47(code) {
      const map = {
        en: 'en-US', es: 'es-ES', fr: 'fr-FR',
        hi: 'hi-IN', zh: 'zh-CN', ar: 'ar-SA', ta: 'ta-IN'
      };
      return map[code] || 'en-US';
    }
  };
})();
