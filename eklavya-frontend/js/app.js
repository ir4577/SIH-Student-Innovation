/* ==========================================================================
   EKLAVYA — app.js
   Global UI: navigation, backend/demo status indicator, toast system,
   shared helpers used across every page.
   ========================================================================== */

const Eklavya = (() => {

  const STORAGE_KEYS = {
    ANALYSIS: 'eklavyaAnalysis',
    MODE: 'eklavyaMode' // "demo" | "backend"
  };

  /** Determine current mode. Defaults to demo until a real backend answers. */
  function getMode() {
    return sessionStorage.getItem(STORAGE_KEYS.MODE) || 'demo';
  }

  function setMode(mode) {
    sessionStorage.setItem(STORAGE_KEYS.MODE, mode);
    renderStatusPill();
  }

  function renderStatusPill() {
    const pill = document.querySelector('[data-status-pill]');
    if (!pill) return;
    const mode = getMode();
    const dot = pill.querySelector('.status-dot');
    const label = pill.querySelector('[data-status-label]');
    if (mode === 'backend') {
      pill.classList.add('is-connected');
      if (label) label.textContent = 'BACKEND CONNECTED';
    } else {
      pill.classList.remove('is-connected');
      if (label) label.textContent = 'DEMO MODE';
    }
  }

  function markActiveNav() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.main-nav a[data-page]').forEach((link) => {
      if (link.dataset.page === path) link.classList.add('is-active');
    });
  }

  function initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.main-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open-mobile');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  /* ---------------------------------------------------------------------
     Toasts
     --------------------------------------------------------------------- */

  function ensureToastStack() {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    return stack;
  }

  function showToast({ title, body, type = 'default', duration = 5000 }) {
    const stack = ensureToastStack();
    const toast = document.createElement('div');
    toast.className = `toast${type === 'success' ? ' toast-success' : ''}`;
    toast.innerHTML = `
      ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
      <div class="toast-body">${escapeHtml(body || '')}</div>
    `;
    stack.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 220ms ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 240);
    }, duration);
  }

  /* ---------------------------------------------------------------------
     Small utils
     --------------------------------------------------------------------- */

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  }

  function formatTimestamp(seconds) {
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(2).padStart(5, '0');
    return `${String(m).padStart(2, '0')}:${s}`;
  }

  function saveAnalysisState(state) {
    const existing = getAnalysisState() || {};
    const merged = { ...existing, ...state };
    sessionStorage.setItem(STORAGE_KEYS.ANALYSIS, JSON.stringify(merged));
    return merged;
  }

  function getAnalysisState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.ANALYSIS);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Eklavya: failed to parse stored analysis state', e);
      return null;
    }
  }

  function clearAnalysisState() {
    sessionStorage.removeItem(STORAGE_KEYS.ANALYSIS);
  }

  /* ---------------------------------------------------------------------
     Video blob persistence across pages

     sessionStorage can't hold a video file, and a blob: object URL only
     resolves within the document that created it — it breaks on a full
     page navigation. IndexedDB is the right tool here: it can hold the
     actual File/Blob and survives navigation within the same origin, so
     each page can mint its own fresh object URL from the same bytes.
     --------------------------------------------------------------------- */

  const DB_NAME = 'eklavya-media';
  const STORE_NAME = 'videos';
  const VIDEO_KEY = 'current-upload';

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveVideoBlob(file) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ blob: file, name: file.name, type: file.type }, VIDEO_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch (err) {
      console.error('Eklavya: could not persist video blob', err);
      return false;
    }
  }

  async function getVideoBlob() {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(VIDEO_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error('Eklavya: could not read video blob', err);
      return null;
    }
  }

  async function clearVideoBlob() {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(VIDEO_KEY);
    } catch (err) { /* non-fatal */ }
  }

  function init() {
    markActiveNav();
    initMobileNav();
    renderStatusPill();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    getMode,
    setMode,
    showToast,
    escapeHtml,
    formatBytes,
    formatTimestamp,
    saveAnalysisState,
    getAnalysisState,
    clearAnalysisState,
    renderStatusPill,
    saveVideoBlob,
    getVideoBlob,
    clearVideoBlob,
    STORAGE_KEYS
  };
})();
