import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts';
import { ShieldAlert, Cpu, TrendingUp, Zap, AlertTriangle } from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// STOCHASTIC SIMULATION ENGINE (Ported from Shroomy Simulator)
// Models: GBM, Merton Jump-Diffusion, Heston SV, Kou Double-Exp
// ═══════════════════════════════════════════════════════════

function boxMuller() {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 0.0001))) * Math.cos(2 * Math.PI * u2);
}

const HESTON_PARAMS = {
  conservative: { kappa: 3.0, theta: 0.0016, xi: 0.1, rho: -0.2 },
  moderate:     { kappa: 2.5, theta: 0.0049, xi: 0.3, rho: -0.5 },
  aggressive:   { kappa: 2.0, theta: 0.0121, xi: 0.8, rho: -0.7 },
};

const KOU_PARAMS = {
  conservative: { p: 0.5, eta1: 25, eta2: 25 },
  moderate:     { p: 0.4, eta1: 10, eta2: 10 },
  aggressive:   { p: 0.3, eta1: 5,  eta2: 3  },
};

function runSimulation({ startPrice, days, mu, sigma, model, risk, numSims = 200 }) {
  const paths = [];
  const hestonCfg = HESTON_PARAMS[risk] || HESTON_PARAMS.moderate;
  const kouCfg = KOU_PARAMS[risk] || KOU_PARAMS.moderate;
  const jumpLambda = risk === 'aggressive' ? 0.08 : risk === 'conservative' ? 0.02 : 0.05;

  for (let sim = 0; sim < numSims; sim++) {
    const path = [startPrice];
    let v_t = sigma * sigma; // Heston variance process

    for (let day = 1; day <= days; day++) {
      const z1 = boxMuller();
      let stepVol = sigma;
      let logMove = mu + stepVol * z1;

      // ── Heston Stochastic Volatility ──
      if (model === 'heston' || model === 'kou') {
        stepVol = Math.sqrt(Math.max(0, v_t));
        logMove = mu + stepVol * z1;

        // Correlated Z2 for variance process
        const z_ind = boxMuller();
        const z2 = hestonCfg.rho * z1 + Math.sqrt(1 - hestonCfg.rho * hestonCfg.rho) * z_ind;

        // Euler discretization: dv = κ(θ - v)dt + ξ√v dW₂
        const vDrift = hestonCfg.kappa * (hestonCfg.theta - Math.max(0, v_t));
        const vDiff = hestonCfg.xi * Math.sqrt(Math.max(0, v_t)) * z2;
        v_t = Math.max(0, v_t + vDrift + vDiff);
      }

      // ── Jump Component ──
      if ((model === 'merton' || model === 'kou') && Math.random() < jumpLambda) {
        if (model === 'kou') {
          // Kou Double-Exponential (Asymmetric)
          const isUp = Math.random() < kouCfg.p;
          const x = -Math.log(Math.random()) / (isUp ? kouCfg.eta1 : kouCfg.eta2);
          logMove += isUp ? x : -x;
        } else {
          // Merton: Normal(0, 10%) symmetric jump
          logMove += 0.10 * boxMuller();
        }
      }

      const nextPrice = path[day - 1] * Math.exp(logMove);
      path.push(Math.max(nextPrice, 0.001));
    }
    paths.push(path);
  }

  // Compute percentile bands
  const result = [];
  for (let day = 0; day <= days; day++) {
    const pricesAtDay = paths.map(p => p[day]).sort((a, b) => a - b);
    const len = pricesAtDay.length;
    result.push({
      day: `D${day}`,
      p5:   pricesAtDay[Math.floor(len * 0.05)],
      p25:  pricesAtDay[Math.floor(len * 0.25)],
      mean: pricesAtDay.reduce((a, b) => a + b, 0) / len,
      p75:  pricesAtDay[Math.floor(len * 0.75)],
      p95:  pricesAtDay[Math.floor(len * 0.95)],
    });
  }

  // Win probability (final > start)
  const wins = paths.filter(p => p[days] > startPrice).length;
  const winPct = Math.round((wins / numSims) * 100);
  
  // Expected return
  const avgFinal = paths.reduce((a, p) => a + p[days], 0) / numSims;
  const expectedReturn = ((avgFinal - startPrice) / startPrice * 100).toFixed(1);

  return { data: result, winPct, expectedReturn, paths };
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

const MODEL_LABELS = {
  gbm:    { name: 'GBM', desc: 'Geometric Brownian Motion', color: '#22c55e', tooltip: 'Classic random walk model. Assumes price changes follow a normal distribution with constant drift and volatility. Good baseline but doesn\'t capture real-world jumps or crashes.' },
  merton: { name: 'Merton', desc: 'Jump-Diffusion (1976)', color: '#3b82f6', tooltip: 'Adds sudden price jumps (spikes/crashes) to the random walk. Captures rare events like a card going viral or getting reprinted. More realistic for collectibles.' },
  heston: { name: 'Heston', desc: 'Stochastic Volatility', color: '#a855f7', tooltip: 'Volatility itself changes over time — not constant. Models the "fear cycles" in markets where uncertainty feeds more uncertainty. Best for longer hold periods.' },
  kou:    { name: 'Kou', desc: 'Double-Exp + Heston', color: '#f59e0b', tooltip: 'Combines Heston\'s changing volatility with asymmetric jumps — big pumps are less likely than drops. Most realistic model for TCG speculation. High computation.' },
};

export default function TCGGradeCard({ content, cardImages = [] }) {
  const [hoveredModel, setHoveredModel] = useState(null);
  const [simData, setSimData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [model, setModel] = useState('merton');
  const [risk, setRisk] = useState('moderate');
  const [simStats, setSimStats] = useState({ winPct: 0, expectedReturn: '0' });
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  
  let report = {};
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      report = parsed.report || {};
    } catch (e) {
      return <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-xl">Error parsing TCG payload</div>;
    }
  } else {
    report = content.report || content || {};
  }
  
  // Unwrap double-nested report
  if (report.report && report.report.overall_grade) {
    report = report.report;
  }
  
  const cScore = report.centering?.score || 0;
  const eScore = report.edges?.score || 0;
  const corScore = report.corners?.score || 0;
  const sScore = report.surface?.score || 0;
  const overall = report.overall_grade || 0;
  
  const isGem = overall >= 9.5;
  const isMint = overall >= 8.5 && overall < 9.5;
  const isExcellent = overall >= 7.5;
  const labelColor = isGem ? "text-yellow-400" : isMint ? "text-red-400" : isExcellent ? "text-emerald-400" : "text-zinc-400";
  const glowBorder = isGem ? "border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)]" : 
                     isMint ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]" : 
                     "border-white/10 shadow-lg shadow-black/50";

  const runSim = useCallback(async () => {
    setIsLoading(true);
    
    // === REALISTIC PRICING ===
    // Priority: RAG empirical data → TCGCSV lookup → conservative baseline
    let basePrice = null;
    let priceSource = 'Synthetic Baseline';

    // 1. Try RAG empirical data (from sqlite oracle)
    const empMu = report.market_physics?.mu_driven;
    const empSigma = report.market_physics?.sigma_driven;
    
    if (empMu != null && !isNaN(parseFloat(empMu))) {
      // We have oracle data — try to get last_price too
      priceSource = 'TCGCSV Oracle';
    }

    // 2. Try fetching from Pokémon TCG API
    if (!basePrice) {
      try {
        const cardName = ((report.card_identified || '').split('-')[0]).trim();
        if (cardName && cardName !== 'Unknown Card') {
          const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${cardName}"&pageSize=5`);
          const data = await res.json();
          if (data.data && data.data.length > 0) {
            const match = data.data.find(c => c.tcgplayer?.prices);
            if (match) {
              const prices = match.tcgplayer.prices?.holofoil || match.tcgplayer.prices?.normal || match.tcgplayer.prices?.['1stEditionHolofoil'];
              if (prices) {
                basePrice = prices.market || prices.mid || prices.low || null;
                if (basePrice) priceSource = 'TCGPlayer Market';
              }
            }
          }
        }
      } catch (e) {
        console.warn('Pricing API unavailable, using baseline.');
      }
    }

    // 3. Realistic fallback based on grade (most common cards are worth very little)
    if (!basePrice) {
      if (overall >= 9.5) basePrice = 5.00;       // Even a Gem Mint common is ~$5
      else if (overall >= 8) basePrice = 1.50;     // NM-MT common
      else if (overall >= 6) basePrice = 0.50;     // EX-MT common
      else basePrice = 0.10;                        // Low grade common = basically bulk
      priceSource = `Est. Grade-Based ($${basePrice.toFixed(2)} common baseline)`;
    }
    
    const mu_raw = (empMu != null && !isNaN(parseFloat(empMu))) ? parseFloat(empMu) : (overall >= 9 ? 0.02 : overall >= 7 ? 0.005 : -0.02);
    const sigma_raw = (empSigma != null && !isNaN(parseFloat(empSigma))) ? Math.max(0.02, parseFloat(empSigma)) : (overall >= 9 ? 0.12 : 0.06);
    
    // Scale to daily
    const mu = (mu_raw - (sigma_raw * sigma_raw) / 2) * (1 / 365);
    const sigma = sigma_raw * Math.sqrt(1 / 365);

    const result = runSimulation({
      startPrice: basePrice,
      days: 30,
      mu,
      sigma,
      model,
      risk,
      numSims: 200,
    });

    setSimData(result.data);
    setSimStats({ winPct: result.winPct, expectedReturn: result.expectedReturn, priceSource, startPrice: basePrice });
    setIsLoading(false);
  }, [overall, isGem, isMint, report.card_identified, model, risk]);

  useEffect(() => { runSim(); }, [runSim]);

  const ScoreBar = ({ label, score, notes }) => (
    <div className="flex flex-col mb-3 relative z-10 group">
      <div className="flex justify-between items-center text-[10px] font-bold tracking-wider text-zinc-400 mb-1">
        <span className="uppercase">{label}</span>
        <span className={`${
          score >= 9.5 ? 'text-yellow-400' : score >= 8.5 ? 'text-emerald-400' : score >= 7 ? 'text-white' : score >= 5 ? 'text-orange-400' : 'text-red-400'
        }`}>{Number(score).toFixed(1)}</span>
      </div>
      <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
        <div 
          className={`h-full bg-gradient-to-r transition-all duration-1000 ease-out ${
            score >= 9.5 ? 'from-yellow-600 to-yellow-400' : 
            score >= 8.5 ? 'from-emerald-700 to-emerald-400' :
            score >= 7 ? 'from-blue-600 to-blue-400' :
            score >= 5 ? 'from-orange-700 to-orange-400' :
            'from-red-800 to-red-500'
          }`}
          style={{ width: `${(score / 10) * 100}%` }}
        />
      </div>
      {notes && <div className="text-[8px] text-zinc-600 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">{notes}</div>}
    </div>
  );

  const activeModel = MODEL_LABELS[model];

  return (
    <div className={`w-[640px] bg-zinc-950/80 backdrop-blur-xl border rounded-2xl overflow-hidden mb-6 mt-4 relative animate-in fade-in slide-in-from-bottom-2 ${glowBorder}`}>
      {/* Decorative Watermark */}
      <div className="absolute -right-8 -top-8 opacity-5 pointer-events-none">
         <ShieldAlert size={160} />
      </div>

      {/* HEADER */}
      <div className="p-5 border-b border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent relative z-10">
        <div className="flex justify-between items-start">
          <div className="w-2/3">
             <div className="flex items-center gap-2 group cursor-text" onClick={() => { if (!isEditingTitle) { setCustomTitle(customTitle || report.card_identified || "Unknown Specimen"); setIsEditingTitle(true); } }}>
               {isEditingTitle ? (
                 <input 
                   autoFocus
                   type="text" 
                   value={customTitle} 
                   onChange={(e) => setCustomTitle(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingTitle(false); }}
                   onBlur={() => setIsEditingTitle(false)}
                   className="text-lg font-bold text-white tracking-tight leading-tight bg-black/50 border border-[#39ff14]/50 rounded px-2 py-0.5 outline-none w-full"
                 />
               ) : (
                 <>
                   <h3 className="text-lg font-bold text-white tracking-tight leading-tight">{customTitle || report.card_identified || "Unknown Specimen"}</h3>
                   <span className="text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">✎ EDIT</span>
                 </>
               )}
             </div>
             <p className="text-zinc-500 text-xs mt-1 leading-snug">{report.verdict}</p>
          </div>
          <div className="text-right flex flex-col items-end">
             <div className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest bg-black/40 px-2 py-0.5 rounded-full border border-white/5 mb-1">
               Predicted Grade
             </div>
             <div className={`text-5xl font-black ${labelColor} drop-shadow-md`}>{Number(overall).toFixed(1)}</div>
             <div className="text-[9px] text-zinc-600 mt-1">Confidence: {report.confidence_score || '—'}%</div>
          </div>
        </div>
      </div>

      {/* Card Images Carousel (if available) */}
      {cardImages && cardImages.length > 0 && (
        <div className="px-5 py-3 border-b border-white/5 flex gap-2 overflow-x-auto bg-black/30">
          {cardImages.map((imgPath, i) => (
            <img
              key={i}
              src={imgPath}
              alt={`Angle ${i + 1}`}
              className="h-20 w-auto object-contain rounded-lg border border-white/10 flex-shrink-0 hover:border-white/30 transition-all hover:scale-105 cursor-zoom-in"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ))}
          <span className="text-[8px] text-zinc-600 self-end flex-shrink-0 mb-1">{cardImages.length} angle{cardImages.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="p-5 grid grid-cols-2 gap-6 relative z-10">
        
        {/* Left Column: Vision Matrix */}
        <div className="flex flex-col justify-start">
           <h4 className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-4 flex items-center gap-1.5 border-b border-white/5 pb-2">
             <Cpu size={12} className="text-emerald-500" /> Optical Calibration
           </h4>
           <div className="space-y-1">
           <ScoreBar label="Centering" score={cScore} notes={report.centering?.notes} />
             <ScoreBar label="Corners" score={corScore} notes={report.corners?.notes} />
             <ScoreBar label="Edges" score={eScore} notes={report.edges?.notes} />
             <ScoreBar label="Surface" score={sScore} notes={report.surface?.notes} />
           </div>

           <div className="mt-4 p-3 bg-black/60 rounded-xl border border-white/5 backdrop-blur-md">
              <span className="text-[10px] text-zinc-400 italic leading-relaxed block overflow-y-auto max-h-24 scrollbar-thin scrollbar-thumb-zinc-700">
                "{report.raw_analysis}"
              </span>
           </div>
        </div>

        {/* Right Column: Simulation Engine */}
        <div className="flex flex-col justify-start">
           <h4 className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-3 flex items-center gap-1.5 border-b border-white/5 pb-2">
             <TrendingUp size={12} style={{ color: activeModel.color }} /> 
             <span>{activeModel.name}</span>
             <span className="text-[8px] opacity-50 ml-1">{activeModel.desc}</span>
             {isLoading && <span className="ml-auto text-[8px] animate-pulse" style={{ color: activeModel.color }}>Computing...</span>}
           </h4>

           {/* Model + Risk Selectors */}
           <div className="flex gap-1.5 mb-3">
             {Object.entries(MODEL_LABELS).map(([key, cfg]) => (
               <button 
                 key={key}
                 onClick={() => setModel(key)}
                 onMouseEnter={() => setHoveredModel(key)}
                 onMouseLeave={() => setHoveredModel(null)}
                 className={`text-[8px] uppercase tracking-widest px-2 py-1 rounded border font-bold transition-all ${
                   model === key 
                     ? 'text-white border-white/30 bg-white/10' 
                     : 'text-zinc-600 border-zinc-800 hover:border-zinc-600'
                 }`}
                 style={model === key ? { color: cfg.color, borderColor: cfg.color + '40' } : {}}
               >
                 {cfg.name}
               </button>
             ))}
           </div>
           {/* Model Tooltip */}
           {hoveredModel && (
             <div className="mb-2 p-2 bg-black/80 border border-white/10 rounded-lg text-[9px] text-zinc-300 leading-relaxed animate-in fade-in duration-200">
               <span className="font-bold" style={{ color: MODEL_LABELS[hoveredModel].color }}>{MODEL_LABELS[hoveredModel].name}:</span>{' '}
               {MODEL_LABELS[hoveredModel].tooltip}
             </div>
           )}
           <div className="flex gap-1.5 mb-3">
             {['conservative', 'moderate', 'aggressive'].map(r => (
               <button
                 key={r}
                 onClick={() => setRisk(r)}
                 className={`text-[8px] uppercase tracking-widest px-2 py-1 rounded border font-bold transition-all flex-1 ${
                   risk === r 
                     ? 'text-white bg-white/5 border-white/20' 
                     : 'text-zinc-600 border-zinc-800 hover:border-zinc-600'
                 }`}
               >
                 {r === 'conservative' ? '🛡️' : r === 'moderate' ? '⚖️' : '🔥'} {r.slice(0, 4)}
               </button>
             ))}
           </div>

           {/* Chart */}
           <div className="w-full h-[140px] bg-black/40 rounded-xl border border-white/5 p-2 pb-0 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simData || []}>
                  <defs>
                    <linearGradient id="colorBand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={activeModel.color} stopOpacity={0.15}/>
                      <stop offset="95%" stopColor={activeModel.color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                  <XAxis dataKey="day" hide={true} />
                  <YAxis domain={['auto', 'auto']} tick={{fontSize: 9, fill: '#71717a'}} width={35} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val.toFixed(0)}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '10px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value, name) => [
                      `$${Number(value).toFixed(2)}`, 
                      name === 'mean' ? 'Mean Expected' : 
                      name === 'p95' ? 'Bull Case (95%)' : 
                      name === 'p75' ? 'Optimistic (75%)' : 
                      name === 'p25' ? 'Pessimistic (25%)' : 
                      name === 'p5' ? 'Bear Case (5%)' : name
                    ]}
                    labelFormatter={(label) => `Simulated ${label}`}
                  />
                  <Area type="monotone" dataKey="p95" stroke="none" fill="url(#colorBand)" fillOpacity={0.4} isAnimationActive={false} />
                  <Area type="monotone" dataKey="p75" stroke="none" fill="url(#colorBand)" fillOpacity={0.3} isAnimationActive={false} />
                  <Line type="monotone" dataKey="p5" stroke="#3f3f46" strokeWidth={1} strokeDasharray="2 2" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="p95" stroke="#3f3f46" strokeWidth={1} strokeDasharray="2 2" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="mean" stroke={activeModel.color} strokeWidth={2} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
           </div>
           
           {/* Stats Row */}
           <div className="flex justify-between items-center mt-2 px-1">
             <div className="text-[9px] text-zinc-500 flex gap-3">
               <span className="flex items-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px]" style={{ backgroundColor: activeModel.color }}></span> Mean
               </span>
               <span className="flex items-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full border border-zinc-500 border-dashed"></span> 95% CI
               </span>
             </div>
             <div className="flex gap-3 text-[9px]">
               <span className={`font-bold ${simStats.winPct >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                 P(Win): {simStats.winPct}%
               </span>
               <span className={`font-bold ${parseFloat(simStats.expectedReturn) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                 E[R]: {simStats.expectedReturn}%
               </span>
             </div>
           </div>

           {/* Price Source + Start Price */}
           <div className="text-[8px] text-zinc-600 mt-1 px-1 flex justify-between">
             <span>Start: ${simStats.startPrice ? simStats.startPrice.toFixed(2) : '—'}</span>
             <span className="italic">{simStats.priceSource || 'Synthetic'}</span>
           </div>

           {/* Legal Disclaimer */}
           <div className="mt-2 p-2 bg-yellow-900/10 border border-yellow-500/10 rounded-lg flex items-start gap-1.5">
             <AlertTriangle size={10} className="text-yellow-600 flex-shrink-0 mt-0.5" />
             <span className="text-[8px] text-yellow-600/80 leading-relaxed">
               For entertainment purposes only. Not financial advice. Past performance does not guarantee future results. Simulated projections are mathematically generated and may not reflect real market conditions.
             </span>
           </div>
        </div>

      </div>
    </div>
  );
}
