// Tegner resultatet af en live-forespørgsel som en tabel i samme stil som de statiske.
import type { Result } from './duck';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const secs = (s: number) => s.toLocaleString('da-DK', { maximumFractionDigits: 1 });

export function renderResult(el: HTMLElement, r: Result) {
  const head = r.columns
    .map((c, i) => `<th class="${r.numeric[i] ? 'n' : ''}">${esc(c.replaceAll('_', ' '))}</th>`)
    .join('');
  const body = r.rows
    .map(
      (row) =>
        `<tr>${row.map((v, i) => `<td class="${r.numeric[i] ? 'n' : ''}"${r.nowrap[i] ? ' style="white-space:nowrap"' : ''}>${esc(v)}</td>`).join('')}</tr>`,
    )
    .join('');
  const shown = r.rows.length < r.total ? `, viser de første ${r.rows.length.toLocaleString('da-DK')}` : '';
  el.innerHTML = `
    <p class="live-meta">${r.total.toLocaleString('da-DK')} ${r.total === 1 ? 'række' : 'rækker'}${shown}. Kørt i din browser på ${secs(r.seconds)} s.</p>
    ${r.columns.length ? `<div class="table-scroll"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` : ''}`;
}

export function renderError(el: HTMLElement, err: unknown) {
  const msg = String((err as Error)?.message ?? err)
    .replace(/https?:\/\/\S+\/(schema=[^/]+\/relation=[^/]+)\/\S*/g, '$1')
    .slice(0, 600);
  el.innerHTML = /stoppet/.test(msg)
    ? `<p class="live-error">${esc(msg)}</p>`
    : `<p class="live-error"><strong>Forespørgslen fejlede.</strong> ${esc(msg)}</p>`;
}

/** Viser en løbende tæller, mens en forespørgsel kører. Returnerer en funktion, der stopper den. */
export function ticker(el: HTMLElement, label: () => string) {
  const t0 = performance.now();
  const tick = () => (el.textContent = `${label()} ${secs((performance.now() - t0) / 1000)} s`);
  tick();
  const id = setInterval(tick, 100);
  return () => clearInterval(id);
}
