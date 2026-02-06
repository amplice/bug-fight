// Bug Fights - About Page View

export function createAboutView(): PageView {
    function mount(container: HTMLElement): void {
        const header = document.createElement('h2');
        header.className = 'page-header';
        header.textContent = 'ABOUT BUG FIGHTS';
        container.appendChild(header);

        const sections = [
            {
                title: 'WHAT IS BUG FIGHTS?',
                content: `
                    <p>Bug Fights is a 24/7 autonomous procedural insect combat simulator. Procedurally generated bugs with unique genomes fight in a true 3D arena, driven entirely by emergent AI behavior.</p>
                    <p>No scripted drama. No forced spectacle. Every fight unfolds organically from simple rules and deep interactions.</p>
                `,
            },
            {
                title: 'HOW IT WORKS',
                content: `
                    <p>Each bug is defined by a genome with four core stats:</p>
                    <ul>
                        <li><strong style="color:#f88">Bulk</strong> - HP pool, damage output, physical size</li>
                        <li><strong style="color:#8f8">Speed</strong> - Movement speed, attack frequency, stamina regen</li>
                        <li><strong style="color:#ff8">Fury</strong> - Critical hit chance, aggression response to damage</li>
                        <li><strong style="color:#8ff">Instinct</strong> - Dodge chance, tactical positioning, feint reading</li>
                    </ul>
                    <p>Bugs have an AI drive system with aggression and caution values that shift dynamically during combat. Landing hits increases aggression. Taking damage triggers responses based on fury: high-fury bugs get MORE aggressive when hurt, while low-fury bugs become cautious.</p>
                    <p>What emerges: aggressive vs aggressive = bloody brawl. Cautious vs cautious = tense spacing. The system creates the drama organically.</p>
                `,
            },
            {
                title: 'COMBAT & MOBILITY',
                content: `
                    <p>Fights take place in a full 3D arena with height, width, and depth. Three mobility types create diverse tactical encounters:</p>
                    <ul>
                        <li><strong style="color:#af5">Ground</strong> - 3D flanking, jump attacks, arena control</li>
                        <li><strong style="color:#af5">Winged</strong> - Aerial dogfights, dive bombing, altitude advantage</li>
                        <li><strong style="color:#af5">Wallcrawler</strong> - Wall climbing, pounce attacks, ambush tactics</li>
                    </ul>
                    <p>Combat features a stamina system, feint/counter-feint mind-games, and five weapon types each affecting range and damage patterns.</p>
                `,
            },
            {
                title: 'EVOLUTION & BREEDING',
                content: `
                    <p>A persistent roster of bugs fight, breed, and evolve through natural selection. Winners pass on their genomes to the next generation.</p>
                    <ul>
                        <li>Stats are blended from parents with mutation</li>
                        <li>Traits can be inherited or mutated</li>
                        <li>Bugs retire after enough fights, making room for offspring</li>
                        <li>Lineage tracking shows family trees across generations</li>
                    </ul>
                    <p>Over time, the roster evolves: successful strategies propagate while weak builds get retired.</p>
                `,
            },
            {
                title: 'PROVABLE FAIRNESS',
                content: `
                    <p>Bug Fights uses the <a href="https://drand.love" target="_blank" rel="noopener">drand randomness beacon</a> to seed fight outcomes with publicly verifiable randomness.</p>
                    <div class="code-block">
// Each fight seeded with drand beacon
const beacon = await fetch('https://api.drand.sh/public/latest');
const seed = beacon.randomness;  // Publicly verifiable
const rng = createSeededRNG(seed);
                    </div>
                    <p>Every fight stores its drand round number. Anyone can replay a fight by cloning the repo and using the same seed to verify the exact same outcome.</p>
                    <p>Trust model: "If we cheated, you could catch us by replaying."</p>
                `,
            },
            {
                title: 'ROADMAP',
                content: `
                    <ul>
                        <li>User accounts with persistent balances</li>
                        <li>Bug ownership and trading</li>
                        <li>Stud fees for breeding with champion bugs</li>
                        <li>Tournament brackets and seasonal rankings</li>
                        <li>TEE attestation for hardware-enforced fairness</li>
                    </ul>
                `,
            },
        ];

        sections.forEach(s => {
            const div = document.createElement('div');
            div.className = 'about-section';
            div.innerHTML = `<h3>${s.title}</h3>${s.content}`;
            container.appendChild(div);
        });

        // Back to arena link
        const back = document.createElement('a');
        back.className = 'about-back-link';
        back.href = '#/arena';
        back.textContent = 'BACK TO ARENA';
        container.appendChild(back);
    }

    function unmount(): void {
        // Static content, nothing to clean up
    }

    return { mount, unmount };
}
