// Bug Fights - Vite Entry Point

import { initApp, setCamera, toggleSound, toggleDebugOverlay } from './app';

// Expose functions for onclick handlers in HTML
window.setCamera = setCamera;
window.toggleSound = toggleSound;
window.toggleDebugOverlay = toggleDebugOverlay;

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
