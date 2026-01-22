// Bug Fights - 3D Renderer
// Three.js based voxel rendering

// ============================================
// IMPORTS (loaded via script tags)
// ============================================
// THREE, OrbitControls loaded from CDN

// ============================================
// CONSTANTS
// ============================================

const ARENA_3D = {
    width: 900,      // X axis
    height: 400,     // Y axis (vertical)
    depth: 600,      // Z axis
    // Boundaries (centered at origin for easier math)
    minX: -450,
    maxX: 450,
    minY: 0,
    maxY: 400,
    minZ: -300,
    maxZ: 300,
};

// Map from 2D coordinates to 3D
// 2D: x = 50-850, y = 80-550 (floorY)
// 3D: x = -450 to 450, y = 0 (floor) to 400, z = -300 to 300
function map2Dto3D(x2d, y2d, z2d = 0) {
    // 2D x: 50-850 -> 3D x: -450 to 450
    const x3d = (x2d - 450);
    // 2D y: 80 (ceiling) to 550 (floor) -> 3D y: 400 (top) to 0 (floor)
    const y3d = 550 - y2d;
    // Z is passed directly from server (already in correct range)
    const z3d = z2d;
    return { x: x3d, y: y3d, z: z3d };
}

// ============================================
// STATE
// ============================================

let scene, camera, renderer, controls;
let arena = {};
let bugMeshes = [null, null]; // Two fighters
let particles3d = [];
let floatingNumbers3d = [];

// Camera presets
const CAMERA_PRESETS = {
    front: { position: { x: 0, y: 200, z: 800 }, target: { x: 0, y: 150, z: 0 } },
    side: { position: { x: 800, y: 200, z: 0 }, target: { x: 0, y: 150, z: 0 } },
    top: { position: { x: 0, y: 800, z: 100 }, target: { x: 0, y: 0, z: 0 } },
    isometric: { position: { x: 500, y: 400, z: 500 }, target: { x: 0, y: 100, z: 0 } },
};

let currentPreset = 'front';

// ============================================
// INITIALIZATION
// ============================================

function initThreeJS() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);

    // Camera
    camera = new THREE.PerspectiveCamera(
        60, // FOV
        window.innerWidth / window.innerHeight, // Aspect
        1, // Near
        5000 // Far
    );
    setCameraPreset('front');

    // Renderer
    const canvas = document.getElementById('arena3d');
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    });
    renderer.setSize(900, 600);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Orbit Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 200;
    controls.maxDistance = 1500;
    controls.maxPolarAngle = Math.PI * 0.85; // Don't go below floor
    controls.target.set(0, 100, 0);

    // Lighting
    setupLighting();

    // Arena
    buildArena();

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);

    console.log('Three.js initialized');
}

function setupLighting() {
    // Ambient light - base visibility
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    // Main directional light (sun)
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

    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-200, 300, -200);
    scene.add(fillLight);

    // Slight warm light from below (terrarium feel)
    const groundLight = new THREE.DirectionalLight(0xffaa66, 0.2);
    groundLight.position.set(0, -100, 0);
    scene.add(groundLight);
}

