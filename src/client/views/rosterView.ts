// Bug Fights - Roster Page View

import * as THREE from 'three';
import { BugGenome } from '../procedural';
import { BugGenerator3D, BugAnimator } from '../bugGenerator3d';

interface RosterBugScene {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    bugGroup: THREE.Group;
    animator: BugAnimator;
    ctx: CanvasRenderingContext2D;
    rotationY: number;
}

interface PageView {
    mount(container: HTMLElement): void;
    unmount(): void;
}

let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedCanvas: HTMLCanvasElement | null = null;

function getSharedRenderer(): { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement } {
    if (!sharedRenderer) {
        sharedCanvas = document.createElement('canvas');
        sharedCanvas.width = 400;
        sharedCanvas.height = 300;
        sharedRenderer = new THREE.WebGLRenderer({
            canvas: sharedCanvas,
            antialias: true,
            preserveDrawingBuffer: true,
        });
        sharedRenderer.setSize(400, 300);
        sharedRenderer.setPixelRatio(1);
    }
    return { renderer: sharedRenderer, canvas: sharedCanvas! };
}

export function createRosterView(): PageView {
    let bugScenes: RosterBugScene[] = [];
    let animationId: number | null = null;
    let allBugs: RosterClientBug[] = [];
    let container: HTMLElement | null = null;
    let gridEl: HTMLElement | null = null;

    function mount(el: HTMLElement): void {
        container = el;

        const header = document.createElement('h2');
        header.className = 'page-header';
        header.textContent = 'BUG ROSTER';
        el.appendChild(header);

        // Controls
        const controls = document.createElement('div');
        controls.className = 'roster-controls';
        controls.innerHTML = `
            <label>Sort:</label>
            <select id="roster-sort">
                <option value="name">Name</option>
                <option value="gen">Generation</option>
                <option value="wins">Wins</option>
                <option value="winpct">Win %</option>
                <option value="bulk">Bulk</option>
                <option value="speed">Speed</option>
                <option value="fury">Fury</option>
                <option value="instinct">Instinct</option>
            </select>
            <label>Filter:</label>
            <select id="roster-filter">
                <option value="all">All</option>
                <option value="mandibles">Mandibles</option>
                <option value="stinger">Stinger</option>
                <option value="fangs">Fangs</option>
                <option value="pincers">Pincers</option>
                <option value="horn">Horn</option>
                <option value="ground">Ground</option>
                <option value="winged">Winged</option>
                <option value="wallcrawler">Wallcrawler</option>
            </select>
        `;
        el.appendChild(controls);

        gridEl = document.createElement('div');
        gridEl.className = 'roster-grid';
        el.appendChild(gridEl);

        // Event listeners for controls
        const sortSelect = controls.querySelector('#roster-sort') as HTMLSelectElement;
        const filterSelect = controls.querySelector('#roster-filter') as HTMLSelectElement;
        sortSelect.addEventListener('change', () => renderGrid());
        filterSelect.addEventListener('change', () => renderGrid());

        loadRoster();
    }

    async function loadRoster(): Promise<void> {
        if (!gridEl) return;
        gridEl.innerHTML = '<div class="loading-msg">Loading roster...</div>';

        try {
            const response = await fetch('/api/roster');
            allBugs = await response.json();
            renderGrid();
        } catch {
            gridEl.innerHTML = '<div class="error-msg">Failed to load roster</div>';
        }
    }

    function renderGrid(): void {
        if (!gridEl || !container) return;

        // Cleanup old scenes
        cleanupScenes();
        gridEl.innerHTML = '';

        const sortSelect = container.querySelector('#roster-sort') as HTMLSelectElement | null;
        const filterSelect = container.querySelector('#roster-filter') as HTMLSelectElement | null;
        const sortBy = sortSelect?.value || 'name';
        const filterBy = filterSelect?.value || 'all';

        let filtered = allBugs;
        if (filterBy !== 'all') {
            filtered = allBugs.filter(b =>
                b.weapon === filterBy || b.mobility === filterBy
            );
        }

        const sorted = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'name': return a.name.localeCompare(b.name);
                case 'gen': return a.generation - b.generation;
                case 'wins': return b.wins - a.wins;
                case 'winpct': {
                    const apct = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0;
                    const bpct = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 0;
                    return bpct - apct;
                }
                case 'bulk': return (b.stats?.bulk ?? b.genome.bulk) - (a.stats?.bulk ?? a.genome.bulk);
                case 'speed': return (b.stats?.speed ?? b.genome.speed) - (a.stats?.speed ?? a.genome.speed);
                case 'fury': return (b.stats?.fury ?? b.genome.fury) - (a.stats?.fury ?? a.genome.fury);
                case 'instinct': return (b.stats?.instinct ?? b.genome.instinct) - (a.stats?.instinct ?? a.genome.instinct);
                default: return 0;
            }
        });

        sorted.forEach(bug => {
            const item = createRosterItem(bug);
            gridEl!.appendChild(item);
        });

        // Drag hint
        const hint = document.createElement('div');
        hint.className = 'roster-controls-hint';
        hint.textContent = 'Drag to rotate bugs | Click for details';
        hint.style.gridColumn = '1 / -1';
        gridEl.appendChild(hint);

        startAnimation();
    }

    function createRosterItem(bug: RosterClientBug): HTMLElement {
        const item = document.createElement('a');
        item.className = 'roster-item-3d';
        item.href = `#/bug/${bug.id}`;

        // 3D canvas
        const canvas = document.createElement('canvas');
        canvas.className = 'roster-bug-canvas';
        canvas.width = 400;
        canvas.height = 300;
        item.appendChild(canvas);

        // Prevent link navigation when dragging
        let didDrag = false;
        item.addEventListener('click', (e) => {
            if (didDrag) { e.preventDefault(); didDrag = false; }
        });

        // Name + gen badge
        const nameRow = document.createElement('div');
        nameRow.className = 'roster-bug-name';
        nameRow.textContent = bug.name;
        const genBadge = document.createElement('span');
        genBadge.className = 'roster-gen-badge';
        genBadge.textContent = `Gen ${bug.generation}`;
        nameRow.appendChild(genBadge);
        item.appendChild(nameRow);

        // Lineage
        if (bug.parentNames) {
            const lineage = document.createElement('div');
            lineage.className = 'roster-bug-lineage';
            lineage.textContent = `${bug.parentNames[0]} × ${bug.parentNames[1]}`;
            item.appendChild(lineage);
        }

        // Record + win rate
        const record = document.createElement('div');
        record.className = 'roster-bug-record';
        record.textContent = `${bug.wins}W - ${bug.losses}L`;
        item.appendChild(record);

        const total = bug.wins + bug.losses;
        if (total > 0) {
            const winrate = document.createElement('div');
            winrate.className = 'roster-bug-winrate';
            winrate.textContent = `${((bug.wins / total) * 100).toFixed(0)}% win rate`;
            item.appendChild(winrate);
        }

        // Stats
        const bugStats = bug.stats || bug.genome;
        const stats = document.createElement('div');
        stats.className = 'roster-bug-stats';
        stats.innerHTML = `
            <span class="roster-stat blk">BLK ${bugStats.bulk}</span>
            <span class="roster-stat spd">SPD ${bugStats.speed}</span>
            <span class="roster-stat fry">FRY ${bugStats.fury}</span>
            <span class="roster-stat ins">INS ${bugStats.instinct}</span>
        `;
        item.appendChild(stats);

        // Tags
        const tags = document.createElement('div');
        tags.className = 'roster-bug-tags';
        tags.innerHTML = `
            <span class="weapon">${bug.weapon}</span>
            <span class="defense">${bug.genome.defense}</span>
            <span class="mobility">${bug.mobility}</span>
        `;
        item.appendChild(tags);

        // Setup 3D scene
        setup3DScene(canvas, bug.genome, () => { didDrag = true; });

        return item;
    }

    function setup3DScene(canvas: HTMLCanvasElement, bugData: GenomeData, onDrag: () => void): void {
        try {
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1a2a1a);

            const camera = new THREE.PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 100);
            camera.position.set(0, 1, 5);
            camera.lookAt(0, 0, 0);

            scene.add(new THREE.AmbientLight(0xffffff, 0.7));
            const directional = new THREE.DirectionalLight(0xffffff, 0.8);
            directional.position.set(5, 10, 5);
            scene.add(directional);
            const fill = new THREE.DirectionalLight(0x88ccff, 0.4);
            fill.position.set(-5, 5, -5);
            scene.add(fill);

            const genome = new BugGenome(bugData);
            const generator = new BugGenerator3D(genome);
            const bugGroup = generator.generate();
            bugGroup.scale.setScalar(0.12);
            bugGroup.rotation.y = -Math.PI / 4;
            scene.add(bugGroup);

            const ctx = canvas.getContext('2d')!;
            const { renderer, canvas: sharedC } = getSharedRenderer();
            renderer.render(scene, camera);
            ctx.drawImage(sharedC, 0, 0);

            const animator = new BugAnimator(bugGroup);

            // Drag controls
            let isDragging = false;
            let prevX = 0;
            let rotationY = -Math.PI / 4;

            canvas.addEventListener('mousedown', (e) => { isDragging = true; prevX = e.clientX; });
            canvas.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const deltaX = e.clientX - prevX;
                    if (Math.abs(deltaX) > 2) onDrag();
                    rotationY += deltaX * 0.01;
                    bugGroup.rotation.y = rotationY;
                    prevX = e.clientX;
                }
            });
            canvas.addEventListener('mouseup', () => isDragging = false);
            canvas.addEventListener('mouseleave', () => isDragging = false);

            canvas.addEventListener('touchstart', (e) => { isDragging = true; prevX = e.touches[0]!.clientX; });
            canvas.addEventListener('touchmove', (e) => {
                if (isDragging) {
                    const deltaX = e.touches[0]!.clientX - prevX;
                    if (Math.abs(deltaX) > 2) onDrag();
                    rotationY += deltaX * 0.01;
                    bugGroup.rotation.y = rotationY;
                    prevX = e.touches[0]!.clientX;
                }
            });
            canvas.addEventListener('touchend', () => isDragging = false);

            bugScenes.push({ scene, camera, bugGroup, animator, ctx, rotationY });
        } catch (err) {
            console.error('Error creating 3D bug:', err, bugData);
        }
    }

    function startAnimation(): void {
        const clock = new THREE.Clock();
        const animate = (): void => {
            animationId = requestAnimationFrame(animate);
            const delta = clock.getDelta();
            const { renderer, canvas: sharedC } = getSharedRenderer();
            bugScenes.forEach(sd => {
                sd.animator.update(delta, 'idle');
                renderer.render(sd.scene, sd.camera);
                sd.ctx.drawImage(sharedC, 0, 0);
            });
        };
        animate();
    }

    function cleanupScenes(): void {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        bugScenes.forEach(sd => {
            sd.scene.traverse((obj: THREE.Object3D) => {
                const mesh = obj as THREE.Mesh;
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        (mesh.material as THREE.Material[]).forEach(m => m.dispose());
                    } else {
                        mesh.material.dispose();
                    }
                }
            });
        });
        bugScenes = [];
    }

    function unmount(): void {
        cleanupScenes();
        if (sharedRenderer) {
            sharedRenderer.dispose();
            sharedRenderer = null;
            sharedCanvas = null;
        }
        allBugs = [];
        container = null;
        gridEl = null;
    }

    return { mount, unmount };
}
