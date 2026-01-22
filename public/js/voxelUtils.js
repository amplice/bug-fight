// Bug Fights - Voxel Utilities
// Helper functions for generating 3D voxel shapes

// ============================================
// VOXEL PRIMITIVES
// ============================================

/**
 * Create a filled sphere of voxels
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} cz - Center Z
 * @param {number} radius - Radius
 * @returns {Array} Array of {x, y, z} positions
 */
function createVoxelSphere(cx, cy, cz, radius) {
    const voxels = [];
    const r = Math.ceil(radius);

    for (let x = -r; x <= r; x++) {
        for (let y = -r; y <= r; y++) {
            for (let z = -r; z <= r; z++) {
                const dist = Math.sqrt(x * x + y * y + z * z);
                if (dist <= radius) {
                    voxels.push({
                        x: cx + x,
                        y: cy + y,
                        z: cz + z
                    });
                }
            }
        }
    }

    return voxels;
}

/**
 * Create a filled ellipsoid of voxels
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} cz - Center Z
 * @param {number} rx - Radius X
 * @param {number} ry - Radius Y
 * @param {number} rz - Radius Z
 * @returns {Array} Array of {x, y, z} positions
 */
function createVoxelEllipsoid(cx, cy, cz, rx, ry, rz) {
    const voxels = [];
    const maxR = Math.ceil(Math.max(rx, ry, rz));

    for (let x = -maxR; x <= maxR; x++) {
        for (let y = -maxR; y <= maxR; y++) {
            for (let z = -maxR; z <= maxR; z++) {
                // Check if point is inside ellipsoid
                const nx = x / rx;
                const ny = y / ry;
                const nz = z / rz;
                if (nx * nx + ny * ny + nz * nz <= 1) {
                    voxels.push({
                        x: cx + x,
                        y: cy + y,
                        z: cz + z
                    });
                }
            }
        }
    }

    return voxels;
}

/**
 * Create a line of voxels between two points
 * @param {Object} start - {x, y, z}
 * @param {Object} end - {x, y, z}
 * @param {number} thickness - Line thickness (default 1)
 * @returns {Array} Array of {x, y, z} positions
 */
function createVoxelLine(start, end, thickness = 1) {
    const voxels = [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const steps = Math.ceil(length);

    for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const x = Math.round(start.x + dx * t);
        const y = Math.round(start.y + dy * t);
        const z = Math.round(start.z + dz * t);

        if (thickness <= 1) {
            voxels.push({ x, y, z });
        } else {
            // Add thickness
            const r = Math.floor(thickness / 2);
            for (let tx = -r; tx <= r; tx++) {
                for (let ty = -r; ty <= r; ty++) {
                    for (let tz = -r; tz <= r; tz++) {
                        if (tx * tx + ty * ty + tz * tz <= r * r) {
                            voxels.push({ x: x + tx, y: y + ty, z: z + tz });
                        }
                    }
                }
            }
        }
    }

    return voxels;
}

/**
 * Create a box of voxels
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} cz - Center Z
 * @param {number} width - Width (X)
 * @param {number} height - Height (Y)
 * @param {number} depth - Depth (Z)
 * @param {boolean} hollow - If true, only create surface voxels
 * @returns {Array} Array of {x, y, z} positions
 */
function createVoxelBox(cx, cy, cz, width, height, depth, hollow = false) {
    const voxels = [];
    const hw = Math.floor(width / 2);
    const hh = Math.floor(height / 2);
    const hd = Math.floor(depth / 2);

    for (let x = -hw; x <= hw; x++) {
        for (let y = -hh; y <= hh; y++) {
            for (let z = -hd; z <= hd; z++) {
                if (hollow) {
                    // Only add surface voxels
                    if (Math.abs(x) === hw || Math.abs(y) === hh || Math.abs(z) === hd) {
                        voxels.push({ x: cx + x, y: cy + y, z: cz + z });
                    }
                } else {
                    voxels.push({ x: cx + x, y: cy + y, z: cz + z });
                }
            }
        }
    }

    return voxels;
}

/**
 * Create a tapered cylinder (cone if endRadius = 0)
 * @param {Object} start - {x, y, z} base center
 * @param {Object} end - {x, y, z} top center
 * @param {number} startRadius - Radius at start
 * @param {number} endRadius - Radius at end
 * @returns {Array} Array of {x, y, z} positions
 */
