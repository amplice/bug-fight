// Bug Fights - 3D Renderer
// Three.js based shape rendering

// ============================================
// CONSTANTS
// ============================================

const ARENA_3D = {
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

// Map from 2D coordinates to 3D
function map2Dto3D(x2d, y2d, z2d = 0) {
    const x3d = (x2d - 450);
    const y3d = 550 - y2d;
    const z3d = z2d;
    return { x: x3d, y: y3d, z: z3d };
}

// ============================================
// STATE
// ============================================

let scene, camera, renderer, controls;
let arena = {};
let bugMeshes = [null, null];
let bugAnimators = [null, null];
let lastTime = performance.now();

// Camera presets
const CAMERA_PRESETS = {
    front: { position: { x: 0, y: 200, z: 800 }, target: { x: 0, y: 150, z: 0 } },
    side: { position: { x: 800, y: 200, z: 0 }, target: { x: 0, y: 150, z: 0 } },
    top: { position: { x: 0, y: 800, z: 100 }, target: { x: 0, y: 0, z: 0 } },
    isometric: { position: { x: 500, y: 400, z: 500 }, target: { x: 0, y: 100, z: 0 } },
};

let currentPreset = 'front';
let currentFightNumber = 0;

// Effects
let hitParticles = [];
let damageNumbers = [];
let screenShake = { intensity: 0 };

// Motion trails for fast-moving bugs
let motionTrails = [[], []];  // One trail array per bug
const MAX_TRAIL_POINTS = 12;
const TRAIL_SPAWN_SPEED = 5;  // Minimum speed to spawn trail

// Fighter UI
let fighterUI = [null, null];

// ============================================
// INITIALIZATION
// ============================================

function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);

    camera = new THREE.PerspectiveCamera(60, 900 / 600, 1, 5000);
    setCameraPreset('front');

    const canvas = document.getElementById('arena3d');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(900, 600);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    controls = new THREE.OrbitControls(camera, renderer.domElement);
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

function setupLighting() {
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

function buildArena() {
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
    const positions = [];
    const colors = [];
    const substrateColors = [0x4a3a28, 0x5a4a35, 0x3a2a18, 0x6a5a45];

    for (let i = 0; i < 500; i++) {
        positions.push(
            (Math.random() - 0.5) * ARENA_3D.width * 0.95,
            Math.random() * 3,
            (Math.random() - 0.5) * ARENA_3D.depth * 0.95
        );
        const c = new THREE.Color(substrateColors[Math.floor(Math.random() * 4)]);
        colors.push(c.r, c.g, c.b);
    }

    substrateGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    substrateGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const substrateMat = new THREE.PointsMaterial({ size: 5, vertexColors: true, sizeAttenuation: true });
    scene.add(new THREE.Points(substrateGeo, substrateMat));

    // Walls (transparent)
    const wallMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.1, side: THREE.DoubleSide });

    const sideWallGeo = new THREE.PlaneGeometry(ARENA_3D.depth, ARENA_3D.height);
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.position.set(ARENA_3D.minX, ARENA_3D.height / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo.clone(), wallMat);
    rightWall.position.set(ARENA_3D.maxX, ARENA_3D.height / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    scene.add(rightWall);

    const frontWallGeo = new THREE.PlaneGeometry(ARENA_3D.width, ARENA_3D.height);
    const frontWall = new THREE.Mesh(frontWallGeo, wallMat);
    frontWall.position.set(0, ARENA_3D.height / 2, ARENA_3D.maxZ);
    frontWall.rotation.y = Math.PI;
    scene.add(frontWall);

    const backWall = new THREE.Mesh(frontWallGeo.clone(), wallMat);
    backWall.position.set(0, ARENA_3D.height / 2, ARENA_3D.minZ);
    scene.add(backWall);

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

function addRocks() {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9, metalness: 0.1 });
    const numRocks = 3 + Math.floor(Math.random() * 3);

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

