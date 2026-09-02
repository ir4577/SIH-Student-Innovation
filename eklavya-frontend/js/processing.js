/* ==========================================================================
   EKLAVYA — processing.js
   Drives the immersive "analyzing" experience on processing.html. In
   Demo Mode this simulates progress against the fixed stage list from
   mock-data.js; when a real backend is connected it would instead poll
   EklavyaAPI.getAnalysisResult() and map its status onto the same UI.
   ========================================================================== */

(() => {

  const TOTAL_DURATION_MS = 7000;
  const TICK_MS = 90;

  function els() {
    return {
      percent: document.getElementById('procPercent'),
      stageLabel: document.getElementById('procStageLabel'),
      barFill: document.getElementById('procBarFill'),
      currentProcess: document.getElementById('procCurrentProcess'),
      log: document.getElementById('procLog'),
      frameCurrent: document.getElementById('pvFrameCurrent'),
      frameTotal: document.getElementById('pvFrameTotal')
    };
  }

  function renderLog(stages, activeIndex) {
    const { log } = els();
    log.innerHTML = stages.map((stage, i) => {
      const state = i < activeIndex ? 'is-done' : (i === activeIndex ? 'is-current' : '');
      return `<div class="proc-log-item ${state}">
        <span class="pli-mark"></span><span>${stage}</span>
      </div>`;
    }).join('');
  }

  function runDemoProgress() {
    const stages = EklavyaMock.PROCESSING_STAGES;
    const { percent, stageLabel, barFill, currentProcess, frameCurrent, frameTotal } = els();
    const totalFrames = 412;
    frameTotal.textContent = String(totalFrames).padStart(4, '0');

    let elapsed = 0;
    renderLog(stages, 0);

    const interval = setInterval(() => {
      elapsed += TICK_MS;
      let pct = Math.min(100, Math.round((elapsed / TOTAL_DURATION_MS) * 100));
      const stageIndex = Math.min(stages.length - 1, Math.floor((pct / 100) * stages.length));

      percent.textContent = `${pct}%`;
      barFill.style.width = `${pct}%`;
      stageLabel.textContent = stages[stageIndex];
      currentProcess.innerHTML = `Current process: <strong>${stages[stageIndex]}</strong>`;
      frameCurrent.textContent = String(Math.min(totalFrames, Math.round((pct / 100) * totalFrames))).padStart(4, '0');
      renderLog(stages, stageIndex);

      if (pct >= 100) {
        clearInterval(interval);
        stageLabel.textContent = 'Analysis complete';
        currentProcess.innerHTML = `Current process: <strong>Finalizing results</strong>`;
        renderLog(stages, stages.length);
        setTimeout(finishAndRedirect, 500);
      }
    }, TICK_MS);
  }

  function finishAndRedirect() {
    const existing = Eklavya.getAnalysisState() || {};
    const analysis = EklavyaMock.buildMockAnalysis({
      sport: existing.sport || 'badminton',
      selectedActivity: existing.activity || 'auto'
    });
    Eklavya.saveAnalysisState({ result: analysis, mode: 'demo' });
    window.location.href = 'results.html';
  }

  async function init() {
    if (!document.body.classList.contains('page-processing')) return;

    const state = Eklavya.getAnalysisState();
    if (!state || !state.sport) {
      // Nothing to process — send the user back to start a real workflow.
      window.location.href = 'analyze.html';
      return;
    }

    // This prototype's backend is not yet a live API (see api.js), so
    // processing always runs in the simulated Demo Mode path. The branch
    // below is where a live poll loop against EklavyaAPI would replace
    // runDemoProgress() once /api/analyze exists.
    if (state.mode === 'backend') {
      try {
        const stored = await Eklavya.getVideoBlob();

        if (!stored || !stored.blob) {
          throw new Error('Video not found');
        }

        const file = new File(
          [stored.blob],
          stored.name,
          { type: stored.type }
        );

        const result = await EklavyaAPI.uploadVideo(file, {
          sport: state.sport,
          activity: state.activity
        });

        console.log('Backend result:', result);

        const backend = result.analysis;

        const analysis = {
          ...backend,

          techniqueScore: 0,
          tier: 'DEVELOPING',

          detectedActivity: backend.shots?.[0]?.classification || 'Unknown',
          confidence: 0,

          metrics: {},

          metricLabels: {},

          feedback: {
            strengths: [],
            improvements: []
          },

          shots: (backend.shots || []).map(shot => ({
            type: shot.classification,
            timestamp: shot.frame / 30,
            confidence: 1,
            score: 0
          })),

          movementProfile: {},

          hasAnnotatedVideo: false
        };

        Eklavya.saveAnalysisState({
          result: analysis,
          videoId: result.video_id,
          mode: 'backend'
        });

        window.location.href = 'results.html';

      } catch (err) {
        console.error('Backend analysis failed:', err);

        Eklavya.showToast({
          title: 'Analysis failed',
          body: err.message
        });
      }

      return;
    }

    runDemoProgress();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
