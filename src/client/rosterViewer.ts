// Bug Fights - 3D Roster Viewer
// Displays all roster bugs in a modal with interactive 3D preview

import * as THREE from 'three';
import { BugGenome } from './procedural';
import { BugGenerator3D, BugAnimator } from './bugGenerator3d';

interface RosterBugScene {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    bugGroup: THREE.Group;
    animator: BugAnimator;
    ctx: CanvasRenderingContext2D;
    rotationY: number;
}

class Roster3DViewer {
    private rosterModal: HTMLElement;
    private rosterGrid: HTMLElement;
    private rosterBtn: HTMLElement;
    private closeBtn: HTMLElement;
    private bugScenes: RosterBugScene[];
    private animationId: number | null;
    private sharedRenderer: THREE.WebGLRenderer | null;
    private sharedCanvas: HTMLCanvasElement | null;

    constructor() {
        this.rosterModal = document.getElementById('roster-modal')!;
        this.rosterGrid = document.getElementById('roster-grid')!;
        this.rosterBtn = document.getElementById('roster-btn')!;
        this.closeBtn = document.getElementById('close-roster')!;
        this.bugScenes = [];
        this.animationId = null;
        this.sharedRenderer = null;
        this.sharedCanvas = null;

        this.setupEventListeners();
    }

    private initSharedRenderer(): void {
        if (this.sharedRenderer) return;
        this.sharedCanvas = document.createElement('canvas');
        this.sharedCanvas.width = 400;
        this.sharedCanvas.height = 300;
        this.sharedRenderer = new THREE.WebGLRenderer({
            canvas: this.sharedCanvas,
            antialias: true,
            preserveDrawingBuffer: true
        });
        this.sharedRenderer.setSize(400, 300);
        this.sharedRenderer.setPixelRatio(1);
    }

    private setupEventListeners(): void {
        this.rosterBtn.addEventListener('click', () => this.open());
        this.closeBtn.addEventListener('click', () => this.close());
        this.rosterModal.addEventListener('click', (e) => {
            if (e.target === this.rosterModal) this.close();
        });
    }

    async open(): Promise<void> {
        // Clear stale content and load data BEFORE showing modal
        this.cleanup();
        this.rosterGrid.innerHTML = '';
        this.initSharedRenderer();
        await this.loadRoster();
        this.rosterModal.classList.remove('hidden');
        this.startAnimation();
    }

    close(): void {
        this.rosterModal.classList.add('hidden');
        this.stopAnimation();
        this.cleanup();
    }

    private async loadRoster(): Promise<void> {
        try {
            const response = await fetch('/api/roster');
            const roster: RosterClientBug[] = await response.json();
            this.populateRoster(roster);
        } catch (err) {
            console.error('Failed to load roster:', err);
            this.rosterGrid.innerHTML = '<div style="color: #f88; text-align: center; padding: 20px;">Failed to load roster</div>';
        }
    }

    private populateRoster(roster: RosterClientBug[]): void {
        this.cleanupScenes();
        this.rosterGrid.innerHTML = '';

        roster.forEach((bug, index) => {
            const item = this.createRosterItem(bug, index);
            this.rosterGrid.appendChild(item);
        });

        // Add controls hint at the bottom
        const hint = document.createElement('div');
        hint.className = 'roster-controls-hint';
        hint.textContent = 'Drag to rotate bugs';
        hint.style.gridColumn = '1 / -1';
        this.rosterGrid.appendChild(hint);
    }

    private createRosterItem(bug: RosterClientBug, index: number): HTMLElement {
        const item = document.createElement('div');
        item.className = 'roster-item-3d';

        // Display canvas (2D) - receives copies from shared renderer
        const canvas = document.createElement('canvas');
        canvas.className = 'roster-bug-canvas';
        canvas.width = 400;
        canvas.height = 300;
        item.appendChild(canvas);

        // Bug name + generation badge
        const nameRow = document.createElement('div');
        nameRow.className = 'roster-bug-name';
        nameRow.textContent = bug.name;
        const genBadge = document.createElement('span');
        genBadge.className = 'roster-gen-badge';
        genBadge.textContent = `Gen ${bug.generation}`;
        nameRow.appendChild(genBadge);
        item.appendChild(nameRow);

        // Parent lineage
        if (bug.parentNames) {
            const lineage = document.createElement('div');
            lineage.className = 'roster-bug-lineage';
            lineage.textContent = `${bug.parentNames[0]} × ${bug.parentNames[1]}`;
            item.appendChild(lineage);
        }

        // Record
        const record = document.createElement('div');
        record.className = 'roster-bug-record';
        record.textContent = `${bug.wins || 0}W - ${bug.losses || 0}L`;
        item.appendChild(record);

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

        // Setup 3D scene for this bug
        this.setup3DScene(canvas, bug.genome, index);

        return item;
    }

