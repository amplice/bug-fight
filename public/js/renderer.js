// Bug Fights - Client Renderer
// Draws the arena, fighters, effects based on server state

// ============================================
// CONSTANTS
// ============================================

const ARENA = {
    width: 900,
    height: 600,
    floorY: 550,
    ceilingY: 80,
    leftWall: 50,
    rightWall: 850,
};

// ============================================
// STATE
// ============================================

let canvas, ctx;
let sprites = {}; // Generated sprites keyed by fight number + side
let particles = [];
let bloodStains = [];
let floatingNumbers = [];
let screenShake = { x: 0, y: 0, intensity: 0 };

// Terrarium decorations
let terrarium = {
    plants: [],
    rocks: [],
    substrate: [],
    initialized: false,
    forFight: 0,
};

// ============================================
// SPRITE GENERATION
// ============================================

function generateSprites(bugs, fightNumber) {
    bugs.forEach((bugData, index) => {
        const key = `${fightNumber}-${index}`;
        if (!sprites[key]) {
            // Create genome from data
            const genome = new BugGenome(bugData);
            const generator = new BugSpriteGenerator(genome);
            sprites[key] = {
                frames: generator.generateAllFrames(),
                size: generator.size,
            };
        }
    });

    // Clean up old sprites (keep last 3 fights)
    const keysToDelete = Object.keys(sprites).filter(key => {
        const fightNum = parseInt(key.split('-')[0]);
        return fightNum < fightNumber - 2;
    });
    keysToDelete.forEach(key => delete sprites[key]);
}

// ============================================
// PARTICLES
// ============================================

function spawnParticles(x, y, type, count = 5) {
    for (let i = 0; i < count; i++) {
        const particle = {
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 2,
            life: 30 + Math.random() * 30,
            maxLife: 60,
            type,
        };

        if (type === 'blood') {
            particle.color = ['#f00', '#c00', '#800'][Math.floor(Math.random() * 3)];
            particle.size = 2 + Math.random() * 3;
            particle.vy -= 3;
        } else if (type === 'dust') {
            particle.color = ['#a98', '#987', '#876'][Math.floor(Math.random() * 3)];
            particle.size = 2 + Math.random() * 2;
            particle.vy = -1 - Math.random() * 2;
        } else if (type === 'spark') {
            particle.color = ['#ff0', '#fa0', '#f80'][Math.floor(Math.random() * 3)];
            particle.size = 1 + Math.random() * 2;
            particle.vx *= 2;
            particle.vy *= 2;
        } else if (type === 'poison') {
            particle.color = ['#0f0', '#0a0', '#080'][Math.floor(Math.random() * 3)];
            particle.size = 2 + Math.random() * 2;
            particle.vy = -2 - Math.random() * 2;
        } else if (type === 'landing') {
            particle.color = '#654';
            particle.size = 2;
            particle.vy = -1;
            particle.vx = (Math.random() - 0.5) * 4;
        }

        particles.push(particle);
    }
}

function spawnFloatingNumber(x, y, value, color, isCrit) {
    floatingNumbers.push({
        x, y,
        value: String(value),
        color,
        life: 60,
        isCrit,
        vy: -2,
    });
}

function addBloodStain(x, y) {
    bloodStains.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y,
        radius: 3 + Math.random() * 4,
        alpha: 0.4 + Math.random() * 0.3,
    });
    if (bloodStains.length > 30) bloodStains.shift();
}

function updateParticles() {
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life--;
        return p.life > 0;
    });

    floatingNumbers = floatingNumbers.filter(n => {
        n.y += n.vy;
        n.vy *= 0.95;
        n.life--;
        return n.life > 0;
    });
}

// ============================================
// TERRARIUM
// ============================================

