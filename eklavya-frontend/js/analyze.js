/* ==========================================================================
   EKLAVYA — analyze.js
   Drives the multi-step analyze workflow on analyze.html: sport selection,
   activity/shot selection, video upload, review, and handing off to the
   processing page. Persists selections via Eklavya.saveAnalysisState so
   processing.html / results.html can pick them back up.
   ========================================================================== */

(() => {

  const state = {
    step: 1,
    sport: null,
    activity: null,
    file: null,
    objectUrl: null
  };

  const SHOTS = [
    { id: 'auto', name: 'Auto Detect', desc: 'Let Eklavya identify the shot automatically.', recommended: true },
    { id: 'smash', name: 'Smash', desc: 'Explosive overhead attacking shot.' },
    { id: 'clear', name: 'Clear', desc: 'Deep shot sending shuttle to the back court.' },
    { id: 'drop', name: 'Drop', desc: 'Soft shot landing just past the net.' },
    { id: 'drive', name: 'Drive', desc: 'Fast, flat shot across mid-court.' },
    { id: 'push', name: 'Push', desc: 'Gentle net shot pushing past the opponent.' },
    { id: 'block', name: 'Block', desc: 'Defensive return of a smash.' },
    { id: 'power-clear', name: 'Power Clear', desc: 'Aggressive high-pace clear.' }
  ];

  let uploader = null;

  function els() {
    return {
      steps: document.querySelectorAll('.workflow-step'),
      tracker: document.querySelectorAll('.st-item'),
      sportsGrid: document.getElementById('sportsGrid'),
      shotGrid: document.getElementById('shotGrid'),
      toShotBtn: document.getElementById('toShotStep'),
      toUploadBtn: document.getElementById('toUploadStep'),
      backToSportBtn: document.getElementById('backToSport'),
      backToShotBtn: document.getElementById('backToShot'),
      toReviewBtn: document.getElementById('toReviewStep'),
      backToUploadBtn: document.getElementById('backToUpload'),
      dropzone: document.getElementById('dropzone'),
      fileInput: document.getElementById('fileInput'),
      uploadZoneWrap: document.getElementById('uploadZoneWrap'),
      previewWrap: document.getElementById('previewWrap'),
      previewVideo: document.getElementById('previewVideo'),
      previewFilename: document.getElementById('previewFilename'),
      previewFilesize: document.getElementById('previewFilesize'),
      removeVideoBtn: document.getElementById('removeVideoBtn'),
      replaceVideoBtn: document.getElementById('replaceVideoBtn'),
      reviewSport: document.getElementById('reviewSport'),
      reviewActivity: document.getElementById('reviewActivity'),
      reviewVideo: document.getElementById('reviewVideo'),
      reviewMode: document.getElementById('reviewMode'),
      analyzeBtn: document.getElementById('analyzeVideoBtn')
    };
  }

  function goToStep(n) {
    state.step = n;
    const { steps, tracker } = els();
    steps.forEach(sec => {
      sec.hidden = Number(sec.dataset.step) !== n;
    });
    tracker.forEach(item => {
      const stepNum = Number(item.dataset.step);
      item.classList.toggle('is-active', stepNum === n);
      item.classList.toggle('is-done', stepNum < n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderShotGrid() {
    const { shotGrid } = els();
    if (!shotGrid) return;
    shotGrid.innerHTML = SHOTS.map(shot => `
      <button type="button"
              class="shot-card panel${shot.recommended ? ' is-recommended' : ''}"
              data-shot="${shot.id}"
              aria-pressed="false">
        <div class="shot-name">${shot.name}${shot.recommended ? '<span class="shot-badge">RECOMMENDED</span>' : ''}</div>
        <p class="shot-desc">${shot.desc}</p>
      </button>
    `).join('');

    shotGrid.querySelectorAll('.shot-card').forEach(card => {
      card.addEventListener('click', () => selectShot(card.dataset.shot));
    });
  }

  function selectShot(shotId) {
    state.activity = shotId;
    const { shotGrid, toUploadBtn } = els();
    shotGrid.querySelectorAll('.shot-card').forEach(card => {
      const active = card.dataset.shot === shotId;
      card.classList.toggle('is-selected', active);
      card.setAttribute('aria-pressed', String(active));
    });
    toUploadBtn.disabled = false;
  }

  function selectSport(sportId) {
    if (sportId !== 'badminton') return; // only badminton is available in this prototype
    state.sport = sportId;
    const { sportsGrid, toShotBtn } = els();
    sportsGrid.querySelectorAll('.sport-card').forEach(card => {
      card.classList.toggle('is-selected', card.dataset.sport === sportId);
    });
    toShotBtn.disabled = false;
  }

  function initSportSelection() {
    const { sportsGrid } = els();
    if (!sportsGrid) return;
    sportsGrid.querySelectorAll('.sport-card.is-available').forEach(card => {
      card.addEventListener('click', () => selectSport(card.dataset.sport));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSport(card.dataset.sport); }
      });
    });
  }

  function initUploader() {
    const { dropzone, fileInput, uploadZoneWrap, previewWrap, previewVideo,
      previewFilename, previewFilesize, removeVideoBtn, replaceVideoBtn, toReviewBtn } = els();

    if (!dropzone) return;

    uploader = EklavyaUpload.createUploader({
      dropzone,
      fileInput,
      onFileAccepted(file, objectUrl) {
        state.file = file;
        state.objectUrl = objectUrl;
        previewVideo.src = objectUrl;
        previewFilename.textContent = file.name;
        previewFilesize.textContent = Eklavya.formatBytes(file.size);
        uploadZoneWrap.hidden = true;
        previewWrap.hidden = false;
        toReviewBtn.disabled = false;
      },
      onError(message) {
        Eklavya.showToast({ title: "Couldn't accept that file", body: message });
      },
      onRemove() {
        state.file = null;
        state.objectUrl = null;
        previewVideo.removeAttribute('src');
        uploadZoneWrap.hidden = false;
        previewWrap.hidden = true;
        toReviewBtn.disabled = true;
      }
    });

    removeVideoBtn.addEventListener('click', () => uploader.reset());
    replaceVideoBtn.addEventListener('click', () => fileInput.click());
  }

  function populateReview() {
    const { reviewSport, reviewActivity, reviewVideo, reviewMode } = els();
    const shotMeta = SHOTS.find(s => s.id === state.activity);
    reviewSport.textContent = state.sport ? 'Badminton' : '—';
    reviewActivity.textContent = shotMeta ? shotMeta.name : '—';
    reviewVideo.textContent = state.file ? state.file.name : '—';
    reviewMode.textContent = state.activity === 'auto' ? 'Pose + Auto Shot Detection' : 'Pose + Shot Detection';
  }

  async function startAnalysis() {
    const { analyzeBtn } = els();
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Starting analysis…';

    const backendUp = await EklavyaAPI.checkBackendAvailable();
    Eklavya.setMode(backendUp ? 'backend' : 'demo');

    Eklavya.saveAnalysisState({
      sport: state.sport,
      activity: state.activity,
      videoFileName: state.file ? state.file.name : null,
      videoFileSize: state.file ? state.file.size : null,
      mode: backendUp ? 'backend' : 'demo'
    });

    // Object URLs don't survive a full page navigation, so the actual
    // video bytes are handed to IndexedDB here; processing/results pages
    // pull the blob back out and mint their own object URL from it.
    if (state.file) {
      await Eklavya.saveVideoBlob(state.file);
    }

    window.location.href = 'processing.html';
  }

  function init() {
    if (!document.body.classList.contains('page-analyze')) return;
    renderShotGrid();
    initSportSelection();
    initUploader();

    const { toShotBtn, toUploadBtn, backToSportBtn, backToShotBtn,
      toReviewBtn, backToUploadBtn, analyzeBtn } = els();

    toShotBtn.addEventListener('click', () => goToStep(2));
    backToSportBtn.addEventListener('click', () => goToStep(1));
    toUploadBtn.addEventListener('click', () => goToStep(3));
    backToShotBtn.addEventListener('click', () => goToStep(2));
    toReviewBtn.addEventListener('click', () => { populateReview(); goToStep(4); });
    backToUploadBtn.addEventListener('click', () => goToStep(3));
    analyzeBtn.addEventListener('click', startAnalysis);

    goToStep(1);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
