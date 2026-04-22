// Failsafe: Force hide the overlay after 6 seconds no matter what happens
setTimeout(() => {
  const o = document.getElementById('loadingOverlay');
  if (o) { o.style.opacity = '0'; setTimeout(() => o.remove(), 500); }
}, 6000);

// =========================================================================
// STATIC FALLBACK DATA — VERIFIED PIXEL-PERFECT SNAPSHOT
// Extracted directly from courtyard.io/marketplace on April 22, 2026.
// =========================================================================
const FALLBACK_CARDS = [
  { name: "2024 Panini Prizm #249 Zach Edey - Basketball Prizm", grade: "PSA 9 MINT", list: 25.75, fmv: 37.20, cat: "Sports", badge: -31 },
  { name: "2020 Panini Chronicles Playoff Momentum Rookies #M1 Joe Burrow", grade: "PSA 9 MINT", list: 12.01, fmv: 16.40, cat: "Sports", badge: -27 },
  { name: "1987 Topps #177 Steve Largent", grade: "PSA 10 GEM MINT", list: 40.75, fmv: 47.60, cat: "Sports", badge: -14 },
  { name: "Pokémon Japanese Strength Expansion Pack: Incandescent Arcana", grade: "Pack", list: 9.00, fmv: 11.30, cat: "Pokemon", badge: -20 },
  { name: "2020 Bowman Chrome Mega Box #BCP8 Jasson Dominguez", grade: "PSA 10 GEM MINT", list: 31.50, fmv: 42.10, cat: "Sports", badge: -25 },
  { name: "2024 Panini Contenders #151 Dillon Johnson - Autograph", grade: "PSA 9 MINT", list: 7.50, fmv: 8.20, cat: "Sports", badge: -9 },
  { name: "2025 Pokémon Sv11w-White Flare #087 Sewaddle - Art Rare", grade: "PSA 10 GEM MINT", list: 45.00, fmv: 47.20, cat: "Pokemon" },
  { name: "2000 Team Rocket #11 Dark Magneton - Holo", grade: "PSA 9 MINT", list: 220.00, fmv: 247.00, cat: "Pokemon", badge: -11 },
  { name: "1999 Pokémon #15 Bisaflor - 1st Edition Holo", grade: "PSA 9 MINT", list: 850.00, fmv: 940.00, cat: "Pokemon", badge: -10 },
  { name: "2021 Bowman Chrome Prospect Autographs #CPABR Bryan Ramos", grade: "PSA 10 GEM MT", list: 30.00, fmv: 41.50, cat: "Sports", badge: -28 },
  { name: "2023 Pokémon Sv1v-Violet EX #082 Slowpoke - Art Rare", grade: "PSA 10 GEM MINT", list: 58.00, fmv: 55.50, cat: "Pokemon" },
  { name: "2018 Topps Heritage #580 Ronald Acuna Jr.", grade: "PSA 10 GEM MINT", list: 42.25, fmv: 44.40, cat: "Sports", badge: -5 },
  { name: "2024 Pokémon SV8-Super Electric Breaker #113 Stunfisk - Art Rare", grade: "PSA 10", list: 48.00, fmv: 20.90, cat: "Pokemon" },
  { name: "2025 Pokémon Sv11w-White Flare #102 Oshawott - Art Rare", grade: "PSA 10 GEM MINT", list: 78.00, fmv: 85.50, cat: "Pokemon", badge: -9 },
  { name: "2022 Panini Prizm #309 Garrett Wilson - Green Prizm", grade: "PSA 10 GEM MINT", list: 40.00, fmv: 55.90, cat: "Sports", badge: -28 },
  { name: "1971 Topps #601 Ken Tatum", grade: "PSA 8 NM-MT", list: 22.00, fmv: 23.60, cat: "Sports", badge: -7 },
  { name: "2009 Topps Mayo #187 Matthew Stafford", grade: "PSA 9 MINT", list: 36.00, fmv: 46.30, cat: "Sports", badge: -22 },
  { name: "1999 Fossil #46/62 Ekans", grade: "CGC 5 EX", list: 11.00, fmv: 11.90, cat: "Pokemon", badge: -8 },
  { name: "2019 Panini Prizm Sensational Swatches #RJB RJ Barrett - Orange Ice", grade: "PSA 10", list: 26.00, fmv: 32.20, cat: "Sports", badge: -19 },
  { name: "1999 Pokémon Game Promo #50 Kabuto - Top Deck Magazine", grade: "PSA 10", list: 70.00, fmv: 68.30, cat: "Pokemon" },
  { name: "2025 Mega Evolution MEG EN #150/132 Steelix - Illustration Rare", grade: "CGC 10", list: 75.00, fmv: 48.60, cat: "Pokemon" },
  { name: "2007 Diamond & Pearl #6 Lucario - Holo", grade: "CGC 8.5 NM-MT+", list: 110.00, fmv: 143.60, cat: "Pokemon", badge: -23 },
  { name: "2020 Panini Mosaic #209 Justin Jefferson - Camo Pink", grade: "PSA 9 MINT", list: 32.00, fmv: 41.70, cat: "Sports", badge: -23 },
  { name: "2023 Panini Prizm Deep Space #2 Brandon Miller - Green Prizm", grade: "PSA 10 GEM MT", list: 27.00, fmv: 32.80, cat: "Sports", badge: -18 },
  { name: "2024 Upper Deck #470 Jackson Blake", grade: "PSA 10 GEM MINT", list: 69.00, fmv: 86.30, cat: "Sports", badge: -20 },
  { name: "2004 EX Fire Red & Leaf Green #53/112 Bellsprout - Reverse Holo", grade: "CGC 7.5", list: 125.00, fmv: 183.75, cat: "Pokemon" },
  { name: "2015 Panini Select #136 Karl-Anthony Towns - Silver Prizm", grade: "PSA 9 MINT", list: 37.00, fmv: 42.20, cat: "Sports", badge: -12 },
  { name: "1986 Fleer Sticker #10 Isiah Thomas", grade: "PSA 5 EX", list: 27.00, fmv: 37.30, cat: "Sports", badge: -28 },
  { name: "2017 Pokémon SM Black Star Promo #SM77 Mewtwo - Holo Shining", grade: "PSA 10", list: 50.00, fmv: 58.00, cat: "Pokemon", badge: -14 },
  { name: "2023 Scarlet & Violet 151 MEW #085/165 Dodrio - Holo", grade: "CGC 10 GEM MINT", list: 24.00, fmv: 27.80, cat: "Pokemon", badge: -14 },
  { name: "1999 Base Set #18 Dragonair - 1st Edition Shadowless", grade: "PSA 8 NM-MT", list: 310.00, fmv: 340.00, cat: "Pokemon" },
  { name: "2021 Pokémon Sword & Shield Fusion Strike #266 Inteleon Vmax - Full Art", grade: "PSA 10", list: 80.00, fmv: 80.30, cat: "Pokemon" },
  { name: "2024 Pokémon SVP EN-SV Black Star Promo #165 Terapagos EX - Holo", grade: "PSA 10", list: 70.00, fmv: 74.50, cat: "Pokemon", badge: -6 },
  { name: "2024 Topps Chrome Update #USC37 Wyatt Langford - Refractor", grade: "PSA 10 GEM MT", list: 75.00, fmv: 99.00, cat: "Sports", badge: -24 },
  { name: "1971 Topps #114 Willie Lanier", grade: "PSA 7 NM", list: 48.00, fmv: 56.90, cat: "Sports", badge: -16 },
  { name: "1961 Fleer #11 Walter Dukes", grade: "PSA 6 EX-MT", list: 65.00, fmv: 81.20, cat: "Sports", badge: -20 },
  { name: "2000 Gold, Silver, to a New World Energy Charge", grade: "CGC 10 GEM MINT", list: 110.00, fmv: 162.50, cat: "Pokemon", badge: -32 },
];