function generateTerrariumDecorations(fightNumber) {
    if (terrarium.initialized && terrarium.forFight === fightNumber) return;

    terrarium.plants = [];
    terrarium.rocks = [];
    terrarium.substrate = [];
    terrarium.forFight = fightNumber;
    terrarium.initialized = true;

    // Substrate particles
    for (let i = 0; i < 150; i++) {
        terrarium.substrate.push({
            x: ARENA.leftWall + Math.random() * (ARENA.rightWall - ARENA.leftWall),
            y: ARENA.floorY + Math.random() * 18,
            size: 1 + Math.random() * 3,
            color: ['#4a3a28', '#5a4a35', '#3a2a18', '#6a5a45'][Math.floor(Math.random() * 4)]
        });
    }

    // Rocks
    const numRocks = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numRocks; i++) {
        const baseX = ARENA.leftWall + 80 + Math.random() * (ARENA.rightWall - ARENA.leftWall - 160);
        const rockWidth = 20 + Math.random() * 40;
        const rockHeight = 15 + Math.random() * 25;
        terrarium.rocks.push({
            x: baseX,
            y: ARENA.floorY - rockHeight * 0.7,
            width: rockWidth,
            height: rockHeight,
            color: ['#4a4a4a', '#5a5a5a', '#3a3a3a', '#606060'][Math.floor(Math.random() * 4)],
            highlight: ['#6a6a6a', '#7a7a7a', '#5a5a5a'][Math.floor(Math.random() * 3)]
        });
    }

    // Plants
    const numPlants = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numPlants; i++) {
        const side = Math.random() < 0.5 ? 'left' : 'right';
        const baseX = side === 'left'
            ? ARENA.leftWall + 10 + Math.random() * 80
            : ARENA.rightWall - 90 + Math.random() * 80;

        terrarium.plants.push({
            x: baseX,
            y: ARENA.floorY,
            height: 30 + Math.random() * 50,
            color: ['#2d5a2d', '#3d6a3d', '#4d7a4d'][Math.floor(Math.random() * 3)],
        });
    }
}

