// Bug Fights - 3D Renderer
// Three.js based shape rendering

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BugGenome } from './procedural';
import { BugGenerator3D, BugAnimator } from './bugGenerator3d';
import { BugFightsSound } from './soundEngine';
import { BugFightsClient } from './client';

type ThreeOrbitControls = OrbitControls;
type ThreeMaterial = THREE.Material;
type ThreeMeshBasicMaterial = THREE.MeshBasicMaterial;
type ThreeMeshStandardMaterial = THREE.MeshStandardMaterial;
type ThreeSprite = THREE.Sprite;
type ThreeScene = THREE.Scene;
type ThreePerspectiveCamera = THREE.PerspectiveCamera;
type ThreeGroup = THREE.Group;
type ThreeWebGLRenderer = THREE.WebGLRenderer;
type ThreeObject3D = THREE.Object3D;
type ThreeMesh = THREE.Mesh;

// ============================================
// INTERNAL INTERFACES
// ============================================

interface Vec3 {
    x: number;
    y: number;
    z: number;
}

interface CameraPreset {
    position: Vec3;
    target: Vec3;
}

interface ActionCameraState {
    enabled: boolean;
    currentPos: Vec3;
    currentTarget: Vec3;
    smoothing: number;
    minDistance: number;
    maxDistance: number;
    heightOffset: number;
    behindOffset: number;
}

interface DeathFallState {
    active: boolean;
    startY: number;
    currentY: number;
    velocityY: number;
    landed: boolean;
    lastAliveY: number;
    lastAliveX: number;
    lastAliveZ: number;
}

interface HitParticle {
    mesh: ThreeMesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    decay: number;
    isSpark: boolean;
}

interface DamageNumber {
    sprite: ThreeSprite;
    vy: number;
    life: number;
    decay: number;
}

interface MotionTrail {
    mesh: ThreeMesh;
    life: number;
    decay: number;
}

interface ScreenShakeState {
    intensity: number;
}

interface WallSet {
    left: ThreeMesh | null;
    right: ThreeMesh | null;
    front: ThreeMesh | null;
    back: ThreeMesh | null;
}

// ============================================
// CONSTANTS
// ============================================

const ARENA_3D: ArenaConfig = {
    width: 900,
    height: 400,
    depth: 600,
    minX: -450,
    maxX: 450,
    minY: 0,
    maxY: 400,
    minZ: -300,
    maxZ: 300,
};

// ============================================
// STATE
// ============================================

let scene: ThreeScene;
let camera: ThreePerspectiveCamera;
let renderer: ThreeWebGLRenderer;
let controls: ThreeOrbitControls;
let arena: Record<string, unknown> = {};
let bugMeshes: [ThreeGroup | null, ThreeGroup | null] = [null, null];
let bugAnimators: [BugAnimator | null, BugAnimator | null] = [null, null];
let lastTime: number = performance.now();
let walls: WallSet = { left: null, right: null, front: null, back: null };

// Camera presets
const CAMERA_PRESETS: Record<string, CameraPreset> = {
    front: { position: { x: 0, y: 200, z: 800 }, target: { x: 0, y: 150, z: 0 } },
    side: { position: { x: 800, y: 200, z: 0 }, target: { x: 0, y: 150, z: 0 } },
    top: { position: { x: 0, y: 800, z: 100 }, target: { x: 0, y: 0, z: 0 } },
    isometric: { position: { x: 500, y: 400, z: 500 }, target: { x: 0, y: 100, z: 0 } },
};

let currentPreset: string = 'action';  // Default to action camera

// Action camera state
let actionCamera: ActionCameraState = {
    enabled: true,
    currentPos: { x: 0, y: 300, z: 600 },
    currentTarget: { x: 0, y: 100, z: 0 },
    smoothing: 0.03,  // Lower = smoother/slower
    minDistance: 250,  // Minimum zoom distance
    maxDistance: 700,  // Maximum zoom distance
    heightOffset: 150,  // Camera height above midpoint
    behindOffset: 400,  // Base distance behind the action
};
let currentFightNumber: number = 0;

// Effects
let hitParticles: HitParticle[] = [];
let damageNumbers: DamageNumber[] = [];
let screenShake: ScreenShakeState = { intensity: 0 };

// Motion trails for fast-moving bugs
let motionTrails: [MotionTrail[], MotionTrail[]] = [[], []];  // One trail array per bug
const MAX_TRAIL_POINTS: number = 12;
const TRAIL_SPAWN_SPEED: number = 5;  // Minimum speed to spawn trail

// Fighter UI
let fighterUI: [ThreeGroup | null, ThreeGroup | null] = [null, null];

// Recursively dispose Three.js object and all children
function disposeObject(obj: ThreeObject3D | null): void {
    if (!obj) return;
    if (obj.children) {
        while (obj.children.length > 0) {
            disposeObject(obj.children[0]!);
            obj.remove(obj.children[0]!);
        }
    }
    const mesh = obj as ThreeMesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m: ThreeMaterial) => m.dispose());
        } else {
            mesh.material.dispose();
        }
    }
}

// ============================================
// INITIALIZATION
// ============================================

function initThreeJS(): void {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);

    camera = new THREE.PerspectiveCamera(60, 900 / 600, 1, 5000);
    setCameraPreset('action');  // Default to action camera

    const canvas = document.getElementById('arena3d') as HTMLCanvasElement;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(900, 600);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 200;
    controls.maxDistance = 1500;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.target.set(0, 100, 0);

    setupLighting();
    buildArena();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);

    console.log('Three.js initialized');
}

