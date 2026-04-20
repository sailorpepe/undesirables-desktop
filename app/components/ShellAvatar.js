'use client';
/**
 * ShellAvatar.js — Reusable avatar display component
 * 
 * Shows the user's shell avatar (Undesirable default, NFT, or upload)
 * with an optional companion image overlay.
 * Click opens the ShellCustomizer modal.
 */
import React from 'react';
import { useShell } from './ShellProvider';

const SIZES = {
  sm: { main: 40, companion: 18, border: 2 },
  md: { main: 56, companion: 24, border: 2 },
  lg: { main: 80, companion: 32, border: 3 },
};

export default function ShellAvatar({ size = 'md', showCompanion = true, onClick }) {
  const { shell } = useShell();
  const dims = SIZES[size] || SIZES.md;

  const avatarUrl = shell.avatarUrl;
  const companionUrl = shell.companion?.enabled ? shell.companion.imageUrl : null;

  return (
    <div 
      className="relative inline-flex cursor-pointer group"
      onClick={onClick}
      title="Customize your look"
    >
      {/* Main Avatar */}
      <div 
        className="rounded-full overflow-hidden border-2 border-neon-primary/40 group-hover:border-neon-primary/80 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(var(--theme-primary-rgb,57,255,20),0.3)]"
        style={{ width: dims.main, height: dims.main, borderWidth: dims.border }}
      >
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt="Shell Avatar" 
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div 
          className={`w-full h-full bg-gradient-to-br from-neon-primary/30 to-neon-primary/10 flex items-center justify-center text-neon-primary font-mono font-bold`}
          style={{ 
            display: avatarUrl ? 'none' : 'flex',
            fontSize: dims.main * 0.35 
          }}
        >
          🌸
        </div>
      </div>

      {/* Companion Overlay */}
      {showCompanion && companionUrl && (
        <div 
          className="absolute -bottom-0.5 -right-0.5 rounded-full overflow-hidden border border-neon-primary/60 bg-black shadow-lg"
          style={{ width: dims.companion, height: dims.companion }}
        >
          <img 
            src={companionUrl} 
            alt="Companion" 
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Edit Badge */}
      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neon-primary/20 border border-neon-primary/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[8px]">✏️</span>
      </div>
    </div>
  );
}