function renderTerrarium(ctx) {
    // Substrate
    terrarium.substrate.forEach(s => {
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x, s.y, s.size, s.size);
    });

    // Rocks
    terrarium.rocks.forEach(rock => {
        ctx.fillStyle = rock.color;
        ctx.beginPath();
        ctx.ellipse(rock.x, rock.y + rock.height / 2, rock.width / 2, rock.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rock.highlight;
        ctx.beginPath();
        ctx.ellipse(rock.x - rock.width * 0.1, rock.y + rock.height * 0.3, rock.width * 0.3, rock.height * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    // Plants
    terrarium.plants.forEach(plant => {
        ctx.strokeStyle = plant.color;
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(plant.x + (i - 2) * 3, plant.y);
            ctx.quadraticCurveTo(
                plant.x + (i - 2) * 8,
                plant.y - plant.height * 0.6,
                plant.x + (i - 2) * 5,
                plant.y - plant.height
            );
            ctx.stroke();
        }
    });
}

// ============================================
// FIGHTER RENDERING
// ============================================

function renderFighter(ctx, fighterState, spriteData, side) {
    const { frames, size } = spriteData;
    const spriteState = (fighterState.state === 'windup' || fighterState.state === 'victory') ? 'idle' : fighterState.state;
    const frameSet = frames[spriteState] || frames.idle;
    const frame = frameSet[Math.min(fighterState.animFrame || 0, frameSet.length - 1)];
    const colors = frames.colors;

    // Size scaling - divide by constant 24 for larger bugs (matches original)
    // spriteSize ranges from 20-48, so scale ranges from ~0.83 to 2.0
    const sizeRatio = (fighterState.spriteSize || 32) / 24;
    const scaleX = sizeRatio * (fighterState.squash || 1);
    const scaleY = sizeRatio * (fighterState.stretch || 1);

    const renderX = fighterState.x + (fighterState.lungeX || 0);
    // Victory bounce offsets Y position
    const renderY = fighterState.y + (fighterState.lungeY || 0) - (fighterState.victoryBounce || 0);

    const sizeX = size * scaleX;
    const sizeY = size * scaleY;
    const startX = renderX - sizeX / 2;
    const startY = renderY - sizeY / 2;

    ctx.save();

    // Flash effect
    if (fighterState.flashTimer > 0) {
        ctx.globalAlpha = 0.5 + (fighterState.flashTimer / 16);
    }

    // Death animation - use rotation and alpha from server
    let rotation = 0;
    if (fighterState.state === 'death') {
        rotation = fighterState.deathRotation || 0;
        ctx.globalAlpha = fighterState.deathAlpha || 0.5;
    } else if (fighterState.onWall) {
        rotation = fighterState.wallSide === 'left' ? Math.PI / 2 : -Math.PI / 2;
    } else if (fighterState.drives) {
        const driveBalance = fighterState.drives.aggression - fighterState.drives.caution;
        const leanDir = fighterState.facingRight ? 1 : -1;
        rotation = driveBalance * 0.15 * leanDir;
    }

    if (rotation !== 0) {
        ctx.translate(renderX, renderY);
        ctx.rotate(rotation);
        ctx.translate(-renderX, -renderY);
    }

    // Drive tint
    let driveTint = null;
    if (fighterState.drives && fighterState.state !== 'death') {
        if (fighterState.drives.aggression > 0.7) {
            const intensity = (fighterState.drives.aggression - 0.7) / 0.3;
            driveTint = { r: Math.floor(60 * intensity), g: 0, b: 0 };
        } else if (fighterState.drives.caution > 0.7) {
            const intensity = (fighterState.drives.caution - 0.7) / 0.3;
            driveTint = { r: 0, g: 0, b: Math.floor(60 * intensity) };
        }
    }

    // Draw pixels
    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            const colorIdx = parseInt(frame[py][fighterState.facingRight ? px : size - 1 - px]);
            if (colorIdx === 0) continue;

            let pixelColor = colors[colorIdx];

            if (fighterState.flashTimer > 0 && fighterState.flashTimer % 2 === 0) {
                pixelColor = '#fff';
            } else if (driveTint) {
                const hex = pixelColor.replace('#', '');
                let r = parseInt(hex.substr(0, 2), 16) || 0;
                let g = parseInt(hex.substr(2, 2), 16) || 0;
                let b = parseInt(hex.substr(4, 2), 16) || 0;
                r = Math.min(255, r + driveTint.r);
                g = Math.min(255, g + driveTint.g);
                b = Math.min(255, b + driveTint.b);
                pixelColor = `rgb(${r},${g},${b})`;
            }

            ctx.fillStyle = pixelColor;
            ctx.fillRect(
                startX + px * scaleX,
                startY + py * scaleY,
                scaleX + 0.5,
                scaleY + 0.5
            );
        }
    }

    ctx.restore();

    // Health bar
    const barWidth = 50;
    const barHeight = 6;
    const barX = fighterState.x - barWidth / 2;
    const barY = renderY - sizeY / 2 - 15;

    ctx.fillStyle = '#000';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const hpPercent = Math.max(0, fighterState.hp / fighterState.maxHp);
    ctx.fillStyle = hpPercent > 0.5 ? '#0f0' : hpPercent > 0.25 ? '#ff0' : '#f00';
    ctx.fillRect(barX + 1, barY + 1, (barWidth - 2) * hpPercent, barHeight - 2);

    // Stamina bar
    const staminaY = barY + barHeight + 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(barX - 1, staminaY - 1, barWidth + 2, 4);
    const staminaPercent = fighterState.stamina / fighterState.maxStamina;
    ctx.fillStyle = staminaPercent > 0.3 ? '#ff0' : '#f80';
    ctx.fillRect(barX, staminaY, barWidth * staminaPercent, 2);

    // Poison indicator
    if (fighterState.poisoned > 0) {
        ctx.fillStyle = '#0f0';
        ctx.fillRect(barX + barWidth + 4, barY, 4, barHeight);
    }

    // AI state indicator
    if (fighterState.aiState && fighterState.state !== 'death') {
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        let stateText = '';
        let stateColor = '#888';
        switch (fighterState.aiState) {
            case 'aggressive': stateText = '→'; stateColor = '#f66'; break;
            case 'circling': stateText = '◯'; stateColor = '#ff0'; break;
            case 'retreating': stateText = '←'; stateColor = '#6af'; break;
            case 'stunned': stateText = '✕'; stateColor = '#f00'; break;
        }
        ctx.fillStyle = stateColor;
        ctx.fillText(stateText, fighterState.x, staminaY + 10);
    }
}

// ============================================
// PRE-FIGHT STATS SCREEN
// ============================================

