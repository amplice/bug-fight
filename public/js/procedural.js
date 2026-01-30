// Bug Fights - Client-side BugGenome
// Lightweight: reconstructs genome from server data for 3D rendering.
// Source of truth for genome logic (randomize, breed, naming): server/BugGenome.js

class BugGenome {
    constructor(data) {
        Object.assign(this, data);
        if (data.color) this.color = { ...data.color };
    }

    getSizeMultiplier() {
        return 0.6 + (this.bulk / 100) * 0.9;
    }
}

if (typeof window !== 'undefined') {
    window.BugGenome = BugGenome;
}
