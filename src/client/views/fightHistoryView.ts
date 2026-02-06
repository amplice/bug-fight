// Bug Fights - Fight History Page View

interface FightData {
    id: string;
    fightNumber: number;
    duration: number;
    isDraw: boolean;
    createdAt: string;
    drandRound: number | null;
    drandSeed: string | null;
    bug1: { id: string; name: string };
    bug2: { id: string; name: string };
    winner: { id: string; name: string } | null;
}

export function createFightHistoryView(): PageView {
    let currentLimit = 50;
    let container: HTMLElement | null = null;
    let tbody: HTMLTableSectionElement | null = null;
    let loadMoreBtn: HTMLButtonElement | null = null;
    let abortController: AbortController | null = null;

    function mount(el: HTMLElement): void {
        container = el;
        abortController = new AbortController();

        const header = document.createElement('h2');
        header.className = 'page-header';
        header.textContent = 'FIGHT HISTORY';
        el.appendChild(header);

        const table = document.createElement('table');
        table.className = 'fights-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Fight #</th>
                    <th>Fighter 1</th>
                    <th>VS</th>
                    <th>Fighter 2</th>
                    <th>Winner</th>
                    <th>Duration</th>
                    <th>drand</th>
                    <th>Date</th>
                </tr>
            </thead>
        `;
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
        el.appendChild(table);

        loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'load-more-btn';
        loadMoreBtn.textContent = 'LOAD MORE';
        loadMoreBtn.addEventListener('click', () => {
            currentLimit = Math.min(currentLimit + 50, 200);
            loadFights();
        });
        el.appendChild(loadMoreBtn);

        loadFights();
    }

    async function loadFights(): Promise<void> {
        if (!tbody) return;
        tbody.innerHTML = '';

        try {
            const response = await fetch(`/api/fights?limit=${currentLimit}`, { signal: abortController?.signal });
            if (!response.ok) {
                if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="error-msg">Failed to load fight history</td></tr>';
                return;
            }
            const fights: FightData[] = await response.json();

            fights.forEach(fight => {
                const tr = document.createElement('tr');
                const durationSec = (fight.duration / 30).toFixed(1);
                const date = new Date(fight.createdAt).toLocaleDateString();

                let winnerHtml: string;
                if (fight.isDraw) {
                    winnerHtml = '<td class="draw-cell">DRAW</td>';
                } else if (fight.winner) {
                    winnerHtml = `<td class="winner-cell"><a href="#/bug/${fight.winner.id}">${fight.winner.name}</a></td>`;
                } else {
                    winnerHtml = '<td class="draw-cell">-</td>';
                }

                let drandHtml: string;
                if (fight.drandRound) {
                    drandHtml = `<td><a class="drand-link" href="https://api.drand.sh/public/${fight.drandRound}" target="_blank" rel="noopener">#${fight.drandRound}</a></td>`;
                } else {
                    drandHtml = '<td style="color:#555">-</td>';
                }

                tr.innerHTML = `
                    <td>${fight.fightNumber}</td>
                    <td><a href="#/bug/${fight.bug1.id}">${fight.bug1.name}</a></td>
                    <td class="vs-cell">VS</td>
                    <td><a href="#/bug/${fight.bug2.id}">${fight.bug2.name}</a></td>
                    ${winnerHtml}
                    <td>${durationSec}s</td>
                    ${drandHtml}
                    <td>${date}</td>
                `;
                tbody!.appendChild(tr);
            });

            // Hide load more if we got fewer than limit or at max
            if (loadMoreBtn) {
                loadMoreBtn.style.display = (fights.length < currentLimit || currentLimit >= 200) ? 'none' : 'block';
            }
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') return;
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" class="error-msg">Failed to load fight history</td></tr>';
            }
        }
    }

    function unmount(): void {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        currentLimit = 50;
        container = null;
        tbody = null;
        loadMoreBtn = null;
    }

    return { mount, unmount };
}
