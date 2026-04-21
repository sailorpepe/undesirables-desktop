'use client';
/**
 * ShellCustomizer.js — "Your Look" Settings Panel
 * 
 * Full modal for customizing the visual shell layer:
 * - Avatar source selection (Default / NFT / Upload)
 * - NFT contract + token ID input with live fetch
 * - Image upload via file dialog
 * - Preset theme picker
 * - Companion image slot
 * - Live preview
 */
import React, { useState, useEffect } from 'react';
import { X, Palette, Image as ImageIcon, Sparkles, Upload, Search, RotateCcw, Check } from 'lucide-react';
import { useShell } from './ShellProvider';
import useNFTFetch from '../hooks/useNFTFetch';
import { extractPalette, paletteToThemeVars } from '../utils/extractPalette';

// SECURITY: Only allow safe URL schemes for user-provided image URLs.
// Blocks javascript:, data: (SVG script injection), file:// (local access), http:// (tracking/MITM)
function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('ipfs://') ||
    trimmed.startsWith('ar://') ||
    trimmed.startsWith('asset:')
  );
}

const PRESET_THEMES = [
  { id: 'default', label: 'Hacker Green', color: '#b4f7a6', bg: '#112d1c' },
  { id: 'cyberpunk', label: 'Magenta Punk', color: '#ff00ff', bg: '#140014' },
  { id: 'sakura', label: 'Cherry Blossom', color: '#ffb7c5', bg: '#1f0b11' },
  { id: 'amber', label: 'Nous Amber', color: '#ffb000', bg: '#160f00' },
  { id: 'sonic', label: 'Bootleg Sonic', color: '#0094ff', bg: '#000e26' },
  { id: 'obsidian', label: 'Crimson', color: '#ff0033', bg: '#1a0005' },
  { id: 'ghost', label: 'Null Chrome', color: '#ffffff', bg: '#0a0a0a' },
];

