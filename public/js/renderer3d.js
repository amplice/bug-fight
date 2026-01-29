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
let walls = { left: null, right: null, front: null, back: null };

// Camera presets
const CAMERA_PRESETS = {
    front: { position: { x: 0, y: 200, z: 800 }, target: { x: 0, y: 150, z: 0 } },
    side: { position: { x: 800, y: 200, z: 0 }, target: { x: 0, y: 150, z: 0 } },
    top: { position: { x: 0, y: 800, z: 100 }, target: { x: 0, y: 0, z: 0 } },
    isometric: { position: { x: 500, y: 400, z: 500 }, target: { x: 0, y: 100, z: 0 } },
};

let currentPreset = 'action';  // Default to action camera

// Action camera state
let actionCamera = {
    enabled: true,
    currentPos: { x: 0, y: 300, z: 600 },
    currentTarget: { x: 0, y: 100, z: 0 },
    smoothing: 0.03,  // Lower = smoother/slower
    minDistance: 250,  // Minimum zoom distance
    maxDistance: 700,  // Maximum zoom distance
    heightOffset: 150,  // Camera height above midpoint
    behindOffset: 400,  // Base distance behind the action
};
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
    setCameraPreset('action');  // Default to action camera

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

    // Walls (transparent, with individual materials for climb highlighting)
    const createWallMat = () => new THREE.MeshBasicMaterial({
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
    if (presetName === 'action') {
        currentPreset = 'action';
        actionCamera.enabled = true;
        return;
    }

    const preset = CAMERA_PRESETS[presetName];
    if (!preset) return;

    currentPreset = presetName;
    actionCamera.enabled = false;
    camera.position.set(preset.position.x, preset.position.y, preset.position.z);
    if (controls) {
        controls.target.set(preset.target.x, preset.target.y, preset.target.z);
        controls.update();
    }
}

function updateActionCamera(state) {
    if (!actionCamera.enabled || !state || !state.fighters || state.fighters.length < 2) {
        return;
    }

    const f1 = state.fighters[0];
    const f2 = state.fighters[1];

    if (!f1 || !f2) return;

    // Get 3D positions
    const pos1 = map2Dto3D(f1.x, f1.y, f1.z || 0);
    const pos2 = map2Dto3D(f2.x, f2.y, f2.z || 0);

    // Calculate midpoint between bugs
    const midX = (pos1.x + pos2.x) / 2;
    const midY = (pos1.y + pos2.y) / 2;
    const midZ = (pos1.z + pos2.z) / 2;

    // Calculate distance between bugs for zoom
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    const bugDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Calculate camera distance based on bug separation
    // Closer bugs = closer camera, further bugs = further camera
    const zoomFactor = Math.max(actionCamera.minDistance,
                                Math.min(actionCamera.maxDistance,
                                         bugDistance * 1.2 + 200));

    // Calculate camera angle - orbit around the action
    // Use midpoint position to determine viewing angle
    const angleFromCenter = Math.atan2(midX, midZ);

    // Position camera to see both bugs well
    // Offset perpendicular to the line between bugs for better view
    const perpAngle = Math.atan2(dx, dz) + Math.PI / 2;

    // Target position - looking at the midpoint, slightly above
    const targetX = midX;
    const targetY = Math.max(80, midY);
    const targetZ = midZ;

    // Camera position - behind and above the action
    // Mix between perpendicular view and front view for dynamic feel
    const cameraAngle = perpAngle * 0.6 + angleFromCenter * 0.4;
    const idealX = midX + Math.sin(cameraAngle) * zoomFactor;
    const idealY = targetY + actionCamera.heightOffset + (bugDistance * 0.15);
    const idealZ = midZ + Math.cos(cameraAngle) * zoomFactor;

    // Smooth interpolation
    const smoothing = actionCamera.smoothing;
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

function onKeyDown(event) {
    switch (event.key) {
        case '1': setCameraPreset('front'); break;
        case '2': setCameraPreset('side'); break;
        case '3': setCameraPreset('top'); break;
        case '4': setCameraPreset('isometric'); break;
        case '5': setCameraPreset('action'); break;
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

    // Reset wall highlighting
    Object.values(walls).forEach(wall => {
        if (wall && wall.material) {
            wall.material.color.setHex(0x333333);
            wall.material.opacity = 0.1;
        }
    });

    // Highlight walls being climbed
    state.fighters.forEach(fighter => {
        if (fighter.onWall && fighter.wallSide && walls[fighter.wallSide]) {
            const wall = walls[fighter.wallSide];
            wall.material.color.setHex(0x44ff88);  // Green tint
            wall.material.opacity = 0.2;
        }
    });

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

        // Position from server
        const pos3d = map2Dto3D(fighter.x, fighter.y, fighter.z || 0);

        // Death/Victory fall handling - bugs fall to ground client-side
        const isDead = fighter.state === 'death';
        const isVictory = fighter.state === 'victory';
        const floorY = 20;  // Floor level in 3D coordinates

        // Initialize death fall tracking
        if (!bug.userData.deathFall) {
            bug.userData.deathFall = {
                active: false,
                startY: 0,
                currentY: 0,
                velocityY: 0,
                landed: false,
                lastAliveY: pos3d.y,  // Track position before death
                lastAliveX: pos3d.x,
                lastAliveZ: pos3d.z
            };
        }

        // Track position while alive (save last known airborne position)
        if (!isDead && !isVictory) {
            bug.userData.deathFall.lastAliveY = pos3d.y;
            bug.userData.deathFall.lastAliveX = pos3d.x;
            bug.userData.deathFall.lastAliveZ = pos3d.z;
            bug.userData.deathFall.active = false;
            bug.userData.deathFall.landed = false;
        }

        // Victory bugs stay where they are (no fall, no teleport)
        if (isVictory && !bug.userData.deathFall.active) {
            bug.userData.deathFall.active = true;
            bug.userData.deathFall.landed = true;  // Don't fall, just stay
            console.log(`Bug ${index} victory - staying at Y=${bug.userData.deathFall.lastAliveY.toFixed(1)}`);
        }

        // Dead bugs fall to ground using LAST ALIVE position (not current server position)
        if (isDead && !bug.userData.deathFall.active) {
            const startY = bug.userData.deathFall.lastAliveY;
            // Only fall if we were above ground
            if (startY > floorY + 5) {
                bug.userData.deathFall.active = true;
                bug.userData.deathFall.startY = startY;
                bug.userData.deathFall.currentY = startY;
                bug.userData.deathFall.velocityY = 0;
                bug.userData.deathFall.landed = false;
                console.log(`Bug ${index} death fall starting from Y=${startY.toFixed(1)}`);
            } else {
                // Already on ground, mark as landed immediately
                bug.userData.deathFall.active = true;
                bug.userData.deathFall.landed = true;
            }
        }

        // Animate the fall (dead bugs only)
        if (isDead && bug.userData.deathFall.active && !bug.userData.deathFall.landed) {
            // Apply gravity
            bug.userData.deathFall.velocityY -= 0.8;  // Gravity (negative because Y+ is up in 3D)
            bug.userData.deathFall.currentY += bug.userData.deathFall.velocityY;

            // Check for floor collision
            if (bug.userData.deathFall.currentY <= floorY) {
                bug.userData.deathFall.currentY = floorY;
                // Small bounce
                if (Math.abs(bug.userData.deathFall.velocityY) > 3) {
                    bug.userData.deathFall.velocityY = -bug.userData.deathFall.velocityY * 0.3;
                } else {
                    bug.userData.deathFall.velocityY = 0;
                    bug.userData.deathFall.landed = true;
                    console.log(`Bug ${index} landed on floor`);
                }
            }

            // Use saved X/Z position (where bug was when it died) and falling Y
            const fallX = bug.userData.deathFall.lastAliveX;
            const fallZ = bug.userData.deathFall.lastAliveZ;
            bug.position.set(fallX, bug.userData.deathFall.currentY, fallZ);
        } else if (bug.userData.deathFall.active && bug.userData.deathFall.landed) {
            // Dead: stay on floor, Victory: stay at last position
            const fallX = bug.userData.deathFall.lastAliveX;
            const fallZ = bug.userData.deathFall.lastAliveZ;
            const stayY = isDead ? floorY : bug.userData.deathFall.lastAliveY;
            bug.position.set(fallX, stayY, fallZ);
        } else {
            // Normal positioning
            bug.position.set(pos3d.x, pos3d.y, pos3d.z);
        }

        // === ROTATION TO FACE OPPONENT ===
        const vx = fighter.vx || 0;
        const vy = fighter.vy || 0;
        const vz = fighter.vz || 0;
        const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

        // Use facingAngle from server (angle toward opponent in XZ plane)
        // Server: atan2(dx, dz) where 0 = +Z direction, PI/2 = +X direction
        // Three.js: rotation.y of 0 = facing +Z (bug's head is at +Z in local space)
        // These match! No adjustment needed.
        let baseRotY = fighter.facingAngle !== undefined
            ? fighter.facingAngle
            : (fighter.facingRight ? Math.PI / 2 : -Math.PI / 2);

        // Banking (roll) based on lateral velocity - lean into turns (reduced)
        const maxBank = Math.PI / 8;  // 22.5 degrees max (was 30)
        const bankAmount = clamp3D(-vz * 0.05, -maxBank, maxBank);

        // Pitch based on vertical velocity - tilt up/down when climbing/diving (reduced)
        const maxPitch = Math.PI / 6;  // 30 degrees max (was 36)
        const pitchAmount = clamp3D(vy * 0.05, -maxPitch, maxPitch);

        // Apply rotations with smoothing (skip if on wall or dead - they have special handling)
        if (!fighter.onWall && !isDead) {
            const smoothFactor = 0.12;
            bug.userData.targetRotX = bug.userData.targetRotX || 0;
            bug.userData.targetRotY = bug.userData.targetRotY || baseRotY;
            bug.userData.targetRotZ = bug.userData.targetRotZ || 0;

            bug.userData.targetRotX = pitchAmount;
            bug.userData.targetRotY = baseRotY;
            bug.userData.targetRotZ = bankAmount;

            bug.rotation.x += (bug.userData.targetRotX - bug.rotation.x) * smoothFactor;
            bug.rotation.y += (bug.userData.targetRotY - bug.rotation.y) * smoothFactor;
            bug.rotation.z += (bug.userData.targetRotZ - bug.rotation.z) * smoothFactor;

            // Additional visual effects for flying bugs (not dead/victory)
            if (fighter.isFlying && !isDead && !isVictory) {
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
            let angle = Math.acos(Math.max(-1, Math.min(1, headProj.dot(targetProj))));

            // Determine sign using cross product
            const cross = new THREE.Vector3().crossVectors(headProj, targetProj);
            if (cross.dot(feetTarget) < 0) angle = -angle;

            // Create rotation around feetTarget axis
            const q2 = new THREE.Quaternion().setFromAxisAngle(feetTarget, angle);

            // Combine: apply q1 first, then q2
            bug.quaternion.copy(q1).premultiply(q2);
        }

        // Animation - pass velocity for speed-based animations
        // Override grounded state for death/victory fall
        const animFighter = { ...fighter };
        if (bug.userData.deathFall.active) {
            animFighter.grounded = bug.userData.deathFall.landed;
            // Override onWall too - dead bugs aren't on walls
            if (isDead || isVictory) {
                animFighter.onWall = false;
            }
        }
        animator.update(deltaTime, fighter.state, animFighter);

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

    // Update action camera before controls
    updateActionCamera(state);

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
    console.log('Camera: 1=Front, 2=Side, 3=Top, 4=Isometric, 5=Action (default), R=Reset, Mouse=Orbit');
}

// Export
window.BugFightsRenderer3D = {
    init: initRenderer3D,
    setCameraPreset: setCameraPreset,
    createBugForRoster: createBug,  // Export for roster viewer
};
