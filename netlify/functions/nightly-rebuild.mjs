// Genbygger sitet hver nat, så katalog, historik og analyser følger med de nye snapshots.
//
// Opret en build-hook i Netlify (Site configuration › Build & deploy › Build hooks) og gem
// URL'en i miljøvariablen BUILD_HOOK_URL.
export default async () => {
  const hook = process.env.BUILD_HOOK_URL;
  if (!hook) {
    console.error('BUILD_HOOK_URL mangler. Opret en build-hook og sæt miljøvariablen.');
    return;
  }
  const res = await fetch(`${hook}?trigger_title=${encodeURIComponent('Natlig genbygning')}`, { method: 'POST' });
  console.log(`Build-hook svarede ${res.status}`);
};

// 04:30 UTC, dvs. 06:30 dansk sommertid / 05:30 vintertid
export const config = {
  schedule: '30 4 * * *',
};