function renderPentagonChart(ctx, centerX, centerY, radius, stats, color, fillColor) {
    // Stats: [bulk, speed, fury, instinct] normalized to 0-1
    const labels = ['BLK', 'SPD', 'FRY', 'INS'];
    const numStats = 4;
    const angleStep = (Math.PI * 2) / numStats;
    const startAngle = -Math.PI / 2; // Start from top

    // Draw background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Draw concentric shapes (at 25%, 50%, 75%, 100%)
    for (let level = 0.25; level <= 1; level += 0.25) {
        ctx.beginPath();
        for (let i = 0; i <= numStats; i++) {
            const angle = startAngle + i * angleStep;
            const x = centerX + Math.cos(angle) * radius * level;
            const y = centerY + Math.sin(angle) * radius * level;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
    }

    // Draw axis lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    for (let i = 0; i < numStats; i++) {
        const angle = startAngle + i * angleStep;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
        ctx.stroke();
    }

    // Draw stat shape
    ctx.beginPath();
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    for (let i = 0; i <= numStats; i++) {
        const statIndex = i % numStats;
        const angle = startAngle + i * angleStep;
        const value = stats[statIndex];
        const x = centerX + Math.cos(angle) * radius * value;
        const y = centerY + Math.sin(angle) * radius * value;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw stat points
    ctx.fillStyle = color;
    for (let i = 0; i < numStats; i++) {
        const angle = startAngle + i * angleStep;
        const value = stats[i];
        const x = centerX + Math.cos(angle) * radius * value;
        const y = centerY + Math.sin(angle) * radius * value;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw labels
    ctx.font = 'bold 9px "Press Start 2P", monospace';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < numStats; i++) {
        const angle = startAngle + i * angleStep;
        const labelRadius = radius + 18;
        const x = centerX + Math.cos(angle) * labelRadius;
        const y = centerY + Math.sin(angle) * labelRadius;
        ctx.fillText(labels[i], x, y);
    }
}

function renderBugPreview(ctx, x, y, bugData, fightNumber, index, maxSize) {
    const key = `${fightNumber}-${index}`;
    if (!sprites[key]) return;

    const { frames, size } = sprites[key];
    const frame = frames.idle[0];
    const colors = frames.colors;

    // Calculate scale to fit in maxSize while maintaining aspect ratio
    const sizeRatio = (bugData.spriteSize || 32) / 24;
    const scale = Math.min(maxSize / (size * sizeRatio), 2.5);
    const finalScale = sizeRatio * scale;

    const renderSize = size * finalScale;
    const startX = x - renderSize / 2;
    const startY = y - renderSize / 2;

    // Draw pixels
    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            const colorIdx = parseInt(frame[py][px]);
            if (colorIdx === 0) continue;

            ctx.fillStyle = colors[colorIdx];
            ctx.fillRect(
                startX + px * finalScale,
                startY + py * finalScale,
                finalScale + 0.5,
                finalScale + 0.5
            );
        }
    }
}

function renderPreFightStats(ctx, state) {
    const bugs = state.bugs;
    const names = state.bugNames;
    const odds = state.odds;
    const records = state.bugRecords || [{wins: 0, losses: 0}, {wins: 0, losses: 0}];

    if (!bugs || bugs.length < 2) return;

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px "Press Start 2P", monospace';
    ctx.fillStyle = '#ff0';
    ctx.shadowColor = '#f80';
    ctx.shadowBlur = 20;
    ctx.fillText('NEXT FIGHT', canvas.width / 2, 35);
    ctx.shadowBlur = 0;

    // Fight number
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#888';
    ctx.fillText(`FIGHT #${state.fightNumber}`, canvas.width / 2, 55);

    // Countdown - centered between the two panels
    ctx.font = 'bold 36px "Press Start 2P", monospace';
    ctx.fillStyle = state.countdown <= 3 ? '#f00' : '#fff';
    ctx.shadowColor = state.countdown <= 3 ? '#f00' : '#08f';
    ctx.shadowBlur = 15;
    ctx.fillText(state.countdown, canvas.width / 2, 300);
    ctx.shadowBlur = 0;

    // VS
    ctx.font = 'bold 24px "Press Start 2P", monospace';
    ctx.fillStyle = '#f00';
    ctx.shadowColor = '#f00';
    ctx.shadowBlur = 10;
    ctx.fillText('VS', canvas.width / 2, 340);
    ctx.shadowBlur = 0;

    // Fighter panels - spread further apart
    const leftX = 190;
    const rightX = 710;
    const chartY = 320;
    const chartRadius = 55;

    // Fighter 1 panel
    renderFighterPanel(ctx, leftX, chartY, bugs[0], names[0], odds, 1, records[0],
                       state.fightNumber, 0, chartRadius, '#f55', 'rgba(255, 85, 85, 0.3)');

    // Fighter 2 panel
    renderFighterPanel(ctx, rightX, chartY, bugs[1], names[1], odds, 2, records[1],
                       state.fightNumber, 1, chartRadius, '#5af', 'rgba(85, 170, 255, 0.3)');

    // Betting hint
    ctx.font = '14px "VT323", monospace';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.fillText('Place your bets below!', canvas.width / 2, 585);
}

