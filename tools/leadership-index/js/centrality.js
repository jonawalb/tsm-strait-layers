// Degree and betweenness centrality on the visible graph (undirected, unweighted).
// Betweenness uses Brandes (2001); fine for a few hundred nodes.

export function centrality(nodeIds, edges) {
  const idx = new Map(nodeIds.map((id, i) => [id, i]));
  const n = nodeIds.length;
  const adj = Array.from({ length: n }, () => new Set());
  for (const e of edges) {
    const a = idx.get(e.a), b = idx.get(e.b);
    if (a == null || b == null || a === b) continue;
    adj[a].add(b); adj[b].add(a);
  }
  const nb = adj.map(s => [...s]);
  const CB = new Float64Array(n);
  const sigma = new Float64Array(n), dist = new Int32Array(n), delta = new Float64Array(n);
  for (let s = 0; s < n; s++) {
    const S = [], P = Array.from({ length: n }, () => []);
    sigma.fill(0); dist.fill(-1); delta.fill(0);
    sigma[s] = 1; dist[s] = 0;
    const Q = [s]; let qi = 0;
    while (qi < Q.length) {
      const v = Q[qi++]; S.push(v);
      for (const w of nb[v]) {
        if (dist[w] < 0) { dist[w] = dist[v] + 1; Q.push(w); }
        if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; P[w].push(v); }
      }
    }
    while (S.length) {
      const w = S.pop();
      for (const v of P[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      if (w !== s) CB[w] += delta[w];
    }
  }
  // Undirected: each pair counted twice. Normalize by (n-1)(n-2)/2.
  const norm = n > 2 ? ((n - 1) * (n - 2)) / 2 : 1;
  const out = new Map();
  nodeIds.forEach((id, i) => out.set(id, { degree: nb[i].length, betweenness: CB[i] / 2 / norm }));
  // Ranks (1 = highest).
  const rank = key => { const order = [...out.entries()].sort((x, y) => y[1][key] - x[1][key]); order.forEach(([id], r) => { out.get(id)[key + 'Rank'] = r + 1; }); };
  rank('degree'); rank('betweenness');
  return out;
}