function setupLighting(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(200, 500, 300);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 100;
    sunLight.shadow.camera.far = 1500;
    sunLight.shadow.camera.left = -500;
    sunLight.shadow.camera.right = 500;
    sunLight.shadow.camera.top = 500;
    sunLight.shadow.camera.bottom = -500;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-200, 300, -200);
    scene.add(fillLight);

    const groundLight = new THREE.DirectionalLight(0xffaa66, 0.2);
    groundLight.position.set(0, -100, 0);
    scene.add(groundLight);
}

function buildArena(): void {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(ARENA_3D.width, ARENA_3D.depth);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.9, metalness: 0.1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // Substrate particles
    const substrateGeo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const substrateColors: number[] = [0x4a3a28, 0x5a4a35, 0x3a2a18, 0x6a5a45];

    for (let i = 0; i < 500; i++) {
        positions.push(
            (Math.random() - 0.5) * ARENA_3D.width * 0.95,
            Math.random() * 3,
            (Math.random() - 0.5) * ARENA_3D.depth * 0.95
        );
        const c = new THREE.Color(substrateColors[Math.floor(Math.random() * 4)]!);
        colors.push(c.r, c.g, c.b);
    }

    substrateGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    substrateGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const substrateMat = new THREE.PointsMaterial({ size: 5, vertexColors: true, sizeAttenuation: true });
    scene.add(new THREE.Points(substrateGeo, substrateMat));

    // Walls (transparent, with individual materials for climb highlighting)
    const createWallMat = (): ThreeMeshBasicMaterial => new THREE.MeshBasicMaterial({
        color: 0x333333, transparent: true, opacity: 0.1, side: THREE.DoubleSide
    });

    const sideWallGeo = new THREE.PlaneGeometry(ARENA_3D.depth, ARENA_3D.height);
    walls.left = new THREE.Mesh(sideWallGeo, createWallMat());
    walls.left.position.set(ARENA_3D.minX, ARENA_3D.height / 2, 0);
    walls.left.rotation.y = Math.PI / 2;
    scene.add(walls.left);

    walls.right = new THREE.Mesh(sideWallGeo.clone(), createWallMat());
    walls.right.position.set(ARENA_3D.maxX, ARENA_3D.height / 2, 0);
    walls.right.rotation.y = -Math.PI / 2;
    scene.add(walls.right);

    const frontWallGeo = new THREE.PlaneGeometry(ARENA_3D.width, ARENA_3D.height);
    walls.front = new THREE.Mesh(frontWallGeo, createWallMat());
    walls.front.position.set(0, ARENA_3D.height / 2, ARENA_3D.maxZ);
    walls.front.rotation.y = Math.PI;
    scene.add(walls.front);

    walls.back = new THREE.Mesh(frontWallGeo.clone(), createWallMat());
    walls.back.position.set(0, ARENA_3D.height / 2, ARENA_3D.minZ);
    scene.add(walls.back);

    // Ceiling
    const ceilingMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.05, side: THREE.DoubleSide });
    const ceiling = new THREE.Mesh(floorGeo.clone(), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ARENA_3D.height;
    scene.add(ceiling);

    // Edge wireframe
    const edgesGeo = new THREE.BoxGeometry(ARENA_3D.width, ARENA_3D.height, ARENA_3D.depth);
    const edges = new THREE.EdgesGeometry(edgesGeo);
    const edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x555555 }));
    edgeLines.position.y = ARENA_3D.height / 2;
    scene.add(edgeLines);

    addRocks();
    addPlants();
}

function addRocks(): void {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9, metalness: 0.1 });
    const numRocks: number = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < numRocks; i++) {
        const rockGeo = new THREE.DodecahedronGeometry(15 + Math.random() * 25, 0);
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(
            (Math.random() - 0.5) * ARENA_3D.width * 0.7,
            10 + Math.random() * 10,
            (Math.random() - 0.5) * ARENA_3D.depth * 0.7
        );
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        rock.scale.y = 0.6 + Math.random() * 0.4;
        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);
    }
}

function addPlants(): void {
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2d5a2d });
    const numPlants: number = 4 + Math.floor(Math.random() * 4);

    for (let i = 0; i < numPlants; i++) {
        const plantGroup: ThreeGroup = new THREE.Group();
        const side: number = Math.random() < 0.5 ? -1 : 1;
        const nearX: boolean = Math.random() < 0.5;

        if (nearX) {
            plantGroup.position.set(
                side * (ARENA_3D.width / 2 - 30 - Math.random() * 50),
                0,
                (Math.random() - 0.5) * ARENA_3D.depth * 0.8
            );
        } else {
            plantGroup.position.set(
                (Math.random() - 0.5) * ARENA_3D.width * 0.8,
                0,
                side * (ARENA_3D.depth / 2 - 30 - Math.random() * 50)
            );
        }

        const numStems: number = 3 + Math.floor(Math.random() * 4);
        for (let j = 0; j < numStems; j++) {
            const height: number = 30 + Math.random() * 50;
            const stemGeo = new THREE.CylinderGeometry(1, 2, height, 6);
            const stem = new THREE.Mesh(stemGeo, stemMat);
            stem.position.set((Math.random() - 0.5) * 10, height / 2, (Math.random() - 0.5) * 10);
            stem.rotation.x = (Math.random() - 0.5) * 0.3;
            stem.rotation.z = (Math.random() - 0.5) * 0.3;
            plantGroup.add(stem);
        }

        scene.add(plantGroup);
    }
}

// ============================================
// CAMERA CONTROLS
// ============================================

