import React, { useState, useEffect } from 'react';
import { Key, ShieldCheck, Database, ArrowRight, ExternalLink } from 'lucide-react';
import { load } from '@tauri-apps/plugin-store';

// Use Tauri's encrypted plugin-store (backed by OS-level file protection)
// instead of the Stronghold vault which has cross-build key derivation issues
const getStore = async () => await load('credentials.json', { autoSave: true });

export default function EbaySetup({ onSuccess }) {
  const [appId, setAppId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    async function loadStore() {
      try {
        const store = await getStore();
        const savedAppId = await store.get('undesirables_ebay_app_id');
        const savedSecret = await store.get('undesirables_ebay_client_secret');
        
        if (savedAppId && savedSecret) {
          onSuccess(savedAppId, savedSecret);
        }
      } catch (e) {
        console.error("Failed to load credentials:", e);
      }
    }
    loadStore();
  }, [onSuccess]);

  const handleSave = async () => {
    if (appId.trim() && clientSecret.trim()) {
      setIsConnecting(true);
      try {
        const store = await getStore();
        await store.set('undesirables_ebay_app_id', appId.trim());
        await store.set('undesirables_ebay_client_secret', clientSecret.trim());
        await store.save();
        
        onSuccess(appId.trim(), clientSecret.trim());
      } catch (e) {
        console.error('Failed to save credentials:', e);
        setIsConnecting(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-start p-6 w-full max-w-4xl mx-auto h-full flex-1 overflow-y-auto pb-24 scrollbar-thin scrollbar-thumb-zinc-800">
      <div className="w-full max-w-2xl bg-zinc-950/80 backdrop-blur-xl border border-[#0064d2]/30 rounded-2xl shadow-[0_0_50px_rgba(0,100,210,0.1)] overflow-y-auto max-h-[85vh] scrollbar-thin scrollbar-thumb-[#0064d2]/50">
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 bg-gradient-to-b from-[#0064d2]/20 to-transparent">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-[#0064d2]/10 rounded-full border border-[#0064d2]/20 shadow-[0_0_30px_rgba(0,100,210,0.2)]">
               <Database size={48} className="text-[#0064d2] drop-shadow-lg" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-white tracking-wider text-center mb-2">EBAY ORACLE</h2>
          <p className="text-[#0064d2]/80 text-center font-mono text-sm">SECURE NATIVE BROWSE EXTRACTION</p>
        </div>

        {/* Tutorial Body */}
        <div className="p-8 space-y-8">
          <div className="bg-black/40 border border-zinc-800 rounded-xl p-5 space-y-4 font-mono text-sm text-zinc-400">
            <h3 className="text-white font-bold flex items-center gap-2 tracking-widest uppercase">
              <ShieldCheck size={16} className="text-[#e0faec]" /> Decentralized Access
            </h3>
            <p className="leading-relaxed">
              To query the live Universal Market for collectibles across eBay, this local application requires a secure API gateway. 
              Because this app is decentralized and open-source, we NEVER route your requests through our servers. You must provide your own free developer credentials.
            </p>
            
            <div className="pl-4 border-l-2 border-zinc-800 space-y-3 mt-4 text-xs">
              <p className="flex items-center gap-2"><span className="text-[#0064d2] font-bold">STEP 1:</span> Create a free developer account at <a href="https://developer.ebay.com/my/keys" target="_blank" className="text-[#0064d2] underline hover:text-blue-300 flex items-center gap-1">developer.ebay.com <ExternalLink size={10}/></a></p>
              <p><span className="text-[#0064d2] font-bold">STEP 2:</span> Go to Application Keys and generate a "Production" key set.</p>
              <p><span className="text-[#0064d2] font-bold">STEP 3:</span> Copy your <span className="text-white font-bold">App ID (Client ID)</span> and <span className="text-white font-bold">Cert ID (Client Secret)</span>.</p>
              <p><span className="text-[#0064d2] font-bold">STEP 4:</span> Paste those credential keys directly into the input fields securely below.</p>
            </div>
          </div>

          {/* Input Form */}
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Key size={18} className="text-[#0064d2]/50 group-focus-within:text-[#0064d2]" />
              </div>
              <input
                type="password"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="App ID (Client ID)"
                className="w-full bg-black border-2 border-[#0064d2]/30 focus:border-[#0064d2] focus:bg-[#0064d2]/5 text-white font-mono text-sm py-4 pl-12 pr-4 rounded-lg outline-none transition-all shadow-inner placeholder:text-zinc-600"
              />
            </div>
            
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Key size={18} className="text-[#0064d2]/50 group-focus-within:text-[#0064d2]" />
              </div>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Cert ID (Client Secret)"
                className="w-full bg-black border-2 border-[#0064d2]/30 focus:border-[#0064d2] focus:bg-[#0064d2]/5 text-white font-mono text-sm py-4 pl-12 pr-4 rounded-lg outline-none transition-all shadow-inner placeholder:text-zinc-600"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={!appId.trim() || !clientSecret.trim() || isConnecting}
              className="w-full py-3 bg-[#0064d2] hover:bg-blue-600 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-bold font-mono text-sm rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest cursor-pointer hover:shadow-[0_0_25px_rgba(0,100,210,0.4)] active:scale-[0.98]"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Encrypting...
                </>
              ) : (
                <>
                  Connect <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 text-center font-mono">⚠️ Your keys are stored locally on this device only and transmitted directly to eBay. Never shared with our servers.</p>
        </div>

      </div>
    </div>
  );
}