function getOddsFormat() {
    return localStorage.getItem('bugfights_odds_format') || 'decimal';
}

function renderFighterPanel(ctx, centerX, chartY, bug, name, odds, fighterNum, record, fightNumber, index, radius, color, fillColor) {
    // Name - at top
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px "Press Start 2P", monospace';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillText(name, centerX, 85);
    ctx.shadowBlur = 0;

    // Record
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#888';
    ctx.fillText(`${record.wins}W - ${record.losses}L`, centerX, 105);

    // Bug preview - larger and centered
    const previewY = 170;
    const genome = new BugGenome(bug);
    const spriteSize = Math.round(32 * genome.getSizeMultiplier());
    bug.spriteSize = Math.max(20, Math.min(48, spriteSize));
    renderBugPreview(ctx, centerX, previewY, bug, fightNumber, index, 70);

    // Win probability under sprite
    const prob = fighterNum === 1 ? odds.prob1 : odds.prob2;
    ctx.font = '12px "VT323", monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`${prob}% chance`, centerX, 220);

    // Pentagon chart - moved down
    const stats = [
        bug.bulk / 100,
        bug.speed / 100,
        bug.fury / 100,
        bug.instinct / 100
    ];
    renderPentagonChart(ctx, centerX, chartY, radius, stats, color, fillColor);

    // Stat values around chart
    ctx.font = '12px "VT323", monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`${bug.bulk}`, centerX, chartY - radius - 25);
    ctx.fillText(`${bug.speed}`, centerX + radius + 25, chartY);
    ctx.fillText(`${bug.fury}`, centerX, chartY + radius + 25);
    ctx.fillText(`${bug.instinct}`, centerX - radius - 25, chartY);

    // Attributes - horizontal layout below chart
    const attrY = chartY + radius + 45;
    ctx.font = '12px "VT323", monospace';

    // Single line for attributes
    ctx.fillStyle = '#f55';
    ctx.fillText(bug.weapon, centerX - 60, attrY);
    ctx.fillStyle = '#5af';
    ctx.fillText(bug.defense, centerX, attrY);
    ctx.fillStyle = '#af5';
    ctx.fillText(bug.mobility, centerX + 60, attrY);

    // Odds - display in user's preferred format
    const oddsFormat = getOddsFormat();
    let oddsText;
    if (oddsFormat === 'american') {
        oddsText = fighterNum === 1 ? odds.american1 : odds.american2;
    } else {
        oddsText = (fighterNum === 1 ? odds.fighter1 : odds.fighter2) + 'x';
    }

    ctx.font = 'bold 14px "Press Start 2P", monospace';
    ctx.fillStyle = '#ff0';
    ctx.shadowColor = '#ff0';
    ctx.shadowBlur = 8;
    ctx.fillText(oddsText, centerX, attrY + 35);
    ctx.shadowBlur = 0;
}

// ============================================
// MAIN RENDER
// ============================================

