import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';

export default function SoulInjector({ onConnect, bootToken }) {
  const [path, setPath] = useState('');
  const [folderName, setFolderName] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [isHovering, setIsHovering] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleInjectionPath = async (selected) => {
    setErrorMsg('');
    let normalized = selected.replace(/\\/g, '/').replace(/\/$/, '');
    
    let finalReadPath = normalized + '/SOUL.md';
    let workspaceDir = normalized;

    // If the user dropped a markdown file directly (e.g., SOUL.md or SOUL 2.md), 
    // we use that exact file for parsing, but mount the parent directory as the workspace!
    if (normalized.toLowerCase().endsWith('.md')) {
      finalReadPath = normalized;
      workspaceDir = normalized.substring(0, normalized.lastIndexOf('/'));
    }

    setPath(workspaceDir);
    const parts = workspaceDir.split('/');
    const soulId = parts[parts.length - 1];
    setFolderName(`Soul #${soulId}`);

    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const content = await readTextFile(finalReadPath);
      
      const getMatch = (regex, fallback) => {
        const m = content.match(regex);
        return m && m[1] ? m[1].trim() : fallback;
      };

      const name = getMatch(/name:\s+"(.*?)"/, `Undesirable #${soulId}`);
      const archetype = getMatch(/archetype:\s+"(.*?)"/, "Unknown Entity");
      const neuroticism = Math.max(0, Math.min(100, parseInt(getMatch(/neuroticism:\s*(\d+)/i, "50"), 10)));
      const extraversion = Math.max(0, Math.min(100, parseInt(getMatch(/extraversion:\s*(\d+)/i, "50"), 10)));
      const openness = Math.max(0, Math.min(100, parseInt(getMatch(/openness:\s*(\d+)/i, "50"), 10)));
      const agreeableness = Math.max(0, Math.min(100, parseInt(getMatch(/agreeableness:\s*(\d+)/i, "50"), 10)));
      const conscientiousness = Math.max(0, Math.min(100, parseInt(getMatch(/conscientiousness:\s*(\d+)/i, "50"), 10)));
      
      setPreviewData({ name, archetype, neuroticism, extraversion, openness, agreeableness, conscientiousness });
    } catch (err) {
      console.error("Could not parse SOUL.md for preview:", err);
      setErrorMsg(`Access Denied or File Not Found: \nTargeted: ${normalized}/SOUL.md \nError: ${err}`);
    }
  };

  useEffect(() => {
    let unlistenDrag;
    
    const setupDrag = async () => {
      try {
        if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        
        unlistenDrag = await getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type === 'over') {
            setIsHovering(true);
          } else if (event.payload.type === 'drop') {
            setIsHovering(false);
            const droppedPaths = event.payload.paths;
            if (droppedPaths && droppedPaths.length > 0) {
              const droppedPath = droppedPaths[0];
              const ext = droppedPath.split('.').pop().toLowerCase();
              // Only accept directories and .md files — ignore video/image/code drops
              const mediaExts = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a',
                                 'png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif', 'bmp', 'tiff', 'avif', 'svg',
                                 'sol', 'js', 'ts', 'py', 'json', 'yaml', 
                                 'toml', 'env', 'txt', 'csv', 'html', 'css'];
              if (!mediaExts.includes(ext)) {
                handleInjectionPath(droppedPath);
              }
            }
          } else {
            setIsHovering(false);
          }
        });
      } catch (err) {
        console.error("Failed to bind webview drag events:", err);
      }
    };
    
    setupDrag();
    
    return () => {
      if (unlistenDrag) unlistenDrag();
    };
  }, []);

  // Removed the manual HTML5 Synthetics since Tauri intercepts them at the OS level

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [{
          name: 'Soul Configuration Box',
          extensions: ['md']
        }],
        title: 'Select your SOUL.md file',
      });
      if (selected) {
        handleInjectionPath(selected);
      }
    } catch (e) {
      console.error('File dialog error:', e);
    }
  };

  return (
    <div className={`bg-[#1f0b11] border p-6 sm:p-8 rounded-lg shadow-[0_0_20px_rgba(255,183,197,0.1)] w-full max-w-3xl mt-8 relative overflow-hidden transition-all duration-300 ${isHovering ? 'border-[#ffb7c5] shadow-[0_0_50px_rgba(255,183,197,0.4)] scale-[1.02]' : 'border-[#ffb7c5]/30'}`}>
      <div className={`absolute top-0 left-0 w-1 h-full bg-[#ffb7c5] transition-opacity ${isHovering ? 'opacity-100' : 'opacity-50'}`}></div>
      
      <h2 className="text-[#ffb7c5] text-xl sm:text-2xl font-mono mb-4 flex items-center gap-3">
        <span className="animate-pulse">▶</span> MOUNT_SOUL_WORKSPACE
      </h2>
      <p className="text-[#ffeef2]/60 font-mono text-sm sm:text-base mb-8 leading-relaxed">
        Browse to the unzipped folder containing your <span className="text-white border-b border-[#ffb7c5]">SOUL.md</span> file to initialize the local MCP binding:
      </p>
      
      <div className="flex flex-col gap-4">
        {previewData ? (
          <div className="bg-black/80 border border-[#ffb7c5]/80 rounded p-6 shadow-[0_0_20px_rgba(255,183,197,0.15)] flex flex-col md:flex-row items-center md:items-start justify-between gap-6 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🧬</span>
                <h3 className="text-[#ffb7c5] text-xl font-bold font-mono uppercase tracking-wider">{previewData.name}</h3>
              </div>
              <div className="text-[#ff00ff] font-mono text-sm tracking-widest mb-4">ARCHETYPE: {previewData.archetype}</div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 max-w-lg mb-4">
                {[
                  { label: "NEUROTICISM", value: previewData.neuroticism },
                  { label: "EXTRAVERSION", value: previewData.extraversion },
                  { label: "OPENNESS", value: previewData.openness },
                  { label: "AGREEABLENESS", value: previewData.agreeableness },
                  { label: "CONSCIENTIOUSNESS", value: previewData.conscientiousness }
                ].map(stat => (
                  <div key={stat.label} className="bg-[#1f0b11] border border-[#ffb7c5]/20 p-2 rounded">
                    <div className="text-[#ffeef2]/40 text-[10px] md:text-xs mb-1 truncate">{stat.label}</div>
                    <div className="text-[#ffb7c5] font-bold text-sm md:text-base">{stat.value}/100</div>
                    <div className="w-full bg-black h-1 mt-1 rounded">
                       <div className="bg-[#ffb7c5] h-1 rounded" style={{width: `${stat.value}%`}}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <button 
                onClick={handleBrowse}
                className="text-[#ffeef2]/50 hover:text-[#ffb7c5] border border-[#ffeef2]/20 hover:border-[#ffb7c5] px-4 py-2 rounded font-mono text-xs transition-all w-full text-center"
              >
                Change Workspace
              </button>
              <button 
                onClick={() => onConnect(path)}
                className="bg-[#ffb7c5]/10 hover:bg-[#ffb7c5]/30 text-[#ffb7c5] border border-[#ffb7c5] rounded px-8 py-4 font-mono font-bold transition-all uppercase shadow-[0_0_15px_rgba(255,183,197,0.2)] hover:shadow-[0_0_30px_rgba(255,183,197,0.5)] w-full relative overflow-hidden group/btn"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  INITIATE NEURAL LINK <span className="animate-ping">»</span>
                </span>
                <div className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-[#ffb7c5]/20 to-transparent group-hover/btn:left-[100%] transition-all duration-700"></div>
              </button>
            </div>
          </div>
        ) : (
          <div 
            onClick={handleBrowse}
            className={`w-full bg-black/80 border-2 border-dashed rounded px-4 py-8 text-center font-mono text-base transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px] ${isHovering ? 'border-[#ffb7c5] shadow-[0_0_30px_rgba(255,183,197,0.3)] bg-[#ffb7c5]/10' : 'border-[#ffb7c5]/50 hover:border-[#ffb7c5] hover:shadow-[0_0_20px_rgba(255,183,197,0.2)]'}`}
          >
            <span className={`flex flex-col items-center gap-3 transition-colors ${isHovering ? 'text-[#ffb7c5]' : 'text-[#ffb7c5]/70 hover:text-[#ffb7c5]'}`}>
              <span className={`text-4xl mb-2 transition-transform ${isHovering ? 'scale-125' : ''}`}>🌸</span>
              <span className="font-bold">{isHovering ? 'DROP FOLDER HERE...' : 'DRAG FOLDER HERE'}</span>
              <span>Click to browse for your extracted Soul Workspace...</span>
              <span className="text-[#ffeef2]/40 text-xs mt-2 block w-full max-w-sm mx-auto leading-relaxed">
                Locate the folder containing your SOUL.md file. This establishes the local MCP binding.
              </span>
            </span>
          </div>
        )}
        
        {errorMsg && (
          <div className="mt-4 p-4 border border-red-500 bg-red-900/20 text-red-400 font-mono text-xs rounded break-words">
            <span className="font-bold flex items-center gap-2 mb-1"><span className="text-lg">⚠️</span> SYSTEM OVERRIDE FAILURE</span>
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}