function buildArena() {
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(ARENA_3D.width, ARENA_3D.depth);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2218,
        roughness: 0.9,
        metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);
    arena.floor = floor;

    // Substrate particles on floor
    const substrateGeometry = new THREE.BufferGeometry();
    const substratePositions = [];
    const substrateColors = [];
    const substrateCount = 500;
    const substrateColors_ = [
        new THREE.Color(0x4a3a28),
        new THREE.Color(0x5a4a35),
        new THREE.Color(0x3a2a18),
        new THREE.Color(0x6a5a45),
    ];

    for (let i = 0; i < substrateCount; i++) {
        const x = (Math.random() - 0.5) * ARENA_3D.width * 0.95;
        const z = (Math.random() - 0.5) * ARENA_3D.depth * 0.95;
        const y = Math.random() * 3;
        substratePositions.push(x, y, z);
        const color = substrateColors_[Math.floor(Math.random() * substrateColors_.length)];
        substrateColors.push(color.r, color.g, color.b);
    }

    substrateGeometry.setAttribute('position', new THREE.Float32BufferAttribute(substratePositions, 3));
    substrateGeometry.setAttribute('color', new THREE.Float32BufferAttribute(substrateColors, 3));
    const substrateMaterial = new THREE.PointsMaterial({
        size: 5,
        vertexColors: true,
        sizeAttenuation: true,
    });
    const substrate = new THREE.Points(substrateGeometry, substrateMaterial);
    scene.add(substrate);
    arena.substrate = substrate;

    // Walls (transparent with wireframe edges)
    const wallMaterial = new THREE.MeshBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
    });
    const wallEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x444444 });

    // Left wall (X = minX)
    const leftWallGeo = new THREE.PlaneGeometry(ARENA_3D.depth, ARENA_3D.height);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMaterial);
    leftWall.position.set(ARENA_3D.minX, ARENA_3D.height / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);
    arena.leftWall = leftWall;

    // Right wall (X = maxX)
    const rightWall = new THREE.Mesh(leftWallGeo.clone(), wallMaterial);
    rightWall.position.set(ARENA_3D.maxX, ARENA_3D.height / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    scene.add(rightWall);
    arena.rightWall = rightWall;

    // Front wall (Z = maxZ, facing camera in default view)
    const frontWallGeo = new THREE.PlaneGeometry(ARENA_3D.width, ARENA_3D.height);
    const frontWall = new THREE.Mesh(frontWallGeo, wallMaterial);
    frontWall.position.set(0, ARENA_3D.height / 2, ARENA_3D.maxZ);
    frontWall.rotation.y = Math.PI;
    scene.add(frontWall);
    arena.frontWall = frontWall;

    // Back wall (Z = minZ)
    const backWall = new THREE.Mesh(frontWallGeo.clone(), wallMaterial);
    backWall.position.set(0, ARENA_3D.height / 2, ARENA_3D.minZ);
    scene.add(backWall);
    arena.backWall = backWall;

    // Ceiling (very transparent)
    const ceilingMaterial = new THREE.MeshBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.05,
        side: THREE.DoubleSide,
    });
    const ceiling = new THREE.Mesh(floorGeometry.clone(), ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ARENA_3D.height;
    scene.add(ceiling);
    arena.ceiling = ceiling;

    // Arena edges (wireframe box)
    const edgesGeometry = new THREE.BoxGeometry(ARENA_3D.width, ARENA_3D.height, ARENA_3D.depth);
    const edges = new THREE.EdgesGeometry(edgesGeometry);
    const edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x555555 }));
    edgeLines.position.y = ARENA_3D.height / 2;
    scene.add(edgeLines);
    arena.edges = edgeLines;

    // Add some rocks
    addRocks();

    // Add some plants
    addPlants();
}

function addRocks() {
    const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4a4a,
        roughness: 0.9,
        metalness: 0.1,
    });

    const numRocks = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numRocks; i++) {
        const rockGeometry = new THREE.DodecahedronGeometry(15 + Math.random() * 25, 0);
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.set(
            (Math.random() - 0.5) * ARENA_3D.width * 0.7,
            10 + Math.random() * 10,
            (Math.random() - 0.5) * ARENA_3D.depth * 0.7
        );
        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        rock.scale.y = 0.6 + Math.random() * 0.4;
        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);
    }
}

