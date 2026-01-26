# Changelog

All notable changes to Bug Fights will be documented in this file.

## [0.3.0-alpha] - 2026-01-22

### Added
- 3D rendering mode with Three.js
- Shape-based procedural bug generation (spheres, cylinders, cones, torus)
- Real-time bug animation system (idle, attack, hit, death, victory states)
- 3D roster viewer with interactive bug previews
- Menacing bug features:
  - Glowing red compound eyes
  - Dorsal and side spikes on abdomen
  - Shoulder spikes and armor plates on thorax
  - Head horns
  - Dark metallic weapons with venom accents
  - Bat-like angular wings with veins
  - Segmented antennae
- Camera controls (front, side, top, isometric presets)
- Orbit controls with mouse drag and scroll zoom
- Version tracking system

### Changed
- Bugs now use primitive 3D shapes instead of voxels for better performance
- Weapons are more menacing with serrated edges and venom effects
- Wings have angular bat-like shape instead of simple ellipse

## [0.2.0-alpha] - Previous

### Added
- WebSocket server for real-time multiplayer viewing
- Persistent bug roster with win/loss records
- Betting system with odds calculation
- Drive system (aggression/caution)
- Stamina system
- AI behavior states (aggressive, circling, retreating, stunned)
- Mobility tactics (flyers, wallcrawlers, ground bugs)
- Visual body language (posture, color tints, state indicators)

## [0.1.0-alpha] - Initial

### Added
- Core fight simulation
- Procedural 2D bug sprite generation
- Basic combat mechanics
- Canvas-based 2D renderer
