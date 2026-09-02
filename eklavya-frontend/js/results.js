/* ==========================================================================
   EKLAVYA — results.js
   Renders the full results dashboard from the analysis object saved in
   sessionStorage (see app.js saveAnalysisState / mock-data.js). Handles
   score animation, metrics, feedback, video playback + pose toggle,
   shot timeline, the detected-shots table and the movement profile.
   ========================================================================== */

(() => {

  const TIER_THRESHOLDS = [
    { min: 90, label: 'ELITE' },
    { min: 75, label: 'ADVANCED' },
    { min: 55, label: 'INTERMEDIATE' },
    { min: 0, label: 'DEVELOPING' }
  ];

  function tierFor(score) {
    return TIER_THRESHOLDS.find(t => score >= t.min).label;
  }

  function els() {
    return {
      demoFlag: document.getElementById('demoFlag'),
      scoreNum: document.getElementById('scoreNum'),
      scoreRingFill: document.getElementById('scoreRingFill'),
      scoreTier: document.getElementById('scoreTier'),
      scoreCopy: document.getElementById('scoreCopy'),
      detectedName: document.getElementById('detectedName'),
      detectedConfidence: document.getElementById('detectedConfidence'),
      metricsWrap: document.getElementById('metricsWrap'),
      strengthsList: document.getElementById('strengthsList'),
      improvementsList: document.getElementById('improvementsList'),
      videoStage: document.getElementById('videoStage'),
      resultVideo: document.getElementById('resultVideo'),
      toggleOriginal: document.getElementById('toggleOriginal'),
      togglePose: document.getElementById('togglePose'),
      timeline: document.getElementById('shotTimeline'),
      shotsTableBody: document.getElementById('shotsTableBody'),
      movementGrid: document.getElementById('movementGrid'),
      resultsSub: document.getElementById('resultsSub'),
      errorZone: document.getElementById('resultsErrorZone'),
      dashboard: document.getElementById('resultsDashboard')
    };
  }

  function renderErrorState(title, body) {
    const { errorZone, dashboard } = els();
    dashboard.hidden = true;
    errorZone.hidden = false;
    errorZone.innerHTML = `
      <div class="inline-error">
        <svg class="ie-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
        <div>
          <div class="ie-title">${Eklavya.escapeHtml(title)}</div>
          <div class="ie-body">${Eklavya.escapeHtml(body)}</div>
        </div>
      </div>
      <div style="margin-top:24px;">
        <a class="btn btn-primary" href="analyze.html">Try another video</a>
      </div>
    `;
  }

  function animateScore(score) {
    const { scoreNum, scoreRingFill } = els();
    const circumference = 440;
    const offset = circumference - (Math.min(100, score) / 100) * circumference;

    requestAnimationFrame(() => {
      scoreRingFill.style.strokeDashoffset = String(offset);
    });

    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      scoreNum.textContent = Math.round(eased * score);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderScore(analysis) {
    const { scoreTier, scoreCopy } = els();
    const tier = analysis.tier || tierFor(analysis.techniqueScore);
    scoreTier.textContent = tier;
    scoreCopy.textContent = tierCopy(tier);
    animateScore(analysis.techniqueScore);
  }

  function tierCopy(tier) {
    switch (tier) {
      case 'ELITE': return 'Technique is refined across nearly every checkpoint Eklavya tracks.';
      case 'ADVANCED': return 'Strong fundamentals with a couple of clear areas to sharpen further.';
      case 'INTERMEDIATE': return 'The base mechanics are there — a few adjustments will unlock more power and control.';
      default: return 'Early-stage technique. Focus on the fundamentals below before adding pace.';
    }
  }

  function renderDetectedShot(analysis) {
    const { detectedName, detectedConfidence } = els();
    detectedName.textContent = analysis.detectedActivity;
    detectedConfidence.textContent = 'RULE-BASED DETECTION';
  }

  function renderMetrics(analysis) {
    const { metricsWrap } = els();
    const metrics = analysis.metrics || {};
    const labels = analysis.metricLabels || {};
    const keys = Object.keys(metrics);

    if (keys.length === 0) {
      metricsWrap.innerHTML = `<p style="color:var(--ink-tertiary); font-size:0.9rem;">No technique breakdown available for this result.</p>`;
      return;
    }

    metricsWrap.innerHTML = keys.map(key => `
      <div class="metric-row">
        <div class="mr-name">${Eklavya.escapeHtml(labels[key] || key)}</div>
        <div class="mr-track"><div class="mr-fill" data-target="${metrics[key]}"></div></div>
        <div class="mr-val">${metrics[key]}</div>
      </div>
    `).join('');

    requestAnimationFrame(() => {
      metricsWrap.querySelectorAll('.mr-fill').forEach(el => {
        el.style.width = `${el.dataset.target}%`;
      });
    });
  }

  function renderFeedback(analysis) {
    const { strengthsList, improvementsList } = els();
    const strengths = (analysis.feedback && analysis.feedback.strengths) || [];
    const improvements = (analysis.feedback && analysis.feedback.improvements) || [];

    const checkIcon = `<svg class="cc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`;
    const arrowIcon = `<svg class="cc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

    strengthsList.innerHTML = strengths.length
      ? strengths.map(s => `<li>${checkIcon}<span>${Eklavya.escapeHtml(s)}</span></li>`).join('')
      : `<li style="color:var(--ink-tertiary);">No standout strengths flagged for this clip.</li>`;

    improvementsList.innerHTML = improvements.length
      ? improvements.map(s => `<li>${arrowIcon}<span>${Eklavya.escapeHtml(s)}</span></li>`).join('')
      : `<li style="color:var(--ink-tertiary);">No specific improvements flagged for this clip.</li>`;
  }

  async function renderVideo(analysis) {
    const { resultVideo, videoStage, toggleOriginal, togglePose } = els();
    const stored = await Eklavya.getVideoBlob();

    if (!stored || !stored.blob) {
      videoStage.innerHTML = `<div class="video-unavailable-msg">The original video isn't available in this session. Upload a new clip to watch it back.</div>`;
      return;
    }

    const originalUrl = URL.createObjectURL(stored.blob);
    resultVideo.src = originalUrl;

    let mode = 'original';
    function setMode(next) {
      mode = next;
      toggleOriginal.classList.toggle('is-active', mode === 'original');
      togglePose.classList.toggle('is-active', mode === 'pose');

      if (mode === 'pose') {
        if (analysis.hasAnnotatedVideo && analysis.annotatedVideoUrl) {
          resultVideo.src = analysis.annotatedVideoUrl;
        } else {
          videoStage.querySelector('video').style.display = 'none';
          let msg = videoStage.querySelector('.video-unavailable-msg');
          if (!msg) {
            msg = document.createElement('div');
            msg.className = 'video-unavailable-msg';
            msg.textContent = 'Pose analysis video unavailable for this result.';
            videoStage.appendChild(msg);
          }
          return;
        }
      } else {
        resultVideo.src = originalUrl;
      }
      resultVideo.style.display = 'block';
      const msg = videoStage.querySelector('.video-unavailable-msg');
      if (msg) msg.remove();
    }

    toggleOriginal.addEventListener('click', () => setMode('original'));
    togglePose.addEventListener('click', () => setMode('pose'));

    window.__eklavyaVideoEl = resultVideo;
  }

  function renderTimeline(analysis) {
    const { timeline, shotsTableBody } = els();
    const shots = analysis.shots || [];

    if (shots.length === 0) {
      timeline.innerHTML = `<p style="color:var(--ink-tertiary); font-size:0.9rem;">No individual shots were detected in this clip.</p>`;
      shotsTableBody.innerHTML = `<tr><td colspan="4" style="color:var(--ink-tertiary);">No shots to display.</td></tr>`;
      return;
    }

    timeline.innerHTML = shots.map(shot => `
      <button type="button" class="timeline-item panel" data-time="${shot.timestamp}">
        <div class="ti-time mono">${Eklavya.formatTimestamp(shot.timestamp)}</div>
        <div class="ti-shot">${Eklavya.escapeHtml(shot.type)}</div>
      </button>
    `).join('');

    shotsTableBody.innerHTML = shots.map(shot => `
      <tr data-time="${shot.timestamp}">
        <td class="st-shot-name">${Eklavya.escapeHtml(shot.type)}</td>
        <td class="mono">${Eklavya.formatTimestamp(shot.timestamp)}</td>
        <td class="mono">RULE-BASED</td>
        <td class="st-score">${shot.score}</td>
      </tr>
    `).join('');

    function jumpTo(time) {
      const video = window.__eklavyaVideoEl;
      if (!video) {
        Eklavya.showToast({ title: 'Video not ready', body: 'Load a video before jumping to a shot.' });
        return;
      }
      video.currentTime = time;
      video.play().catch(() => {});
    }

    timeline.querySelectorAll('.timeline-item').forEach(item => {
      item.addEventListener('click', () => jumpTo(Number(item.dataset.time)));
    });
    shotsTableBody.querySelectorAll('tr[data-time]').forEach(row => {
      row.addEventListener('click', () => jumpTo(Number(row.dataset.time)));
    });
  }

  function renderMovementProfile(analysis) {
    const { movementGrid } = els();
    const profile = analysis.movementProfile || {};
    const keys = Object.keys(profile);
    const labelMap = {
      explosiveness: 'Explosiveness',
      mobility: 'Mobility',
      balance: 'Balance',
      consistency: 'Consistency'
    };

    if (keys.length === 0) {
      movementGrid.closest('.movement-panel').hidden = true;
      return;
    }

    const tierClass = (val) => {
      const v = val.toUpperCase();
      if (v.includes('VERY GOOD') || v === 'HIGH') return 'tier-verygood';
      if (v === 'GOOD') return 'tier-good';
      return 'tier-high';
    };

    movementGrid.innerHTML = keys.map(key => `
      <div class="movement-item">
        <div class="mi-label">${labelMap[key] || key}</div>
        <div class="mi-val ${tierClass(profile[key])}">${profile[key]}</div>
      </div>
    `).join('');
  }

  function renderShotTrajectory() {
    return `
      <svg viewBox="0 0 280 90" preserveAspectRatio="none">
        <path d="M6,80 C 70,10 150,4 274,54" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="6" cy="80" r="4" fill="var(--accent)"/>
        <circle cx="274" cy="54" r="4" fill="var(--cyan)"/>
      </svg>
    `;
  }

  async function init() {
    if (!document.body.classList.contains('page-results')) return;

    const state = Eklavya.getAnalysisState();
    const analysis = state && state.result;

    if (!analysis) {
      renderErrorState(
        "We couldn't find an analysis to show",
        'Start a new analysis from the Analyze page to see your results here.'
      );
      return;
    }

    if (!analysis.detectedActivity || (analysis.shots && analysis.shots.length === 0 && !analysis.techniqueScore)) {
      renderErrorState(
        "We couldn't detect a clear shot",
        'Try a video with the player fully visible and enough lighting for pose detection.'
      );
      return;
    }

    const { demoFlag, resultsSub } = els();
    if (analysis.isDemo || state.mode === 'demo') {
      demoFlag.hidden = false;
    } else {
      demoFlag.hidden = true;
    }
    resultsSub.textContent = "Here's what Eklavya found in your movement.";

    document.querySelector('.shot-trajectory').innerHTML = renderShotTrajectory();

    renderScore(analysis);
    renderDetectedShot(analysis);
    renderMetrics(analysis);
    renderFeedback(analysis);
    renderTimeline(analysis);
    renderMovementProfile(analysis);
    await renderVideo(analysis);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
