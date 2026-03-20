/**
 * TrafficAI - Report Page JavaScript
 * Handles: file upload, voice recording, text input,
 * AI analysis simulation, result rendering
 */

'use strict';

/* =============================================
   STATE
   ============================================= */
const ReportState = {
  activeTab: 'upload',
  files: [],
  voiceBlob: null,
  voiceTranscript: '',
  textInput: '',
  location: null,
  severity: 'medium',
  isProcessing: false,
  hasInput: false,
  mediaStream: null,
  mediaRecorder: null,
  recordingInterval: null,
  recordingSeconds: 0
};


/* =============================================
   TABS
   ============================================= */
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      ReportState.activeTab = tabId;

      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      panels.forEach(panel => {
        panel.hidden = true;
        panel.classList.remove('active');
      });
      const active = document.getElementById(`${tabId}Panel`);
      if (active) {
        active.hidden = false;
        active.classList.add('active');
      }

      updateSubmitButton();
    });
  });
}


/* =============================================
   FILE UPLOAD
   ============================================= */
function initUpload() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');
  const preview = document.getElementById('filePreviewArea');

  if (!zone) return;

  // Click to open file picker
  zone.addEventListener('click', () => input && input.click());
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input && input.click();
    }
  });

  // Drag and Drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files));
  });

  // File input change
  if (input) {
    input.addEventListener('change', () => {
      handleFiles(Array.from(input.files));
      input.value = ''; // Reset so same file can be re-selected
    });
  }

  function handleFiles(newFiles) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/mov', 'video/quicktime', 'video/avi'];
    const maxSize = 100 * 1024 * 1024; // 100MB

    newFiles.forEach(file => {
      if (!validTypes.includes(file.type)) {
        Toast.show('Invalid File Type', `${file.name} is not a supported format.`, 'error');
        return;
      }
      if (file.size > maxSize) {
        Toast.show('File Too Large', `${file.name} exceeds 100MB limit.`, 'error');
        return;
      }
      if (ReportState.files.length >= 5) {
        Toast.show('Too Many Files', 'Maximum 5 files per report.', 'warning');
        return;
      }

      ReportState.files.push(file);
      addFilePreview(file, preview);
    });

    if (ReportState.files.length) {
      ReportState.hasInput = true;
      updateSubmitButton();
    }
  }

  function addFilePreview(file, container) {
    const item = document.createElement('div');
    item.className = 'file-preview-item';

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (isImage) {
      const img = document.createElement('img');
      img.alt = file.name;
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.readAsDataURL(file);
      item.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'file-preview-type';
      placeholder.innerHTML = `<span>${isVideo ? '🎥' : '📄'}</span>`;
      item.appendChild(placeholder);
    }

    const name = document.createElement('div');
    name.className = 'file-preview-name';
    name.textContent = file.name;
    item.appendChild(name);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = ReportState.files.indexOf(file);
      if (idx > -1) ReportState.files.splice(idx, 1);
      item.remove();
      if (!ReportState.files.length) {
        ReportState.hasInput = ReportState.voiceTranscript.length > 0 || ReportState.textInput.length > 0;
        updateSubmitButton();
      }
    });
    item.appendChild(removeBtn);
    container.appendChild(item);
  }
}


/* =============================================
   VOICE RECORDING
   ============================================= */
