// Bug Fights - Bug Detail Page View

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BugGenome } from '../procedural';
import { BugGenerator3D, BugAnimator } from '../bugGenerator3d';
import { getRouteParams } from '../router';

interface BugDetailData {
    id: string;
    name: string;
    genome: GenomeData;
    wins: number;
    losses: number;
    active: boolean;
    generation: number;
    createdAt: string;
    retiredAt: string | null;
    parent1?: { id: string; name: string } | null;
    parent2?: { id: string; name: string } | null;
    childrenAsParent1?: Array<{ id: string; name: string; generation: number }>;
    childrenAsParent2?: Array<{ id: string; name: string; generation: number }>;
    fightsAsBug1?: Array<FightRecord>;
    fightsAsBug2?: Array<FightRecord>;
}

interface FightRecord {
    id: string;
    fightNumber: number;
    duration: number;
    isDraw: boolean;
    createdAt: string;
    drandRound: number | null;
    bug1?: { id: string; name: string };
    bug2?: { id: string; name: string };
    winner?: { id: string; name: string } | null;
}

export function createBugDetailView(): PageView {
    let renderer: THREE.WebGLRenderer | null = null;
    let animationId: number | null = null;
    let controls: OrbitControls | null = null;
    let abortController: AbortController | null = null;
    let mounted = false;
    let scene: THREE.Scene | null = null;

    function mount(container: HTMLElement): void {
        mounted = true;
        abortController = new AbortController();
        const params = getRouteParams();
        const bugId = params['id'];
        if (!bugId) {
            container.innerHTML = '<div class="error-msg">Bug ID not found</div>';
            return;
        }

        container.innerHTML = '<div class="loading-msg">Loading bug data...</div>';
        loadBug(container, bugId);
    }

    async function loadBug(container: HTMLElement, bugId: string): Promise<void> {
        try {
            const response = await fetch(`/api/bug/${bugId}`, { signal: abortController?.signal });
            if (!response.ok) {
                container.innerHTML = '<div class="error-msg">Bug not found</div>';
                return;
            }
            const bug: BugDetailData = await response.json();
            if (!mounted) return; // View was unmounted during fetch
            renderDetail(container, bug);
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') return;
            container.innerHTML = '<div class="error-msg">Failed to load bug data</div>';
        }
    }

    function renderDetail(container: HTMLElement, bug: BugDetailData): void {
        container.innerHTML = '';

        const header = document.createElement('h2');
        header.className = 'page-header';
        header.textContent = 'BUG DETAIL';
        container.appendChild(header);

        // Two-column layout
        const layout = document.createElement('div');
        layout.className = 'bug-detail-layout';

        // Left: 3D model
        const modelDiv = document.createElement('div');
        modelDiv.className = 'bug-detail-model';
        layout.appendChild(modelDiv);

        // Right: Info
        const infoDiv = document.createElement('div');
        infoDiv.className = 'bug-detail-info';
        layout.appendChild(infoDiv);

        container.appendChild(layout);

        // Build info panel
        buildInfoPanel(infoDiv, bug);

        // Build 3D model
        build3DModel(modelDiv, bug.genome);

        // Lineage section
        buildLineage(container, bug);

        // Fight history section
        buildFightHistory(container, bug);
    }

    function buildInfoPanel(el: HTMLElement, bug: BugDetailData): void {
        const genome = bug.genome;

        // Name + gen
        const name = document.createElement('div');
        name.className = 'bug-detail-name';
        name.textContent = bug.name + ' ';
        const genBadge = document.createElement('span');
        genBadge.className = 'roster-gen-badge';
        genBadge.textContent = `Gen ${bug.generation}`;
        name.appendChild(genBadge);
        el.appendChild(name);

        // Status
        const status = document.createElement('div');
        status.className = `bug-detail-status ${bug.active ? 'active' : 'retired'}`;
        status.textContent = bug.active ? 'ACTIVE' : 'RETIRED';
        el.appendChild(status);

        // Record
        const total = bug.wins + bug.losses;
        const winRate = total > 0 ? ((bug.wins / total) * 100).toFixed(1) : '0.0';
        const record = document.createElement('div');
        record.className = 'bug-detail-record';
        record.textContent = `${bug.wins}W - ${bug.losses}L (${winRate}%)`;
        el.appendChild(record);

        // Stat bars
        const stats = document.createElement('div');
        stats.className = 'stat-bars';
        const statList: Array<{ key: string; label: string; value: number }> = [
            { key: 'blk', label: 'BLK', value: genome.bulk },
            { key: 'spd', label: 'SPD', value: genome.speed },
            { key: 'fry', label: 'FRY', value: genome.fury },
            { key: 'ins', label: 'INS', value: genome.instinct },
        ];
        statList.forEach(s => {
            const row = document.createElement('div');
            row.className = 'stat-bar-row';
            row.innerHTML = `
                <span class="stat-bar-label ${s.key}">${s.label}</span>
                <div class="stat-bar-track">
                    <div class="stat-bar-fill ${s.key}" style="width: ${s.value}%"></div>
                </div>
                <span class="stat-bar-value">${s.value}</span>
            `;
            stats.appendChild(row);
        });
        el.appendChild(stats);

        // Combat traits
        const traits = document.createElement('div');
        traits.className = 'bug-detail-traits';
        traits.innerHTML = `<h3>COMBAT TRAITS</h3>`;
        const traitList = document.createElement('div');
        traitList.className = 'trait-list';
        traitList.innerHTML = `
            <span class="weapon">${genome.weapon}</span>
            <span class="defense">${genome.defense}</span>
            <span class="mobility">${genome.mobility}</span>
        `;
        traits.appendChild(traitList);
        el.appendChild(traits);

        // Visual traits
        const visual = document.createElement('div');
        visual.className = 'bug-detail-visual';
        visual.innerHTML = `<h3>VISUAL TRAITS</h3>`;
        const grid = document.createElement('div');
        grid.className = 'visual-traits-grid';
        const visualTraits: Array<[string, string]> = [
            ['Head', genome.headType],
            ['Thorax', genome.thoraxType],
            ['Abdomen', genome.abdomenType],
            ['Legs', `${genome.legCount} (${genome.legStyle})`],
            ['Eyes', genome.eyeStyle],
            ['Antennae', genome.antennaStyle],
            ['Texture', genome.textureType],
            ['Wings', genome.wingType],
        ];
        visualTraits.forEach(([label, value]) => {
            const trait = document.createElement('div');
            trait.className = 'visual-trait';
            trait.innerHTML = `<span class="visual-trait-label">${label}:</span> <span class="visual-trait-value">${value}</span>`;
            grid.appendChild(trait);
        });
        visual.appendChild(grid);
        el.appendChild(visual);
    }

    function build3DModel(modelDiv: HTMLElement, genome: GenomeData): void {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 700;
            modelDiv.appendChild(canvas);

            renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
            renderer.setSize(800, 700);
            renderer.setPixelRatio(1);

            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1a2a1a);

            const camera = new THREE.PerspectiveCamera(50, 800 / 700, 0.1, 100);
            camera.position.set(0, 1, 7);
            camera.lookAt(0, 0.3, 0);

            scene.add(new THREE.AmbientLight(0xffffff, 0.7));
            const dir = new THREE.DirectionalLight(0xffffff, 0.8);
            dir.position.set(5, 10, 5);
            scene.add(dir);
            const fill = new THREE.DirectionalLight(0x88ccff, 0.4);
            fill.position.set(-5, 5, -5);
            scene.add(fill);

            const bugGenome = new BugGenome(genome);
            const generator = new BugGenerator3D(bugGenome);
            const bugGroup = generator.generate();
            bugGroup.scale.setScalar(0.13);
            scene.add(bugGroup);

            controls = new OrbitControls(camera, canvas);
            controls.enableDamping = true;
            controls.dampingFactor = 0.1;
            controls.enableZoom = true;
            controls.enablePan = false;
            controls.target.set(0, 0.3, 0);

            const animator = new BugAnimator(bugGroup);
            const clock = new THREE.Clock();

            const animate = (): void => {
                animationId = requestAnimationFrame(animate);
                const delta = clock.getDelta();
                animator.update(delta, 'idle');
                controls!.update();
                renderer!.render(scene!, camera);
            };
            animate();

            const hint = document.createElement('div');
            hint.className = 'controls-hint';
            hint.textContent = 'Drag to rotate | Scroll to zoom';
            modelDiv.appendChild(hint);
        } catch (err) {
            console.error('Error creating detail 3D model:', err);
            modelDiv.innerHTML = '<div class="error-msg">Failed to load 3D model</div>';
        }
    }

    function buildLineage(container: HTMLElement, bug: BugDetailData): void {
        const section = document.createElement('div');
        section.className = 'bug-detail-lineage';
        section.innerHTML = '<h3>LINEAGE</h3>';

        const links = document.createElement('div');
        links.className = 'lineage-links';

        if (bug.parent1 || bug.parent2) {
            let html = 'Parents: ';
            if (bug.parent1) html += `<a href="#/bug/${bug.parent1.id}">${bug.parent1.name}</a>`;
            if (bug.parent1 && bug.parent2) html += ' × ';
            if (bug.parent2) html += `<a href="#/bug/${bug.parent2.id}">${bug.parent2.name}</a>`;
            links.innerHTML = html;
        } else {
            links.innerHTML = 'Parents: <span style="color:#888">Gen 0 (no parents)</span>';
        }

        section.appendChild(links);

        // Children
        const allChildren = [
            ...(bug.childrenAsParent1 || []),
            ...(bug.childrenAsParent2 || []),
        ];
        if (allChildren.length > 0) {
            const childLabel = document.createElement('div');
            childLabel.style.marginTop = '8px';
            childLabel.innerHTML = 'Children: ';
            const childList = document.createElement('span');
            childList.className = 'children-list';
            childList.style.display = 'inline';
            allChildren.forEach((child, i) => {
                if (i > 0) childList.appendChild(document.createTextNode(', '));
                const a = document.createElement('a');
                a.href = `#/bug/${child.id}`;
                a.textContent = `${child.name} (Gen ${child.generation})`;
                a.style.color = '#0ff';
                a.style.textDecoration = 'none';
                childList.appendChild(a);
            });
            childLabel.appendChild(childList);
            section.appendChild(childLabel);
        }

        container.appendChild(section);
    }

    function buildFightHistory(container: HTMLElement, bug: BugDetailData): void {
        const allFights: Array<FightRecord & { opponentName: string; opponentId: string; won: boolean | null }> = [];

        (bug.fightsAsBug1 || []).forEach(f => {
            allFights.push({
                ...f,
                opponentName: f.bug2?.name || 'Unknown',
                opponentId: f.bug2?.id || '',
                won: f.isDraw ? null : (f.winner?.id === bug.id),
            });
        });

        (bug.fightsAsBug2 || []).forEach(f => {
            allFights.push({
                ...f,
                opponentName: f.bug1?.name || 'Unknown',
                opponentId: f.bug1?.id || '',
                won: f.isDraw ? null : (f.winner?.id === bug.id),
            });
        });

        allFights.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const section = document.createElement('div');
        section.innerHTML = '<h3 class="page-header" style="font-size:14px; margin-top:20px;">FIGHT HISTORY</h3>';

        if (allFights.length === 0) {
            section.innerHTML += '<div style="color:#888; padding:10px;">No fights recorded yet</div>';
            container.appendChild(section);
            return;
        }

        const table = document.createElement('table');
        table.className = 'fights-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Fight #</th>
                    <th>Opponent</th>
                    <th>Result</th>
                    <th>Duration</th>
                    <th>Date</th>
                </tr>
            </thead>
        `;

        const tbody = document.createElement('tbody');
        allFights.forEach(fight => {
            const tr = document.createElement('tr');
            const durationSec = (fight.duration / 30).toFixed(1);
            const date = new Date(fight.createdAt).toLocaleDateString();
            const resultClass = fight.won === null ? 'draw-cell' : (fight.won ? 'winner-cell' : '');
            const resultText = fight.won === null ? 'DRAW' : (fight.won ? 'WIN' : 'LOSS');

            tr.innerHTML = `
                <td>${fight.fightNumber}</td>
                <td><a href="#/bug/${fight.opponentId}">${fight.opponentName}</a></td>
                <td class="${resultClass}">${resultText}</td>
                <td>${durationSec}s</td>
                <td>${date}</td>
            `;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        section.appendChild(table);
        container.appendChild(section);
    }

    function unmount(): void {
        mounted = false;
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (controls) {
            controls.dispose();
            controls = null;
        }
        if (scene) {
            scene.traverse((obj: THREE.Object3D) => {
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
            scene = null;
        }
        if (renderer) {
            renderer.dispose();
            renderer = null;
        }
    }

    return { mount, unmount };
}