function addPlants() {
    const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x2d5a2d });

    const numPlants = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numPlants; i++) {
        const plantGroup = new THREE.Group();

        // Position near walls
        const side = Math.random() < 0.5 ? -1 : 1;
        const nearX = Math.random() < 0.5;

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

        // Create plant stems
        const numStems = 3 + Math.floor(Math.random() * 4);
        for (let j = 0; j < numStems; j++) {
            const height = 30 + Math.random() * 50;
            const stemGeometry = new THREE.CylinderGeometry(1, 2, height, 6);
            const stem = new THREE.Mesh(stemGeometry, stemMaterial);
            stem.position.set(
                (Math.random() - 0.5) * 10,
                height / 2,
                (Math.random() - 0.5) * 10
            );
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

function setCameraPreset(presetName) {
    const preset = CAMERA_PRESETS[presetName];
    if (!preset) return;

    currentPreset = presetName;

    camera.position.set(preset.position.x, preset.position.y, preset.position.z);
    if (controls) {
        controls.target.set(preset.target.x, preset.target.y, preset.target.z);
        controls.update();
    } else {
        camera.lookAt(preset.target.x, preset.target.y, preset.target.z);
    }
}

function onKeyDown(event) {
    switch (event.key) {
        case '1':
            setCameraPreset('front');
            break;
        case '2':
            setCameraPreset('side');
            break;
        case '3':
            setCameraPreset('top');
            break;
        case '4':
            setCameraPreset('isometric');
            break;
        case 'r':
        case 'R':
            // Reset to current preset
            setCameraPreset(currentPreset);
            break;
    }
}

function onWindowResize() {
    const container = document.getElementById('arena3d');
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 600;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// ============================================
// VOXEL BUG RENDERING
// ============================================

// Cached bug meshes and data
let bugCache = {}; // Keyed by genome hash
let currentFightNumber = 0;

// Voxel size in world units
const VOXEL_SIZE = 3;

// Animation state
const ANIM_FRAME_DURATION = 6; // Ticks per animation frame
let animationCounters = [0, 0]; // Per-fighter animation counter

/**
 * Create a mesh group from voxel data
 * @param {Object} frameData - {voxels, colors, size}
 * @returns {THREE.Group} Group containing all voxel meshes
 */
function createMeshFromVoxels(frameData) {
    const bugGroup = new THREE.Group();

    // Group voxels by color for efficient instancing
    const colorGroups = {};
    frameData.voxels.forEach(v => {
        if (!colorGroups[v.colorIndex]) {
            colorGroups[v.colorIndex] = [];
        }
        colorGroups[v.colorIndex].push(v);
    });

    // Create instanced mesh for each color
    const voxelGeometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);

    Object.entries(colorGroups).forEach(([colorIndex, voxels]) => {
        const color = frameData.colors[colorIndex];
        if (!color) return; // Skip transparent

        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.7,
            metalness: 0.1,
        });

        const instancedMesh = new THREE.InstancedMesh(voxelGeometry, material, voxels.length);
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;

        const matrix = new THREE.Matrix4();
        voxels.forEach((v, i) => {
            matrix.setPosition(v.x * VOXEL_SIZE, v.y * VOXEL_SIZE, v.z * VOXEL_SIZE);
            instancedMesh.setMatrixAt(i, matrix);
        });

        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.userData.colorIndex = colorIndex;
        bugGroup.add(instancedMesh);
    });

    return bugGroup;
}

/**
 * Create all animation frames for a bug
 * @param {Object} bugData - Bug genome data
 * @returns {Object} Object containing frame groups for each animation state
 */
function createAllBugFrames(bugData) {
    const genome = new BugGenome(bugData);
    const generator = new BugGenerator3D(genome);
    const animData = generator.generateAllFrames();

    const frameMeshes = {
        idle: [],
        attack: [],
        hit: [],
        death: [],
        victory: [],
        colors: animData.colors,
    };

    // Create mesh groups for each frame
    Object.keys(animData.frames).forEach(stateName => {
        animData.frames[stateName].forEach(frameData => {
            const mesh = createMeshFromVoxels(frameData);
            mesh.visible = false; // Start hidden
            frameMeshes[stateName].push(mesh);
        });
    });

    return frameMeshes;
}

/**
 * Create a voxel mesh group for a bug (legacy - creates single frame)
 * @param {Object} bugData - Bug genome data
 * @param {number} index - Fighter index (0 or 1)
 * @returns {THREE.Group} Group containing all voxel meshes
 */
function createVoxelBug(bugData, index) {
    // Create genome and generator
    const genome = new BugGenome(bugData);
    const generator = new BugGenerator3D(genome);
    const bugModel = generator.generate();

    return createMeshFromVoxels(bugModel);
}

/**
 * Generate a hash for bug genome to use as cache key
 */
function genomeCacheKey(bugData, fightNumber, index) {
    return `${fightNumber}-${index}`;
}

// Store animation frame data for each fighter
let bugAnimFrames = [null, null];
let currentAnimState = ['idle', 'idle'];
let currentFrameIndex = [0, 0];

/**
 * Map fighter state to animation state
 */
function getAnimationState(fighterState) {
    switch (fighterState) {
        case 'attacking':
            return 'attack';
        case 'hit':
        case 'stunned':
            return 'hit';
        case 'death':
            return 'death';
        case 'victory':
            return 'victory';
        default:
            return 'idle';
    }
}

/**
 * Update bug positions and create/update meshes
 */