function setCameraPreset(presetName: string): void {
    if (presetName === 'action') {
        currentPreset = 'action';
        actionCamera.enabled = true;
        return;
    }

    const preset: CameraPreset | undefined = CAMERA_PRESETS[presetName];
    if (!preset) return;

    currentPreset = presetName;
    actionCamera.enabled = false;
    camera.position.set(preset.position.x, preset.position.y, preset.position.z);
    if (controls) {
        controls.target.set(preset.target.x, preset.target.y, preset.target.z);
        controls.update();
    }
}

function updateActionCamera(state: GameState): void {
    if (!actionCamera.enabled || !state || !state.fighters || state.fighters.length < 2) {
        return;
    }

    const f1: FighterState | undefined = state.fighters[0];
    const f2: FighterState | undefined = state.fighters[1];

    if (!f1 || !f2) return;

    // Get 3D positions
    const pos1: Vec3 = { x: f1.x, y: f1.y, z: f1.z || 0 };
    const pos2: Vec3 = { x: f2.x, y: f2.y, z: f2.z || 0 };

    // Calculate midpoint between bugs
    const midX: number = (pos1.x + pos2.x) / 2;
    const midY: number = (pos1.y + pos2.y) / 2;
    const midZ: number = (pos1.z + pos2.z) / 2;

    // Calculate distance between bugs for zoom
    const dx: number = pos2.x - pos1.x;
    const dy: number = pos2.y - pos1.y;
    const dz: number = pos2.z - pos1.z;
    const bugDistance: number = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Calculate camera distance based on bug separation
    // Closer bugs = closer camera, further bugs = further camera
    const zoomFactor: number = Math.max(actionCamera.minDistance,
                                Math.min(actionCamera.maxDistance,
                                         bugDistance * 1.2 + 200));

    // Calculate camera angle - orbit around the action
    // Use midpoint position to determine viewing angle
    const angleFromCenter: number = Math.atan2(midX, midZ);

    // Position camera to see both bugs well
    // Offset perpendicular to the line between bugs for better view
    const perpAngle: number = Math.atan2(dx, dz) + Math.PI / 2;

    // Target position - looking at the midpoint, slightly above
    const targetX: number = midX;
    const targetY: number = Math.max(80, midY);
    const targetZ: number = midZ;

    // Camera position - behind and above the action
    // Mix between perpendicular view and front view for dynamic feel
    const cameraAngle: number = perpAngle * 0.6 + angleFromCenter * 0.4;
    const idealX: number = midX + Math.sin(cameraAngle) * zoomFactor;
    const idealY: number = targetY + actionCamera.heightOffset + (bugDistance * 0.15);
    const idealZ: number = midZ + Math.cos(cameraAngle) * zoomFactor;

    // Smooth interpolation
    const smoothing: number = actionCamera.smoothing;
    actionCamera.currentPos.x += (idealX - actionCamera.currentPos.x) * smoothing;
    actionCamera.currentPos.y += (idealY - actionCamera.currentPos.y) * smoothing;
    actionCamera.currentPos.z += (idealZ - actionCamera.currentPos.z) * smoothing;

    actionCamera.currentTarget.x += (targetX - actionCamera.currentTarget.x) * smoothing * 1.5;
    actionCamera.currentTarget.y += (targetY - actionCamera.currentTarget.y) * smoothing * 1.5;
    actionCamera.currentTarget.z += (targetZ - actionCamera.currentTarget.z) * smoothing * 1.5;

    // Apply to camera
    camera.position.set(
        actionCamera.currentPos.x,
        actionCamera.currentPos.y,
        actionCamera.currentPos.z
    );

    if (controls) {
        controls.target.set(
            actionCamera.currentTarget.x,
            actionCamera.currentTarget.y,
            actionCamera.currentTarget.z
        );
    }
}

function onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
        case '1': setCameraPreset('front'); break;
        case '2': setCameraPreset('side'); break;
        case '3': setCameraPreset('top'); break;
        case '4': setCameraPreset('isometric'); break;
        case '5': setCameraPreset('action'); break;
        case 'r': case 'R': setCameraPreset(currentPreset); break;
        case 'm': case 'M':
            if (BugFightsSound) {
                BugFightsSound.init();
                const muted: boolean = BugFightsSound.toggleMute();
                const btn: HTMLElement | null = document.getElementById('sound-toggle');
                if (btn) btn.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
            }
            break;
    }
}

