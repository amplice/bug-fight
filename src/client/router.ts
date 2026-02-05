// Bug Fights - Hash-based SPA Router

import { initNav, updateNav } from './nav';

interface PageView {
    mount(container: HTMLElement): void;
    unmount(): void;
}

type RouteHandler = () => PageView;

const routes: Record<string, RouteHandler> = {};
let currentView: PageView | null = null;
let arenaContainer: HTMLElement;
let pageContent: HTMLElement;

export function registerRoute(path: string, handler: RouteHandler): void {
    routes[path] = handler;
}

function getRouteAndParams(): { route: string; params: Record<string, string> } {
    const hash = window.location.hash.slice(1) || '/arena';

    // Check parameterized routes like /bug/:id
    for (const route of Object.keys(routes)) {
        if (route.includes(':')) {
            const routeParts = route.split('/');
            const hashParts = hash.split('/');
            if (routeParts.length === hashParts.length) {
                const params: Record<string, string> = {};
                let match = true;
                for (let i = 0; i < routeParts.length; i++) {
                    const rp = routeParts[i]!;
                    const hp = hashParts[i]!;
                    if (rp.startsWith(':')) {
                        params[rp.slice(1)] = hp;
                    } else if (rp !== hp) {
                        match = false;
                        break;
                    }
                }
                if (match) return { route, params };
            }
        }
    }

    if (routes[hash]) return { route: hash, params: {} };
    return { route: '/arena', params: {} };
}

// Store params for current route so views can access them
let currentParams: Record<string, string> = {};
export function getRouteParams(): Record<string, string> {
    return currentParams;
}

function navigate(): void {
    const { route, params } = getRouteAndParams();
    currentParams = params;

    // Unmount current view
    if (currentView) {
        currentView.unmount();
        currentView = null;
    }

    if (route === '/arena') {
        // Show arena, hide page content
        arenaContainer.classList.remove('hidden');
        pageContent.classList.add('hidden');
        pageContent.innerHTML = '';
    } else {
        // Hide arena, show page content
        arenaContainer.classList.add('hidden');
        pageContent.classList.remove('hidden');
        pageContent.innerHTML = '';

        const handler = routes[route];
        if (handler) {
            currentView = handler();
            currentView.mount(pageContent);
        }
    }

    updateNav(route);
}

export function initRouter(): void {
    arenaContainer = document.getElementById('arena-container')!;
    pageContent = document.getElementById('page-content')!;

    initNav();

    window.addEventListener('hashchange', navigate);
    navigate();
}