// =========================================================================
// LIVE DATA FETCH — Pulls from Mac Mini scraper via Cloudflare tunnel
// Falls back to static snapshot if API is unreachable
// =========================================================================
const API_URL = 'https://oracle.the-undesirables.com/api/v1/courtyard/listings';

// Show loading state
document.getElementById('countBadge').textContent = 'Connecting to scanner...';

async function loadData() {
  let CARDS = [];
  let scannedAt = null;
  let fromApi = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (resp.ok) {
      const data = await resp.json();
      if (data.cards && data.cards.length > 0) {
        CARDS = data.cards.map(c => ({
          name: c.name,
          grade: c.grade || 'N/A',
          list: c.list,
          fmv: c.fmv,
          cat: c.cat || 'Other',
          image: c.image || null,
          set: c.set || '',
          year: c.year || null,
          collection: c.collection || '',
          signal: c.signal || 'FAIR',
        }));
        scannedAt = data.scanned_at;
        fromApi = true;
      }
    }
  } catch (e) {
    console.warn('[SCANNER] API unreachable, using static fallback:', e.message);
  }

  // If fetch failed or returned nothing, use the fallback data
  if (CARDS.length === 0) {
    CARDS = FALLBACK_CARDS;
  }

  // Filter out cards without both prices
  const VALID = CARDS.filter(c => c.list !== null && c.fmv !== null && c.fmv > 0);

  // Compute deltas
  VALID.forEach(c => {
    c.delta = ((c.list - c.fmv) / c.fmv * 100);
    c.savings = c.fmv - c.list;
  });
  VALID.sort((a, b) => a.delta - b.delta);

  // Stats
  const underpriced = VALID.filter(c => c.delta < -5);
  const overpriced = VALID.filter(c => c.delta > 5);
  const fair = VALID.filter(c => Math.abs(c.delta) <= 5);
  const avgDiscount = VALID.length > 0 ? (VALID.reduce((s, c) => s + c.delta, 0) / VALID.length) : 0;
  const totalSavings = underpriced.reduce((s, c) => s + c.savings, 0);
  const pokemonCount = VALID.filter(c => c.cat === "Pokemon").length;
  const sportsCount = VALID.filter(c => c.cat === "Sports").length;

  // Format "last scanned" time
  let scanLabel = 'Static snapshot';
  if (scannedAt) {
    const scanDate = new Date(scannedAt);
    const hoursAgo = Math.round((Date.now() - scanDate.getTime()) / 3600000);
    scanLabel = hoursAgo < 1 ? 'Live — scanned just now' : `Live — scanned ${hoursAgo}h ago`;
  }

  const sourceTag = fromApi ? `🟢 ${scanLabel}` : '🟡 Static fallback';
  document.getElementById('countBadge').textContent =
    `${VALID.length} listings · ${underpriced.length} underpriced · ${sourceTag}`;

  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card"><div class="val green">${underpriced.length}</div><div class="label">Underpriced</div></div>
    <div class="stat-card"><div class="val red">${overpriced.length}</div><div class="label">Overpriced</div></div>
    <div class="stat-card"><div class="val cyan">${fair.length}</div><div class="label">Fair Value</div></div>
    <div class="stat-card"><div class="val gold">${avgDiscount.toFixed(1)}%</div><div class="label">Avg Delta</div></div>
    <div class="stat-card"><div class="val green">$${totalSavings.toFixed(0)}</div><div class="label">Total Savings</div></div>
    <div class="stat-card"><div class="val purple">${pokemonCount}/${sportsCount}</div><div class="label">Pokémon / Sports</div></div>
  `;

  return { VALID, underpriced, overpriced, fair };
}

// Boot the visualization
loadData().then(({ VALID }) => {
  // Fade out loading screen
  const overlay = document.getElementById('loadingOverlay');
  overlay.style.opacity = '0';
  setTimeout(() => overlay.remove(), 500);

  renderBarChart(VALID);
  renderScatter(VALID);
  startParticles();
  startClock();
});

function renderBarChart(VALID) {
if (VALID.length === 0) return;

// Bar chart
const barChart = document.getElementById('barChart');
const maxAbsDelta = Math.max(...VALID.map(c => Math.abs(c.delta)));

VALID.forEach((c, i) => {
  const pct = Math.min(100, (Math.abs(c.delta) / maxAbsDelta) * 100);
  const cls = c.delta < -5 ? 'undervalued' : c.delta > 5 ? 'overvalued' : 'neutral';
  const deltaStr = c.delta > 0 ? `+${c.delta.toFixed(0)}%` : `${c.delta.toFixed(0)}%`;
  const isHighlight = c.delta < -20;

  const catEmoji = c.cat === 'Pokemon' ? '⚡' : c.cat === 'Sports' ? '🏈' : c.cat === 'MTG' ? '🧙' : '🃏';

  const row = document.createElement('div');
  row.className = `bar-row${isHighlight ? ' highlight' : ''}`;
  row.innerHTML = `
    <span class="bar-category" title="${c.cat}">${catEmoji}</span>
    <span class="bar-label">${c.name}</span>
    <span class="bar-grade">${c.grade}</span>
    <div class="bar-track">
      <div class="bar-fill ${cls}" style="width: 0%">${deltaStr}</div>
    </div>
    <div class="bar-prices">
      <span class="list">$${c.list.toFixed(c.list < 10 ? 2 : 0)}</span>
      <span class="fmv">FMV $${c.fmv.toFixed(c.fmv < 10 ? 2 : 0)}</span>
      <span class="delta ${c.delta < -5 ? 'green' : c.delta > 5 ? 'red' : ''}">${deltaStr}</span>
    </div>
  `;

  row.addEventListener('mouseenter', (e) => showTooltip(e, c));
  row.addEventListener('mouseleave', hideTooltip);
  barChart.appendChild(row);

  setTimeout(() => {
    row.querySelector('.bar-fill').style.width = `${pct}%`;
  }, 80 + i * 30);
});
} // end renderBarChart

function renderScatter(VALID) {
if (VALID.length === 0) return;

// Scatter plot
const canvas = document.getElementById('scatterCanvas');
const ctx = canvas.getContext('2d');
const dpr = window.devicePixelRatio || 1;

function drawScatter() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const pad = { top: 30, right: 30, bottom: 50, left: 65 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  let maxPrice = Math.max(...VALID.map(c => Math.max(c.list, c.fmv))) * 1.1;
  if (!isFinite(maxPrice) || maxPrice === 0) maxPrice = 100;

  ctx.clearRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = pad.top + (plotH / 5) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    const x = pad.left + (plotW / 5) * i;
    ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + plotH); ctx.stroke();

    ctx.fillStyle = '#444';
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    const yVal = maxPrice - (maxPrice / 5) * i;
    ctx.fillText(`$${yVal.toFixed(0)}`, pad.left - 8, y + 3);
    ctx.textAlign = 'center';
    const xVal = (maxPrice / 5) * i;
    ctx.fillText(`$${xVal.toFixed(0)}`, x, h - pad.bottom + 18);
  }

  // Fair value line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + plotH);
  ctx.lineTo(pad.left + plotW, pad.top);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '10px Inter';
  ctx.save();
  ctx.translate(pad.left + plotW * 0.65, pad.top + plotH * 0.3);
  ctx.rotate(-Math.atan(plotH / plotW));
  ctx.fillText('Fair Value (List = FMV)', 0, 0);
  ctx.restore();

  // Dots
  VALID.forEach(c => {
    const x = pad.left + (c.fmv / maxPrice) * plotW;
    const y = pad.top + plotH - (c.list / maxPrice) * plotH;
    const r = Math.max(4, Math.min(14, Math.sqrt(c.fmv) / 2));

    const isUnder = c.delta < -5;
    const isOver = c.delta > 5;

    // Glow for strong signals
    if (isUnder && c.delta < -20) {
      ctx.beginPath();
      ctx.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(57, 255, 20, 0.08)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = isUnder ? 'rgba(57, 255, 20, 0.55)' : isOver ? 'rgba(239, 68, 68, 0.55)' : 'rgba(100, 100, 100, 0.4)';
    ctx.fill();
    ctx.strokeStyle = isUnder ? '#39ff14' : isOver ? '#ef4444' : '#555';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Axes labels
  ctx.fillStyle = '#666';
  ctx.font = '11px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('Fair Market Value (FMV) →', pad.left + plotW / 2, h - 8);
  ctx.save();
  ctx.translate(14, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('List Price →', 0, 0);
  ctx.restore();
}

drawScatter();
window.addEventListener('resize', drawScatter);

// Animated scatter - pulsing glow rings
let scatterFrame = 0;
function animateScatter() {
  scatterFrame++;
  if (scatterFrame % 3 === 0) { // Throttle to ~20fps
    drawScatter();
    // Draw pulsing rings on strong buys
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const pad = { top: 30, right: 30, bottom: 50, left: 65 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const maxPrice = Math.max(...VALID.map(c => Math.max(c.list, c.fmv))) * 1.1;
    const t = Date.now() / 1000;

    VALID.filter(c => c.delta < -20).forEach(c => {
      const x = pad.left + (c.fmv / maxPrice) * plotW;
      const y = pad.top + plotH - (c.list / maxPrice) * plotH;
      const pulseR = 12 + Math.sin(t * 2) * 4;
      const alpha = 0.12 + Math.sin(t * 2) * 0.06;
      ctx.beginPath();
      ctx.arc(x, y, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(57, 255, 20, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }
  requestAnimationFrame(animateScatter);
}
animateScatter();
} // end renderScatter

// Tooltip
const tooltip = document.getElementById('tooltip');
function showTooltip(e, c) {
  document.getElementById('ttName').textContent = c.name;
  document.getElementById('ttList').textContent = `$${c.list.toFixed(2)}`;
  document.getElementById('ttFmv').textContent = `$${c.fmv.toFixed(2)}`;
  const deltaEl = document.getElementById('ttDelta');
  deltaEl.textContent = `${c.delta > 0 ? '+' : ''}${c.delta.toFixed(1)}%`;
  deltaEl.style.color = c.delta < -5 ? '#39ff14' : c.delta > 5 ? '#ef4444' : '#aaa';
  document.getElementById('ttGrade').textContent = c.grade;
  document.getElementById('ttCat').textContent = c.cat;

  const verdict = document.getElementById('ttVerdict');
  if (c.delta < -20) {
    verdict.textContent = `🟢 STRONG BUY — Save $${c.savings.toFixed(2)}`;
    verdict.style.color = '#39ff14';
  } else if (c.delta < -5) {
    verdict.textContent = `🟡 UNDERVALUED — Save $${c.savings.toFixed(2)}`;
    verdict.style.color = '#fbbf24';
  } else if (c.delta > 20) {
    verdict.textContent = `🔴 SIGNIFICANTLY OVERPRICED`;
    verdict.style.color = '#ef4444';
  } else if (c.delta > 5) {
    verdict.textContent = `🟠 OVERPRICED — Overpaying $${Math.abs(c.savings).toFixed(2)}`;
    verdict.style.color = '#f97316';
  } else {
    verdict.textContent = `⚪ FAIR VALUE`;
    verdict.style.color = '#888';
  }

  tooltip.style.left = Math.min(e.clientX + 15, window.innerWidth - 320) + 'px';
  tooltip.style.top = (e.clientY - 10) + 'px';
  tooltip.classList.add('visible');
}
function hideTooltip() {
  tooltip.classList.remove('visible');
}

function startParticles() {
// =========== PARTICLE SYSTEM ===========
const pCanvas = document.getElementById('particles');
const pCtx = pCanvas.getContext('2d');
let particles = [];
function resizeParticles() {
  pCanvas.width = window.innerWidth;
  pCanvas.height = window.innerHeight;
}
resizeParticles();
window.addEventListener('resize', resizeParticles);

for (let i = 0; i < 60; i++) {
  particles.push({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    r: Math.random() * 1.5 + 0.5,
    alpha: Math.random() * 0.25 + 0.05,
    color: Math.random() > 0.7 ? '57,255,20' : Math.random() > 0.5 ? '0,229,255' : '168,85,247'
  });
}

function drawParticles() {
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = pCanvas.width;
    if (p.x > pCanvas.width) p.x = 0;
    if (p.y < 0) p.y = pCanvas.height;
    if (p.y > pCanvas.height) p.y = 0;

    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    pCtx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
    pCtx.fill();
  });

  // Draw faint connections
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        pCtx.beginPath();
        pCtx.moveTo(particles[i].x, particles[i].y);
        pCtx.lineTo(particles[j].x, particles[j].y);
        pCtx.strokeStyle = `rgba(57, 255, 20, ${0.03 * (1 - dist / 120)})`;
        pCtx.lineWidth = 0.5;
        pCtx.stroke();
      }
    }
  }
  requestAnimationFrame(drawParticles);
}
drawParticles();
} // end startParticles

// =========== ANIMATED NUMBER COUNTERS ===========
function animateValue(el, end, duration, prefix = '', suffix = '') {
  const start = 0;
  const startTime = Date.now();
  function update() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.round(start + (end - start) * eased);
    el.textContent = prefix + current + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  update();
}

// Animate stat cards after a brief delay
setTimeout(() => {
  const vals = document.querySelectorAll('.stat-card .val');
  vals.forEach((el, i) => {
    el.style.setProperty('--i', i);
  });
}, 200);

function startClock() {
// =========== LIVE CLOCK TICKER ===========
function updateClock() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const s = now.getSeconds().toString().padStart(2, '0');
  document.getElementById('liveClock').textContent = `${h}:${m}:${s} LOCAL`;
}
updateClock();
setInterval(updateClock, 1000);
} // end startClock