function onWindowResize(): void {
    const container: HTMLElement | null = document.getElementById('arena3d');
    const width: number = container?.clientWidth || 900;
    const height: number = container?.clientHeight || 600;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// ============================================
// BUG RENDERING
// ============================================

function createBug(bugData: GenomeData, _index?: number): ThreeGroup {
    const genome = new BugGenome(bugData);
    const generator = new BugGenerator3D(genome);
    const bugGroup: ThreeGroup = generator.generate();

    // Scale down for arena
    bugGroup.scale.setScalar(2.5);

    return bugGroup;
}

function updateBugs(state: GameState, deltaTime: number): void {
    if (!state.fighters || state.fighters.length < 2) return;
    if (!state.bugs || state.bugs.length < 2) return;

    // Reset wall highlighting
    (Object.values(walls) as Array<ThreeMesh | null>).forEach((wall: ThreeMesh | null) => {
        if (wall && wall.material) {
            (wall.material as ThreeMeshBasicMaterial).color.setHex(0x333333);
            (wall.material as ThreeMeshBasicMaterial).opacity = 0.1;
        }
    });

    // Highlight walls being climbed
    state.fighters.forEach((fighter: FighterState) => {
        if (fighter.onWall && fighter.wallSide && walls[fighter.wallSide]) {
            const wall: ThreeMesh = walls[fighter.wallSide]!;
            (wall.material as ThreeMeshBasicMaterial).color.setHex(0x44ff88);  // Green tint
            (wall.material as ThreeMeshBasicMaterial).opacity = 0.2;
        }
    });

    // Check for new fight
    if (state.fightNumber !== currentFightNumber) {
        // Clear old bugs - dispose GPU resources
        bugMeshes.forEach((mesh: ThreeGroup | null) => {
            if (mesh) {
                scene.remove(mesh);
                disposeObject(mesh);
            }
        });
        bugMeshes = [null, null];
        bugAnimators = [null, null];

        // Clear UI - dispose GPU resources
        fighterUI.forEach((ui: ThreeGroup | null) => {
            if (ui) {
                scene.remove(ui);
                disposeObject(ui);
            }
        });
        fighterUI = [null, null];

        // Clear motion trails - dispose GPU resources
        motionTrails.forEach((trail: MotionTrail[], index: number) => {
            trail.forEach((t: MotionTrail) => {
                scene.remove(t.mesh);
                disposeObject(t.mesh);
            });
            motionTrails[index as 0 | 1] = [];
        });

        // Clear lingering particles and damage numbers
        hitParticles.forEach((p: HitParticle) => {
            scene.remove(p.mesh);
            disposeObject(p.mesh);
        });
        hitParticles = [];
        damageNumbers.forEach((d: DamageNumber) => {
            scene.remove(d.sprite);
            disposeObject(d.sprite);
        });
        damageNumbers = [];

        currentFightNumber = state.fightNumber;
    }

    state.fighters.forEach((fighter: FighterState, index: number) => {
        // Create bug if needed
        if (!bugMeshes[index as 0 | 1]) {
            const bugData: GenomeData | undefined = state.bugs[index];
            if (!bugData) return;
            bugMeshes[index as 0 | 1] = createBug(bugData, index);
            bugAnimators[index as 0 | 1] = new BugAnimator(bugMeshes[index as 0 | 1]!);
            scene.add(bugMeshes[index as 0 | 1]!);
        }

        const bug: ThreeGroup = bugMeshes[index as 0 | 1]!;
        const animator: BugAnimator = bugAnimators[index as 0 | 1]!;

        // Position from server
        const pos3d: Vec3 = { x: fighter.x, y: fighter.y, z: fighter.z || 0 };

        // Death/Victory fall handling - bugs fall to ground client-side
        const isDead: boolean = fighter.state === 'death';
        const isVictory: boolean = fighter.state === 'victory';
        const floorY: number = 20;  // Floor level in 3D coordinates

        // Initialize death fall tracking
        if (!bug.userData['deathFall']) {
            bug.userData['deathFall'] = {
                active: false,
                startY: 0,
                currentY: 0,
                velocityY: 0,
                landed: false,
                lastAliveY: pos3d.y,  // Track position before death
                lastAliveX: pos3d.x,
                lastAliveZ: pos3d.z
            } as DeathFallState;
        }

        const deathFall: DeathFallState = bug.userData['deathFall'] as DeathFallState;

        // Track position while alive (save last known airborne position)
        if (!isDead && !isVictory) {
            deathFall.lastAliveY = pos3d.y;
            deathFall.lastAliveX = pos3d.x;
            deathFall.lastAliveZ = pos3d.z;
            deathFall.active = false;
            deathFall.landed = false;
        }

        // Victory bugs stay where they are (no fall, no teleport)
        if (isVictory && !deathFall.active) {
            deathFall.active = true;
            deathFall.landed = true;  // Don't fall, just stay
            console.log(`Bug ${index} victory - staying at Y=${deathFall.lastAliveY.toFixed(1)}`);
        }

        // Dead bugs fall to ground using LAST ALIVE position (not current server position)
        if (isDead && !deathFall.active) {
            const startY: number = deathFall.lastAliveY;
            // Only fall if we were above ground
            if (startY > floorY + 5) {
                deathFall.active = true;
                deathFall.startY = startY;
                deathFall.currentY = startY;
                deathFall.velocityY = 0;
                deathFall.landed = false;
                console.log(`Bug ${index} death fall starting from Y=${startY.toFixed(1)}`);
            } else {
                // Already on ground, mark as landed immediately
                deathFall.active = true;
                deathFall.landed = true;
            }
        }

        // Animate the fall (dead bugs only)
        if (isDead && deathFall.active && !deathFall.landed) {
            // Apply gravity
            deathFall.velocityY -= 0.8;  // Gravity (negative because Y+ is up in 3D)
            deathFall.currentY += deathFall.velocityY;

            // Check for floor collision
            if (deathFall.currentY <= floorY) {
                deathFall.currentY = floorY;
                // Small bounce
                if (Math.abs(deathFall.velocityY) > 3) {
                    deathFall.velocityY = -deathFall.velocityY * 0.3;
                } else {
                    deathFall.velocityY = 0;
                    deathFall.landed = true;
                    console.log(`Bug ${index} landed on floor`);
                }
            }

            // Use saved X/Z position (where bug was when it died) and falling Y
            const fallX: number = deathFall.lastAliveX;
            const fallZ: number = deathFall.lastAliveZ;
            bug.position.set(fallX, deathFall.currentY, fallZ);
        } else if (deathFall.active && deathFall.landed) {
            // Dead: stay on floor, Victory: stay at last position
            const fallX: number = deathFall.lastAliveX;
            const fallZ: number = deathFall.lastAliveZ;
            const stayY: number = isDead ? floorY : deathFall.lastAliveY;
            bug.position.set(fallX, stayY, fallZ);
        } else {
            // Normal positioning - clamp Y to stay within arena bounds
            const clampedY: number = Math.min(pos3d.y, ARENA_3D.maxY - 20);  // Keep below ceiling with small margin
            bug.position.set(pos3d.x, clampedY, pos3d.z);
        }

        // === ROTATION TO FACE OPPONENT ===
        const vx: number = fighter.vx || 0;
        const vy: number = fighter.vy || 0;
        const vz: number = fighter.vz || 0;
        const speed: number = Math.sqrt(vx * vx + vy * vy + vz * vz);

        // Use facingAngle from server (angle toward opponent in XZ plane)
        // Server: atan2(dx, dz) where 0 = +Z direction, PI/2 = +X direction
        // Three.js: rotation.y of 0 = facing +Z (bug's head is at +Z in local space)
        // These match! No adjustment needed.
        let baseRotY: number = fighter.facingAngle !== undefined
            ? fighter.facingAngle
            : (fighter.facingRight ? Math.PI / 2 : -Math.PI / 2);

        // Banking (roll) based on lateral velocity - lean into turns (reduced)
        const maxBank: number = Math.PI / 8;  // 22.5 degrees max (was 30)
        const bankAmount: number = clamp3D(-vz * 0.05, -maxBank, maxBank);

        // Pitch based on vertical velocity - tilt up/down when climbing/diving (reduced)
        const maxPitch: number = Math.PI / 6;  // 30 degrees max (was 36)
        const pitchAmount: number = clamp3D(vy * 0.05, -maxPitch, maxPitch);

        // Apply rotations with smoothing (skip if on wall or dead - they have special handling)
        if (!fighter.onWall && !isDead) {
            const smoothFactor: number = 0.12;
            bug.userData['targetRotX'] = bug.userData['targetRotX'] as number || 0;
            bug.userData['targetRotY'] = bug.userData['targetRotY'] as number || baseRotY;
            bug.userData['targetRotZ'] = bug.userData['targetRotZ'] as number || 0;

            bug.userData['targetRotX'] = pitchAmount;
            bug.userData['targetRotY'] = baseRotY;
            bug.userData['targetRotZ'] = bankAmount;

            bug.rotation.x += ((bug.userData['targetRotX'] as number) - bug.rotation.x) * smoothFactor;
            bug.rotation.y += ((bug.userData['targetRotY'] as number) - bug.rotation.y) * smoothFactor;
            bug.rotation.z += ((bug.userData['targetRotZ'] as number) - bug.rotation.z) * smoothFactor;

            // Additional visual effects for flying bugs (not dead/victory)
            if (fighter.isFlying && !isDead && !isVictory) {
                // Hovering bob when slow
                if (speed < 3) {
                    const bob: number = Math.sin(performance.now() / 200) * 3;
                    bug.position.y += bob;
                }

                // Diving visual - stronger pitch
                if (fighter.isDiving) {
                    bug.rotation.x = Math.max(bug.rotation.x, Math.PI / 4);  // Force nose-down
                }
            }
        }

        // Wall climbing visual - two-step quaternion approach
        //
        // Bug model: Head at +Z, Feet at -Y
        // Goal: Feet toward wall, Head pointing up
        //
        // Step 1: Rotate so feet (-Y local) point toward wall
        // Step 2: Rotate around that axis so head (+Z) points up
        //
        // Skip for dead bugs - they fall off walls
        if (fighter.onWall && !isDead) {
            // Where should feet point? Toward the wall surface.
            const feetTarget = new THREE.Vector3();
            if (fighter.wallSide === 'left') feetTarget.set(-1, 0, 0);
            else if (fighter.wallSide === 'right') feetTarget.set(1, 0, 0);
            else if (fighter.wallSide === 'front') feetTarget.set(0, 0, 1);
            else if (fighter.wallSide === 'back') feetTarget.set(0, 0, -1);

            // Step 1: Rotate local -Y to align with feetTarget
            const localDown = new THREE.Vector3(0, -1, 0);
            const q1 = new THREE.Quaternion().setFromUnitVectors(localDown, feetTarget);

            // After q1, where does the head (+Z) end up?
            const localForward = new THREE.Vector3(0, 0, 1);
            const headAfterQ1 = localForward.clone().applyQuaternion(q1);

            // Step 2: We want head to point up (+Y world), but constrained to rotate around feetTarget axis
            const headTarget = new THREE.Vector3(0, 1, 0);

            // Project both vectors onto the plane perpendicular to feetTarget
            const headProj = headAfterQ1.clone().sub(feetTarget.clone().multiplyScalar(headAfterQ1.dot(feetTarget))).normalize();
            const targetProj = headTarget.clone().sub(feetTarget.clone().multiplyScalar(headTarget.dot(feetTarget))).normalize();

            // Angle between them (rotation around feetTarget axis)
            let angle: number = Math.acos(Math.max(-1, Math.min(1, headProj.dot(targetProj))));

            // Determine sign using cross product
            const cross = new THREE.Vector3().crossVectors(headProj, targetProj);
            if (cross.dot(feetTarget) < 0) angle = -angle;

            // Create rotation around feetTarget axis
            const q2 = new THREE.Quaternion().setFromAxisAngle(feetTarget, angle);

            // Combine: apply q1 first, then q2
            bug.quaternion.copy(q1).premultiply(q2);

            // Push bug position toward wall so feet touch the surface
            // The bug's body center is offset from the wall, so push it closer
            const wallOffset: number = 15;  // Distance to push toward wall
            if (fighter.wallSide === 'left') {
                bug.position.x = ARENA_3D.minX + wallOffset;
            } else if (fighter.wallSide === 'right') {
                bug.position.x = ARENA_3D.maxX - wallOffset;
            } else if (fighter.wallSide === 'front') {
                bug.position.z = ARENA_3D.maxZ - wallOffset;
            } else if (fighter.wallSide === 'back') {
                bug.position.z = ARENA_3D.minZ + wallOffset;
            }
        }

        // Animation - pass velocity for speed-based animations
        // Override grounded state for death/victory fall
        const animFighter: FighterState = { ...fighter };
        if (deathFall.active) {
            animFighter.grounded = deathFall.landed;
            // Override onWall too - dead bugs aren't on walls
            if (isDead || isVictory) {
                animFighter.onWall = false;
            }
        }
        animator.update(deltaTime, fighter.state, animFighter);

        // Flash effect (hit feedback)
        if (fighter.flashTimer > 0 && fighter.flashTimer % 2 === 0) {
            bug.traverse((child: ThreeObject3D) => {
                const m = child as ThreeMesh;
                if (m.isMesh && m.material) {
                    const mat = m.material as ThreeMeshStandardMaterial;
                    mat.emissive = new THREE.Color(0xffffff);
                    mat.emissiveIntensity = 0.8;
                }
            });
        } else {
            bug.traverse((child: ThreeObject3D) => {
                const m = child as ThreeMesh;
                if (m.isMesh && m.material) {
                    const mat = m.material as ThreeMeshStandardMaterial;
                    if (mat.emissive) {
                        mat.emissive = new THREE.Color(0x000000);
                        mat.emissiveIntensity = 0;
                    }
                }
            });
        }

        // Aggression color tint
        if (fighter.drives) {
            const aggression: number = fighter.drives.aggression || 0.5;
            const caution: number = fighter.drives.caution || 0.5;
            bug.traverse((child: ThreeObject3D) => {
                const m = child as ThreeMesh;
                if (m.isMesh && m.material && !m.userData['isEye']) {
                    // Subtle color shift based on drives
                    const r: number = 0.1 * (aggression - 0.5);
                    const b: number = 0.1 * (caution - 0.5);
                    const mat = m.material as ThreeMeshStandardMaterial;
                    if (mat.emissive) {
                        mat.emissive.setRGB(Math.max(0, r), 0, Math.max(0, b));
                        mat.emissiveIntensity = 0.2;
                    }
                }
            });
        }

        // Update UI
        updateFighterUI(index, fighter, state);
    });
}

// Helper for clamping
function clamp3D(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

// ============================================
// EFFECTS
// ============================================

function createHitParticles(x: number, y: number, z: number, color: number = 0xffff00, count: number = 8, isCrit: boolean = false): void {
    // Mix of spark shapes for more dynamic effect
    const sphereGeo = new THREE.SphereGeometry(2, 4, 4);
    const sparkGeo = new THREE.ConeGeometry(1.5, 6, 4);  // Elongated sparks

    for (let i = 0; i < count; i++) {
        if (hitParticles.length >= 150) {
            const old: HitParticle | undefined = hitParticles.shift();
            if (old) {
                scene.remove(old.mesh);
                disposeObject(old.mesh);
            }
        }

        // Vary particle size - crits get bigger particles
        const sizeScale: number = isCrit ? 1.5 + Math.random() * 0.5 : 0.8 + Math.random() * 0.6;
        const useSpark: boolean = Math.random() > 0.4;  // 60% sparks, 40% spheres

        const geo = useSpark ? sparkGeo.clone() : sphereGeo.clone();
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.scale.setScalar(sizeScale);

        // Faster, more explosive speed
        const speed: number = (isCrit ? 8 : 5) + Math.random() * 6;
        const angleXZ: number = Math.random() * Math.PI * 2;
        const angleY: number = (Math.random() - 0.2) * Math.PI;  // Bias slightly upward

        const pvx: number = Math.cos(angleXZ) * Math.cos(angleY) * speed;
        const pvy: number = Math.sin(angleY) * speed + 3;
        const pvz: number = Math.sin(angleXZ) * Math.cos(angleY) * speed;

        // Orient spark in direction of travel
        if (useSpark) {
            mesh.lookAt(x + pvx, y + pvy, z + pvz);
            mesh.rotateX(Math.PI / 2);
        }

        hitParticles.push({
            mesh: mesh,
            vx: pvx,
            vy: pvy,
            vz: pvz,
            life: 1.0,
            decay: 0.04 + Math.random() * 0.02,  // Slightly faster decay
            isSpark: useSpark,
        });

        scene.add(mesh);
    }
}

function createDamageNumber(x: number, y: number, z: number, damage: number, isCrit: boolean = false, isPoison: boolean = false): void {
    if (damageNumbers.length >= 20) {
        const old: DamageNumber | undefined = damageNumbers.shift();
        if (old) {
            scene.remove(old.sprite);
            disposeObject(old.sprite);
        }
    }

    const canvas: HTMLCanvasElement = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx: CanvasRenderingContext2D = canvas.getContext('2d')!;

    let color: string = '#fff';
    let fontSize: number = 32;
    if (isCrit) { color = '#ff0'; fontSize = 40; }
    else if (isPoison) { color = '#0f0'; fontSize = 28; }

    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText(damage.toString(), 64, 32);
    ctx.fillStyle = color;
    ctx.fillText(damage.toString(), 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(x, y + 20, z);
    sprite.scale.set(40, 20, 1);

    damageNumbers.push({
        sprite: sprite,
        vy: 1.5 + (isCrit ? 0.5 : 0),
        life: 1.0,
        decay: 0.025,
    });

    scene.add(sprite);
}

function createMotionTrail(x: number, y: number, z: number, color: number, index: number): void {
    // Create a small sphere for the trail point
    const trailGeo = new THREE.SphereGeometry(3, 4, 4);
    const trailMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.6,
    });
    const trailMesh = new THREE.Mesh(trailGeo, trailMat);
    trailMesh.position.set(x, y, z);

    motionTrails[index as 0 | 1].push({
        mesh: trailMesh,
        life: 1.0,
        decay: 0.08,
    });

    scene.add(trailMesh);

    // Remove oldest if too many
    if (motionTrails[index as 0 | 1].length > MAX_TRAIL_POINTS) {
        const old: MotionTrail | undefined = motionTrails[index as 0 | 1].shift();
        if (old) {
            scene.remove(old.mesh);
            disposeObject(old.mesh);
        }
    }
}

function updateMotionTrails(state: GameState): void {
    if (!state.fighters) return;

    state.fighters.forEach((fighter: FighterState, index: number) => {
        const vx: number = fighter.vx || 0;
        const vy: number = fighter.vy || 0;
        const vz: number = fighter.vz || 0;
        const speed: number = Math.sqrt(vx * vx + vy * vy + vz * vz);

        // Spawn trail point if moving fast enough
        if (speed > TRAIL_SPAWN_SPEED && fighter.state !== 'death') {
            const pos3d: Vec3 = { x: fighter.x, y: fighter.y, z: fighter.z || 0 };

            // Color based on state
            let trailColor: number = 0x888888;  // Default gray
            if (fighter.isFlying && fighter.isDiving) {
                trailColor = 0xff8800;  // Orange for diving
            } else if (fighter.isFlying) {
                trailColor = 0x88ccff;  // Light blue for flying
            } else if (fighter.aiState === 'aggressive') {
                trailColor = 0xff4444;  // Red for aggressive
            } else if (fighter.aiState === 'retreating') {
                trailColor = 0x44ff44;  // Green for retreating
            }

            // Spawn trail with some randomness
            if (Math.random() < 0.7) {
                createMotionTrail(
                    pos3d.x + (Math.random() - 0.5) * 5,
                    pos3d.y + (Math.random() - 0.5) * 5,
                    pos3d.z + (Math.random() - 0.5) * 5,
                    trailColor,
                    index
                );
            }
        }

        // Update existing trail points
        for (let i = motionTrails[index as 0 | 1].length - 1; i >= 0; i--) {
            const trail: MotionTrail | undefined = motionTrails[index as 0 | 1][i];
            if (!trail) continue;
            trail.life -= trail.decay;
            (trail.mesh.material as ThreeMeshBasicMaterial).opacity = trail.life * 0.6;
            trail.mesh.scale.setScalar(trail.life);

            if (trail.life <= 0) {
                scene.remove(trail.mesh);
                disposeObject(trail.mesh);
                motionTrails[index as 0 | 1].splice(i, 1);
            }
        }
    });
}

function updateEffects(): void {
    // Update particles
    for (let i = hitParticles.length - 1; i >= 0; i--) {
        const p: HitParticle | undefined = hitParticles[i];
        if (!p) continue;
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        p.vy -= 0.2;  // Slightly more gravity
        p.vx *= 0.98;  // Air resistance
        p.vz *= 0.98;
        p.life -= p.decay;
        (p.mesh.material as ThreeMeshBasicMaterial).opacity = Math.pow(p.life, 0.5);  // Fade out more gradually at first

        // Sparks orient to direction of travel and shrink lengthwise
        if (p.isSpark) {
            const speed: number = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
            if (speed > 0.5) {
                p.mesh.lookAt(
                    p.mesh.position.x + p.vx,
                    p.mesh.position.y + p.vy,
                    p.mesh.position.z + p.vz
                );
                p.mesh.rotateX(Math.PI / 2);
            }
            p.mesh.scale.set(p.life, p.life * 1.5, p.life);  // Elongated fade
        } else {
            p.mesh.scale.setScalar(p.life * 0.8 + 0.2);  // Don't shrink to nothing
        }

        if (p.life <= 0) {
            scene.remove(p.mesh);
            disposeObject(p.mesh);
            hitParticles.splice(i, 1);
        }
    }

    // Update damage numbers
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
        const d: DamageNumber | undefined = damageNumbers[i];
        if (!d) continue;
        d.sprite.position.y += d.vy;
        d.vy *= 0.95;
        d.life -= d.decay;
        (d.sprite.material as import('three').SpriteMaterial).opacity = d.life;

        if (d.life <= 0) {
            scene.remove(d.sprite);
            disposeObject(d.sprite);
            damageNumbers.splice(i, 1);
        }
    }

    // Screen shake decay
    if (screenShake.intensity > 0) {
        screenShake.intensity *= 0.9;
        if (screenShake.intensity < 0.1) screenShake.intensity = 0;
    }
}