function addPlants() {
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2d5a2d });
    const numPlants = 4 + Math.floor(Math.random() * 4);

    for (let i = 0; i < numPlants; i++) {
        const plantGroup = new THREE.Group();
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

        const numStems = 3 + Math.floor(Math.random() * 4);
        for (let j = 0; j < numStems; j++) {
            const height = 30 + Math.random() * 50;
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

function setCameraPreset(presetName) {
    const preset = CAMERA_PRESETS[presetName];
    if (!preset) return;

    currentPreset = presetName;
    camera.position.set(preset.position.x, preset.position.y, preset.position.z);
    if (controls) {
        controls.target.set(preset.target.x, preset.target.y, preset.target.z);
        controls.update();
    }
}

function onKeyDown(event) {
    switch (event.key) {
        case '1': setCameraPreset('front'); break;
        case '2': setCameraPreset('side'); break;
        case '3': setCameraPreset('top'); break;
        case '4': setCameraPreset('isometric'); break;
        case 'r': case 'R': setCameraPreset(currentPreset); break;
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
// BUG RENDERING
// ============================================

function createBug(bugData, index) {
    const genome = new BugGenome(bugData);
    const generator = new BugGenerator3D(genome);
    const bugGroup = generator.generate();

    // Scale down for arena
    bugGroup.scale.setScalar(2.5);

    return bugGroup;
}

function updateBugs(state, deltaTime) {
    if (!state.fighters || state.fighters.length < 2) return;
    if (!state.bugs || state.bugs.length < 2) return;

    // Check for new fight
    if (state.fightNumber !== currentFightNumber) {
        // Clear old bugs
        bugMeshes.forEach(mesh => { if (mesh) scene.remove(mesh); });
        bugMeshes = [null, null];
        bugAnimators = [null, null];

        // Clear UI
        fighterUI.forEach(ui => { if (ui) scene.remove(ui); });
        fighterUI = [null, null];

        // Clear motion trails
        motionTrails.forEach((trail, index) => {
            trail.forEach(t => scene.remove(t.mesh));
            motionTrails[index] = [];
        });

        currentFightNumber = state.fightNumber;
    }

    state.fighters.forEach((fighter, index) => {
        // Create bug if needed
        if (!bugMeshes[index]) {
            bugMeshes[index] = createBug(state.bugs[index], index);
            bugAnimators[index] = new BugAnimator(bugMeshes[index]);
            scene.add(bugMeshes[index]);
        }

        const bug = bugMeshes[index];
        const animator = bugAnimators[index];

        // Position
        const pos3d = map2Dto3D(fighter.x, fighter.y, fighter.z || 0);
        bug.position.set(pos3d.x, pos3d.y, pos3d.z);

        // === VELOCITY-BASED ROTATION ===
        const vx = fighter.vx || 0;
        const vy = fighter.vy || 0;
        const vz = fighter.vz || 0;
        const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

        // Base rotation (facing direction)
        let baseRotY = fighter.facingRight ? 0 : Math.PI;

        // Banking (roll) based on lateral velocity - lean into turns
        const maxBank = Math.PI / 6;  // 30 degrees max
        const bankAmount = clamp3D(-vz * 0.1, -maxBank, maxBank);

        // Pitch based on vertical velocity - tilt up/down when climbing/diving
        const maxPitch = Math.PI / 5;  // 36 degrees max
        const pitchAmount = clamp3D(vy * 0.08, -maxPitch, maxPitch);

        // Yaw adjustment when strafing
        const strafeYaw = clamp3D(vz * 0.05, -Math.PI / 8, Math.PI / 8);

        // Apply rotations with smoothing
        const smoothFactor = 0.15;
        bug.userData.targetRotX = bug.userData.targetRotX || 0;
        bug.userData.targetRotY = bug.userData.targetRotY || baseRotY;
        bug.userData.targetRotZ = bug.userData.targetRotZ || 0;

        bug.userData.targetRotX = pitchAmount;
        bug.userData.targetRotY = baseRotY + strafeYaw;
        bug.userData.targetRotZ = bankAmount;

        bug.rotation.x += (bug.userData.targetRotX - bug.rotation.x) * smoothFactor;
        bug.rotation.y += (bug.userData.targetRotY - bug.rotation.y) * smoothFactor;
        bug.rotation.z += (bug.userData.targetRotZ - bug.rotation.z) * smoothFactor;

        // Additional visual effects for flying bugs
        if (fighter.isFlying) {
            // Hovering bob when slow
            if (speed < 3) {
                const bob = Math.sin(performance.now() / 200) * 3;
                bug.position.y += bob;
            }

            // Diving visual - stronger pitch
            if (fighter.isDiving) {
                bug.rotation.x = Math.max(bug.rotation.x, Math.PI / 4);  // Force nose-down
            }
        }

        // Wall climbing visual
        if (fighter.onWall) {
            if (fighter.wallSide === 'left') {
                bug.rotation.z = -Math.PI / 2;
            } else if (fighter.wallSide === 'right') {
                bug.rotation.z = Math.PI / 2;
            }
        }

        // Animation - pass velocity for speed-based animations
        animator.update(deltaTime, fighter.state, fighter);

        // Flash effect (hit feedback)
        if (fighter.flashTimer > 0 && fighter.flashTimer % 2 === 0) {
            bug.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material.emissive = new THREE.Color(0xffffff);
                    child.material.emissiveIntensity = 0.8;
                }
            });
        } else {
            bug.traverse(child => {
                if (child.isMesh && child.material && child.material.emissive) {
                    child.material.emissive = new THREE.Color(0x000000);
                    child.material.emissiveIntensity = 0;
                }
            });
        }

        // Aggression color tint
        if (fighter.drives) {
            const aggression = fighter.drives.aggression || 0.5;
            const caution = fighter.drives.caution || 0.5;
            bug.traverse(child => {
                if (child.isMesh && child.material && !child.userData.isEye) {
                    // Subtle color shift based on drives
                    const r = 0.1 * (aggression - 0.5);
                    const b = 0.1 * (caution - 0.5);
                    if (child.material.emissive) {
                        child.material.emissive.setRGB(Math.max(0, r), 0, Math.max(0, b));
                        child.material.emissiveIntensity = 0.2;
                    }
                }
            });
        }

        // Update UI
        updateFighterUI(index, fighter, state);
    });
}

// Helper for clamping
function clamp3D(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// ============================================
// EFFECTS
// ============================================

function createHitParticles(x, y, z, color = 0xffff00, count = 8) {
    const particleGeo = new THREE.SphereGeometry(2, 4, 4);
    const particleMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 });

    for (let i = 0; i < count; i++) {
        if (hitParticles.length >= 100) {
            const old = hitParticles.shift();
            scene.remove(old.mesh);
        }

        const mesh = new THREE.Mesh(particleGeo.clone(), particleMat.clone());
        mesh.position.set(x, y, z);

        const speed = 3 + Math.random() * 5;
        const angleXZ = Math.random() * Math.PI * 2;
        const angleY = (Math.random() - 0.3) * Math.PI;

        hitParticles.push({
            mesh: mesh,
            vx: Math.cos(angleXZ) * Math.cos(angleY) * speed,
            vy: Math.sin(angleY) * speed + 2,
            vz: Math.sin(angleXZ) * Math.cos(angleY) * speed,
            life: 1.0,
            decay: 0.03 + Math.random() * 0.02,
        });

        scene.add(mesh);
    }
}

