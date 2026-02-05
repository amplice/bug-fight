// Bug Fights - Navigation Bar Component

import { BugFightsClient } from './client';

const NAV_ITEMS = [
    { label: 'ARENA', hash: '#/arena' },
    { label: 'ROSTER', hash: '#/roster' },
    { label: 'FIGHTS', hash: '#/fights' },
    { label: 'ABOUT', hash: '#/about' },
];

let navLinks: HTMLAnchorElement[] = [];
let statusEl: HTMLElement | null = null;
let unsubscribe: (() => void) | null = null;

export function initNav(): void {
    const nav = document.getElementById('nav-bar');
    if (!nav) return;

    // Build left side: links
    const linksDiv = document.createElement('div');
    linksDiv.className = 'nav-links';

    NAV_ITEMS.forEach(item => {
        const a = document.createElement('a');
        a.className = 'nav-link';
        a.href = item.hash;
        a.textContent = item.label;
        linksDiv.appendChild(a);
        navLinks.push(a);
    });
    nav.appendChild(linksDiv);

    // Build right side: live fight status
    statusEl = document.createElement('div');
    statusEl.className = 'nav-status';
    statusEl.innerHTML = '<span class="fight-phase">connecting...</span>';
    nav.appendChild(statusEl);

    // Register permanent state listener
    unsubscribe = BugFightsClient.addStateListener(updateStatus);
}

function updateStatus(state: GameState): void {
    if (!statusEl) return;
    statusEl.innerHTML =
        `Fight <span class="fight-num">#${state.fightNumber}</span> ` +
        `<span class="fight-phase">${state.phase}</span>`;
}

export function updateNav(route: string): void {
    navLinks.forEach(link => {
        const linkHash = link.getAttribute('href') || '';
        const linkRoute = linkHash.slice(1); // remove #
        if (route === linkRoute || (route === '/arena' && linkRoute === '/arena')) {
            link.classList.add('active');
        } else if (route.startsWith('/bug/') && linkRoute === '/roster') {
            // Bug detail is under roster
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}