    private setup3DScene(canvas: HTMLCanvasElement, bugData: GenomeData, _index: number): void {
        try {
            // Create scene (shared renderer will render this)
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1a2a1a);

            // Create camera
            const camera = new THREE.PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 100);
            camera.position.set(0, 1, 5);
            camera.lookAt(0, 0, 0);

            // Lighting
            scene.add(new THREE.AmbientLight(0xffffff, 0.7));
            const directional = new THREE.DirectionalLight(0xffffff, 0.8);
            directional.position.set(5, 10, 5);
            scene.add(directional);
            const fill = new THREE.DirectionalLight(0x88ccff, 0.4);
            fill.position.set(-5, 5, -5);
            scene.add(fill);

            // Create bug
            const genome = new BugGenome(bugData);
            const generator = new BugGenerator3D(genome);
            const bugGroup = generator.generate();
            bugGroup.scale.setScalar(0.12);
            bugGroup.rotation.y = -Math.PI / 4;
            scene.add(bugGroup);

            // 2D context for copying rendered frames to display canvas
            const ctx = canvas.getContext('2d')!;

            // Initial render using shared renderer
            this.sharedRenderer!.render(scene, camera);
            ctx.drawImage(this.sharedCanvas!, 0, 0);

            // Create animator
            const animator = new BugAnimator(bugGroup);

            // Simple orbit controls via drag
            let isDragging = false;
            let prevX = 0;
            let rotationY = -Math.PI / 4;

            canvas.addEventListener('mousedown', (e) => {
                isDragging = true;
                prevX = e.clientX;
            });

            canvas.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const deltaX = e.clientX - prevX;
                    rotationY += deltaX * 0.01;
                    bugGroup.rotation.y = rotationY;
                    prevX = e.clientX;
                }
            });

            canvas.addEventListener('mouseup', () => isDragging = false);
            canvas.addEventListener('mouseleave', () => isDragging = false);

            // Touch support
            canvas.addEventListener('touchstart', (e) => {
                isDragging = true;
                prevX = e.touches[0]!.clientX;
            });

            canvas.addEventListener('touchmove', (e) => {
                if (isDragging) {
                    const deltaX = e.touches[0]!.clientX - prevX;
                    rotationY += deltaX * 0.01;
                    bugGroup.rotation.y = rotationY;
                    prevX = e.touches[0]!.clientX;
                }
            });

            canvas.addEventListener('touchend', () => isDragging = false);

            // Store scene data for animation loop
            this.bugScenes.push({
                scene,
                camera,
                bugGroup,
                animator,
                ctx,
                rotationY
            });
        } catch (err) {
            console.error('Error creating 3D bug:', err, bugData);
        }
    }

    private startAnimation(): void {
        const clock = new THREE.Clock();

        const animate = (): void => {
            this.animationId = requestAnimationFrame(animate);
            const delta = clock.getDelta();

            // Render each bug using the single shared renderer
            this.bugScenes.forEach(sceneData => {
                sceneData.animator.update(delta, 'idle');
                this.sharedRenderer!.render(sceneData.scene, sceneData.camera);
                sceneData.ctx.drawImage(this.sharedCanvas!, 0, 0);
            });
        };

        animate();
    }

    private stopAnimation(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    private cleanupScenes(): void {
        this.stopAnimation();

        this.bugScenes.forEach(sceneData => {
            sceneData.scene.traverse((obj: THREE.Object3D) => {
                const mesh = obj as THREE.Mesh;
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        (mesh.material as import('three').Material[]).forEach(m => m.dispose());
                    } else {
                        mesh.material.dispose();
                    }
                }
            });
        });

        this.bugScenes = [];
    }

    cleanup(): void {
        this.cleanupScenes();
        if (this.sharedRenderer) {
            this.sharedRenderer.dispose();
            this.sharedRenderer = null;
            this.sharedCanvas = null;
        }
    }
}

export { Roster3DViewer };