function processEvents(events: GameEvent[]): void {
    if (!events || events.length === 0) return;

    events.forEach((event: GameEvent) => {
        // Sound engine handles all event types
        if (BugFightsSound) {
            BugFightsSound.handleEvent(event);
        }

        if (event.type === 'hit') {
            const pos3d: Vec3 = { x: event.data.x, y: event.data.y, z: 0 };
            const isCrit: boolean = !!event.data.isCrit;
            const isPoison: boolean = !!event.data.isPoison;

            // Color by damage type - orange normal, yellow crit, green poison
            const color: number = isPoison ? 0x00ff00 : isCrit ? 0xffff00 : 0xff6600;

            // More particles for bigger hits, even more for crits
            const particleCount: number = isCrit ? 20 : 12;
            createHitParticles(pos3d.x, pos3d.y, pos3d.z, color, particleCount, isCrit);
            createDamageNumber(pos3d.x, pos3d.y, pos3d.z, event.data.damage, isCrit, isPoison);

            // Stronger screen shake - scales with damage
            const damageShake: number = Math.min(event.data.damage / 10, 2);
            const critBonus: number = isCrit ? 4 : 0;
            screenShake.intensity = Math.min(15, screenShake.intensity + damageShake + critBonus + 2);
        }

        if (event.type === 'wallImpact') {
            const pos3d: Vec3 = { x: event.data.x, y: event.data.y, z: 0 };
            createHitParticles(pos3d.x, pos3d.y, pos3d.z, 0x888888, 15, false);
            screenShake.intensity = Math.min(12, screenShake.intensity + event.data.stunApplied / 3);
        }
    });

    // Clear events after processing to prevent re-processing on next frame
    events.length = 0;
}