function updateBugPositions(state) {
    if (!state.fighters || state.fighters.length < 2) return;
    if (!state.bugs || state.bugs.length < 2) return;

    // Check for new fight
    if (state.fightNumber !== currentFightNumber) {
        // Clear old bug meshes and animation frames
        bugMeshes.forEach(mesh => {
            if (mesh) scene.remove(mesh);
        });
        bugMeshes = [null, null];

        // Remove all animation frame meshes from scene
        bugAnimFrames.forEach(frames => {
            if (frames) {
                Object.keys(frames).forEach(stateName => {
                    if (Array.isArray(frames[stateName])) {
                        frames[stateName].forEach(mesh => {
                            if (mesh && mesh.parent) scene.remove(mesh);
                        });
                    }
                });
            }
        });
        bugAnimFrames = [null, null];
        currentAnimState = ['idle', 'idle'];
        currentFrameIndex = [0, 0];
        animationCounters = [0, 0];

        // Clear fighter UI
        clearFighterUI();

        currentFightNumber = state.fightNumber;
    }

    state.fighters.forEach((fighter, index) => {
        // Create all animation frames if needed
        if (!bugAnimFrames[index]) {
            const cacheKey = genomeCacheKey(state.bugs[index], state.fightNumber, index);

            // Check cache
            if (bugCache[cacheKey]) {
                bugAnimFrames[index] = bugCache[cacheKey];
            } else {
                bugAnimFrames[index] = createAllBugFrames(state.bugs[index]);
                bugCache[cacheKey] = bugAnimFrames[index];
            }

            // Add all frames to scene (but hidden)
            Object.keys(bugAnimFrames[index]).forEach(stateName => {
                if (Array.isArray(bugAnimFrames[index][stateName])) {
                    bugAnimFrames[index][stateName].forEach(mesh => {
                        scene.add(mesh);
                    });
                }
            });

            // Clean old cache entries
            cleanBugCache(state.fightNumber);
        }

        // Determine animation state
        const targetAnimState = getAnimationState(fighter.state);

        // Reset frame counter on state change
        if (targetAnimState !== currentAnimState[index]) {
            currentAnimState[index] = targetAnimState;
            currentFrameIndex[index] = 0;
            animationCounters[index] = 0;
        }

        // Advance animation frame
        animationCounters[index]++;
        if (animationCounters[index] >= ANIM_FRAME_DURATION) {
            animationCounters[index] = 0;
            const frames = bugAnimFrames[index][currentAnimState[index]];
            if (frames && frames.length > 0) {
                currentFrameIndex[index] = (currentFrameIndex[index] + 1) % frames.length;
            }
        }

        // Hide all frames, show current
        Object.keys(bugAnimFrames[index]).forEach(stateName => {
            if (Array.isArray(bugAnimFrames[index][stateName])) {
                bugAnimFrames[index][stateName].forEach((mesh, frameIdx) => {
                    const shouldShow = stateName === currentAnimState[index] &&
                        frameIdx === currentFrameIndex[index];
                    mesh.visible = shouldShow;

                    if (shouldShow) {
                        // Map 2D position to 3D (now with z from server)
                        const pos3d = map2Dto3D(fighter.x, fighter.y, fighter.z || 0);
                        mesh.position.set(pos3d.x, pos3d.y, pos3d.z);

                        // Rotation based on facing
                        mesh.rotation.y = fighter.facingRight ? 0 : Math.PI;

                        // Scale based on squash/stretch
                        const squash = fighter.squash || 1;
                        const stretch = fighter.stretch || 1;
                        mesh.scale.set(squash, stretch, 1);

                        // Flash effect
                        mesh.traverse(child => {
                            if (child.isMesh && child.material) {
                                if (fighter.flashTimer > 0 && fighter.flashTimer % 2 === 0) {
                                    child.material.emissive = new THREE.Color(0xffffff);
                                    child.material.emissiveIntensity = 0.8;
                                } else {
                                    child.material.emissive = new THREE.Color(0x000000);
                                    child.material.emissiveIntensity = 0;
                                }
                            }
                        });

                        // Additional position adjustments for victory/death
                        // (these are baked into the animation frames now)
                    }
                });
            }
        });
    });
}

/**
 * Clean old entries from bug cache
 */
function cleanBugCache(currentFight) {
    Object.keys(bugCache).forEach(key => {
        const fightNum = parseInt(key.split('-')[0]);
        if (fightNum < currentFight - 2) {
            delete bugCache[key];
        }
    });
}

// ============================================
// 3D EFFECTS SYSTEM
// ============================================

// Particle pool for hit effects
let hitParticles = [];
const MAX_HIT_PARTICLES = 100;

// Floating damage numbers
let damageNumbers = [];
const MAX_DAMAGE_NUMBERS = 20;

// Screen shake
let screenShake = { x: 0, y: 0, intensity: 0 };

// Floating UI (health bars, names)
let fighterUI = [null, null];

/**
 * Create hit particle burst at position
 */
