// Dark Fleet Viewer entry point. Draws the basemap first, then loads the AIS data modules (a few hundred KB)
// and the interactive code, so the page paints before the data arrives.
import { createMap } from './map.js';

const q = new URLSearchParams(location.hash.slice(1));
const ext = q.get('x') === 'region' ? 'region' : 'taiwan'; // same default as hash.js readHash
const map = createMap(document.getElementById('map'), document.getElementById('tracks'));
map.setExtent(ext);
document.querySelectorAll('[data-ext]').forEach(b => b.setAttribute('aria-pressed', b.dataset.ext === ext));
const panel = document.getElementById('panel');
panel.innerHTML = '<div class="sec"><div class="status"><b>Loading AIS fixes</b><span>Decoding the live window and the archive.</span></div></div>';

import('./main.js')
  .then(m => m.start(map))
  .catch(err => {
    panel.innerHTML = '<div class="sec"><div class="status" data-s="bad"><b>Could not load the AIS data</b><span>Reload the page to try again.</span></div></div>';
    console.error(err);
  });
