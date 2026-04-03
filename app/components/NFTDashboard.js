import React, { useState } from 'react';
import { Search, ImageOff, Hexagon, DatabaseZap, LogOut } from 'lucide-react';

export default function NFTDashboard({ apiKey, onBack, onDisconnect }) {
  const [address, setAddress] = useState('');
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchNFTs = async () => {
    if (!address.match(/^0x[a-fA-F0-9]{40}$/) && !address.endsWith('.eth')) {
      setError('Please enter a valid 0x Ethereum Address or ENS.');
      return;
    }
    
    setLoading(true);
    setError('');
    setNfts([]);
    
    try {
      const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?owner=${address}&withMetadata=true&pageSize=20`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error('Alchemy API rejected the key or encountered an error.');
      }
      
      const data = await res.json();
      setNfts(data.ownedNfts || []);
    } catch (e) {
      setError(e.message || 'Failed to fetch NFTs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-6 relative w-full max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-2">
      
      {/* Header Bar */}
      <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
        <div>
           <button onClick={onBack} className="text-[#39ff14] hover:text-[#39ff14]/70 font-mono text-xs mb-2">← return to core</button>
           <h2 className="text-3xl font-black text-white tracking-widest flex items-center gap-3">
             <Hexagon className="text-blue-500" /> ETHEREUM NEXUS
           </h2>
        </div>
        <div className="flex items-center gap-4">
           <span className="text-[10px] uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20 flex items-center gap-2 font-bold">
             <DatabaseZap size={12} /> Alchemy Link Active
           </span>
           <button onClick={onDisconnect} className="text-zinc-500 hover:text-red-500 transition-colors" title="Disconnect API Key">
             <LogOut size={16} />
           </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="max-w-2xl mx-auto w-full mb-12">
        <div className="relative group flex items-center">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Search Wallet Address (0x...)"
              onKeyDown={(e) => e.key === 'Enter' && fetchNFTs()}
              className="w-full bg-zinc-950/80 backdrop-blur-md border border-zinc-800 focus:border-blue-500 text-white font-mono text-sm py-4 pl-6 pr-32 rounded-lg outline-none transition-all shadow-inner"
            />
            <button
              onClick={fetchNFTs}
              disabled={loading || !address}
              className="absolute right-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold font-mono text-xs rounded transition-all flex items-center gap-2 uppercase tracking-widest pointer-events-auto"
            >
              {loading ? 'Scanning...' : 'Extract'} <Search size={14} />
            </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-3 text-center tracking-wide">{error}</p>}
      </div>

      {/* Grid Layout */}
      {nfts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
           {nfts.map((nft, idx) => {
              const image = nft.image?.cachedUrl || nft.image?.pnqUrl || nft.image?.originalUrl;
              const title = nft.name || `${nft.contract.name || 'Unknown Contract'} #${nft.tokenId}`;
              
              return (
                <div key={idx} className="group relative bg-[#040905] border border-blue-900/40 rounded-xl overflow-hidden shadow-lg hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:border-blue-500/50 transition-all duration-300">
                  <div className="aspect-square bg-black border-b border-zinc-800 relative overflow-hidden flex items-center justify-center">
                    {image ? (
                      <img src={image} alt={title} className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-zinc-700">
                        <ImageOff />
                        <span className="text-[9px] uppercase tracking-widest">No Asset Gateway</span>
                      </div>
                    )}
                    
                    {/* Hover Overlay Meta */}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-between backdrop-blur-sm">
                       <div>
                         <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">CONTRACT</p>
                         <p className="text-[11px] text-blue-400 font-mono break-all leading-tight">{nft.contract.address}</p>
                       </div>
                       <div>
                         <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">STANDARD</p>
                         <p className="text-[11px] text-emerald-400 font-mono">{nft.contract.tokenType}</p>
                       </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-zinc-950 to-black">
                     <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1 truncate block">{nft.contract.name}</p>
                     <h3 className="font-bold text-sm text-zinc-200 truncate pr-2" title={title}>{title}</h3>
                  </div>
                </div>
              );
           })}
        </div>
      )}
    </div>
  );
}
