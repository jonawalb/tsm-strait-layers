// TSM Interactive access gate. Classic (non-module) script, injected into the <head> of every page
// by scripts/build_site.py. Data files are published AES-256-GCM encrypted; the key is derived
// from the access password with PBKDF2-SHA256 and never leaves the browser.
// In local development (serving the source tree) this file is not loaded and data is plaintext.
(function () {
  'use strict';
  var CFG = {"id": "3ac5ee5d38", "salt": "6POnr52emytt5TPCfY8jYQ==", "iter": 600000, "check": "4d3AN2j/tzimq6kxmRwRLyxT7Nak84Xz3yZMNmQPcb5xGA==", "master": {"salt": "vde/ATuxVfD/g0e6EHJAMQ==", "check": "TU+yFg3h69kpOPVjlXBcWXt7p1z0XnU5t6ltqTRR6sgbOw==", "wraps": {"1": "OlR54Q7r2AReP+Y0Ifr1Po2VgvHtgClhbMqkCg0PqfbaLvLBCYwxw9S6wFK15WBrSHCiuur1AbVpMVvl"}}};
  var KEYNAME = 'tsm-vault-key-' + (CFG ? CFG.id : 'dev');
  var MAGIC = 'TSMVAULT2:';
  // Optional extra tiers: tools listed in CFG.t2.slugs (or CFG.t3.slugs) have their data sealed with a
  // second (or third) password. A page belongs to at most one extra tier.
  var TIERS = { 2: CFG && CFG.t2, 3: CFG && CFG.t3, 4: CFG && CFG.t4, 5: CFG && CFG.t5, 6: CFG && CFG.t6 };
  var T2 = TIERS[2];
  var KEYNAME2 = T2 ? 'tsm-vault-key-' + T2.id : '';
  var KEYNAME3 = TIERS[3] ? 'tsm-vault-key-' + TIERS[3].id : '';
  var KEYNAME4 = TIERS[4] ? 'tsm-vault-key-' + TIERS[4].id : '';
  var KEYNAME5 = TIERS[5] ? 'tsm-vault-key-' + TIERS[5].id : '';
  var KEYNAME6 = TIERS[6] ? 'tsm-vault-key-' + TIERS[6].id : '';
  var MAGIC2 = 'TSMVAULT3:';
  var MAGIC3 = 'TSMVAULT4:';
  var MAGIC4 = 'TSMVAULT5:';
  var MAGIC5 = 'TSMVAULT6:';
  var MAGIC6 = 'TSMVAULT7:';
  var ROOT = new URL('../../', document.currentScript.src).href;
  var slugMatch = location.pathname.match(/\/tools\/([^/]+)\//);
  var inTier = function (t) { return !!(TIERS[t] && slugMatch && TIERS[t].slugs.indexOf(slugMatch[1]) >= 0); };
  var PAGE_TIER = inTier(6) ? 6 : inTier(5) ? 5 : inTier(4) ? 4 : inTier(3) ? 3 : inTier(2) ? 2 : 0;
  var LOCKED_PAGE = PAGE_TIER > 0;
  // Master password (CFG.master): one password that unlocks every tier of the site for this tab. Each tier's key is
  // published wrapped (AES-GCM) under a key derived from it. The unwrapped keys live only in sessionStorage, so the
  // master is never kept on the device; the input is built so browsers do not offer to save it.
  var MKEY = CFG && CFG.master ? 'tsm-master-' + CFG.id : '';
  var MASTER = null; // {tier: CryptoKey} once the master password has been entered in this tab
  var resolveKey, resolveKey2;
  var keyReady = new Promise(function (r) { resolveKey = r; });
  var key2Ready = new Promise(function (r) { resolveKey2 = r; });

  var b64d = function (s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  var b64e = function (u) { var s = ''; for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  var importRaw = function (raw) { return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']); };
  function decrypt(key, bytes) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12)).then(function (b) { return new Uint8Array(b); });
  }
  /** Decrypt, then gunzip when the payload was compressed at build time (thumbnails are sealed uncompressed,
   *  so check the gzip magic bytes rather than trusting the flag). */
  function open(key, bytes, gz) {
    return decrypt(key, bytes).then(function (plain) {
      if (!gz || plain[0] !== 0x1f || plain[1] !== 0x8b) return plain;
      var stream = new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Response(stream).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
    });
  }
  function derive(pw, tier) {
    var salt = tier > 1 ? TIERS[tier].salt : CFG.salt;
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (base) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64d(salt), iterations: CFG.iter, hash: 'SHA-256' }, base, 256);
    }).then(function (bits) { return new Uint8Array(bits); });
  }
  /** Open tiers (CFG.tN.raw): the build published the tier's key, so its pages unlock without asking. */
  function openTier(tier) { return !!(TIERS[tier] && TIERS[tier].raw); }
  function openKey(tier) { return tryRaw(b64d(TIERS[tier].raw), tier); }
  /** Resolves to a CryptoKey if raw key bytes decrypt the check token, else rejects. */
  function tryRaw(raw, tier) {
    var check = tier > 1 ? TIERS[tier].check : CFG.check;
    return importRaw(raw).then(function (k) { return decrypt(k, b64d(check)).then(function () { return k; }); });
  }
  function storedKey(name, tier) {
    var v = null;
    try { v = localStorage.getItem(name) || sessionStorage.getItem(name); } catch (e) { /* storage blocked */ }
    return v ? tryRaw(b64d(v), tier) : Promise.reject();
  }
  /** Extra-tier key: asked for on every visit to a locked tool page and never stored, so nothing else can use it.
   *  After the master password, every tier's key is available in this tab. */
  function key2Now(tier) {
    if (tier === PAGE_TIER) return key2Ready;
    if (openTier(tier)) return openKey(tier);
    return MASTER && MASTER[tier] ? Promise.resolve(MASTER[tier]) : Promise.reject();
  }
  function deriveMaster(pw) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (base) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64d(CFG.master.salt), iterations: CFG.iter, hash: 'SHA-256' }, base, 256);
    }).then(function (bits) { return new Uint8Array(bits); });
  }
  /** Raw tier keys {tier: Uint8Array} → CryptoKeys, each checked against its tier's token. */
  function useMasterRaws(raws) {
    var tiers = Object.keys(raws);
    return Promise.all(tiers.map(function (t) { return tryRaw(raws[t], +t); })).then(function (keys) {
      MASTER = {}; tiers.forEach(function (t, i) { MASTER[t] = keys[i]; });
      return MASTER;
    });
  }
  /** Try `pw` as the master password: unwrap every tier key and keep them for this tab only. Rejects if wrong. */
  function tryMaster(pw) {
    if (!MKEY) return Promise.reject();
    return deriveMaster(pw).then(importRaw).then(function (mk) {
      return decrypt(mk, b64d(CFG.master.check)).then(function () {
        var tiers = Object.keys(CFG.master.wraps), raws = {};
        return Promise.all(tiers.map(function (t) { return decrypt(mk, b64d(CFG.master.wraps[t])).then(function (r) { raws[t] = r; }); }))
          .then(function () {
            var out = {}; tiers.forEach(function (t) { out[t] = b64e(raws[t]); });
            try { sessionStorage.setItem(MKEY, JSON.stringify(out)); } catch (e) { /* storage blocked: this page only */ }
            return useMasterRaws(raws);
          });
      });
    });
  }
  function storedMaster() {
    var v = null;
    try { v = MKEY && sessionStorage.getItem(MKEY); } catch (e) { /* storage blocked */ }
    if (!v) return Promise.reject();
    var o = JSON.parse(v), raws = {};
    Object.keys(o).forEach(function (t) { raws[t] = b64d(o[t]); });
    return useMasterRaws(raws);
  }
  // Sites built with remember:false keep the site key only for this tab (sessionStorage), never on the device.
  // remember:'nav' (taiwanmonitor.com) goes further: the key survives only clicks between this site's pages, so a
  // refresh, a typed or bookmarked URL, or arriving from another site always asks for the password again.
  var REMEMBER = !CFG || (CFG.remember !== false && CFG.remember !== 'nav');
  if (!REMEMBER) { try { localStorage.removeItem(KEYNAME); } catch (e) { /* storage blocked */ } }
  if (CFG && CFG.remember === 'nav') {
    var navType = '';
    try { navType = (performance.getEntriesByType('navigation')[0] || {}).type || ''; } catch (e) { /* old browser */ }
    var fromHere = false;
    try { fromHere = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { /* bad referrer */ }
    if (navType === 'reload' || (navType !== 'back_forward' && !fromHere)) {
      try { sessionStorage.removeItem(KEYNAME); if (MKEY) sessionStorage.removeItem(MKEY); } catch (e) { /* storage blocked */ }
    }
  }
  if (MKEY) { try { localStorage.removeItem(MKEY); } catch (e) { /* storage blocked */ } }
  // Drop any second-tier key saved by an earlier version of this gate.
  [KEYNAME2, KEYNAME3, KEYNAME4, KEYNAME5, KEYNAME6].forEach(function (n) { if (n) { try { localStorage.removeItem(n); sessionStorage.removeItem(n); } catch (e) { /* storage blocked */ } } });

  function startsWithMagic(buf, magic) {
    if (buf.length < magic.length) return false;
    for (var i = 0; i < magic.length; i++) if (buf[i] !== magic.charCodeAt(i)) return false;
    return true;
  }

  window.TSMVault = {
    ready: keyReady,
    /** Decrypt an encrypted ES module (data/*.js) and import it. baseUrl resolves its relative imports. */
    module: function (baseUrl, b64, gz, tier) {
      return (tier > 1 ? key2Now(tier) : keyReady).then(function (k) { return open(k, b64d(b64), gz); }).then(function (bytes) {
        var src = new TextDecoder().decode(bytes).replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]+)\2/g,
          function (m, pre, q, spec) { return pre + q + new URL(spec, baseUrl).href + q; });
        var url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        return import(url).finally(function () { URL.revokeObjectURL(url); });
      });
    },
    /** Decrypt a sealed blob (base64, gzip) with a password typed for `tier`. Rejects on a wrong password. */
    unsealWithPassword: function (b64, tier, pw) {
      return derive(pw, tier).then(function (raw) { return tryRaw(raw, tier); })
        .catch(function () { return tryMaster(pw).then(function (m) { return m[tier] || Promise.reject(); }); })
        .then(function (k) { return open(k, b64d(b64), true); })
        .then(function (bytes) { return new TextDecoder().decode(bytes); });
    },
    /** True when `slug` is in a tier whose key is published (no password needed). */
    isOpen: function (slug) { return [2, 3, 4, 5, 6].some(function (t) { return openTier(t) && TIERS[t].slugs.indexOf(slug) >= 0; }); },
    /** Attributes for a password box that browsers will not offer to save (used by the hub's section form too). */
    inputAttrs: function () { return NOSAVE; },
    /** Decrypt a sealed blob with the key this page was unlocked with (only on pages of that tier). */
    unseal: function (b64, tier) {
      return key2Now(tier).then(function (k) { return open(k, b64d(b64), true); }).then(function (bytes) { return new TextDecoder().decode(bytes); });
    },
    lock: function () {
      try { [KEYNAME, KEYNAME2, KEYNAME3, KEYNAME4, KEYNAME5, KEYNAME6, MKEY].forEach(function (n) { if (n) { localStorage.removeItem(n); sessionStorage.removeItem(n); } }); } catch (e) { /* storage blocked */ }
      location.reload();
    },
  };

  // Transparent decryption for fetched data files (json, csv, etc.).
  var nativeFetch = window.fetch.bind(window);
  var DATA_URL = /\/data\/|\/thumb\.png$/;
  window.fetch = function (input, init) {
    // Test the requested URL too: a data host (Hugging Face) redirects to a CDN URL without /data/ in it.
    var asked = typeof input === 'string' ? input : (input && input.url) || String(input);
    return nativeFetch(input, init).then(function (r) {
      if (!r.ok || !(DATA_URL.test(r.url || '') || DATA_URL.test(asked))) return r;
      return r.clone().arrayBuffer().then(function (ab) {
        var buf = new Uint8Array(ab);
        var tier = startsWithMagic(buf, MAGIC) ? 1 : startsWithMagic(buf, MAGIC2) ? 2 : startsWithMagic(buf, MAGIC3) ? 3 : startsWithMagic(buf, MAGIC4) ? 4 : startsWithMagic(buf, MAGIC5) ? 5 : startsWithMagic(buf, MAGIC6) ? 6 : 0;
        if (!tier) return r;
        return (tier > 1 ? key2Now(tier) : keyReady).then(function (k) { return open(k, b64d(new TextDecoder().decode(buf.subarray(MAGIC.length))), true); })
          .then(function (plain) { return new Response(plain, { status: 200, headers: r.headers }); },
            function () { return new Response(null, { status: 403, statusText: 'Locked' }); });
      });
    });
  };

  // A password box browsers will not offer to save: a text field drawn as dots where the browser supports that,
  // otherwise a password field marked as a new password. Password managers are told to ignore it.
  var NOSAVE = (window.CSS && CSS.supports && CSS.supports('-webkit-text-security', 'disc')
    ? 'type="text" style="-webkit-text-security:disc"' : 'type="password"')
    + ' autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other"'
    + ' name="tsm-' + Math.random().toString(36).slice(2) + '"';

  if (!CFG) { resolveKey(null); return; }

  // Hide the page until unlocked.
  var html = document.documentElement;
  html.classList.add('tsm-locked');
  var style = document.createElement('style');
  style.textContent = 'html.tsm-locked body>*:not(#tsm-gate){visibility:hidden!important}' +
    '#tsm-gate{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:#ffffff;color:#000000;font:15px/1.5 "Open Sans",Arial,sans-serif}' +
    '@media (prefers-color-scheme:dark){#tsm-gate{background:#0b1411;color:#dfe7e1}#tsm-gate .g-card{background:#111d18;border-color:#243129}#tsm-gate #g-pw{background:#0b1411;color:#dfe7e1;border-color:#243129}}' +
    '#tsm-gate .g-card{width:min(420px,100%);background:#ffffff;border:1px solid #dcd7ca;border-top:4px solid #e97132;border-radius:6px;padding:26px 24px 22px;display:flex;flex-direction:column;gap:12px}' +
    '#tsm-gate .g-brand{display:flex;align-items:center;gap:12px}#tsm-gate img{width:56px;height:56px}' +
    '#tsm-gate .g-org{margin:0;font:600 12px Figtree,"Open Sans",Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#005239}' +
    '#tsm-gate h1{margin:0;font:700 28px/1.05 Figtree,"Open Sans",Arial,sans-serif}#tsm-gate p{margin:0;color:#7f8a83;font-size:13.5px}' +
    '#tsm-gate form{display:flex;flex-direction:column;gap:10px}' +
    '#tsm-gate #g-pw{font:inherit;padding:10px 12px;border:1px solid #dcd7ca;border-radius:4px}' +
    '#tsm-gate input:focus-visible,#tsm-gate button:focus-visible{outline:2px solid #e97132;outline-offset:2px}' +
    '#tsm-gate button{font:600 14px inherit;padding:10px 14px;border-radius:4px;border:1px solid #005239;background:#005239;color:#ffffff;cursor:pointer}' +
    '#tsm-gate button:disabled{opacity:.6;cursor:wait}#tsm-gate label.g-rem{display:flex;gap:8px;align-items:center;font-size:13px;color:#7f8a83}' +
    '#tsm-gate .g-err{color:#b3261e;font-size:13px;min-height:1.3em}';
  document.head.appendChild(style);

  function reveal() { html.classList.remove('tsm-locked'); var g = document.getElementById('tsm-gate'); if (g) g.remove(); }
  function unlock2(key) { resolveKey2(key); reveal(); }
  function unlock(key) {
    resolveKey(key);
    if (!LOCKED_PAGE) { reveal(); return; }
    if (MASTER && MASTER[PAGE_TIER]) { unlock2(MASTER[PAGE_TIER]); return; }
    if (openTier(PAGE_TIER)) { openKey(PAGE_TIER).then(unlock2); return; }
    var g = document.getElementById('tsm-gate'); if (g) g.remove();
    if (document.body) showGate(PAGE_TIER); else document.addEventListener('DOMContentLoaded', function () { showGate(PAGE_TIER); });
  }

  function showGate(tier) {
    tier = tier > 1 && TIERS[tier] ? tier : 1;
    var g = document.createElement('div');
    g.id = 'tsm-gate';
    g.setAttribute('role', 'dialog');
    g.setAttribute('aria-modal', 'true');
    g.setAttribute('aria-labelledby', 'g-title');
    g.innerHTML = '<div class="g-card"><div class="g-brand"><img src="' + ROOT + 'shared/assets/tsm-logo.png" alt="">' +
      '<div><p class="g-org">Taiwan Security Monitor</p><h1 id="g-title">TSM Interactive</h1></div></div>' +
      (tier > 1 ? '<p><b>' + (TIERS[tier].name || 'This section') + '</b> is password protected. Enter the password to continue.</p>'
        : '<p>This site is for invited readers. Enter the access password to continue.</p>') +
      '<form autocomplete="off"><input ' + NOSAVE + ' id="g-pw" aria-label="Access password" placeholder="Access password" required>' +
      (tier > 1 || !REMEMBER ? '' : '<label class="g-rem"><input type="checkbox" id="g-rem" checked> Remember on this device</label>') +
      '<button type="submit" id="g-go">Unlock</button><div class="g-err" id="g-err" aria-live="polite"></div></form></div>';
    document.body.appendChild(g);
    var pw = g.querySelector('#g-pw'), go = g.querySelector('#g-go'), err = g.querySelector('#g-err');
    pw.focus();
    g.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      go.disabled = true; go.textContent = 'Checking\u2026'; err.textContent = '';
      var typed = pw.value;
      derive(typed, tier).then(function (raw) {
        return tryRaw(raw, tier).then(function (k) {
          if (tier === 1) { try { (REMEMBER && g.querySelector('#g-rem').checked ? localStorage : sessionStorage).setItem(KEYNAME, b64e(raw)); } catch (e2) { /* storage blocked */ } }
          (tier > 1 ? unlock2 : unlock)(k);
        });
      }).catch(function () {
        // Not this prompt's password: maybe the master password, which opens every tier for this tab.
        return tryMaster(typed).then(function (m) {
          if (tier === 1) unlock(m[1] || null); else unlock2(m[tier]);
        });
      }).catch(function () {
        go.disabled = false; go.textContent = 'Unlock';
        err.textContent = 'That password is not right. Check it and try again.';
        pw.select();
      });
    });
  }

  // Public builds (CFG.open, jwalberg.com/narratives/) have no site password: only extra-tier pages ask for one.
  var ask = function () { if (document.body) showGate(1); else document.addEventListener('DOMContentLoaded', function () { showGate(1); }); };
  storedMaster().then(function (m) {
    if (CFG.open) unlock(null); else if (m[1]) unlock(m[1]); else return Promise.reject();
  }).catch(function () {
    if (CFG.open) { unlock(null); return; }
    storedKey(KEYNAME, 1).then(unlock, ask);
  });
})();
