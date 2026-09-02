/* ==========================================================================
   EKLAVYA — api.js
   Every network call to the Python backend goes through this file.
   No other file should call fetch() directly.

   The backend today is a set of local OpenCV / MediaPipe scripts, not yet
   exposed as a REST API. This module is written against the API shape the
   backend is expected to grow into:

     POST /api/analyze                     -> { id, status }
     GET  /api/analysis/:id                -> analysis result object
     GET  /api/analysis/:id/video           -> original video stream
     GET  /api/analysis/:id/annotated-video -> pose-annotated video stream

   Until that API exists, every function below falls back to Demo Mode
   (see mock-data.js) so the rest of the app can be built and demoed
   against a realistic contract. When the backend ships, only the
   fetch calls in this file — not the UI code — should need to change.
   ========================================================================== */

const EklavyaAPI = (() => {

  // Change this when the backend is deployed elsewhere.
  const API_BASE_URL = 'http://localhost:8000';

  const ENDPOINTS = {
    analyze: () => `${API_BASE_URL}/analyze`,
    result: (id) => `${API_BASE_URL}/api/analysis/${id}`,
    video: (id) => `${API_BASE_URL}/api/analysis/${id}/video`,
    annotatedVideo: (id) => `${API_BASE_URL}/api/analysis/${id}/annotated-video`
  };

  const HEALTH_CHECK_TIMEOUT_MS = 1500;

  /**
   * Quick reachability check for the backend. Resolves false on any
   * network error, timeout, or non-OK response — callers should treat
   * that as "fall back to Demo Mode" rather than a hard failure.
   */
  async function checkBackendAvailable() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
      const res = await fetch(`${API_BASE_URL}/docs`, { signal: controller.signal });
      clearTimeout(timer);
      return res.ok;
    } catch (err) {
      return false;
    }
  }

  /**
   * Upload a video file and request analysis.
   * @param {File} file
   * @param {{sport: string, activity: string}} options
   * @param {(pct:number)=>void} [onProgress]
   * @returns {Promise<{id: string}>}
   */
  async function uploadVideo(file, options, onProgress) {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('sport', options.sport);
    formData.append('activity', options.activity);

    const res = await fetch(ENDPOINTS.analyze(), {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new ApiError('UPLOAD_FAILED', `Upload failed with status ${res.status}`);
    }
    return res.json();
  }

  /**
   * Kick off analysis for an already-uploaded video (kept separate from
   * uploadVideo in case the backend splits "upload" and "analyze" into
   * two steps).
   */
  async function analyzeVideo(id) {
    const res = await fetch(`${ENDPOINTS.result(id)}/start`, { method: 'POST' });
    if (!res.ok) {
      throw new ApiError('ANALYSIS_FAILED', `Analysis failed with status ${res.status}`);
    }
    return res.json();
  }

  /** Poll for the analysis result. */
  async function getAnalysisResult(id) {
    const res = await fetch(ENDPOINTS.result(id));
    if (!res.ok) {
      throw new ApiError('RESULT_UNAVAILABLE', `Could not fetch result (status ${res.status})`);
    }
    return res.json();
  }

  /** URL for the original uploaded video, once processed server-side. */
  function getOriginalVideoUrl(id) {
    return ENDPOINTS.video(id);
  }

  /** URL for the pose-annotated output video. */
  function getAnnotatedVideoUrl(id) {
    return ENDPOINTS.annotatedVideo(id);
  }

  class ApiError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
    }
  }

  return {
    API_BASE_URL,
    checkBackendAvailable,
    uploadVideo,
    analyzeVideo,
    getAnalysisResult,
    getOriginalVideoUrl,
    getAnnotatedVideoUrl,
    ApiError
  };
})();
