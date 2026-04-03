'use client';

import React, { useState, useEffect, useCallback } from 'react';
import EbaySetup from './EbaySetup';
import { invoke } from '@tauri-apps/api/core';

// ═══════════════════════════════════════════════════════════
// TCG MARKET BROWSER — Browse Games → Sets → Cards
// Powered by TCGCSV (https://tcgcsv.com)
// ═══════════════════════════════════════════════════════════

const TCGCSV_BASE = 'https://tcgcsv.com/tcgplayer';

const GAMES = [
  { id: 3, name: 'Pokémon', icon: '⚡', color: '#facc15' },
  { id: 1, name: 'Magic: The Gathering', icon: '🧙', color: '#a855f7' },
  { id: 2, name: 'Yu-Gi-Oh!', icon: '👁️', color: '#ef4444' },
  { id: 71, name: 'Lorcana', icon: '✨', color: '#3b82f6' },
  { id: 68, name: 'One Piece', icon: '🏴‍☠️', color: '#f97316' },
  { id: 79, name: 'Star Wars Unlimited', icon: '⚔️', color: '#cbd5e1' },
  { id: 80, name: 'Dragon Ball Fusion World', icon: '🐉', color: '#ef4444' },
  { id: 62, name: 'Flesh & Blood', icon: '🩸', color: '#991b1b' },
  { id: 63, name: 'Digimon', icon: '🦖', color: '#3b82f6' },
  { id: 85, name: 'Pokémon (Japan)', icon: '🇯🇵', color: '#fde047' },
  { id: 89, name: 'LoL Riftbound', icon: '🎮', color: '#0ea5e9' },
  { id: 86, name: 'Gundam', icon: '🤖', color: '#94a3b8' },
  { id: 81, name: 'Union Arena', icon: '🎌', color: '#eab308' },
];

const MODELS = [
  { key: 'gbm', name: 'GBM', desc: 'Brownian Motion', color: '#22c55e' },
  { key: 'merton', name: 'Merton', desc: 'Jump-Diffusion', color: '#3b82f6' },
  { key: 'heston', name: 'Heston', desc: 'Stochastic Vol', color: '#a855f7' },
  { key: 'kou', name: 'Kou', desc: 'Double-Exp', color: '#f59e0b' },
];

// ── Box-Muller Normal RNG ──
function boxMuller() {
  const u1 = Math.random(), u2 = Math.random();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-4))) * Math.cos(2 * Math.PI * u2);
}

const HESTON = {
  conservative: { kappa: 3.0, theta: 0.0016, xi: 0.1, rho: -0.2 },
  moderate:     { kappa: 2.5, theta: 0.0049, xi: 0.3, rho: -0.5 },
  aggressive:   { kappa: 2.0, theta: 0.0121, xi: 0.8, rho: -0.7 },
};
const KOU = {
  conservative: { p: 0.5, eta1: 25, eta2: 25 },
  moderate:     { p: 0.4, eta1: 10, eta2: 10 },
  aggressive:   { p: 0.3, eta1: 5,  eta2: 3  },
};

function runSim({ price, days, mu, sigma, model, risk, sims = 150 }) {
  const h = HESTON[risk] || HESTON.moderate;
  const k = KOU[risk] || KOU.moderate;
  const lam = risk === 'aggressive' ? 0.08 : risk === 'conservative' ? 0.02 : 0.05;
  const paths = [];

  for (let s = 0; s < sims; s++) {
    const path = [price];
    let v = sigma * sigma;
    for (let d = 1; d <= days; d++) {
      const z1 = boxMuller();
      let vol = sigma, logM = mu + vol * z1;

      if (model === 'heston' || model === 'kou') {
        vol = Math.sqrt(Math.max(0, v));
        logM = mu + vol * z1;
        const zi = boxMuller();
        const z2 = h.rho * z1 + Math.sqrt(1 - h.rho * h.rho) * zi;
        v = Math.max(0, v + h.kappa * (h.theta - Math.max(0, v)) + h.xi * Math.sqrt(Math.max(0, v)) * z2);
      }

      if ((model === 'merton' || model === 'kou') && Math.random() < lam) {
        if (model === 'kou') {
          const up = Math.random() < k.p;
          const x = -Math.log(Math.random()) / (up ? k.eta1 : k.eta2);
          logM += up ? x : -x;
        } else {
          logM += 0.10 * boxMuller();
        }
      }
      path.push(Math.max(path[d - 1] * Math.exp(logM), 0.001));
    }
    paths.push(path);
  }

  const result = [];
  for (let d = 0; d <= days; d++) {
    const col = paths.map(p => p[d]).sort((a, b) => a - b);
    const len = col.length;
    result.push({
      day: d,
      p5: col[Math.floor(len * 0.05)],
      p25: col[Math.floor(len * 0.25)],
      mean: col.reduce((a, b) => a + b, 0) / len,
      p75: col[Math.floor(len * 0.75)],
      p95: col[Math.floor(len * 0.95)],
    });
  }
  const wins = paths.filter(p => p[days] > price).length;
  return { data: result, winPct: Math.round((wins / sims) * 100) };
}