// ============================================
// FIGHTER UI
// ============================================

function createFighterUI(_index: number, name: string): ThreeGroup {
    const group: ThreeGroup = new THREE.Group();

    // Health bar background
    const bgGeo = new THREE.PlaneGeometry(50, 6);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    group.add(bgMesh);

    // Health bar fill
    const fillGeo = new THREE.PlaneGeometry(48, 4);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    const fillMesh = new THREE.Mesh(fillGeo, fillMat);
    fillMesh.position.z = 0.1;
    group.add(fillMesh);

    // Name label
    const canvas: HTMLCanvasElement = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx: CanvasRenderingContext2D = canvas.getContext('2d')!;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(name, 128, 32);
    ctx.fillText(name, 128, 32);

    const nameTexture = new THREE.CanvasTexture(canvas);
    const nameMat = new THREE.SpriteMaterial({ map: nameTexture, transparent: true, depthTest: false });
    const nameSprite = new THREE.Sprite(nameMat);
    nameSprite.position.y = 15;
    nameSprite.scale.set(60, 15, 1);
    group.add(nameSprite);

    group.userData['fillMesh'] = fillMesh;
    group.userData['fillMat'] = fillMat;

    return group;
}

function updateFighterUI(index: number, fighter: FighterState, state: GameState): void {
    if (!fighterUI[index as 0 | 1]) {
        const name: string = state.bugNames ? (state.bugNames[index] ?? `Fighter ${index + 1}`) : `Fighter ${index + 1}`;
        fighterUI[index as 0 | 1] = createFighterUI(index, name);
        scene.add(fighterUI[index as 0 | 1]!);
    }

    const ui: ThreeGroup = fighterUI[index as 0 | 1]!;
    const pos3d: Vec3 = { x: fighter.x, y: fighter.y, z: fighter.z || 0 };
    ui.position.set(pos3d.x, pos3d.y + 50, pos3d.z);
    ui.lookAt(camera.position);

    const hpPercent: number = fighter.hp / fighter.maxHp;
    const fillMesh: ThreeMesh = ui.userData['fillMesh'] as ThreeMesh;
    const fillMat: ThreeMeshBasicMaterial = ui.userData['fillMat'] as ThreeMeshBasicMaterial;

    fillMesh.scale.x = hpPercent;
    fillMesh.position.x = (1 - hpPercent) * -24;

    if (hpPercent > 0.5) fillMat.color.setHex(0x00ff00);
    else if (hpPercent > 0.25) fillMat.color.setHex(0xffff00);
    else fillMat.color.setHex(0xff0000);

    ui.visible = fighter.state !== 'death' || fighter.deathAlpha > 0.5;
}

