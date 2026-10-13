// One-click PDF: each Letter sheet is rendered with html2canvas and placed on a jsPDF page,
// with the sheet's links re-created as clickable PDF link areas. Libraries load from cdnjs,
// pinned and integrity-checked, only when the reader asks for a PDF.
const LIBS = [
  { src: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    sri: 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H', ok: () => window.html2canvas },
  { src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    sri: 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk', ok: () => window.jspdf },
];
const PAGE_PT = [612, 792]; // US Letter in points
const SHEET_PX = 816;

let loading = null;
function loadLibs() {
  return loading ||= Promise.all(LIBS.map(l => l.ok() ? null : new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = l.src; s.integrity = l.sri; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
    s.onload = res;
    s.onerror = () => rej(new Error('Could not load ' + l.src));
    document.head.appendChild(s);
  }))).catch(e => { loading = null; throw e; });
}

const SVG_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor'];

/** html2canvas draws inline SVG as an image, without page CSS; copy computed styles inline first. */
function inlineSvgStyles(root) {
  const undo = [];
  root.querySelectorAll('svg, svg *').forEach(el => {
    const cs = getComputedStyle(el), prev = el.getAttribute('style');
    undo.push([el, prev]);
    el.setAttribute('style', SVG_PROPS.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';') + (prev ? ';' + prev : ''));
  });
  return () => undo.forEach(([el, prev]) => prev == null ? el.removeAttribute('style') : el.setAttribute('style', prev));
}

/**
 * @param {HTMLElement[]} sheets
 * @param {{title: string, file: string, onProgress?: (i: number, n: number) => void}} opt
 */
export async function downloadPdf(sheets, { title, file, onProgress }) {
  await loadLibs();
  await document.fonts.ready;
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true });
  pdf.setProperties({ title, subject: 'Taiwan Security Monitor briefing packet', creator: 'TSM Interactive, Briefing Packet Builder', author: 'Taiwan Security Monitor' });
  document.body.classList.add('capturing');
  const restore = sheets.map(inlineSvgStyles);
  const k = PAGE_PT[0] / SHEET_PX;
  try {
    for (let i = 0; i < sheets.length; i++) {
      onProgress?.(i + 1, sheets.length);
      const s = sheets[i];
      const bg = getComputedStyle(s).backgroundColor;
      const canvas = await window.html2canvas(s, { scale: 2, backgroundColor: bg, logging: false, useCORS: true,
        windowWidth: 1280, scrollX: 0, scrollY: -window.scrollY });
      if (i) pdf.addPage('letter', 'portrait');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, PAGE_PT[0], PAGE_PT[1], undefined, 'FAST');
      const box = s.getBoundingClientRect();
      s.querySelectorAll('a[href^="http"]').forEach(a => {
        for (const r of a.getClientRects()) {
          pdf.link((r.left - box.left) * k, (r.top - box.top) * k, r.width * k, r.height * k, { url: a.href });
        }
      });
    }
  } finally {
    restore.forEach(f => f());
    document.body.classList.remove('capturing');
  }
  pdf.save(`TSM-briefing-packet_${file}.pdf`);
}