// ── Mini Sparkline (Pure CSS) ──
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map(d => d.mean));
  const min = Math.min(...data.map(d => d.mean));
  const range = max - min || 1;
  const w = 120, ht = 32;
  const points = data.map((d, i) => `${(i / (data.length - 1)) * w},${ht - ((d.mean - min) / range) * ht}`).join(' ');

  return (
    <svg width={w} height={ht} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TCGMarketBrowser({ onSelectCard }) {
  const [view, setView] = useState('games'); // games → sets → cards → sim
  const [gameId, setGameId] = useState(null);
  const [gameName, setGameName] = useState('');
  const [sets, setSets] = useState([]);
  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // eBay Integration State
  const [ebayQuery, setEbayQuery] = useState('');
  const [ebayListings, setEbayListings] = useState([]);
  const [ebayStats, setEbayStats] = useState(null);
  const [ebayCreds, setEbayCreds] = useState(null);
  const [ebaySuggestions, setEbaySuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [ebayListExpanded, setEbayListExpanded] = useState(false);
  const [compareItems, setCompareItems] = useState([]);

  const toggleCompare = (item) => {
    setCompareItems(prev => {
      const exists = prev.find(p => p.itemId === item.itemId);
      if (exists) return prev.filter(p => p.itemId !== item.itemId);
      if (prev.length >= 4) return prev; // max 4 comparison slots
      return [...prev, { ...item, _searchQuery: ebayQuery }];
    });
  };

  // Debounced auto-suggest for eBay Live Search
  useEffect(() => {
    if (!ebayCreds || ebayQuery.trim().length < 3 || !showSuggestions) {
      setEbaySuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      if (loading) return; // Prevent overlapping with main search
      setIsSuggesting(true);
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const rawRes = await invoke('execute_mcp_tool', { 
           serverName: 'undesirables-mcp-server', 
           toolName: 'search_ebay_market', 
           args: { query: ebayQuery, limit: 20, app_id: ebayCreds.appId, client_secret: ebayCreds.clientSecret } 
        });
        let res = typeof rawRes === 'string' ? JSON.parse(rawRes) : rawRes;
        if (res && res.result && typeof res.result === 'string') {
          try { res = JSON.parse(res.result); } catch { res = res.result; }
        }
        if (res && res.sample_listings) {
          setEbaySuggestions(res.sample_listings);
        } else {
          setEbaySuggestions([]);
        }
      } catch (err) {
        console.error('[eBay Auto-Suggest] Failed:', err);
      }
      setIsSuggesting(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [ebayQuery, ebayCreds, loading, showSuggestions]);

  // Simulation state
  const [simModel, setSimModel] = useState('merton');
  const [simRisk, setSimRisk] = useState('moderate');
  const [simDays, setSimDays] = useState(30);
  const [simResult, setSimResult] = useState(null);
  const [simRunning, setSimRunning] = useState(false);
  const [chartMode, setChartMode] = useState('future'); // 'history' | 'future'
  const [hoverHistPoint, setHoverHistPoint] = useState(null);
  const [historyData, setHistoryData] = useState({});
  const [simDisclaimerAccepted, setSimDisclaimerAccepted] = useState(false);

  const fetchData = async (path) => {
    try {
      return await invoke('fetch_tcg_data', { path });
    } catch (e) {
      // If invoke throws a string, it's our Rust backend error.
      // If it throws a TypeError (invoke not found), it means we are outside the Sandbox.
      if (e instanceof TypeError || (e.message && e.message.includes('__TAURI_INTERNALS__'))) {
        throw new Error('SECURITY BLOCK: Application must be run inside the Tauri Sandbox to bypass Cloudflare.');
      }
      throw new Error(typeof e === 'string' ? e : e.message);
    }
  };

  const fetchSets = async (catId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchData(`${catId}/groups`);
      const groups = (data.results || data || []).sort((a, b) => new Date(b.publishedOn) - new Date(a.publishedOn));
      setSets(groups);
      setView('sets');
    } catch (e) {
      setError(typeof e === 'string' ? e : (e.message || 'Failed to load sets. Check your connection.'));
    }
    setLoading(false);
  };

  const fetchCards = async (catId, groupId) => {
    setLoading(true);
    setError(null);
    try {
      const [dataProd, dataPrice] = await Promise.all([
        fetchData(`${catId}/${groupId}/products`),
        fetchData(`${catId}/${groupId}/prices`),
      ]);
      const products = dataProd.results || [];
      const prices = dataPrice.results || [];

      const priceMap = {};
      prices.forEach(p => {
        const best = p.marketPrice || p.midPrice || p.lowPrice || 0;
        if (!priceMap[p.productId] || best > (priceMap[p.productId].best || 0)) {
          priceMap[p.productId] = { best, raw: p };
        }
      });

      const enriched = products.map(p => ({
        ...p,
        price: priceMap[p.productId]?.best || 0,
        priceData: priceMap[p.productId]?.raw || {},
        imageUrl: (p.imageUrl || '').replace('_200w', '_in_1000x1000'),
      })).sort((a, b) => (b.price || 0) - (a.price || 0));

      setCards(enriched);
      setView('cards');
    } catch (e) {
      setError(e.message || 'Failed to load cards. Try again.');
    }
    setLoading(false);
  };

  const handleSimulate = useCallback(() => {
    if (!selectedCard || !selectedCard.price) return;
    setSimRunning(true);

    const basePrice = selectedCard.price;
    const dailyMu = 0.0005; // Slight positive drift
    const dailySigma = 0.03; // ~3% daily vol for TCG

    requestAnimationFrame(() => {
      const result = runSim({
        price: basePrice,
        days: simDays,
        mu: dailyMu,
        sigma: dailySigma,
        model: simModel,
        risk: simRisk,
        sims: 150,
      });
      setSimResult(result);
      setSimRunning(false);
    });
  }, [selectedCard, simModel, simRisk, simDays]);

  useEffect(() => {
    if (selectedCard && selectedCard.price > 0 && chartMode === 'future') {
      handleSimulate();
    }
  }, [selectedCard, simModel, simRisk, simDays, chartMode]);

  useEffect(() => {
    if (selectedCard && selectedCard.price > 0 && chartMode === 'history') {
      const p = selectedCard.price;
      const low = selectedCard.priceData?.lowPrice || p * 0.8;
      const high = selectedCard.priceData?.highPrice || p * 1.2;
      const points = [];
      const steps = 90;
      let current = (low + p) / 2;
      const maxP = Math.max(high, p * 1.05);
      const minP = Math.min(low, p * 0.95);
      const range = maxP - minP || 1;
      
      for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        if (progress === 1) current = p;
        else {
          const randomWander = (Math.random() - 0.5) * (range * 0.1);
          const driftToTarget = (p - current) * Math.pow(progress, 2); 
          current = current + randomWander + driftToTarget;
          current = Math.max(minP, Math.min(maxP, current));
        }
        
        const x = (i / steps) * 300;
        const y = 100 - ((current - minP) / range) * 100;
        points.push({ x, y, price: current, day: i - 90 });
      }
      setHistoryData({
         points,
         path: points.map(pt => `${pt.x},${pt.y}`).join(' '),
         maxP, minP, range
      });
    }
  }, [selectedCard, chartMode]);

  const filtered = (list, key) => {
    if (!filter) return list;
    const q = filter.toLowerCase();
    return list.filter(item => {
      const name = item[key] || item.name || item.cleanName || '';
      return name.toLowerCase().includes(q);
    });
  };

  const activeModelCfg = MODELS.find(m => m.key === simModel) || MODELS[0];

  const performEbaySearch = async (queryText) => {
    if (!queryText || !queryText.trim()) return;
    setEbayQuery(queryText);
    setShowSuggestions(false);
    setLoading(true);
    setError(null);
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const params = { 
          query: queryText, 
          limit: 150,
          app_id: ebayCreds?.appId || '', 
          client_secret: ebayCreds?.clientSecret || '' 
        };
        const rawRes = await invoke('execute_mcp_tool', { 
          serverName: 'undesirables-mcp-server', 
          toolName: 'search_ebay_market', 
          args: params 
        });
        
        let res = typeof rawRes === 'string' ? JSON.parse(rawRes) : rawRes;
        if (res && res.result && typeof res.result === 'string') {
            try { res = JSON.parse(res.result); } catch { res = res.result; }
        }

        if (res && res.market_depth) {
          setEbayStats(res.market_depth);
          setEbayListings(res.sample_listings || []);
        } else if (res.error) {
          setError(res.error);
        } else {
          setError('No data found, or failed to parse FastMCP respond. Check API keys.');
        }
    } catch (err) {
      setError('Failed to reach eBay via FastMCP. Is your Python backend running?');
    }
    setLoading(false);
  };

  // ═══ RENDER ═══
  return (
    <div className="flex flex-col h-full text-white select-none">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-1 pb-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500 border-b border-[#39ff14]/10 mb-2 flex-shrink-0">
        <button onClick={() => { setView('games'); setFilter(''); }} className={`hover:text-[#39ff14] transition ${view === 'games' ? 'text-[#39ff14]' : ''}`}>Games</button>
        {(view === 'sets' || view === 'cards' || view === 'sim' || view === 'ebay') && (
          <>
            <span className="text-zinc-700">›</span>
            <button onClick={() => { 
                if (view === 'ebay') { setView('ebay'); setFilter(''); setSelectedCard(null); }
                else { setView('sets'); setFilter(''); setSelectedCard(null); }
              }} 
              className={`hover:text-[#39ff14] transition truncate max-w-[80px] ${(view === 'sets' || view === 'ebay') ? 'text-[#39ff14]' : ''}`}
            >
              {view === 'ebay' ? 'eBay Live' : gameName}
            </button>
          </>
        )}
        {(view === 'cards' || view === 'sim') && (
          <>
            <span className="text-zinc-700">›</span>
            <button onClick={() => { setView('cards'); setFilter(''); setSelectedCard(null); }} className={`hover:text-[#39ff14] transition ${view === 'cards' ? 'text-[#39ff14]' : ''}`}>Cards</button>
          </>
        )}
        {view === 'sim' && selectedCard && (
          <>
            <span className="text-zinc-700">›</span>
            <span className="text-[#39ff14] truncate max-w-[80px]">{selectedCard.cleanName || selectedCard.name}</span>
          </>
        )}
      </div>

      {/* Search & Navigation Controls */}
      {(view !== 'sim' && view !== 'ebay') && (
        <div className="relative mb-2 flex-shrink-0 px-1 flex gap-2">
          {view === 'sets' && (
            <button
              onClick={() => { setView('games'); setFilter(''); setSelectedCard(null); }}
              className="px-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-mono transition shadow-lg shrink-0 border border-zinc-700"
            >
              ← BACK
            </button>
          )}
          {view === 'cards' && (
            <button
              onClick={() => { setView('sets'); setFilter(''); setSelectedCard(null); }}
              className="px-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-mono transition shadow-lg shrink-0 border border-zinc-700"
            >
              ← BACK
            </button>
          )}
          <input
            type="text"
            placeholder={`Search ${view}...`}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full bg-black/50 border border-[#39ff14]/20 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#39ff14]/50 transition font-mono"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-[#39ff14]/50 border-t-[#39ff14] animate-spin" />
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
              {view === 'ebay' ? 'Scanning eBay Market...' : 'Loading from TCGCSV...'}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-1 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-[10px] text-red-400 mb-2">{error}</div>
      )}

      {/* ═── GAMES ──═ */}
      {!loading && view === 'games' && (
        <div className="flex-1 overflow-y-auto space-y-2 px-1 scrollbar-thin scrollbar-thumb-zinc-800">
          
          {/* Universal Oracle Module — Pinned Top */}
          <div className="mb-2 p-[2px] rounded-xl bg-gradient-to-r from-[#0064d2]/10 via-[#0064d2]/40 to-[#0064d2]/10 relative group">
            <div className="absolute inset-0 bg-[#0064d2]/20 blur-xl rounded-xl opacity-0 group-hover:opacity-100 transition duration-700"></div>
            <div className="bg-black/80 rounded-xl p-4 relative z-10 border border-[#0064d2]/30">
              <div className="flex justify-between items-center mb-1">
                <div className="text-[10px] text-blue-400 font-mono uppercase tracking-widest font-bold">🌍 Live eBay Oracle</div>
              </div>
              <div className="text-[10px] text-zinc-400 leading-relaxed mb-4 font-mono">
                Access the global live marketplace to extract unstructured items, vintage slabs, Pudgy Toys, VeeFriends, and raw assets.
              </div>
              <button
                onClick={() => { setView('ebay'); setEbayQuery(''); setEbayListings([]); setSelectedCard(null); }}
                className="w-full relative group/btn bg-gradient-to-r from-[#004a9e] to-[#0064d2] hover:from-[#0064d2] hover:to-[#004a9e] text-white font-black text-[11px] uppercase tracking-[0.2em] py-3 rounded-lg shadow-[0_0_20px_rgba(0,100,210,0.2)] hover:shadow-[0_0_40px_rgba(0,100,210,0.6)] transition-all flex items-center justify-center overflow-hidden border border-white/10"
              >
                <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover/btn:animate-[shimmer_1.5s_infinite]"></div>
                <span className="relative z-10 flex items-center gap-2">🛒 CONNECT TO EBAY</span>
              </button>
            </div>
          </div>

          <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest pl-1 mb-1 mt-2">TCG Supported Games</div>
          {GAMES.map(g => (
            <button
              key={g.id}
              onClick={() => { setGameId(g.id); setGameName(g.name); fetchSets(g.id); setFilter(''); }}
              className="w-full text-left p-3 rounded-lg border border-zinc-800 hover:border-[color] bg-black/30 hover:bg-[color]/5 transition-all flex items-center gap-3 group"
              style={{ '--color': g.color }}
            >
              <span className="text-2xl">{g.icon}</span>
              <div>
                <div className="text-sm font-bold text-white group-hover:text-[var(--color)] transition">{g.name}</div>
                <div className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">Browse sets & cards</div>
              </div>
            </button>
          ))}

          <div className="mt-2 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mb-1">📊 DATA SOURCE</div>
            <div className="text-[10px] text-zinc-400 leading-relaxed">
              Powered by <a href="https://tcgcsv.com" target="_blank" rel="noopener noreferrer" className="text-[#39ff14] underline hover:text-white">TCGCSV.com</a> — free, open TCGPlayer market data. 
              Prices update daily. No API key required.
            </div>
          </div>
        </div>
      )}

      {/* ═── EBAY LIVE ──═ */}
      {!loading && view === 'ebay' && !ebayCreds && (
        <EbaySetup onSuccess={(id, secret) => setEbayCreds({ appId: id, clientSecret: secret })} />
      )}
      {!loading && view === 'ebay' && ebayCreds && (
        <div className="flex-1 overflow-y-auto space-y-3 px-2 py-1 scrollbar-thin scrollbar-thumb-zinc-800">
          
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="text-[#0064d2]">🛒</span> eBay Live Market Search
            </h3>
            <button 
              onClick={() => {
                localStorage.removeItem('undesirables_ebay_app_id');
                localStorage.removeItem('undesirables_ebay_client_secret');
                setEbayCreds(null);
              }}
              className="text-[9px] text-zinc-500 hover:text-red-400 font-mono tracking-widest uppercase transition-colors"
            >
              [ Disconnect ]
            </button>
          </div>
          <div className="p-3 bg-gradient-to-tr from-[#0064d2]/20 to-transparent border border-[#0064d2]/30 rounded-xl mb-2">
            <p className="text-[10px] text-zinc-400 leading-relaxed mb-3">
              Search the live eBay marketplace for items not native to TCGCSV (e.g. Vibes cards, Pudgy Penguin Toys, DC Hro, Vintage Slabs).
              <br /><span className="text-[#39ff14]/80 mt-1 block">💡 <b>PRO TIP:</b> Copy and paste the EXACT title from an eBay listing to bypass category limits and find specific hidden auctions.</span>
            </p>
            
            <div className="flex gap-2 mb-2 relative">
              <input
                type="text"
                placeholder="⚡ Type here exactly what you're looking for..."
                value={ebayQuery}
                onChange={e => {
                  setEbayQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && ebayQuery.trim()) {
                    await performEbaySearch(ebayQuery);
                  }
                }}
                className="flex-1 bg-black/80 border-2 border-[#39ff14]/50 rounded-lg px-4 py-3 text-xs text-white placeholder:text-[#39ff14]/60 placeholder:animate-pulse focus:outline-none focus:border-[#39ff14] focus:shadow-[0_0_20px_rgba(57,255,20,0.3)] transition-all font-mono shadow-[inset_0_0_10px_rgba(0,0,0,0.5),0_0_15px_rgba(57,255,20,0.1)]"
                autoFocus
              />
              <button
                onClick={async () => {
                  if (!ebayQuery.trim()) return;
                  await performEbaySearch(ebayQuery);
                }}
                className="bg-[#0064d2] text-white px-5 rounded-lg text-xs font-bold hover:bg-[#0064d2]/80 transition shadow hover:shadow-[#0064d2]/50 uppercase tracking-widest"
              >
                Search
              </button>

              {/* Suggestions Dropdown */}
              {showSuggestions && (ebaySuggestions.length > 0 || isSuggesting) && (
                <div className="absolute top-[100%] left-0 right-20 mt-1 bg-black/95 backdrop-blur-md border border-[#0064d2]/40 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50 overflow-hidden max-h-64 overflow-y-auto">
                  {isSuggesting && ebaySuggestions.length === 0 ? (
                    <div className="p-3 text-center text-[10px] text-[#0064d2] font-mono animate-pulse">Scanning live market...</div>
                  ) : (
                    <div className="flex flex-col">
                      {ebaySuggestions.map((item, idx) => (
                        <div 
                          key={idx}
                          onClick={() => {
                            performEbaySearch(item.title);
                          }}
                          className="flex items-center gap-3 p-2 border-b border-white/5 hover:bg-[#0064d2]/20 cursor-pointer transition-colors"
                        >
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" className="w-8 h-8 object-cover rounded shadow" />
                          ) : (
                            <div className="w-8 h-8 bg-zinc-800 rounded flex items-center justify-center text-[8px] text-zinc-500">NO IMG</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-white font-medium line-clamp-1">{item.title}</div>
                          </div>
                          <div className="text-[10px] font-bold text-[#eab308]">${item.price?.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1 mt-3">
              <span className="text-[9px] text-zinc-500 mr-1 mt-1 font-mono uppercase">Quick Taps:</span>
              <button onClick={() => performEbaySearch('Vibes Trading Cards Box')} className="px-2 py-1 bg-black/40 border border-[#ab47bc]/40 hover:border-[#ab47bc] rounded text-[9px] text-zinc-300 font-mono transition">Pudgy: Vibes</button>
              <button onClick={() => performEbaySearch('VeeFriends Series 2')} className="px-2 py-1 bg-black/40 border border-zinc-700 hover:border-zinc-500 rounded text-[9px] text-zinc-300 font-mono transition">VeeFriends</button>
              <button onClick={() => performEbaySearch('DC Hro Cards Hybrid')} className="px-2 py-1 bg-black/40 border border-zinc-700 hover:border-zinc-500 rounded text-[9px] text-zinc-300 font-mono transition">DC Hro Cards</button>
            </div>
          </div>

          {!ebayStats && ebayListings.length === 0 && !error && !loading && (
             <div className="flex flex-col items-center justify-center py-16 mt-4 space-y-8 relative overflow-hidden rounded-2xl bg-black/20 border border-white/5 shadow-inner">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHBhdGggZD0iTTAgMGgyMHYyMEgwem0xOSAxOWgtMTh2MThoMTh6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz48L3N2Zz4=')] opacity-20" />
                
                <div className="relative flex items-center justify-center">
                   <div className="w-32 h-32 border border-[#0064d2]/20 rounded-full absolute animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
                   <div className="w-24 h-24 border border-[#0064d2]/40 rounded-full absolute animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]" />
                   <div className="w-12 h-12 border-2 border-[#0064d2]/60 rounded-full absolute animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite_1s]" />
                   <div className="w-6 h-6 bg-gradient-to-tr from-[#0064d2] to-cyan-400 rounded-full animate-pulse shadow-[0_0_30px_rgba(0,100,210,1)] relative z-10" />
                   
                   {/* Scanning Radar Line */}
                   <div className="absolute w-[150px] h-[150px] rounded-full overflow-hidden">
                      <div className="w-1/2 h-1/2 bg-gradient-to-br from-[#0064d2]/40 to-transparent origin-bottom-right animate-[spin_4s_linear_infinite]" />
                   </div>
                </div>
                
                <div className="text-center relative z-10">
                   <h3 className="text-sm font-mono font-black text-[#e0faec] uppercase tracking-[0.2em] mb-2 drop-shadow-[0_0_10px_rgba(0,100,210,0.8)]">Oracle Connected</h3>
                   <p className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase">Awaiting Universal Market Input...</p>
                </div>
             </div>
          )}

          {ebayStats && (
            <div className="mt-4">
              
              {/* STICKY TOP: Hero Image + Market Stats (always visible) */}
              <div className="flex-shrink-0">
              {/* PRIMARY VISUAL SNAPSHOT (Shroomy Oracle Style) */}
              {ebayListings[0] && (
                <div className="w-full max-w-[240px] mx-auto mb-4 relative group transform transition hover:scale-105 duration-500">
                   {ebayListings[0].imageUrl && (
                     <>
                       <div className="absolute -inset-2 bg-gradient-to-br from-[#0064d2]/50 to-transparent blur-2xl opacity-70 group-hover:opacity-100 transition duration-500"></div>
                       <div className="relative p-[2px] bg-gradient-to-br from-[#0064d2]/40 to-black rounded-2xl shadow-[0_0_30px_rgba(0,100,210,0.3)]">
                         <img 
                           src={ebayListings[0].imageUrl} 
                           alt="Oracle Target" 
                           className="w-full aspect-square object-cover rounded-xl bg-black/80" 
                         />
                       </div>
                     </>
                   )}
                   {/* Full Legible Title Block */}
                   <div className="mt-3 px-2 text-center relative z-10">
                     <h2 className="text-[13px] font-bold text-white leading-snug tracking-wide drop-shadow-md">
                       {ebayListings[0].title}
                     </h2>
                     <p className="mt-1 text-[10px] text-[#39ff14] font-mono tracking-widest font-black uppercase drop-shadow-[0_0_5px_rgba(57,255,20,0.5)]">
                       ${ebayListings[0].price?.toFixed(2)} ORACLE HIT
                     </p>
                   </div>
                </div>
              )}

              <div className="p-3 bg-black/40 border border-[#0064d2]/30 rounded-xl mb-3">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Market Status</div>
                    <div className="text-xl font-bold text-white">${ebayStats.avg_listing_price?.toFixed(2)} Avg</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Market Depth</div>
                    <div className="text-sm font-bold text-[#eab308]">{ebayStats.num_listings} Listings</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-3 p-2 bg-black/50 rounded-lg border border-zinc-800">
                  <div className="text-center">
                    <div className="text-[8px] text-zinc-600 font-mono uppercase">Spread Low</div>
                    <div className="text-xs font-mono text-white">${ebayStats.price_range?.low?.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[8px] text-zinc-600 font-mono uppercase">Spread High</div>
                    <div className="text-xs font-mono text-white">${ebayStats.price_range?.high?.toFixed(2)}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <button
                    onClick={() => {
                        // Create a fake card payload for the simulator
                        setSelectedCard({
                            cleanName: ebayQuery,
                            name: ebayQuery,
                            price: ebayStats.avg_listing_price,
                            imageUrl: ebayListings[0]?.imageUrl || '',
                            priceData: {
                                lowPrice: ebayStats.price_range?.low,
                                highPrice: ebayStats.price_range?.high
                            }
                        });
                        setView('sim');
                    }}
                    className="w-full bg-[#eab308]/20 hover:bg-[#eab308]/30 text-[#eab308] font-bold text-[10px] uppercase tracking-widest py-2 rounded-lg border border-[#eab308]/30 transition-all flex items-center justify-center gap-2"
                  >
                    <span>📈 ANALYZE HISTORY & FORECAST</span>
                  </button>
                </div>
              </div>
              </div>

              {/* SCROLLABLE BOTTOM: Individual Listings */}
              <div className="flex items-center justify-between mb-1 mt-4">
                <div className="text-[9px] text-[#0064d2] font-mono uppercase tracking-widest">Latest eBay Search Results ({ebayListings.length})</div>
                <button 
                  onClick={() => setEbayListExpanded(prev => !prev)}
                  className="text-[9px] text-[#0064d2] hover:text-white font-mono uppercase tracking-widest px-2 py-0.5 rounded border border-[#0064d2]/20 hover:border-[#0064d2]/50 bg-[#0064d2]/5 hover:bg-[#0064d2]/15 transition-all cursor-pointer"
                >
                  {ebayListExpanded ? '▲ Collapse' : '▼ Expand All'}
                </button>
              </div>
              <div className={`space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 transition-all duration-300 ${ebayListExpanded ? '' : 'max-h-[280px]'}`}>
                {ebayListings.map((item, idx) => {
                  const isPinned = compareItems.some(p => p.itemId === item.itemId);
                  return (
                    <div
                      key={idx}
                      className={`flex text-left p-2 rounded-lg border transition-all items-center gap-3 group ${
                        isPinned ? 'border-[#eab308]/50 bg-[#eab308]/5' : 'border-zinc-800/50 hover:border-[#0064d2]/30 bg-black/20 hover:bg-[#0064d2]/5'
                      }`}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCompare(item); }}
                        className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-[10px] border transition-all cursor-pointer ${
                          isPinned
                            ? 'bg-[#eab308]/20 border-[#eab308]/50 text-[#eab308]'
                            : 'bg-black/50 border-zinc-700 text-zinc-500 hover:border-[#eab308]/50 hover:text-[#eab308]'
                        }`}
                        title={isPinned ? 'Unpin from comparison' : 'Pin to compare'}
                      >
                        {isPinned ? '★' : '☆'}
                      </button>
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="w-10 h-10 object-cover rounded flex-shrink-0"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <a
                        href={item.itemWebUrl?.startsWith('https://') ? item.itemWebUrl : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="text-[10px] font-medium text-white group-hover:text-[#0064d2] transition line-clamp-2">{item.title}</div>
                      </a>
                      <div className="flex-shrink-0">
                        <span className="text-xs font-bold text-white font-mono">${item.price?.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═── SETS ──═ */}
      {!loading && view === 'sets' && (
        <div className="flex-1 overflow-y-auto space-y-1 px-1 scrollbar-thin scrollbar-thumb-zinc-800">
          {filtered(sets, 'name').map(s => (
            <button
              key={s.groupId}
              onClick={() => { fetchCards(gameId, s.groupId); setFilter(''); }}
              className="w-full text-left px-3 py-2 rounded-lg border border-zinc-800/50 hover:border-[#39ff14]/30 bg-black/20 hover:bg-[#39ff14]/5 transition-all flex items-center justify-between group"
            >
              <div className="truncate flex-1">
                <div className="text-xs font-medium text-white group-hover:text-[#39ff14] transition truncate">{s.name}</div>
                <div className="text-[9px] text-zinc-600 font-mono">{s.abbreviation || ''}</div>
              </div>
              <div className="text-[9px] text-zinc-600 font-mono ml-2 flex-shrink-0">
                {s.publishedOn ? new Date(s.publishedOn).getFullYear() : ''}
              </div>
            </button>
          ))}
          {filtered(sets, 'name').length === 0 && <div className="text-center text-zinc-600 text-xs py-8">No sets found</div>}
        </div>
      )}

      {/* ═── CARDS ──═ */}
      {!loading && view === 'cards' && (
        <div className="flex-1 overflow-y-auto space-y-1 px-1 scrollbar-thin scrollbar-thumb-zinc-800">
          {filtered(cards, 'cleanName').map(c => (
            <button
              key={c.productId}
              onClick={() => { setSelectedCard(c); setView('sim'); }}
              className="w-full text-left px-3 py-2 rounded-lg border border-zinc-800/50 hover:border-[#39ff14]/30 bg-black/20 hover:bg-[#39ff14]/5 transition-all flex items-center gap-3 group"
            >
              {c.imageUrl && (
                <img
                  src={c.imageUrl}
                  alt=""
                  className="w-8 h-11 object-contain rounded-sm border border-zinc-700/50 flex-shrink-0"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white group-hover:text-[#39ff14] transition truncate">{c.cleanName || c.name}</div>
                {c.rarityName && <div className="text-[9px] text-zinc-600 font-mono truncate">{c.rarityName}</div>}
              </div>
              <div className="text-right flex-shrink-0 flex flex-col items-end">
                {c.price > 0 ? (
                  <span className="text-xs font-bold text-[#39ff14] font-mono">${c.price.toFixed(2)}</span>
                ) : (
                  <span className="text-[9px] text-zinc-700 font-mono">—</span>
                )}
              </div>
            </button>
          ))}
          {filtered(cards, 'cleanName').length === 0 && <div className="text-center text-zinc-600 text-xs py-8">No cards found</div>}
        </div>
      )}

      {/* ═── SIMULATION ──═ */}
      {!loading && view === 'sim' && selectedCard && (
        <div className="flex-1 overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-zinc-800">

          {/* Card Info */}
          <div className="flex items-start gap-3 mb-3 p-3 bg-black/40 border border-zinc-800 rounded-xl">
            {selectedCard.imageUrl && (
              <img src={selectedCard.imageUrl} alt="" className="w-16 h-22 object-contain rounded border border-zinc-700/50" onError={e => { e.target.style.display = 'none'; }} />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{selectedCard.cleanName || selectedCard.name}</div>
              {selectedCard.rarityName && <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">{selectedCard.rarityName}</div>}
              <div className="text-lg font-black text-[#39ff14] font-mono mt-1">
                ${selectedCard.price > 0 ? selectedCard.price.toFixed(2) : '—'}
              </div>
              <div className="text-[8px] text-zinc-600 font-mono">TCGPlayer Market Price</div>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-black/40 border border-zinc-800 rounded-lg p-1 mb-3">
            <button
              onClick={() => setChartMode('history')}
              className={`flex-1 text-[9px] font-mono uppercase tracking-widest py-1.5 rounded transition ${chartMode === 'history' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
            >
              🕰️ Past History
            </button>
            <button
              onClick={() => setChartMode('future')}
              className={`flex-1 text-[9px] font-mono uppercase tracking-widest py-1.5 rounded transition ${chartMode === 'future' ? 'bg-[#39ff14]/20 text-[#39ff14]' : 'text-zinc-500 hover:text-[#39ff14]'}`}
            >
              🚀 Future Simulation
            </button>
          </div>

          {chartMode === 'future' ? (
            !simDisclaimerAccepted ? (
              <div className="bg-black/60 border border-yellow-500/30 rounded-xl p-5 my-4 flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(234,179,8,0.05)]">
                <div className="text-3xl mb-3">⚖️</div>
                <h3 className="text-yellow-500 font-bold uppercase tracking-widest text-xs mb-3">Legal Verification Required</h3>
                <p className="text-[10px] text-zinc-400 font-mono mb-5 leading-relaxed max-w-sm">
                  Please verify that this mathematical projection, along with the scraped listing data and history, is for <strong>entertainment and educational purposes only</strong>. Geographic tracking and Monte Carlo variables may hallucinate. Stop and verify — do not use this engine for financial trading.
                </p>
                <button 
                  onClick={() => setSimDisclaimerAccepted(true)}
                  className="bg-yellow-900/40 hover:bg-yellow-600/60 border border-yellow-500/50 text-white font-bold text-[10px] uppercase tracking-widest py-2.5 px-6 rounded-lg transition-all cursor-pointer shadow-[0_0_15px_rgba(234,179,8,0.2)] hover:shadow-[0_0_25px_rgba(234,179,8,0.4)]"
                >
                  I Verify & Agree
                </button>
              </div>
            ) : (
            <>
              {/* Model Selector */}
          <div className="mb-2">
            <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mb-1.5">Stochastic Model</div>
            <div className="grid grid-cols-4 gap-1">
              {MODELS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setSimModel(m.key)}
                  className={`text-[8px] uppercase font-bold tracking-wider px-1.5 py-2 rounded-lg border transition-all text-center ${
                    simModel === m.key
                      ? 'border-white/30 bg-white/10 text-white'
                      : 'border-zinc-800 text-zinc-600 hover:border-zinc-600'
                  }`}
                  style={simModel === m.key ? { color: m.color, borderColor: m.color + '40' } : {}}
                >
                  <div>{m.name}</div>
                  <div className="text-[7px] opacity-60 mt-0.5 normal-case">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Risk Level */}
          <div className="mb-2">
            <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mb-1.5">Risk Tolerance</div>
            <div className="grid grid-cols-3 gap-1">
              {['conservative', 'moderate', 'aggressive'].map(r => (
                <button
                  key={r}
                  onClick={() => setSimRisk(r)}
                  className={`text-[9px] uppercase font-bold tracking-wider px-2 py-2 rounded-lg border transition-all ${
                    simRisk === r ? 'text-white bg-white/5 border-white/20' : 'text-zinc-600 border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  {r === 'conservative' ? '🛡️' : r === 'moderate' ? '⚖️' : '🔥'} {r.slice(0, 5)}
                </button>
              ))}
            </div>
          </div>

          {/* Hold Days Slider */}
          <div className="mb-3">
            <div className="flex justify-between text-[9px] text-zinc-500 font-mono uppercase tracking-widest mb-1">
              <span>Hold Period</span>
              <span className="text-[#39ff14]">{simDays} days</span>
            </div>
            <input
              type="range"
              min="7"
              max="180"
              value={simDays}
              onChange={e => setSimDays(parseInt(e.target.value))}
              className="w-full h-1 appearance-none bg-zinc-800 rounded-full outline-none accent-[#39ff14]"
            />
          </div>

          {/* Chart */}
          {simResult && (
            <div className="bg-black/40 border border-zinc-800 rounded-xl p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeModelCfg.color }} />
                  {activeModelCfg.name} Projection
                </div>
                <div className="text-[9px] font-bold" style={{ color: simResult.winPct >= 50 ? '#22c55e' : '#ef4444' }}>
                  P(Win): {simResult.winPct}%
                </div>
              </div>

              {/* Simple SVG Chart */}
              <div className="w-full h-[100px] relative">
                <svg viewBox="0 0 300 100" className="w-full h-full" preserveAspectRatio="none">
                  {(() => {
                    const d = simResult.data;
                    const maxP = Math.max(...d.map(p => p.p95));
                    const minP = Math.min(...d.map(p => p.p5));
                    const range = maxP - minP || 1;
                    const x = (i) => (i / (d.length - 1)) * 300;
                    const y = (v) => 100 - ((v - minP) / range) * 100;

                    const bandPoints = d.map((p, i) => `${x(i)},${y(p.p95)}`).join(' ') + ' ' +
                      [...d].reverse().map((p, i) => `${x(d.length - 1 - i)},${y(p.p5)}`).join(' ');
                    const meanLine = d.map((p, i) => `${x(i)},${y(p.mean)}`).join(' ');
                    const startLine = y(d[0].mean);

                    return (
                      <>
                        <polygon points={bandPoints} fill={activeModelCfg.color} fillOpacity="0.08" />
                        <line x1="0" y1={startLine} x2="300" y2={startLine} stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="4 2" />
                        <polyline points={meanLine} fill="none" stroke={activeModelCfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    );
                  })()}
                </svg>

                {/* Y-axis labels */}
                <div className="absolute top-0 right-0 text-[8px] text-zinc-600 font-mono">${simResult.data[simResult.data.length - 1]?.p95.toFixed(0)}</div>
                <div className="absolute bottom-0 right-0 text-[8px] text-zinc-600 font-mono">${simResult.data[simResult.data.length - 1]?.p5.toFixed(0)}</div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-zinc-800">
                <div className="text-center">
                  <div className="text-[8px] text-zinc-600 font-mono uppercase">Mean</div>
                  <div className="text-xs font-bold text-white font-mono">${simResult.data[simResult.data.length - 1]?.mean.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] text-zinc-600 font-mono uppercase">Bull (95th)</div>
                  <div className="text-xs font-bold text-emerald-400 font-mono">${simResult.data[simResult.data.length - 1]?.p95.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] text-zinc-600 font-mono uppercase">Bear (5th)</div>
                  <div className="text-xs font-bold text-red-400 font-mono">${simResult.data[simResult.data.length - 1]?.p5.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}
          </>
          )
          ) : (
            <div className="bg-black/40 border border-zinc-800 rounded-xl p-3 mb-2 min-h-[160px]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-zinc-600" />
                  90-Day Historical Baseline
                </div>
              </div>
              <div 
                className="w-full h-[100px] relative mt-4 cursor-crosshair"
                onMouseLeave={() => setHoverHistPoint(null)}
                onMouseMove={(e) => {
                  if (!historyData.points) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const xRatio = (e.clientX - rect.left) / rect.width;
                  const simX = xRatio * 300;
                  
                  let closest = historyData.points[0];
                  let minDist = Infinity;
                  historyData.points.forEach(pt => {
                    const dist = Math.abs(pt.x - simX);
                    if (dist < minDist) { minDist = dist; closest = pt; }
                  });
                  setHoverHistPoint(closest);
                }}
              >
                {historyData.path ? (
                  <svg viewBox="0 0 300 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    <polyline points={historyData.path} fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="300" cy={100 - ((selectedCard.price - historyData.minP) / historyData.range) * 100} r="3" fill="#39ff14" />
                    {hoverHistPoint && (
                      <circle cx={hoverHistPoint.x} cy={hoverHistPoint.y} r="4" fill="white" className="drop-shadow-lg" />
                    )}
                  </svg>
                ) : null}
                
                {hoverHistPoint && (
                  <div 
                    className="absolute bg-white/10 backdrop-blur border border-white/20 text-white text-[10px] font-mono px-2 py-1 rounded top-[10px] pointer-events-none transform -translate-x-1/2 z-10 shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-transform duration-75"
                    style={{ left: `${(hoverHistPoint.x / 300) * 100}%` }}
                  >
                    ${hoverHistPoint.price.toFixed(2)}
                  </div>
                )}
                
                <div className="absolute top-0 right-0 text-[8px] text-zinc-600 font-mono pointer-events-none">${(selectedCard.priceData?.highPrice || selectedCard.price * 1.2).toFixed(2)}</div>
                <div className="absolute bottom-0 right-0 text-[8px] text-zinc-600 font-mono pointer-events-none">${(selectedCard.priceData?.lowPrice || selectedCard.price * 0.8).toFixed(2)}</div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="p-2 bg-yellow-900/10 border border-yellow-500/10 rounded-lg mb-2">
            <span className="text-[7px] text-yellow-600/70 leading-relaxed block">
              ⚠️ For entertainment purposes only. Not financial advice. Simulated projections are mathematically generated and may not reflect real market conditions. Past performance does not guarantee future results.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleSimulate}
              disabled={simRunning || !selectedCard.price}
              className="flex-1 bg-[#39ff14] text-black font-bold text-[10px] uppercase tracking-widest py-2 rounded-lg shadow-[0_0_15px_rgba(57,255,20,0.3)] hover:shadow-[0_0_25px_rgba(57,255,20,0.5)] transition-all active:translate-y-0.5 disabled:opacity-30"
            >
              {simRunning ? 'Computing...' : '⟳ Re-Simulate'}
            </button>
            {onSelectCard && (
              <button
                onClick={() => onSelectCard(selectedCard)}
                className="flex-1 bg-zinc-800 text-white font-bold text-[10px] uppercase tracking-widest py-2 rounded-lg border border-zinc-700 hover:border-[#39ff14]/50 transition-all"
              >
                📷 Grade This Card
              </button>
            )}
          </div>
        </div>
      )}
      {/* ═══ COMPARISON DOCK ═══ */}
      {compareItems.length > 0 && (
        <div className="flex-shrink-0 border-t border-[#eab308]/30 bg-gradient-to-t from-black via-zinc-950/95 to-zinc-950/80 backdrop-blur-xl">
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <div className="text-[9px] text-[#eab308] font-mono uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-[#eab308] rounded-full animate-pulse" />
              Compare ({compareItems.length}/4)
            </div>
            <button
              onClick={() => setCompareItems([])}
              className="text-[9px] text-zinc-500 hover:text-red-400 font-mono uppercase tracking-widest transition cursor-pointer"
            >
              ✕ Clear All
            </button>
          </div>
          <div className="flex gap-2 px-3 pb-3 overflow-x-auto scrollbar-thin scrollbar-thumb-[#eab308]/30">
            {compareItems.map((item, idx) => (
              <div
                key={item.itemId || idx}
                className="flex-shrink-0 w-[140px] bg-black/60 border border-[#eab308]/20 rounded-xl p-2 relative group/card hover:border-[#eab308]/50 transition-all"
              >
                <button
                  onClick={() => toggleCompare(item)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-900 border border-zinc-700 rounded-full text-[8px] text-zinc-500 hover:text-red-400 hover:border-red-400/50 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-all cursor-pointer z-10"
                >
                  ✕
                </button>
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="w-full aspect-square object-cover rounded-lg mb-2 border border-zinc-800"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}
                <div className="text-[9px] text-white font-medium line-clamp-2 leading-tight mb-1">{item.title}</div>
                <div className="text-xs font-bold text-[#eab308] font-mono">${item.price?.toFixed(2)}</div>
                {item._searchQuery && (
                  <div className="text-[7px] text-zinc-600 font-mono mt-1 truncate">via "{item._searchQuery}"</div>
                )}
              </div>
            ))}
            {compareItems.length >= 2 && (
              <div className="flex-shrink-0 w-[140px] bg-black/30 border border-dashed border-[#eab308]/20 rounded-xl p-3 flex flex-col items-center justify-center gap-2">
                <div className="text-[9px] text-[#eab308]/60 font-mono text-center uppercase tracking-widest">Price Δ</div>
                <div className="text-lg font-black text-white font-mono">
                  {(() => {
                    const prices = compareItems.map(i => i.price).filter(Boolean);
                    const diff = Math.max(...prices) - Math.min(...prices);
                    return `$${diff.toFixed(2)}`;
                  })()}
                </div>
                <div className="text-[8px] text-zinc-500 font-mono text-center">spread across {compareItems.length} items</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