function initVoiceRecording() {
  const btn = document.getElementById('voiceBtn');
  const statusText = document.getElementById('voiceStatusText');
  const timer = document.getElementById('voiceTimer');
  const visualizer = document.getElementById('voiceVisualizer');
  const transcriptionText = document.getElementById('transcriptionText');
  const indicator = document.getElementById('transcriptionIndicator');

  if (!btn) return;

  let isRecording = false;

  btn.addEventListener('click', async () => {
    if (!isRecording) {
      await startRecording();
    } else {
      stopRecording();
    }
  });

  async function startRecording() {
    try {
      // Check browser support
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        // Fallback for browsers without mic support (demo mode)
        simulateVoiceRecording();
        return;
      }

      ReportState.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      ReportState.mediaRecorder = new MediaRecorder(ReportState.mediaStream);
      const chunks = [];

      ReportState.mediaRecorder.ondataavailable = e => chunks.push(e.data);
      ReportState.mediaRecorder.onstop = () => {
        ReportState.voiceBlob = new Blob(chunks, { type: 'audio/webm' });
        ReportState.hasInput = true;
        updateSubmitButton();
      };

      ReportState.mediaRecorder.start();
      isRecording = true;
      btn.classList.add('recording');
      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', 'Stop voice recording');
      visualizer.classList.add('recording');
      statusText.textContent = 'Recording... Press to stop';
      indicator.classList.add('active');

      // Simulate transcription
      simulateTranscription(transcriptionText);

      // Timer
      ReportState.recordingSeconds = 0;
      ReportState.recordingInterval = setInterval(() => {
        ReportState.recordingSeconds++;
        const mins = Math.floor(ReportState.recordingSeconds / 60);
        const secs = ReportState.recordingSeconds % 60;
        timer.textContent = `${mins}:${String(secs).padStart(2, '0')}`;

        // Auto-stop at 2 minutes
        if (ReportState.recordingSeconds >= 120) stopRecording();
      }, 1000);

    } catch (err) {
      // Demo fallback
      simulateVoiceRecording();
    }
  }

  function stopRecording() {
    isRecording = false;
    btn.classList.remove('recording');
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Start voice recording');
    visualizer.classList.remove('recording');
    statusText.textContent = 'Recording saved — ready to submit';
    indicator.classList.remove('active');

    clearInterval(ReportState.recordingInterval);

    if (ReportState.mediaRecorder && ReportState.mediaRecorder.state !== 'inactive') {
      ReportState.mediaRecorder.stop();
    }
    if (ReportState.mediaStream) {
      ReportState.mediaStream.getTracks().forEach(t => t.stop());
    }
  }

  function simulateVoiceRecording() {
    isRecording = true;
    btn.classList.add('recording');
    visualizer.classList.add('recording');
    statusText.textContent = 'Recording... (Demo mode)';
    indicator.classList.add('active');

    const demoTranscripts = [
      "There's a bad accident on the highway...",
      "...two cars collided near the bridge...",
      "...debris blocking the right lane...",
      "...traffic is backing up really badly...",
      "...I think someone might be injured..."
    ];
    let idx = 0;
    transcriptionText.textContent = '';
    transcriptionText.classList.add('populated');

    const typeInterval = setInterval(() => {
      if (idx < demoTranscripts.length) {
        transcriptionText.textContent += (idx === 0 ? '' : ' ') + demoTranscripts[idx];
        idx++;
      } else {
        clearInterval(typeInterval);
        ReportState.voiceTranscript = transcriptionText.textContent;
        ReportState.hasInput = true;
        updateSubmitButton();
        stopSim();
      }
    }, 1400);

    let secs = 0;
    ReportState.recordingInterval = setInterval(() => {
      secs++;
      const mins = Math.floor(secs / 60);
      timer.textContent = `${mins}:${String(secs % 60).padStart(2, '0')}`;
    }, 1000);

    function stopSim() {
      btn.classList.remove('recording');
      visualizer.classList.remove('recording');
      statusText.textContent = 'Recording complete — ready to submit';
      indicator.classList.remove('active');
      clearInterval(ReportState.recordingInterval);
    }
  }

  function simulateTranscription(el) {
    const phrases = [
      'Listening...',
      'There is a bad accident...',
      'Two vehicles on the highway...',
      'Lane blocked, debris on road...',
      'People may be injured...'
    ];
    let i = 0;
    el.textContent = '';
    el.classList.add('populated');

    const interval = setInterval(() => {
      if (i < phrases.length && isRecording) {
        el.textContent = phrases.slice(0, i + 1).join(' ');
        ReportState.voiceTranscript = el.textContent;
        i++;
      } else if (!isRecording) {
        clearInterval(interval);
      }
    }, 1500);
  }
}