export default function ShellCustomizer({ isOpen, onClose }) {
  const { 
    shell, setShellSource, setNFTInfo, setNFTMetadata, 
    setUploadedAvatar, setCompanion, setThemePreset, 
    setExtractedPalette, resetShell 
  } = useShell();

  const { fetchNFT, loading: nftLoading, error: nftError, imageUrl: fetchedImage, nftName, metadata: fetchedMeta } = useNFTFetch();

  // Local form state
  const [contractInput, setContractInput] = useState(shell.nft?.contractAddress || '');
  const [tokenIdInput, setTokenIdInput] = useState(shell.nft?.tokenId || '');
  const [activeTab, setActiveTab] = useState(shell.source || 'default');
  const [companionInput, setCompanionInput] = useState(shell.companion?.imageUrl || '');
  const [companionLabel, setCompanionLabel] = useState(shell.companion?.label || '');
  const [extracting, setExtracting] = useState(false);

  // Sync local state when shell changes
  useEffect(() => {
    setContractInput(shell.nft?.contractAddress || '');
    setTokenIdInput(shell.nft?.tokenId || '');
    setActiveTab(shell.source || 'default');
    setCompanionInput(shell.companion?.imageUrl || '');
    setCompanionLabel(shell.companion?.label || '');
  }, [shell]);

  // When NFT is fetched, auto-extract palette
  useEffect(() => {
    if (fetchedImage && fetchedMeta) {
      setNFTMetadata(fetchedMeta, fetchedImage);
      
      // Auto-extract palette from the NFT image
      setExtracting(true);
      extractPalette(fetchedImage)
        .then(palette => {
          setExtractedPalette(palette);
          setExtracting(false);
        })
        .catch(() => setExtracting(false));
    }
  }, [fetchedImage, fetchedMeta]);

  const handleFetchNFT = async () => {
    if (!contractInput || !tokenIdInput) return;
    setNFTInfo(contractInput, tokenIdInput);
    await fetchNFT(contractInput, tokenIdInput);
  };

  const handleUpload = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
        title: 'Select Avatar Image',
      });
      if (selected) {
        // Convert to asset URL for display
        const { convertFileSrc } = await import('@tauri-apps/api/core');
        const assetUrl = convertFileSrc(selected);
        setUploadedAvatar(selected, assetUrl);

        // Extract palette from uploaded image
        setExtracting(true);
        extractPalette(assetUrl)
          .then(palette => {
            setExtractedPalette(palette);
            setExtracting(false);
          })
          .catch(() => setExtracting(false));
      }
    } catch (e) {
      console.error('Upload dialog error:', e);
    }
  };

  const handleSetSource = (source) => {
    setActiveTab(source);
    setShellSource(source);
    
    if (source === 'default') {
      // Clear custom avatar when switching to default
      setNFTMetadata(null, null);
    }
  };

  const handleApplyTheme = (presetId) => {
    setThemePreset(presetId);
    // Apply to document immediately
    document.documentElement.setAttribute('data-theme', presetId);
    localStorage.setItem('undesirables_theme', presetId);
  };

  const handleApplyExtractedTheme = () => {
    if (!shell.theme.extractedPalette) return;
    const vars = paletteToThemeVars(shell.theme.extractedPalette);
    // Apply custom CSS variables directly
    Object.entries(vars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
    setThemePreset('custom');
  };

  const [companionError, setCompanionError] = useState('');

  const handleSaveCompanion = () => {
    if (companionInput && !isValidImageUrl(companionInput)) {
      setCompanionError('URL must start with https://, ipfs://, or ar://');
      return;
    }
    setCompanionError('');
    setCompanion(companionInput || null, companionLabel);
  };

  const handleReset = () => {
    resetShell();
    document.documentElement.setAttribute('data-theme', 'default');
    localStorage.setItem('undesirables_theme', 'default');
    // Clear any custom CSS vars
    ['--theme-primary', '--theme-bg', '--theme-card', '--theme-text'].forEach(v => {
      document.documentElement.style.removeProperty(v);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-zinc-950/95 border border-neon-primary/30 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)] relative">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Palette size={20} className="text-neon-primary" />
            <h2 className="text-neon-primary font-mono font-bold text-lg tracking-widest uppercase">Your Look</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8">

          {/* ========== AVATAR SOURCE ========== */}
          <div>
            <h3 className="text-zinc-400 font-mono text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
              <ImageIcon size={14} /> Avatar Source
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'default', label: 'Undesirable', icon: '🌸', desc: 'Use your soul\'s default' },
                { id: 'nft', label: 'External NFT', icon: '💎', desc: 'Paste contract + token' },
                { id: 'upload', label: 'Upload', icon: '📁', desc: 'Local image file' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => handleSetSource(opt.id)}
                  className={`p-4 rounded-xl border font-mono text-left transition-all ${
                    activeTab === opt.id 
                      ? 'border-neon-primary/60 bg-neon-primary/10 shadow-[0_0_20px_rgba(var(--theme-primary-rgb,57,255,20),0.15)]' 
                      : 'border-zinc-800 bg-black/30 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-2xl block mb-2">{opt.icon}</span>
                  <span className={`text-sm font-bold block ${activeTab === opt.id ? 'text-neon-primary' : 'text-zinc-300'}`}>
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-1">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ========== NFT INPUT ========== */}
          {activeTab === 'nft' && (
            <div className="bg-black/40 border border-zinc-800 rounded-xl p-5 space-y-4">
              <h4 className="text-zinc-300 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                <Search size={14} /> Fetch NFT Metadata
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-zinc-500 text-[10px] font-mono uppercase block mb-1">Contract Address</label>
                  <input
                    type="text"
                    value={contractInput}
                    onChange={e => setContractInput(e.target.value)}
                    placeholder="0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D"
                    className="w-full bg-black/60 border border-zinc-700 focus:border-neon-primary/50 text-white font-mono text-sm py-2.5 px-3 rounded-lg outline-none transition-all"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-zinc-500 text-[10px] font-mono uppercase block mb-1">Token ID</label>
                    <input
                      type="text"
                      value={tokenIdInput}
                      onChange={e => setTokenIdInput(e.target.value)}
                      placeholder="420"
                      className="w-full bg-black/60 border border-zinc-700 focus:border-neon-primary/50 text-white font-mono text-sm py-2.5 px-3 rounded-lg outline-none transition-all"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleFetchNFT}
                      disabled={nftLoading || !contractInput || !tokenIdInput}
                      className="px-6 py-2.5 bg-neon-primary/20 hover:bg-neon-primary/30 disabled:bg-zinc-800 disabled:text-zinc-600 text-neon-primary border border-neon-primary/30 rounded-lg font-mono text-xs uppercase tracking-widest transition-all flex items-center gap-2"
                    >
                      {nftLoading ? (
                        <><span className="animate-spin">⟳</span> Fetching...</>
                      ) : (
                        <><Search size={14} /> Fetch</>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {nftError && (
                <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 font-mono text-xs">
                  ⚠️ {nftError}
                </div>
              )}

              {shell.avatarUrl && shell.source === 'nft' && (
                <div className="flex items-center gap-4 p-3 bg-emerald-900/10 border border-emerald-500/20 rounded-lg">
                  <img src={shell.avatarUrl} alt="NFT" className="w-16 h-16 rounded-lg object-cover border border-white/10" />
                  <div>
                    <div className="text-emerald-400 font-mono text-sm font-bold">{shell.nft?.metadata?.name || 'NFT Loaded'}</div>
                    <div className="text-zinc-500 text-[10px] font-mono mt-1">
                      {shell.nft?.contractAddress?.slice(0, 8)}...{shell.nft?.contractAddress?.slice(-6)}
                    </div>
                  </div>
                  <Check size={20} className="text-emerald-400 ml-auto" />
                </div>
              )}
            </div>
          )}

          {/* ========== UPLOAD ========== */}
          {activeTab === 'upload' && (
            <div className="bg-black/40 border border-zinc-800 rounded-xl p-5">
              <div 
                onClick={handleUpload}
                className="w-full border-2 border-dashed border-zinc-700 hover:border-neon-primary/50 rounded-xl p-8 text-center cursor-pointer transition-all hover:bg-neon-primary/5 flex flex-col items-center gap-3"
              >
                {shell.avatarUrl && shell.source === 'upload' ? (
                  <>
                    <img src={shell.avatarUrl} alt="Uploaded" className="w-20 h-20 rounded-full object-cover border-2 border-neon-primary/30" />
                    <span className="text-neon-primary font-mono text-xs">Click to change</span>
                  </>
                ) : (
                  <>
                    <Upload size={32} className="text-zinc-500" />
                    <span className="text-zinc-400 font-mono text-sm">Click to browse for an image</span>
                    <span className="text-zinc-600 text-[10px] font-mono">PNG, JPG, WebP, GIF</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ========== THEME PRESETS ========== */}
          <div>
            <h3 className="text-zinc-400 font-mono text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
              <Sparkles size={14} /> Theme Preset
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {PRESET_THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleApplyTheme(t.id)}
                  className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all min-w-[90px] ${
                    shell.theme.preset === t.id 
                      ? 'border-white/30 bg-white/5 shadow-lg' 
                      : 'border-zinc-800 bg-black/30 hover:border-zinc-600'
                  }`}
                >
                  <div 
                    className="w-8 h-8 rounded-full border-2"
                    style={{ backgroundColor: t.bg, borderColor: t.color, boxShadow: shell.theme.preset === t.id ? `0 0 12px ${t.color}40` : 'none' }}
                  >
                    <div className="w-full h-full rounded-full" style={{ background: `radial-gradient(circle, ${t.color}40, transparent)` }} />
                  </div>
                  <span className={`text-[9px] font-mono uppercase tracking-wider ${shell.theme.preset === t.id ? 'text-white' : 'text-zinc-500'}`}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Auto-extracted theme from avatar image */}
            {shell.theme.extractedPalette && (
              <div className="mt-3 p-3 bg-black/40 border border-zinc-800 rounded-xl flex items-center gap-4">
                <div className="flex gap-1">
                  {shell.theme.extractedPalette.palette?.slice(0, 5).map((c, i) => (
                    <div key={i} className="w-6 h-6 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <button
                  onClick={handleApplyExtractedTheme}
                  disabled={extracting}
                  className="ml-auto px-4 py-1.5 bg-neon-primary/10 hover:bg-neon-primary/20 text-neon-primary border border-neon-primary/20 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all"
                >
                  {extracting ? 'Extracting...' : 'Apply Extracted'}
                </button>
              </div>
            )}
          </div>

          {/* ========== COMPANION SLOT ========== */}
          <div>
            <h3 className="text-zinc-400 font-mono text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
              <ImageIcon size={14} /> Companion Image
              <span className="text-zinc-600 text-[9px] ml-1">(experimental)</span>
            </h3>
            <div className="bg-black/40 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div>
                <label className="text-zinc-500 text-[10px] font-mono uppercase block mb-1">Image URL</label>
                <input
                  type="text"
                  value={companionInput}
                  onChange={e => setCompanionInput(e.target.value)}
                  placeholder="https://... or ipfs://..."
                  className="w-full bg-black/60 border border-zinc-700 focus:border-neon-primary/50 text-white font-mono text-xs py-2 px-3 rounded-lg outline-none transition-all"
                />
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-zinc-500 text-[10px] font-mono uppercase block mb-1">Label</label>
                  <input
                    type="text"
                    value={companionLabel}
                    onChange={e => setCompanionLabel(e.target.value)}
                    placeholder="My Pudgy Penguin"
                    className="w-full bg-black/60 border border-zinc-700 focus:border-neon-primary/50 text-white font-mono text-xs py-2 px-3 rounded-lg outline-none transition-all"
                  />
                </div>
                <button
                  onClick={handleSaveCompanion}
                  className="px-4 py-2 bg-neon-primary/10 hover:bg-neon-primary/20 text-neon-primary border border-neon-primary/20 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all"
                >
                  Set
                </button>
                {companionError && (
                  <span className="text-red-400 font-mono text-[10px] ml-2">{companionError}</span>
                )}
              </div>
              {shell.companion?.imageUrl && (
                <div className="flex items-center gap-3 mt-2">
                  <img src={shell.companion.imageUrl} alt="Companion" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                  <span className="text-zinc-400 font-mono text-xs">{shell.companion.label || 'Companion'}</span>
                  <button onClick={() => setCompanion(null)} className="ml-auto text-zinc-600 hover:text-red-400 text-xs">Remove</button>
                </div>
              )}
            </div>
          </div>

          {/* ========== ACTIONS ========== */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-zinc-500 hover:text-red-400 font-mono text-xs uppercase tracking-widest transition-all"
            >
              <RotateCcw size={14} /> Reset All
            </button>
            <button
              onClick={onClose}
              className="px-8 py-2.5 bg-neon-primary/20 hover:bg-neon-primary/30 text-neon-primary border border-neon-primary/30 rounded-lg font-mono text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(var(--theme-primary-rgb,57,255,20),0.1)]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