function createVoxelCylinder(start, end, startRadius, endRadius) {
    const voxels = [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const steps = Math.ceil(length);

    for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const cx = start.x + dx * t;
        const cy = start.y + dy * t;
        const cz = start.z + dz * t;
        const radius = startRadius + (endRadius - startRadius) * t;

        // Create disc at this point
        const r = Math.ceil(radius);
        for (let x = -r; x <= r; x++) {
            for (let z = -r; z <= r; z++) {
                if (x * x + z * z <= radius * radius) {
                    voxels.push({
                        x: Math.round(cx + x),
                        y: Math.round(cy),
                        z: Math.round(cz + z)
                    });
                }
            }
        }
    }

    return voxels;
}

/**
 * Create a wing shape (thin curved plane)
 * @param {Object} base - {x, y, z} attachment point
 * @param {number} length - Wing length
 * @param {number} width - Wing width
 * @param {number} side - 1 for right, -1 for left
 * @param {number} angle - Wing angle (0 = horizontal)
 * @returns {Array} Array of {x, y, z} positions
 */
function createVoxelWing(base, length, width, side, angle = 0) {
    const voxels = [];

    for (let i = 0; i < length; i++) {
        const t = i / length;
        const wingWidth = width * (1 - t * 0.5); // Taper toward tip

        for (let w = 0; w < wingWidth; w++) {
            // Wing extends outward (X) and slightly back (Z)
            const x = base.x + side * (i + 1);
            const y = base.y + Math.sin(angle) * i * 0.5;
            const z = base.z - w + wingWidth / 2;

            voxels.push({ x: Math.round(x), y: Math.round(y), z: Math.round(z) });
        }
    }

    return voxels;
}

/**
 * Rotate voxels around Y axis
 * @param {Array} voxels - Array of {x, y, z}
 * @param {number} angle - Rotation angle in radians
 * @param {Object} pivot - Pivot point {x, y, z}
 * @returns {Array} Rotated voxels
 */
function rotateVoxelsY(voxels, angle, pivot = { x: 0, y: 0, z: 0 }) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return voxels.map(v => {
        const dx = v.x - pivot.x;
        const dz = v.z - pivot.z;
        return {
            x: Math.round(pivot.x + dx * cos - dz * sin),
            y: v.y,
            z: Math.round(pivot.z + dx * sin + dz * cos)
        };
    });
}

/**
 * Rotate voxels around X axis
 * @param {Array} voxels - Array of {x, y, z}
 * @param {number} angle - Rotation angle in radians
 * @param {Object} pivot - Pivot point {x, y, z}
 * @returns {Array} Rotated voxels
 */
function rotateVoxelsX(voxels, angle, pivot = { x: 0, y: 0, z: 0 }) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return voxels.map(v => {
        const dy = v.y - pivot.y;
        const dz = v.z - pivot.z;
        return {
            x: v.x,
            y: Math.round(pivot.y + dy * cos - dz * sin),
            z: Math.round(pivot.z + dy * sin + dz * cos)
        };
    });
}

/**
 * Translate voxels by offset
 * @param {Array} voxels - Array of {x, y, z}
 * @param {number} dx - X offset
 * @param {number} dy - Y offset
 * @param {number} dz - Z offset
 * @returns {Array} Translated voxels
 */
function translateVoxels(voxels, dx, dy, dz) {
    return voxels.map(v => ({
        x: v.x + dx,
        y: v.y + dy,
        z: v.z + dz
    }));
}

/**
 * Scale voxels from origin
 * @param {Array} voxels - Array of {x, y, z}
 * @param {number} scale - Scale factor
 * @returns {Array} Scaled voxels
 */
function scaleVoxels(voxels, scale) {
    return voxels.map(v => ({
        x: Math.round(v.x * scale),
        y: Math.round(v.y * scale),
        z: Math.round(v.z * scale)
    }));
}

/**
 * Remove duplicate voxels
 * @param {Array} voxels - Array of {x, y, z}
 * @returns {Array} Deduplicated voxels
 */
function dedupeVoxels(voxels) {
    const seen = new Set();
    return voxels.filter(v => {
        const key = `${v.x},${v.y},${v.z}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Mirror voxels across X axis (for symmetry)
 * @param {Array} voxels - Array of {x, y, z}
 * @returns {Array} Original + mirrored voxels
 */
function mirrorVoxelsX(voxels) {
    const mirrored = voxels.map(v => ({ x: -v.x, y: v.y, z: v.z }));
    return dedupeVoxels([...voxels, ...mirrored]);
}

// Export
window.VoxelUtils = {
    createVoxelSphere,
    createVoxelEllipsoid,
    createVoxelLine,
    createVoxelBox,
    createVoxelCylinder,
    createVoxelWing,
    rotateVoxelsY,
    rotateVoxelsX,
    translateVoxels,
    scaleVoxels,
    dedupeVoxels,
    mirrorVoxelsX,
};