function createDamageNumber(x, y, z, damage, isCrit = false, isPoison = false) {
    if (damageNumbers.length >= 20) {
        const old = damageNumbers.shift();
        scene.remove(old.sprite);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    let color = '#fff';
    let fontSize = 32;
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

function createMotionTrail(x, y, z, color, index) {
    // Create a small sphere for the trail point
    const trailGeo = new THREE.SphereGeometry(3, 4, 4);
    const trailMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.6,
    });
    const trailMesh = new THREE.Mesh(trailGeo, trailMat);
    trailMesh.position.set(x, y, z);

    motionTrails[index].push({
        mesh: trailMesh,
        life: 1.0,
        decay: 0.08,
    });

    scene.add(trailMesh);

    // Remove oldest if too many
    if (motionTrails[index].length > MAX_TRAIL_POINTS) {
        const old = motionTrails[index].shift();
        scene.remove(old.mesh);
    }
}

function updateMotionTrails(state) {
    if (!state.fighters) return;

    state.fighters.forEach((fighter, index) => {
        const vx = fighter.vx || 0;
        const vy = fighter.vy || 0;
        const vz = fighter.vz || 0;
        const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

        // Spawn trail point if moving fast enough
        if (speed > TRAIL_SPAWN_SPEED && fighter.state !== 'death') {
            const pos3d = map2Dto3D(fighter.x, fighter.y, fighter.z || 0);

            // Color based on state
            let trailColor = 0x888888;  // Default gray
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
        for (let i = motionTrails[index].length - 1; i >= 0; i--) {
            const trail = motionTrails[index][i];
            trail.life -= trail.decay;
            trail.mesh.material.opacity = trail.life * 0.6;
            trail.mesh.scale.setScalar(trail.life);

            if (trail.life <= 0) {
                scene.remove(trail.mesh);
                motionTrails[index].splice(i, 1);
            }
        }
    });
}

function updateEffects() {
    // Update particles
    for (let i = hitParticles.length - 1; i >= 0; i--) {
        const p = hitParticles[i];
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        p.vy -= 0.15;
        p.life -= p.decay;
        p.mesh.material.opacity = p.life;
        p.mesh.scale.setScalar(p.life);

        if (p.life <= 0) {
            scene.remove(p.mesh);
            hitParticles.splice(i, 1);
        }
    }

    // Update damage numbers
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
        const d = damageNumbers[i];
        d.sprite.position.y += d.vy;
        d.vy *= 0.95;
        d.life -= d.decay;
        d.sprite.material.opacity = d.life;

        if (d.life <= 0) {
            scene.remove(d.sprite);
            damageNumbers.splice(i, 1);
        }
    }

    // Screen shake decay
    if (screenShake.intensity > 0) {
        screenShake.intensity *= 0.9;
        if (screenShake.intensity < 0.1) screenShake.intensity = 0;
    }
}

