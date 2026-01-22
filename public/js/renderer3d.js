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
function map2Dto3D(x2d, y2d) {
    // 2D x: 50-850 -> 3D x: -450 to 450
    const x3d = (x2d - 450);
    // 2D y: 80 (ceiling) to 550 (floor) -> 3D y: 400 (top) to 0 (floor)
    const y3d = 550 - y2d;
    // Z starts at 0 (center) for now, will be added in Phase 4
    const z3d = 0;
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
// PLACEHOLDER BUG RENDERING
// ============================================

// Temporary: render bugs as colored boxes until Phase 2
function createPlaceholderBug(color) {
    const geometry = new THREE.BoxGeometry(30, 20, 40);
    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.7,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
}

function updateBugPositions(state) {
    if (!state.fighters || state.fighters.length < 2) return;

    state.fighters.forEach((fighter, index) => {
        // Create placeholder if needed
        if (!bugMeshes[index]) {
            const color = index === 0 ? 0xff5555 : 0x5555ff;
            bugMeshes[index] = createPlaceholderBug(color);
            scene.add(bugMeshes[index]);
        }

        // Map 2D position to 3D
        const pos3d = map2Dto3D(fighter.x, fighter.y);
        bugMeshes[index].position.set(pos3d.x, pos3d.y + 15, pos3d.z);

        // Rotation based on facing
        bugMeshes[index].rotation.y = fighter.facingRight ? 0 : Math.PI;

        // Scale based on squash/stretch
        const squash = fighter.squash || 1;
        const stretch = fighter.stretch || 1;
        bugMeshes[index].scale.set(squash, stretch, 1);

        // Flash effect
        if (fighter.flashTimer > 0) {
            bugMeshes[index].material.emissive.setHex(0xffffff);
            bugMeshes[index].material.emissiveIntensity = 0.5;
        } else {
            bugMeshes[index].material.emissive.setHex(0x000000);
            bugMeshes[index].material.emissiveIntensity = 0;
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