function render(state) {
    if (!ctx) return;

    ctx.save();

    // Screen shake
    if (screenShake.intensity > 0) {
        screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
        screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
        screenShake.intensity *= 0.9;
        ctx.translate(screenShake.x, screenShake.y);
    }

    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, ARENA.height);
    bgGradient.addColorStop(0, '#0d1117');
    bgGradient.addColorStop(0.5, '#161b22');
    bgGradient.addColorStop(1, '#0d1117');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Generate terrarium for this fight
    generateTerrariumDecorations(state.fightNumber);
    renderTerrarium(ctx);

    // Arena boundaries
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.strokeRect(ARENA.leftWall, ARENA.ceilingY, ARENA.rightWall - ARENA.leftWall, ARENA.floorY - ARENA.ceilingY);

    // Floor
    ctx.fillStyle = '#2a2218';
    ctx.fillRect(ARENA.leftWall, ARENA.floorY, ARENA.rightWall - ARENA.leftWall, 30);

    // Blood stains
    bloodStains.forEach(stain => {
        ctx.globalAlpha = stain.alpha * 0.5;
        ctx.fillStyle = '#600';
        ctx.beginPath();
        ctx.ellipse(stain.x, stain.y, stain.radius * 1.5, stain.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Generate sprites if needed
    if (state.bugs && state.bugs.length >= 2) {
        generateSprites(state.bugs, state.fightNumber);
    }

    // Render fighters
    if (state.fighters && state.fighters.length === 2) {
        state.fighters.forEach((fighterState, index) => {
            const key = `${state.fightNumber}-${index}`;
            if (sprites[key]) {
                renderFighter(ctx, fighterState, sprites[key], index === 0 ? 'left' : 'right');
            }
        });
    }

    // Particles
    updateParticles();
    particles.forEach(p => {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    // Floating numbers
    floatingNumbers.forEach(n => {
        ctx.globalAlpha = n.life / 60;
        ctx.font = n.isCrit ? 'bold 18px monospace' : '14px monospace';
        ctx.fillStyle = n.color;
        ctx.textAlign = 'center';
        ctx.fillText(n.value, n.x, n.y);
    });
    ctx.globalAlpha = 1;

    // Title
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('BUG FIGHTS', canvas.width / 2, 35);
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText(`FIGHT #${state.fightNumber}`, canvas.width / 2, 55);

    // Pre-fight stats screen during countdown
    if (state.phase === 'countdown') {
        renderPreFightStats(ctx, state);
    }

    // Commentary
    const commentary = window.BugFightsClient.getCommentary();
    ctx.textAlign = 'left';
    ctx.font = '16px "VT323", monospace';
    commentary.forEach((c, i) => {
        c.age++;
        ctx.globalAlpha = Math.max(0, 1 - c.age / 180);
        ctx.shadowColor = c.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = c.color;
        ctx.fillText('> ' + c.text, 55, canvas.height - 70 + i * 20);
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // CRT effect
    renderCRTEffect(ctx);

    ctx.restore();
}

function renderCRTEffect(ctx) {
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#000';
    for (let y = 0; y < canvas.height; y += 3) {
        ctx.fillRect(0, y, canvas.width, 1);
    }

    ctx.globalAlpha = 1;
    const vignette = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.8
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ============================================
// GAME LOOP
// ============================================

function gameLoop() {
    const state = window.BugFightsClient.getState();
    render(state);
    requestAnimationFrame(gameLoop);
}

// ============================================
// EVENT HANDLERS
// ============================================

function handleEvent(event) {
    if (event.type === 'hit') {
        const data = event.data;
        spawnParticles(data.x, data.y, data.isPoison ? 'poison' : 'blood', data.isCrit ? 5 : 2);
        addBloodStain(data.x, data.y + 15);
        spawnFloatingNumber(data.x, data.y, data.damage, data.isCrit ? '#ff0' : '#f80', data.isCrit);
        screenShake.intensity = data.isCrit ? 5 : 2;
    }
}

// ============================================
// INIT
// ============================================

function initRenderer() {
    canvas = document.getElementById('arena');
    ctx = canvas.getContext('2d');

    // Set up event handler
    window.BugFightsClient.setOnEvent(handleEvent);

    // Clear stains on new fight
    window.BugFightsClient.setOnStateUpdate((state) => {
        // Clear blood stains on new fight
        if (state.phase === 'countdown' && bloodStains.length > 0) {
            bloodStains = [];
            terrarium.initialized = false;
        }
    });

    // Start render loop
    gameLoop();
}

// Export
window.BugFightsRenderer = {
    init: initRenderer,
};