function processEvents(events) {
    if (!events || events.length === 0) return;

    events.forEach(event => {
        if (event.type === 'hit') {
            const pos3d = map2Dto3D(event.data.x, event.data.y, 0);
            const color = event.data.isPoison ? 0x00ff00 : event.data.isCrit ? 0xffff00 : 0xff8800;
            createHitParticles(pos3d.x, pos3d.y, pos3d.z, color, event.data.isCrit ? 15 : 8);
            createDamageNumber(pos3d.x, pos3d.y, pos3d.z, event.data.damage, event.data.isCrit, event.data.isPoison);
            screenShake.intensity = Math.min(10, screenShake.intensity + (event.data.isCrit ? 3 : 1));
        }

        if (event.type === 'wallImpact') {
            const pos3d = map2Dto3D(event.data.x, event.data.y, 0);
            createHitParticles(pos3d.x, pos3d.y, pos3d.z, 0x888888, 12);
            screenShake.intensity = Math.min(10, screenShake.intensity + event.data.stunApplied / 5);
        }
    });
}

// ============================================
// FIGHTER UI
// ============================================

function createFighterUI(index, name) {
    const group = new THREE.Group();

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
    const nameMat = new THREE.SpriteMaterial({ map: nameTexture, transparent: true, depthTest: false });
    const nameSprite = new THREE.Sprite(nameMat);
    nameSprite.position.y = 15;
    nameSprite.scale.set(60, 15, 1);
    group.add(nameSprite);

    group.userData.fillMesh = fillMesh;
    group.userData.fillMat = fillMat;

    return group;
}

function updateFighterUI(index, fighter, state) {
    if (!fighterUI[index]) {
        const name = state.bugNames ? state.bugNames[index] : `Fighter ${index + 1}`;
        fighterUI[index] = createFighterUI(index, name);
        scene.add(fighterUI[index]);
    }

    const ui = fighterUI[index];
    const pos3d = map2Dto3D(fighter.x, fighter.y, fighter.z || 0);
    ui.position.set(pos3d.x, pos3d.y + 50, pos3d.z);
    ui.lookAt(camera.position);

    const hpPercent = fighter.hp / fighter.maxHp;
    const fillMesh = ui.userData.fillMesh;
    const fillMat = ui.userData.fillMat;

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

function render3D(state) {
    if (!renderer) return;

    const now = performance.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    if (controls) controls.update();

    updateBugs(state, deltaTime);
    updateMotionTrails(state);
    processEvents(state.events);
    updateEffects();

    // Screen shake
    if (screenShake.intensity > 0) {
        camera.position.x += (Math.random() - 0.5) * screenShake.intensity;
        camera.position.y += (Math.random() - 0.5) * screenShake.intensity;
    }

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
    gameLoop3D();
    console.log('3D Renderer initialized');
    console.log('Camera: 1=Front, 2=Side, 3=Top, 4=Isometric, R=Reset, Mouse=Orbit');
}

// Export
window.BugFightsRenderer3D = {
    init: initRenderer3D,
    setCameraPreset: setCameraPreset,
    createBugForRoster: createBug,  // Export for roster viewer
};
