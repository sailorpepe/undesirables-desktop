import React, { useState, useEffect } from 'react';
import { Key, ShieldCheck, Database, ArrowRight, ExternalLink } from 'lucide-react';
import NFTDashboard from './NFTDashboard';
import { load } from '@tauri-apps/plugin-store';

// Use Tauri's plugin-store (backed by OS-level file protection)
// instead of the Stronghold vault which has cross-build Argon2 key derivation issues
const getStore = async () => await load('credentials.json', { autoSave: true });

export default function AlchemySetup({ onBack }) {
  const [apiKey, setApiKey] = useState('');
  const [isLinked, setIsLinked] = useState(false);

  useEffect(() => {
    async function loadStore() {
      try {
        const store = await getStore();
        const savedKey = await store.get('undesirables_alchemy_key');
        
        if (savedKey && savedKey.length > 20) {
          setApiKey(savedKey);
          setIsLinked(true);
        }
      } catch (e) {
        console.error("Failed to load credentials:", e);
      }
    }
    loadStore();
  }, []);

  const handleSave = async () => {
    if (apiKey.trim().length > 20) {
      try {
        const store = await getStore();
        await store.set('undesirables_alchemy_key', apiKey.trim());
        await store.save();
        
        setIsLinked(true);
      } catch (e) {
        console.error("Failed to save credentials:", e);
      }
    }
  };

  const clearKey = async () => {
    try {
      const store = await getStore();
      await store.delete('undesirables_alchemy_key');
      await store.save();
      setApiKey('');
      setIsLinked(false);
    } catch (e) {
      console.error("Failed to clear credentials:", e);
    }
  };

  if (isLinked) {
    return <NFTDashboard apiKey={apiKey} onBack={onBack} onDisconnect={clearKey} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative w-full max-w-4xl mx-auto">
      <button 
        onClick={onBack}
        className="absolute top-6 left-6 text-[#39ff14]/70 hover:text-[#39ff14] font-mono text-xs tracking-widest border border-[#39ff14]/30 px-4 py-2 rounded-md bg-black/50"
      >
        ← RETURN TO CORE
      </button>

      <div className="w-full max-w-2xl bg-zinc-950/80 backdrop-blur-xl border border-blue-500/30 rounded-2xl shadow-[0_0_50px_rgba(59,130,246,0.1)] overflow-hidden">
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 bg-gradient-to-b from-blue-900/20 to-transparent">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-500/10 rounded-full border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
               <Database size={48} className="text-blue-400 drop-shadow-lg" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-white tracking-wider text-center mb-2">ALCHEMY NEXUS</h2>
          <p className="text-blue-400/80 text-center font-mono text-sm">SECURE NATIVE WEB3 EXTRACTION</p>
        </div>

        {/* Tutorial Body */}
        <div className="p-8 space-y-8">
          <div className="bg-black/40 border border-zinc-800 rounded-xl p-5 space-y-4 font-mono text-sm text-zinc-400">
            <h3 className="text-white font-bold flex items-center gap-2 tracking-widest uppercase">
              <ShieldCheck size={16} className="text-emerald-500" /> Decentralized Access
            </h3>
            <p className="leading-relaxed">
              To query live Ethereum Mainnet assets (like your Undesirables or Ordinookis), this local client requires a secure API gateway. We use <span className="text-blue-400 font-bold">Alchemy</span>. 
              Because this app is decentralized, you must generate your own free private key.
            </p>
            
            <div className="pl-4 border-l-2 border-zinc-800 space-y-3 mt-4 text-xs">
              <p className="flex items-center gap-2"><span className="text-blue-500 font-bold">STEP 1:</span> Create a free account at <a href="https://dashboard.alchemy.com" target="_blank" className="text-blue-400 underline hover:text-blue-300 flex items-center gap-1">dashboard.alchemy.com <ExternalLink size={10}/></a></p>
              <p><span className="text-blue-500 font-bold">STEP 2:</span> Click "Create New App". Name it "Undesirables UI".</p>
              <p><span className="text-blue-500 font-bold">STEP 3:</span> Select "Ethereum" chain, and "Mainnet" network.</p>
              <p><span className="text-blue-500 font-bold">STEP 4:</span> Click "API Key" on the dashboard and paste it below.</p>
            </div>
          </div>

          {/* Input Form */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Key size={18} className="text-blue-500/50 group-focus-within:text-blue-400" />
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste Alchemy API Key (e.g., tR4R6V45SQb...)"
              className="w-full bg-black/60 border border-zinc-800 focus:border-blue-500 text-white font-mono text-sm py-4 pl-12 pr-32 rounded-lg outline-none transition-all shadow-inner"
            />
            <button
              onClick={handleSave}
              disabled={apiKey.length < 20}
              className="absolute inset-y-2 right-2 px-6 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold font-mono text-xs rounded transition-all flex items-center gap-2 uppercase tracking-widest"
            >
              Connect <ArrowRight size={14} />
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 text-center font-mono">⚠️ Your key is stored locally on this device only and never transmitted to our servers.</p>
        </div>

      </div>
    </div>
  );
}
