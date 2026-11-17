// d3 force network. Uses the global d3 (v7.9.0, pinned UMD build from cdnjs, loaded in index.html).
// Nodes: colour = country token, radius = tier, ring = removed / under investigation at the chosen date.
// Edges: one line per layer per pair, offset sideways so parallel layers stay visible and clickable.
const d3 = window.d3;
const R = { 1: 9, 2: 5.5 };
const LAYER_ORDER = ['rel', 'hi', 'fa', 'mt', 'co', 'ca', 'bg', 'st'];
const SG = { 1: 'sg-pos', '-1': 'sg-neg', 0: 'sg-0' };
const rad = d => d.inter ? 3.5 : R[d.tier];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createGraph(box, tip, { onPick, onEdge }) {
  const svg = d3.select(box).append('svg').attr('class', 'net').attr('role', 'group')
    .attr('aria-label', 'Network of leaders. Each circle is a person; lines are ties. Use Tab to reach people and Enter to open a profile.');
  const defs = svg.append('defs');
  defs.append('marker').attr('id', 'li-arrow').attr('viewBox', '0 0 10 10').attr('refX', 10).attr('refY', 5)
    .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
    .append('path').attr('d', 'M0 0L10 5L0 10z').attr('class', 'arrowhead');
  const root = svg.append('g');
  const gE = root.append('g').attr('class', 'edges');
  const gN = root.append('g').attr('class', 'nodes');
  let W = 800, H = 600, nodes = [], links = [], pos = new Map(), sel = null, hl = new Set(), fitted = false;

  const zoom = d3.zoom().scaleExtent([0.25, 5]).on('zoom', ev => root.attr('transform', ev.transform));
  svg.call(zoom).on('dblclick.zoom', null);

  const sim = d3.forceSimulation().alphaDecay(0.035)
    .force('link', d3.forceLink().id(d => d.id).distance(l => l.layer === 'hi' ? 46 : l.layer === 'bg' ? 90 : 64)
      .strength(l => l.layer === 'st' ? 0 : l.layer === 'bg' ? 0.03 : l.layer === 'co' ? 0.12 : 0.25))
    .force('charge', d3.forceManyBody().strength(d => d.tier === 1 ? -150 : -70).distanceMax(380))
    .force('collide', d3.forceCollide(d => rad(d) + 6))
    .force('x', d3.forceX(d => d.ax).strength(0.07))
    .force('y', d3.forceY(d => d.ay).strength(0.07))
    .on('tick', draw);
  sim.stop();

  function size() {
    const r = box.getBoundingClientRect();
    W = Math.max(300, r.width); H = Math.max(300, r.height);
    svg.attr('viewBox', `0 0 ${W} ${H}`);
  }

  // Country anchors on an ellipse so countries form loose clusters.
  function anchors(countries) {
    const m = new Map();
    const n = countries.length;
    countries.forEach((c, i) => {
      if (n === 1) { m.set(c, [W / 2, H / 2]); return; }
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      m.set(c, [W / 2 + Math.cos(a) * W * 0.3, H / 2 + Math.sin(a) * H * 0.3]);
    });
    return m;
  }

  function update(people, edges, opts) {
    size();
    const cs = [...new Set(people.map(p => p.country))];
    const A = anchors(cs);
    nodes = people.map(p => {
      const old = pos.get(p.id);
      const [ax, ay] = A.get(p.country);
      return { ...p, ax, ay, x: old ? old.x : ax + (Math.random() - 0.5) * 60, y: old ? old.y : ay + (Math.random() - 0.5) * 60 };
    });
    const byPair = new Map();
    links = edges.map(e => ({ ...e, source: e.a, target: e.b }));
    for (const l of links) { const k = l.a < l.b ? l.a + '|' + l.b : l.b + '|' + l.a; if (!byPair.has(k)) byPair.set(k, []); byPair.get(k).push(l); }
    for (const list of byPair.values()) {
      list.sort((x, y) => LAYER_ORDER.indexOf(x.layer) - LAYER_ORDER.indexOf(y.layer));
      list.forEach((l, i) => { l.off = (i - (list.length - 1) / 2) * 3.2; l.pair = l.a < l.b ? l.a + '|' + l.b : l.b + '|' + l.a; });
    }

    const eSel = gE.selectAll('g.e').data(links, d => d.id);
    eSel.exit().remove();
    const eIn = eSel.enter().append('g').attr('class', d => `e l-${d.layer}${d.sign != null ? ' ' + SG[d.sign] : ''}`).style('--fc', d => d.fc ? `var(${d.fc})` : null)
      .on('click', (ev, d) => { ev.stopPropagation(); onEdge(d.pair); })
      .on('mousemove', (ev, d) => showTip(ev, `<b>${esc(d.layerLabel)}</b><br>${esc(d.na)} and ${esc(d.nb)}${d.layer === 'co' ? `<br>${d.weight} yr overlap` : ''}<br><span class="fine">Click for the reason and sources</span>`))
      .on('mouseleave', hideTip);
    eIn.append('line').attr('class', 'hit');
    eIn.append('line').attr('class', 'vis');
    gE.selectAll('g.e').select('line.vis')
      .attr('stroke-width', d => d.layer === 'co' || d.layer === 'mt' ? 1 + Math.min(d.weight, 8) * 0.35 : d.layer === 'bg' ? 1 : 1.5)
      .attr('marker-end', d => d.layer === 'hi' ? 'url(#li-arrow)' : null);

    const nSel = gN.selectAll('g.n').data(nodes, d => d.id);
    nSel.exit().remove();
    const nIn = nSel.enter().append('g').attr('class', 'n').attr('tabindex', 0).attr('role', 'button')
      .on('click', (ev, d) => { ev.stopPropagation(); onPick(d.id, ev); })
      .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick(d.id, ev); } })
      .on('mousemove', (ev, d) => showTip(ev, `<b>${esc(d.name)}</b> <span class="fine">${d.country}</span><br>${esc(d.topPost || 'No post at this date')}`))
      .on('mouseleave', hideTip)
      .call(d3.drag().on('start', dragStart).on('drag', dragged).on('end', dragEnd));
    nIn.append('circle').attr('class', 'ring');
    nIn.append('circle').attr('class', 'dot');
    nIn.append('text').attr('class', 'lbl').attr('dy', '0.32em');
    gN.selectAll('g.n')
      .attr('aria-label', d => d.state ? `${d.name}, imposing state, not a person` : `${d.name}, ${d.country}, tier ${d.tier}${d.statusNow !== 'active' ? ', ' + d.statusNow.replace('_', ' ') : ''}`)
      .attr('data-s', d => d.statusNow)
      .classed('former', d => !d.activeNow).classed('inter', d => !!d.inter).classed('cmp', d => !!d.cmp).classed('state', d => !!d.state)
      .style('--k', d => `var(--k-${d.country})`);
    gN.selectAll('g.n').select('circle.dot').attr('r', rad);
    gN.selectAll('g.n').select('circle.ring').attr('r', d => rad(d) + 3.5);
    gN.selectAll('g.n').select('text.lbl').attr('x', d => rad(d) + 4).text(d => d.short);

    sim.nodes(nodes);
    sim.force('link').links(links);
    const newShare = nodes.length ? nodes.filter(n => !pos.has(n.id)).length / nodes.length : 0;
    if (reduced()) { sim.stop(); sim.alpha(1); for (let i = 0; i < 300; i++) sim.tick(); draw(); if (!fitted || newShare > 0.5) fit(true); fitted = true; }
    else if (!fitted || newShare > 0.5) {
      // Mostly new layout: settle it before the first paint so the page opens readable, then let it breathe.
      sim.stop(); sim.alpha(1); for (let i = 0; i < 220; i++) sim.tick(); draw(); fit(true); fitted = true;
      sim.alpha(0.05).restart();
    } else sim.alpha(opts.reheat ? 0.5 : 0.3).restart();
    highlight(opts.sel, opts.match);
  }

  function draw() {
    for (const n of nodes) pos.set(n.id, { x: n.x, y: n.y });
    gE.selectAll('g.e').each(function (d) {
      const s = d.source, t = d.target;
      const dx = t.x - s.x, dy = t.y - s.y, len = Math.hypot(dx, dy) || 1;
      const ox = (-dy / len) * d.off, oy = (dx / len) * d.off;
      const shrink = d.layer === 'hi' ? (rad(t) + 4) / len : 0; // stop the arrow at the node edge
      const x2 = t.x - dx * shrink + ox, y2 = t.y - dy * shrink + oy;
      d3.select(this).selectAll('line').attr('x1', s.x + ox).attr('y1', s.y + oy).attr('x2', x2).attr('y2', y2);
    });
    gN.selectAll('g.n').attr('transform', d => `translate(${d.x},${d.y})`);
  }

  function highlight(id, match) {
    sel = id;
    hl = new Set();
    if (id) { hl.add(id); for (const l of links) { if (l.a === id) hl.add(l.b); if (l.b === id) hl.add(l.a); } }
    const any = id || (match && match.size);
    gN.selectAll('g.n').classed('sel', d => d.id === id)
      .classed('dim', d => any && !d.cmp ? !(hl.has(d.id) || (match && match.has(d.id))) : false)
      .classed('named', d => d.cmp || d.tier === 1 || hl.has(d.id) || (match && match.has(d.id)) || nodes.length <= 40);
    gE.selectAll('g.e').classed('dim', d => id ? !(d.a === id || d.b === id) : false);
  }

  function fit(instant) {
    if (!nodes.length) return;
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const x0 = Math.min(...xs) - 40, x1 = Math.max(...xs) + 120, y0 = Math.min(...ys) - 30, y1 = Math.max(...ys) + 30;
    const k = Math.min(1.4, 0.95 * Math.min(W / (x1 - x0), H / (y1 - y0)));
    const tr = d3.zoomIdentity.translate(W / 2 - k * (x0 + x1) / 2, H / 2 - k * (y0 + y1) / 2).scale(k);
    if (instant || reduced()) svg.call(zoom.transform, tr); else svg.transition().duration(500).call(zoom.transform, tr);
  }

  function dragStart(ev, d) { if (!reduced() && !ev.active) sim.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; }
  function dragged(ev, d) { d.fx = ev.x; d.fy = ev.y; if (reduced()) { d.x = ev.x; d.y = ev.y; draw(); } }
  function dragEnd(ev, d) { if (!reduced() && !ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }

  function showTip(ev, html) {
    const r = box.getBoundingClientRect();
    tip.innerHTML = html; tip.hidden = false;
    const x = Math.min(ev.clientX - r.left + 14, r.width - tip.offsetWidth - 6);
    tip.style.left = Math.max(4, x) + 'px'; tip.style.top = (ev.clientY - r.top + 14) + 'px';
  }
  function hideTip() { tip.hidden = true; }
  svg.on('click', () => onPick(null));

  return {
    update, highlight, fit: () => { fitted = true; fit(); },
    zoomBy: k => svg.transition().duration(reduced() ? 0 : 250).call(zoom.scaleBy, k),
    resize: () => { size(); },
    focusNode: id => gN.selectAll('g.n').filter(d => d.id === id).node()?.focus(),
  };
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