// ============================================
// RENDER LOOP
// ============================================

function render3D(state: GameState): void {
    if (!renderer) return;

    const now: number = performance.now();
    const deltaTime: number = (now - lastTime) / 1000;
    lastTime = now;

    // Update action camera before controls
    updateActionCamera(state);

    if (controls) controls.update();

    updateBugs(state, deltaTime);
    updateMotionTrails(state);
    processEvents(state.events);
    updateEffects();

    // Update sound engine (wing buzzes, ambient, phase changes)
    if (BugFightsSound) {
        BugFightsSound.update(state.fighters);
    }

    // Screen shake
    if (screenShake.intensity > 0) {
        camera.position.x += (Math.random() - 0.5) * screenShake.intensity;
        camera.position.y += (Math.random() - 0.5) * screenShake.intensity;
    }

    renderer.render(scene, camera);
}

function gameLoop3D(): void {
    const state: GameState = BugFightsClient.getState();
    render3D(state);
    requestAnimationFrame(gameLoop3D);
}

// ============================================
// INIT
// ============================================

function initRenderer3D(): void {
    initThreeJS();
    gameLoop3D();

    // Initialize sound engine on first user interaction (browser requirement)
    const initSound = (): void => {
        if (BugFightsSound) {
            BugFightsSound.init();
        }
        document.removeEventListener('click', initSound);
        document.removeEventListener('keydown', initSound);
    };
    document.addEventListener('click', initSound);
    document.addEventListener('keydown', initSound);

    console.log('3D Renderer initialized');
    console.log('Camera: 1=Front, 2=Side, 3=Top, 4=Isometric, 5=Action (default), R=Reset, Mouse=Orbit');
}

export const BugFightsRenderer3D: Renderer3DAPI = {
    init: initRenderer3D,
    setCameraPreset: setCameraPreset,
    createBugForRoster: createBug,
};
