// Guided walkthrough: why the first island chain matters for Taiwan.
export const STEPS = [
  { title: 'Two chains of islands',
    body: 'Strategists describe the western Pacific as two chains of islands. The first runs from Japan through the Ryukyus, Taiwan and the Philippines to Borneo. The second runs from Japan\'s Bonin Islands through the Marianas and Guam to Palau. They are ideas about geography, not lines anyone has drawn on a treaty.',
    set: { mode: 'site', site: 'kadena', zoom: 'region', chains: true, layers: ['us', 'jp', 'ph', 'au'] } },
  { title: 'Taiwan is the hinge',
    body: 'Taiwan sits in the middle of the first chain. Ships leaving the East and South China Seas for the open Pacific pass through gaps in the chain, such as the Miyako Strait northeast of Taiwan and the Bashi Channel south of it. Taiwan lies between the two.',
    set: { mode: 'site', site: 'yonaguni', zoom: 'taiwan' } },
  { title: 'Allies on either side',
    body: 'Japan has opened Ground Self-Defense Force posts on Yonaguni (2016), Amami and Miyako (2019) and Ishigaki (2023). In 2023 the Philippines named four more EDCA sites, three of them in northern Luzon, south of the Luzon Strait. Yonaguni lies about 110 km from Taiwan.',
    set: { mode: 'site', site: 'osias', zoom: 'luzon', layers: ['jp', 'ph'] } },
  { title: 'Inside the short-range umbrella',
    body: 'Kadena Air Base on Okinawa is about 650 km from the nearest PRC territory, inside the 600–900 km band CSIS gives for the DF-15. Every ring here is drawn around the site: a launcher anywhere inside a ring could reach it. Along much of the first chain, short-range missiles are enough.',
    set: { mode: 'site', site: 'kadena', zoom: 'taiwan', layers: ['us', 'jp', 'ph', 'au'] } },
  { title: 'The second chain buys distance',
    body: 'Guam is about 2,900 km from the nearest PRC territory. Only the DF-26 reaches it among the missiles shown; CSIS calls it China\'s first conventionally armed ballistic missile able to strike Guam. Distance does not make Guam safe, but it thins the list of weapons that can reach it.',
    set: { mode: 'site', site: 'andersen', zoom: 'guam' } },
  { title: 'Flip it around',
    body: 'Pick a PLA ring instead. From the Fujian coast, the DF-21D ring covers the first island chain from Kyushu to central Luzon, plus the U.S. bases in South Korea. A ring shows where a missile can fly. Whether it hits depends on finding and tracking the target, which the Strait Layers tool explores.',
    set: { mode: 'ring', ring: { missile: 'df21d', launch: 'fujian' }, zoom: 'region' } },
];

export function createTour(root, apply) {
  let i = -1;
  const card = document.createElement('div');
  card.className = 'ic-tour';
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Guided walkthrough');
  root.appendChild(card);
  const show = () => {
    const s = STEPS[i];
    apply(s.set);
    card.innerHTML = `<div class="ic-tour-h"><span>Walkthrough ${i + 1} / ${STEPS.length}</span><button type="button" class="x" aria-label="Close walkthrough">×</button></div>
      <h3>${s.title}</h3><p>${s.body}</p>
      <div class="ic-tour-nav"><button type="button" class="btn" ${i === 0 ? 'disabled' : ''} data-d="-1">Back</button>
      <button type="button" class="btn solid" data-d="1">${i === STEPS.length - 1 ? 'Finish' : 'Next'}</button></div>`;
    card.querySelector('.x').onclick = stop;
    card.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const n = i + Number(b.dataset.d); if (n >= STEPS.length) stop(); else { i = n; show(); } });
    card.querySelector('.solid').focus();
  };
  const start = () => { i = 0; card.hidden = false; show(); };
  const stop = () => { card.hidden = true; i = -1; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) stop(); });
  return { start, stop };
}