/* =============================================
   TEXT INPUT
   ============================================= */
function initTextInput() {
  const textarea = document.getElementById('textReport');
  const charCount = document.getElementById('textCharCount');

  if (!textarea) return;

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    if (charCount) {
      charCount.textContent = `${len} / 2000`;
      charCount.className = 'char-count' + (len > 1800 ? ' near-limit' : '') + (len >= 2000 ? ' at-limit' : '');
    }
    ReportState.textInput = textarea.value.trim();
    ReportState.hasInput = ReportState.textInput.length > 0;
    updateSubmitButton();
  });
}


/* =============================================
   LOCATION
   ============================================= */
function initLocation() {
  const geoBtn = document.getElementById('geolocateBtn');
  const input = document.getElementById('locationInput');
  const confirmed = document.getElementById('locationConfirmed');

  if (geoBtn) {
    geoBtn.addEventListener('click', () => {
      geoBtn.disabled = true;
      geoBtn.textContent = 'Getting location...';

      if (!navigator.geolocation) {
        // Demo fallback
        setDemoLocation(confirmed);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          ReportState.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          confirmed.textContent = `📍 GPS location obtained (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
          geoBtn.textContent = '✓ Location Set';
          geoBtn.disabled = false;
          Toast.show('Location Set', 'GPS coordinates captured successfully.', 'success');
        },
        () => {
          setDemoLocation(confirmed);
          geoBtn.disabled = false;
        }
      );
    });
  }

  if (input) {
    input.addEventListener('input', () => {
      const val = input.value.trim();
      if (val.length > 3) {
        ReportState.location = { address: val };
        confirmed.textContent = `📍 Location: ${val}`;
      }
    });
  }

  function setDemoLocation(el) {
    ReportState.location = { lat: 37.7749, lng: -122.4194, address: 'San Francisco, CA (demo)' };
    el.textContent = '📍 San Francisco, CA (demo location)';
    geoBtn && (geoBtn.textContent = '✓ Demo Location Set');
    geoBtn && (geoBtn.disabled = false);
  }
}


/* =============================================
   SEVERITY SELECTION
   ============================================= */
function initSeverity() {
  document.querySelectorAll('input[name="severity"]').forEach(radio => {
    radio.addEventListener('change', () => {
      ReportState.severity = radio.value;
    });
  });
}


/* =============================================
   SUBMIT BUTTON
   ============================================= */
function updateSubmitButton() {
  const btn = document.getElementById('submitBtn');
  const txt = document.getElementById('submitBtnText');
  if (!btn) return;

  const tabInputMap = {
    upload: ReportState.files.length > 0,
    voice: ReportState.voiceTranscript.length > 0 || ReportState.voiceBlob !== null,
    text: ReportState.textInput.length > 5
  };

  const hasInput = tabInputMap[ReportState.activeTab];

  btn.disabled = !hasInput || ReportState.isProcessing;
  if (txt) {
    txt.textContent = hasInput ? 'Analyze with Gemini AI' : 'Add Input to Submit';
  }
}


/* =============================================
   ANALYSIS WORKFLOW
   ============================================= */
function initSubmit() {
  const btn = document.getElementById('submitBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (ReportState.isProcessing) return;
    startAnalysis();
  });
}

async function startAnalysis() {
  ReportState.isProcessing = true;

  const placeholder = document.getElementById('analysisPlaceholder');
  const active = document.getElementById('analysisActive');
  const results = document.getElementById('analysisResults');
  const panelStatus = document.getElementById('panelStatus');
  const panelStatusText = document.getElementById('panelStatusText');
  const submitBtn = document.getElementById('submitBtn');
  const submitTxt = document.getElementById('submitBtnText');
  const uploadProgress = document.getElementById('uploadProgress');

  // Show processing state
  if (placeholder) placeholder.hidden = true;
  if (results) results.hidden = true;
  if (active) active.hidden = false;
  if (panelStatus) panelStatus.querySelector('.status-dot').className = 'status-dot active';
  if (panelStatusText) panelStatusText.textContent = 'Gemini analyzing...';
  if (submitBtn) submitBtn.disabled = true;
  if (submitTxt) submitTxt.textContent = 'Analyzing...';
  if (uploadProgress) uploadProgress.removeAttribute('aria-hidden');

  // AI processing steps
  const aiSteps = document.getElementById('aiSteps');
  if (aiSteps) aiSteps.innerHTML = '';

  const steps = [
    { icon: '☁️', text: 'Uploading to Cloud Storage...' },
    { icon: '🧠', text: 'Gemini multimodal analysis...' },
    { icon: '🔍', text: 'Extracting incident details...' },
    { icon: '✅', text: 'Verifying with live traffic data...' },
    { icon: '⚡', text: 'Triggering action flow...' }
  ];

  // Progress bar simulation
  let progress = 0;
  const progressBar = document.getElementById('progressBar');
  const progressPct = document.getElementById('progressPct');
  const psteps = document.querySelectorAll('.pstep');

  const progressInterval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 8, 95);
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressPct) progressPct.textContent = `${Math.floor(progress)}%`;
    const stepIdx = Math.floor((progress / 100) * psteps.length);
    psteps.forEach((s, i) => {
      s.className = 'pstep' + (i < stepIdx ? ' done' : i === stepIdx ? ' active' : '');
    });
    const progressOuter = uploadProgress ? uploadProgress.querySelector('[role="progressbar"]') : null;
    if (progressOuter) progressOuter.setAttribute('aria-valuenow', Math.floor(progress));
  }, 400);

  // Show AI steps with staggered animation
  for (let i = 0; i < steps.length; i++) {
    await new Promise(r => setTimeout(r, 700));
    if (aiSteps) {
      const step = document.createElement('div');
      step.className = 'ai-step processing';
      step.innerHTML = `
        <div class="ai-step-icon">${steps[i].icon}</div>
        <div class="ai-step-text">${steps[i].text}</div>
        <div class="spinner"></div>
      `;
      aiSteps.appendChild(step);

      // After brief pause, mark done
      await new Promise(r => setTimeout(r, 500));
      step.className = 'ai-step done';
      step.querySelector('.spinner').textContent = '✓';
      step.querySelector('.spinner').className = '';
    }
  }

  // Get AI result
  const inputData = {
    files: ReportState.files,
    transcript: ReportState.voiceTranscript,
    text: ReportState.textInput,
    location: ReportState.location,
    severity: ReportState.severity
  };

  const result = await window.TrafficAI.simulateAnalysis(inputData);

  // Complete progress
  clearInterval(progressInterval);
  if (progressBar) { progressBar.style.width = '100%'; }
  if (progressPct) progressPct.textContent = '100%';
  psteps.forEach(s => s.className = 'pstep done');
  await new Promise(r => setTimeout(r, 400));

  // Add to data store
  const incident = window.TrafficAI.addIncident({
    type: result.type,
    severity: result.severity,
    title: result.title,
    description: result.description,
    location: result.location,
    coordinates: result.coordinates,
    confidence: result.confidence,
    inputTypes: [ReportState.activeTab === 'upload' ? (ReportState.files[0]?.type.startsWith('video') ? 'video' : 'photo') : ReportState.activeTab],
    geminiAnalysis: result.geminiAnalysis || result.details
  });

  // Show results
  showResults(result);

  // Reset processing state
  ReportState.isProcessing = false;
  if (submitBtn) submitBtn.disabled = false;
  if (submitTxt) submitTxt.textContent = 'Submit Another Report';
  if (panelStatusText) panelStatusText.textContent = 'Analysis complete';
  if (panelStatus) panelStatus.querySelector('.status-dot').className = 'status-dot active';
  if (uploadProgress) uploadProgress.setAttribute('aria-hidden', 'true');

  Toast.show('Analysis Complete', `Incident classified as ${result.severity.toUpperCase()} — ${result.title}`, 'success');
}

function showResults(result) {
  const active = document.getElementById('analysisActive');
  const resultsEl = document.getElementById('analysisResults');

  if (active) active.hidden = true;
  if (resultsEl) {
    resultsEl.hidden = false;

    // Confidence Ring
    const confPct = Math.round(result.confidence * 100);
    const confCircle = document.getElementById('confCircle');
    const confValue = document.getElementById('confValue');
    if (confCircle) {
      const circumference = 251;
      const offset = circumference - (confPct / 100) * circumference;
      confCircle.style.transition = 'stroke-dashoffset 1.2s ease';
      confCircle.style.strokeDashoffset = offset;
      // Color by confidence
      confCircle.style.stroke = confPct > 85 ? '#00ff88' : confPct > 70 ? '#00d4ff' : '#fbbf24';
    }
    if (confValue) {
      setTimeout(() => {
        let n = 0;
        const interval = setInterval(() => {
          n = Math.min(n + 2, confPct);
          confValue.textContent = `${n}%`;
          if (n >= confPct) clearInterval(interval);
        }, 20);
      }, 300);
    }

    // Tags
    const tagsEl = document.getElementById('resultTags');
    if (tagsEl) {
      tagsEl.innerHTML = `
        <span class="severity-badge ${result.severity}">${result.severity}</span>
        <span class="tag">${result.type}</span>
        ${result.requiresEmergencyResponse ? '<span class="severity-badge critical">Emergency</span>' : ''}
      `;
    }

    // Incident Details
    const detailsEl = document.getElementById('incidentDetails');
    if (detailsEl) {
      const details = result.details || {};
      detailsEl.innerHTML = Object.entries(details).map(([k, v]) => `
        <div class="detail-item">
          <div class="detail-label">${k}</div>
          <div class="detail-value">${v}</div>
        </div>
      `).join('') + `
        <div class="detail-item">
          <div class="detail-label">Location</div>
          <div class="detail-value">${result.location || 'Detected'}</div>
        </div>
      `;
    }

    // Actions
    const actionsEl = document.getElementById('actionsList');
    if (actionsEl) {
      actionsEl.innerHTML = result.actions.map(action => `
        <div class="action-item ${action.type}">
          <span class="action-icon">${action.icon}</span>
          <span>${action.text}</span>
        </div>
      `).join('');
    }

    // JSON Output
    const jsonCode = document.getElementById('jsonCode');
    if (jsonCode) {
      jsonCode.textContent = JSON.stringify(result.structuredJSON, null, 2);
      // Syntax highlight basic
      jsonCode.innerHTML = jsonCode.textContent
        .replace(/"([^"]+)":/g, '<span style="color:#7c3aed">"$1"</span>:')
        .replace(/: "([^"]+)"/g, ': <span style="color:#00ff88">"$1"</span>')
        .replace(/: (\d+\.?\d*)/g, ': <span style="color:#fbbf24">$1</span>')
        .replace(/: (true|false|null)/g, ': <span style="color:#ff6b35">$1</span>');
    }

    // Authority Alert
    const authAlert = document.getElementById('authorityAlert');
    if (authAlert) {
      authAlert.hidden = !result.requiresEmergencyResponse;
      if (result.requiresEmergencyResponse) {
        Toast.show('Authorities Alerted!', 'Emergency services notified due to high severity.', 'warning', 8000);
      }
    }

    // Copy JSON button
    const copyBtn = document.getElementById('copyJsonBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = JSON.stringify(result.structuredJSON, null, 2);
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.textContent = '✓ Copied!';
            copyBtn.className = 'btn-copy copied';
            setTimeout(() => {
              copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2"/></svg> Copy JSON`;
              copyBtn.className = 'btn-copy';
            }, 2000);
          });
        }
      });
    }
  }
}


/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initUpload();
  initVoiceRecording();
  initTextInput();
  initLocation();
  initSeverity();
  initSubmit();
});
