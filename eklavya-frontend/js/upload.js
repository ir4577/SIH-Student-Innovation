/* ==========================================================================
   EKLAVYA — upload.js
   Self-contained drag-and-drop video uploader. Handles file selection,
   drag/drop, validation, size display and preview. Reports back to
   whatever page includes it via callbacks — it holds no page-flow logic.
   ========================================================================== */

const EklavyaUpload = (() => {

  const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
  const ACCEPTED_EXT = ['.mp4', '.mov', '.webm'];
  const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500MB soft cap for the prototype

  /**
   * @param {Object} config
   * @param {HTMLElement} config.dropzone
   * @param {HTMLInputElement} config.fileInput
   * @param {HTMLElement} config.previewContainer
   * @param {(file: File, objectUrl: string) => void} config.onFileAccepted
   * @param {(message: string) => void} config.onError
   * @param {() => void} [config.onRemove]
   */
  function createUploader(config) {
    const { dropzone, fileInput, previewContainer, onFileAccepted, onError, onRemove } = config;

    let currentFile = null;
    let currentObjectUrl = null;

    function validate(file) {
      const extOk = ACCEPTED_EXT.some(ext => file.name.toLowerCase().endsWith(ext));
      const typeOk = ACCEPTED_TYPES.includes(file.type) || extOk;
      if (!typeOk) {
        return `"${file.name}" isn't a supported format. Upload a .mp4, .mov, or .webm file.`;
      }
      if (file.size > MAX_SIZE_BYTES) {
        return `That file is too large. Keep uploads under ${Eklavya.formatBytes(MAX_SIZE_BYTES)}.`;
      }
      if (file.size === 0) {
        return `"${file.name}" appears to be empty. Try exporting the clip again.`;
      }
      return null;
    }

    function acceptFile(file) {
      const error = validate(file);
      if (error) {
        onError && onError(error);
        return;
      }
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
      currentFile = file;
      currentObjectUrl = URL.createObjectURL(file);
      onFileAccepted(file, currentObjectUrl);
    }

    function reset() {
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
      currentFile = null;
      currentObjectUrl = null;
      fileInput.value = '';
      onRemove && onRemove();
    }

    if (dropzone) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInput.click();
        }
      });

      ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('is-dragover');
        });
      });

      ['dragleave', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('is-dragover');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) acceptFile(file);
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) acceptFile(file);
      });
    }

    return {
      reset,
      getFile: () => currentFile,
      getObjectUrl: () => currentObjectUrl
    };
  }

  return { createUploader, MAX_SIZE_BYTES, ACCEPTED_EXT };
})();
