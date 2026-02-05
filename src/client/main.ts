// Bug Fights - Vite Entry Point

import { initApp, setCamera, toggleSound, toggleDebugOverlay } from './app';
import { initRouter, registerRoute } from './router';
import { createRosterView } from './views/rosterView';
import { createBugDetailView } from './views/bugDetailView';
import { createFightHistoryView } from './views/fightHistoryView';
import { createAboutView } from './views/aboutView';

// Expose functions for onclick handlers in HTML
window.setCamera = setCamera;
window.toggleSound = toggleSound;
window.toggleDebugOverlay = toggleDebugOverlay;

function startup(): void {
    // Init arena (client, renderer, sound, debug overlay)
    initApp();

    // Register routes
    registerRoute('/arena', () => ({ mount() {}, unmount() {} })); // handled specially by router
    registerRoute('/roster', createRosterView);
    registerRoute('/bug/:id', createBugDetailView);
    registerRoute('/fights', createFightHistoryView);
    registerRoute('/about', createAboutView);

    // Start router
    initRouter();
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startup);
} else {
    startup();
}