function createHitParticles(x, y, z, color = 0xffff00, count = 8) {
    const particleGeo = new THREE.SphereGeometry(2, 4, 4);
    const particleMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 1,
    });

    for (let i = 0; i < count; i++) {
        if (hitParticles.length >= MAX_HIT_PARTICLES) {
            // Remove oldest particle
            const old = hitParticles.shift();
            scene.remove(old.mesh);
        }

        const mesh = new THREE.Mesh(particleGeo.clone(), particleMat.clone());
        mesh.position.set(x, y, z);

        // Random velocity in all directions
        const speed = 3 + Math.random() * 5;
        const angleXZ = Math.random() * Math.PI * 2;
        const angleY = (Math.random() - 0.3) * Math.PI;

        const particle = {
            mesh: mesh,
            vx: Math.cos(angleXZ) * Math.cos(angleY) * speed,
            vy: Math.sin(angleY) * speed + 2, // Upward bias
            vz: Math.sin(angleXZ) * Math.cos(angleY) * speed,
            life: 1.0,
            decay: 0.03 + Math.random() * 0.02,
        };

        scene.add(mesh);
        hitParticles.push(particle);
    }
}

/**
 * Create floating damage number
 */
function createDamageNumber(x, y, z, damage, isCrit = false, isPoison = false) {
    if (damageNumbers.length >= MAX_DAMAGE_NUMBERS) {
        const old = damageNumbers.shift();
        scene.remove(old.sprite);
    }

    // Create canvas for the number text
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Style based on damage type
    let color = '#fff';
    let fontSize = 32;
    if (isCrit) {
        color = '#ff0';
        fontSize = 40;
    } else if (isPoison) {
        color = '#0f0';
        fontSize = 28;
    }

    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText(damage.toString(), 64, 32);

    // Fill
    ctx.fillStyle = color;
    ctx.fillText(damage.toString(), 64, 32);

    // Create sprite
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(x, y + 20, z);
    sprite.scale.set(40, 20, 1);

    const dmgNum = {
        sprite: sprite,
        vy: 1.5 + (isCrit ? 0.5 : 0),
        life: 1.0,
        decay: 0.025,
    };

    scene.add(sprite);
    damageNumbers.push(dmgNum);
}

/**
 * Update all particles and effects
 */
function updateEffects() {
    // Update hit particles
    for (let i = hitParticles.length - 1; i >= 0; i--) {
        const p = hitParticles[i];

        // Physics
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        p.vy -= 0.15; // Gravity

        // Fade
        p.life -= p.decay;
        p.mesh.material.opacity = p.life;
        p.mesh.scale.setScalar(p.life);

        // Remove if dead
        if (p.life <= 0) {
            scene.remove(p.mesh);
            hitParticles.splice(i, 1);
        }
    }

    // Update damage numbers
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
        const d = damageNumbers[i];

        // Float up
        d.sprite.position.y += d.vy;
        d.vy *= 0.95; // Slow down

        // Fade
        d.life -= d.decay;
        d.sprite.material.opacity = d.life;

        // Remove if dead
        if (d.life <= 0) {
            scene.remove(d.sprite);
            damageNumbers.splice(i, 1);
        }
    }

    // Screen shake decay
    if (screenShake.intensity > 0) {
        screenShake.intensity *= 0.9;
        if (screenShake.intensity < 0.1) {
            screenShake.intensity = 0;
        }
    }
}

/**
 * Apply screen shake
 */
function applyScreenShake(intensity) {
    screenShake.intensity = Math.min(10, screenShake.intensity + intensity);
}

/**
 * Create floating UI (health bar + name) for a fighter
 */
function createFighterUI(index, name) {
    const group = new THREE.Group();

    // Health bar background
    const bgGeo = new THREE.PlaneGeometry(50, 6);
    const bgMat = new THREE.MeshBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
    });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.y = 0;
    group.add(bgMesh);

    // Health bar fill
    const fillGeo = new THREE.PlaneGeometry(48, 4);
    const fillMat = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
    });
    const fillMesh = new THREE.Mesh(fillGeo, fillMat);
    fillMesh.position.y = 0;
    fillMesh.position.z = 0.1;
    group.add(fillMesh);

    // Name label
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(name, 128, 32);
    ctx.fillText(name, 128, 32);

    const nameTexture = new THREE.CanvasTexture(canvas);
    const nameMat = new THREE.SpriteMaterial({
        map: nameTexture,
        transparent: true,
        depthTest: false,
    });
    const nameSprite = new THREE.Sprite(nameMat);
    nameSprite.position.y = 15;
    nameSprite.scale.set(60, 15, 1);
    group.add(nameSprite);

    // Store references for updates
    group.userData.fillMesh = fillMesh;
    group.userData.fillMat = fillMat;
    group.userData.originalWidth = 48;

    return group;
}

