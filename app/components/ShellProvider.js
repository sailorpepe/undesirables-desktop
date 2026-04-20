'use client';
/**
 * ShellProvider.js — React Context for the visual Shell layer
 * 
 * Manages avatar source, NFT info, companion image, and theme preset.
 * Persists all state to @tauri-apps/plugin-store (shell.json).
 * 
 * The Shell is PURELY cosmetic — it never touches SoulParticles.js
 * physics, Big Five scores, or the SOUL.md personality engine.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const ShellContext = createContext(null);

const DEFAULT_SHELL = {
  source: 'default',         // 'default' | 'nft' | 'upload'
  avatarUrl: null,
  nft: {
    contractAddress: '',
    tokenId: '',
    chain: 'ethereum',
    metadata: null,
  },
  uploadPath: null,
  companion: {
    enabled: false,
    imageUrl: null,
    label: '',
  },
  theme: {
    preset: 'default',       // Matches data-theme attribute names
    extractedPalette: null,
    customAccent: null,
  },
};

export function ShellProvider({ children }) {
  const [shell, setShell] = useState(DEFAULT_SHELL);
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef(null);

  // Load from plugin-store on mount
  useEffect(() => {
    let cancelled = false;

    const loadShell = async () => {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('shell.json', { autoSave: true });
        const saved = await store.get('shell_config');

        if (saved && !cancelled) {
          // Merge with defaults to handle new fields added in future versions
          setShell(prev => ({
            ...DEFAULT_SHELL,
            ...saved,
            nft: { ...DEFAULT_SHELL.nft, ...saved.nft },
            companion: { ...DEFAULT_SHELL.companion, ...saved.companion },
            theme: { ...DEFAULT_SHELL.theme, ...saved.theme },
          }));
        }
      } catch (e) {
        // Not in Tauri environment (dev mode) — use localStorage fallback
        try {
          const saved = localStorage.getItem('undesirables_shell');
          if (saved && !cancelled) {
            const parsed = JSON.parse(saved);
            setShell(prev => ({
              ...DEFAULT_SHELL,
              ...parsed,
              nft: { ...DEFAULT_SHELL.nft, ...parsed.nft },
              companion: { ...DEFAULT_SHELL.companion, ...parsed.companion },
              theme: { ...DEFAULT_SHELL.theme, ...parsed.theme },
            }));
          }
        } catch {}
      }
      if (!cancelled) setLoaded(true);
    };

    loadShell();

    // Listen for shell-updated events from auto-fetch in ChatInterface
    const handleShellUpdate = () => loadShell();
    window.addEventListener('shell-updated', handleShellUpdate);

    return () => { 
      cancelled = true; 
      window.removeEventListener('shell-updated', handleShellUpdate);
    };
  }, []);

  // Debounced save to store whenever shell changes
  useEffect(() => {
    if (!loaded) return;

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('shell.json', { autoSave: true });
        await store.set('shell_config', shell);
        await store.save();
      } catch {
        // Fallback to localStorage in dev
        try {
          localStorage.setItem('undesirables_shell', JSON.stringify(shell));
        } catch {}
      }
    }, 500);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [shell, loaded]);

  const setShellSource = useCallback((source) => {
    setShell(prev => ({ ...prev, source }));
  }, []);

  const setNFTInfo = useCallback((contractAddress, tokenId, chain = 'ethereum') => {
    setShell(prev => ({
      ...prev,
      source: 'nft',
      nft: { ...prev.nft, contractAddress, tokenId, chain },
    }));
  }, []);

  const setNFTMetadata = useCallback((metadata, imageUrl) => {
    setShell(prev => ({
      ...prev,
      avatarUrl: imageUrl,
      nft: { ...prev.nft, metadata },
    }));
  }, []);

  const setUploadedAvatar = useCallback((filePath, dataUrl) => {
    setShell(prev => ({
      ...prev,
      source: 'upload',
      uploadPath: filePath,
      avatarUrl: dataUrl || filePath,
    }));
  }, []);

  const setCompanion = useCallback((imageUrl, label = '') => {
    setShell(prev => ({
      ...prev,
      companion: { enabled: !!imageUrl, imageUrl, label },
    }));
  }, []);

  const setThemePreset = useCallback((preset) => {
    setShell(prev => ({
      ...prev,
      theme: { ...prev.theme, preset },
    }));
  }, []);

  const setExtractedPalette = useCallback((palette) => {
    setShell(prev => ({
      ...prev,
      theme: { ...prev.theme, extractedPalette: palette },
    }));
  }, []);

  const resetShell = useCallback(() => {
    setShell(DEFAULT_SHELL);
  }, []);

  return (
    <ShellContext.Provider value={{
      shell,
      loaded,
      setShellSource,
      setNFTInfo,
      setNFTMetadata,
      setUploadedAvatar,
      setCompanion,
      setThemePreset,
      setExtractedPalette,
      resetShell,
    }}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    // Return a safe no-op shell when used outside provider (e.g., during SSR)
    return {
      shell: DEFAULT_SHELL,
      loaded: false,
      setShellSource: () => {},
      setNFTInfo: () => {},
      setNFTMetadata: () => {},
      setUploadedAvatar: () => {},
      setCompanion: () => {},
      setThemePreset: () => {},
      setExtractedPalette: () => {},
      resetShell: () => {},
    };
  }
  return ctx;
}