/**
 * Update fighter UI position and health
 */
function updateFighterUI(index, fighter, state) {
    if (!fighterUI[index]) {
        const name = state.bugNames ? state.bugNames[index] : `Fighter ${index + 1}`;
        fighterUI[index] = createFighterUI(index, name);
        scene.add(fighterUI[index]);
    }

    const ui = fighterUI[index];
    const pos3d = map2Dto3D(fighter.x, fighter.y, fighter.z || 0);

    // Position above bug
    ui.position.set(pos3d.x, pos3d.y + 40, pos3d.z);

    // Make UI face camera (billboard)
    ui.lookAt(camera.position);

    // Update health bar
    const hpPercent = fighter.hp / fighter.maxHp;
    const fillMesh = ui.userData.fillMesh;
    const fillMat = ui.userData.fillMat;

    // Scale health bar
    fillMesh.scale.x = hpPercent;
    fillMesh.position.x = (1 - hpPercent) * -24; // Keep left-aligned

    // Color based on health
    if (hpPercent > 0.5) {
        fillMat.color.setHex(0x00ff00);
    } else if (hpPercent > 0.25) {
        fillMat.color.setHex(0xffff00);
    } else {
        fillMat.color.setHex(0xff0000);
    }

    // Hide if dead
    ui.visible = fighter.state !== 'death' || fighter.deathAlpha > 0.5;
}

/**
 * Clean up fighter UI for new fight
 */
function clearFighterUI() {
    fighterUI.forEach(ui => {
        if (ui) scene.remove(ui);
    });
    fighterUI = [null, null];
}

/**
 * Process events from game state
 */
function processEvents(events) {
    if (!events || events.length === 0) return;

    events.forEach(event => {
        if (event.type === 'hit') {
            const pos3d = map2Dto3D(event.data.x, event.data.y, 0);

            // Hit particles
            const color = event.data.isPoison ? 0x00ff00 :
                event.data.isCrit ? 0xffff00 : 0xff8800;
            createHitParticles(pos3d.x, pos3d.y, pos3d.z, color, event.data.isCrit ? 15 : 8);

            // Damage number
            createDamageNumber(
                pos3d.x,
                pos3d.y,
                pos3d.z,
                event.data.damage,
                event.data.isCrit,
                event.data.isPoison
            );

            // Screen shake
            if (event.data.isCrit) {
                applyScreenShake(3);
            } else {
                applyScreenShake(1);
            }
        }

        if (event.type === 'wallImpact') {
            const pos3d = map2Dto3D(event.data.x, event.data.y, 0);
            // Wall impact particles
            createHitParticles(pos3d.x, pos3d.y, pos3d.z, 0x888888, 12);
            applyScreenShake(event.data.stunApplied / 5);
        }
    });
}

// ============================================
// RENDER LOOP
// ============================================

function render3D(state) {
    if (!renderer) return;

    // Update controls
    if (controls) {
        controls.update();
    }

    // Update bug positions
    updateBugPositions(state);

    // Update fighter UI (health bars, names)
    if (state.fighters && state.fighters.length >= 2) {
        state.fighters.forEach((fighter, index) => {
            updateFighterUI(index, fighter, state);
        });
    }

    // Process game events (hits, impacts)
    processEvents(state.events);

    // Update effects (particles, damage numbers)
    updateEffects();

    // Apply screen shake to camera
    if (screenShake.intensity > 0) {
        const shakeX = (Math.random() - 0.5) * screenShake.intensity;
        const shakeY = (Math.random() - 0.5) * screenShake.intensity;
        camera.position.x += shakeX;
        camera.position.y += shakeY;
    }

    // Render
    renderer.render(scene, camera);
}

function gameLoop3D() {
    const state = window.BugFightsClient.getState();
    render3D(state);
    requestAnimationFrame(gameLoop3D);
}

// ============================================
// INIT
// ============================================

function initRenderer3D() {
    initThreeJS();

    // Start render loop
    gameLoop3D();

    console.log('3D Renderer initialized');
    console.log('Camera controls: 1=Front, 2=Side, 3=Top, 4=Isometric, R=Reset, Mouse=Orbit');
}

// Export
window.BugFightsRenderer3D = {
    init: initRenderer3D,
    setCameraPreset: setCameraPreset,
};
