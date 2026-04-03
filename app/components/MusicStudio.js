"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Music, Zap, Loader2, Square, Sparkles, Play, RefreshCw, Radio, X } from 'lucide-react';

const GENRE_PRESETS = [
  { label: '🔥 Chicago Drill', tags: 'instrumental, chicago drill, booming 808 bass, fast hi-hats, punchy kicks, aggressive, dark' },
  { label: '🌊 Lo-Fi Chill', tags: 'instrumental, lo-fi hip hop, chill, jazzy, warm, vinyl crackle, mellow, relaxing' },
  { label: '👻 Phonk', tags: 'instrumental, phonk, memphis, dark, bass heavy, cowbell, chopped vocals, drift' },
  { label: '🌆 Synthwave', tags: 'instrumental, synthwave, retro, neon, 80s, analog synth, driving bassline, nostalgic' },
  { label: '🎬 Cinematic', tags: 'instrumental, cinematic, epic, orchestral, dramatic, trailer, suspenseful, powerful' },
  { label: '💥 Trap', tags: 'instrumental, trap, aggressive, hard-hitting, 808, rolling hi-hats, dark melody' },
  { label: '📻 Boom Bap', tags: 'instrumental, boom bap, old school, vinyl, dusty, jazzy samples, head-nodding' },
  { label: '🌌 Ambient', tags: 'instrumental, ambient, atmospheric, ethereal, spacious, evolving pads, dreamy' },
  { label: '🪩 Funk', tags: 'instrumental, funk, groovy, upbeat, wah guitar, slap bass, brass stabs, danceable' },
  { label: '⚡ EDM Drop', tags: 'instrumental, EDM, festival, build-up, massive drop, euphoric, high energy, supersaw' },
];

/**
 * MusicStudio — Dedicated ACE-Step music generation interface.
 * Renders as standalone panel when the 🎵 Music Generator skill is active.
 * Features:
 * - Genre presets with one-click selection
 * - Custom tag editing
 * - AI prompt enhancement via Ollama
 * - Duration slider + seed control
 * - ACE-Step server start/stop
 * - Waveform preview of generated audio
 * - History of generated tracks
 */
export default function MusicStudio({ onGenerated }) {
  // ACE-Step state
  const [aceStatus, setAceStatus] = useState('unknown'); // unknown, offline, starting, ready
  const [aceStarting, setAceStarting] = useState(false);
  const [ramInfo, setRamInfo] = useState(null);

  // Generation state
  const [genreTags, setGenreTags] = useState(GENRE_PRESETS[0].tags);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customTags, setCustomTags] = useState('');
  const [duration, setDuration] = useState(30);
  const [seed, setSeed] = useState(42);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');

  // AI prompt enhancement
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState('');

  // Results
  const [generatedTracks, setGeneratedTracks] = useState([]);
  const [previewEnergy, setPreviewEnergy] = useState(null);
  const waveformRef = useRef(null);

  // Check status on mount
  useEffect(() => {
    checkAceStatus();
    checkRam();
  }, []);

  // Draw waveform preview
  useEffect(() => {
    if (!previewEnergy || !waveformRef.current) return;
    const canvas = waveformRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#050a08';
    ctx.fillRect(0, 0, W, H);

    const maxE = Math.max(...previewEnergy, 0.01);
    const barW = W / previewEnergy.length;

    for (let i = 0; i < previewEnergy.length; i++) {
      const norm = previewEnergy[i] / maxE;
      const barH = norm * H * 0.85;
      const x = i * barW;
      const y = (H - barH) / 2;
      const r = Math.floor(255 - norm * 100);
      const g = Math.floor(40 + norm * 160);
      const b = Math.floor(180 + norm * 75);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.5 + norm * 0.4})`;
      ctx.fillRect(x, y, Math.max(1, barW - 0.5), barH);
    }
  }, [previewEnergy]);

  const checkAceStatus = async () => {
    try {
      // Gradio server doesn't send CORS headers, so a normal fetch throws a TypeError.
      // Using 'no-cors' mode: an opaque response (type: 'opaque') confirms the server is alive.
      const resp = await fetch('http://127.0.0.1:7865/', {
        mode: 'no-cors',
        signal: AbortSignal.timeout(2000),
      });
      // 'opaque' responses always have status 0, but reaching here means the server answered
      setAceStatus('ready');
    } catch (_) {
      setAceStatus('offline');
    }
  };

  // Re-check engine status every 5 seconds so the UI updates after starting
  useEffect(() => {
    const interval = setInterval(checkAceStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkRam = async () => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const ram = await invoke('get_system_ram');
        setRamInfo(ram);
      }
    } catch (_) {}
  };

  const startEngine = async () => {
    setAceStarting(true);
    setAceStatus('starting');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('start_acestep_server');
      setAceStatus(result.status === 'ready' || result.status === 'already_running' ? 'ready' : 'offline');
    } catch (e) {
      console.error('[ACE] Start failed:', e);
      setAceStatus('offline');
    }
    setAceStarting(false);
  };

  const stopEngine = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_acestep_server');
      setAceStatus('offline');
    } catch (_) {}
  };

  const enhancePromptWithAI = async () => {
    setEnhancing(true);
    try {
      const currentTags = customTags || genreTags;

      // Call Ollama directly — no MCP intermediary needed
      const resp = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen3:8b',
          prompt: `You are a professional music producer. Enhance these genre tags into a detailed prompt for an AI music generator. Add specific instruments, tempo, mix characteristics, and mood. Return ONLY comma-separated tags. No explanations. /no_think\n\nInput: "${currentTags}"\nOutput:`,
          stream: false,
          options: { temperature: 0.7, num_predict: 1000 }
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!resp.ok) throw new Error(`Ollama returned ${resp.status}`);
      // SECURITY (HIGH-3): Ollama may return plaintext errors (e.g. "model not found").
      // Parse as text first to prevent JSON.parse crash on non-JSON bodies.
      const rawText = await resp.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Ollama response was not valid JSON: ${rawText.slice(0, 200)}`);
      }
      let enhanced = (data.response || '').trim();
      // Clean up any quotes or preamble
      enhanced = enhanced.replace(/^["']|["']$/g, '').replace(/^(Here|Enhanced|Output:?)\s*/i, '').trim();
      if (enhanced && enhanced.length > 10) {
        setEnhancedPrompt(enhanced);
        setCustomTags(enhanced);
      }
    } catch (e) {
      console.error('[AI ENHANCE] Failed:', e.message || e);
    }
    setEnhancing(false);
  };

  const generate = async () => {
    if (aceStatus !== 'ready') {
      setGenerationProgress('❌ Music engine is offline. Press START MUSIC ENGINE first.');
      return;
    }
    setGenerating(true);
    setGenerationProgress('Sending to ACE-Step model...');

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const finalTags = customTags || genreTags;

      setGenerationProgress(`Generating ${duration}s track (seed: ${seed})...`);

      const result = await invoke('execute_mcp_tool', {
        serverName: 'default',
        toolName: 'generate_music',
        args: {
          genre_tags: finalTags,
          lyrics: '[inst]',
          duration,
          seed,
          guidance_scale: 15.0,
          output_name: '',
        }
      });

      const data = typeof result === 'string' ? JSON.parse(result) : (result.result ? JSON.parse(result.result) : result);

      if (data.status === 'success') {
        const { convertFileSrc } = await import('@tauri-apps/api/core');
        const track = {
          path: data.path,
          url: convertFileSrc(data.path),
          filename: data.filename,
          duration: data.duration,
          seed: data.seed,
          genre: finalTags,
          timestamp: new Date().toLocaleTimeString(),
          energyPreview: data.energy_preview,
        };
        setGeneratedTracks(prev => [track, ...prev]);
        setGenerationProgress('');

        if (data.energy_preview) {
          setPreviewEnergy(data.energy_preview);
        }

        // Notify parent
        if (onGenerated) onGenerated(track);
      } else {
        setGenerationProgress(`❌ ${data.error || 'Generation failed'}`);
      }
    } catch (e) {
      console.error('[MUSIC] Failed:', e);
      setGenerationProgress(`❌ ${e.toString()}`);
    }
    setGenerating(false);
  };

  const randomizeSeed = () => setSeed(Math.floor(Math.random() * 99999));

  const statusDot = aceStatus === 'ready' ? 'bg-[#39ff14]' : aceStatus === 'starting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500';
  const statusLabel = aceStatus === 'ready' ? 'ENGINE ONLINE' : aceStatus === 'starting' ? 'LOADING MODEL...' : 'ENGINE OFFLINE';

  return (
    <div className="w-full bg-[#0a0f0d] border border-[#ff00ff]/20 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0d0a14] border-b border-[#ff00ff]/10">
        <div className="flex items-center gap-2">
          <Music size={18} className="text-[#ff00ff]" />
          <span className="text-[#ff00ff] font-bold font-mono text-sm tracking-wider">MUSIC STUDIO</span>
          <span className="text-[#e0faec]/20 text-[10px] font-mono">ACE-Step AI</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusDot}`} />
          <span className="text-[#e0faec]/40 text-[10px] font-mono">{statusLabel}</span>
          {ramInfo && (
            <span className="text-[#e0faec]/20 text-[9px] font-mono">{ramInfo.available_gb}GB free</span>
          )}
        </div>
      </div>

      {/* Engine Controls */}
      {aceStatus !== 'ready' && (
        <div className="px-4 py-3 bg-black/40 border-b border-[#ff00ff]/5">
          <div className="text-[#e0faec]/50 text-xs font-mono mb-2">
            {ramInfo && !ramInfo.acestep_safe
              ? <span className="text-red-400">⚠️ Low memory ({ramInfo.available_gb}GB free) — close apps before starting</span>
              : 'Start the ACE-Step AI model to begin generating instrumentals (~20s to load)'
            }
          </div>
          <button onClick={startEngine} disabled={aceStarting || (ramInfo && !ramInfo.acestep_safe)}
            className={`w-full py-2.5 rounded-lg font-mono text-sm font-bold tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              aceStarting
                ? 'bg-yellow-400/10 border border-yellow-400/40 text-yellow-400'
                : (ramInfo && !ramInfo.acestep_safe)
                  ? 'bg-red-400/5 border border-red-400/20 text-red-400/40 cursor-not-allowed'
                  : 'bg-[#ff00ff]/15 border border-[#ff00ff] text-[#ff00ff] hover:bg-[#ff00ff]/25 hover:shadow-[0_0_25px_rgba(255,0,255,0.15)]'
            }`}>
            {aceStarting
              ? <><Loader2 size={14} className="animate-spin" /> LOADING AI MODEL...</>
              : <><Zap size={14} /> START MUSIC ENGINE</>
            }
          </button>
        </div>
      )}

      {/* Main Studio — only when engine is ready */}
      {aceStatus === 'ready' && (
        <div className="px-4 py-3 space-y-4">

          {/* Genre Presets */}
          <div>
            <div className="text-[#e0faec]/30 text-[10px] uppercase tracking-wider mb-2">Genre Preset</div>
            <div className="flex flex-wrap gap-1.5">
              {GENRE_PRESETS.map((preset, i) => (
                <button key={i} onClick={() => { setSelectedPreset(i); setGenreTags(preset.tags); setCustomTags(''); setEnhancedPrompt(''); }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all cursor-pointer ${
                    selectedPreset === i
                      ? 'border-[#ff00ff] text-[#ff00ff] bg-[#ff00ff]/10 shadow-[0_0_10px_rgba(255,0,255,0.1)]'
                      : 'border-[#e0faec]/10 text-[#e0faec]/50 hover:border-[#ff00ff]/40 hover:text-[#ff00ff]/80'
                  }`}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Current Tags Display */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[#e0faec]/30 text-[10px] uppercase tracking-wider">Prompt Tags</div>
              <button onClick={enhancePromptWithAI} disabled={enhancing}
                className={`text-[10px] font-mono flex items-center gap-1 px-2 py-0.5 rounded border transition-all cursor-pointer ${
                  enhancing
                    ? 'border-yellow-400/30 text-yellow-400'
                    : 'border-[#ff00ff]/30 text-[#ff00ff] hover:bg-[#ff00ff]/10 hover:border-[#ff00ff]/60'
                }`}>
                {enhancing
                  ? <><Loader2 size={10} className="animate-spin" /> ENHANCING...</>
                  : <><Sparkles size={10} /> AI ENHANCE PROMPT</>
                }
              </button>
            </div>
            <textarea
              value={customTags || genreTags}
              onChange={(e) => setCustomTags(e.target.value)}
              rows={3}
              className="w-full bg-black/60 border border-[#e0faec]/15 rounded-lg px-3 py-2 text-[#ff00ff] text-xs font-mono outline-none focus:border-[#ff00ff]/50 resize-none placeholder:text-[#e0faec]/15"
              placeholder="Type custom genre tags or click a preset above..."
            />
            {enhancedPrompt && (
              <div className="mt-1 text-[9px] text-[#ff00ff]/40 font-mono">
                ✨ AI-enhanced prompt applied. Edit above if needed.
              </div>
            )}
          </div>

          {/* Duration + Seed Row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="text-[#e0faec]/30 text-[10px] uppercase tracking-wider mb-1.5">Duration</div>
              <div className="flex items-center gap-2">
                <input type="range" min={15} max={60} step={5} value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="flex-1 accent-[#ff00ff] cursor-pointer" />
                <span className="text-[#ff00ff] text-sm font-mono font-bold w-10 text-right">{duration}s</span>
              </div>
              <div className="flex justify-between text-[#e0faec]/15 text-[8px] font-mono mt-0.5">
                <span>15s</span><span>30s</span><span>45s</span><span>60s</span>
              </div>
            </div>
            <div className="w-28">
              <div className="text-[#e0faec]/30 text-[10px] uppercase tracking-wider mb-1.5">Seed</div>
              <div className="flex gap-1">
                <input type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value) || 42)}
                  className="flex-1 bg-black/60 border border-[#e0faec]/15 rounded px-2 py-1.5 text-[#ff00ff] text-xs font-mono text-center outline-none focus:border-[#ff00ff]/50" />
                <button onClick={randomizeSeed} title="Randomize seed"
                  className="px-2 bg-black/40 border border-[#e0faec]/10 rounded text-[#e0faec]/30 hover:text-[#ff00ff] hover:border-[#ff00ff]/30 transition-all cursor-pointer">
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button onClick={generate} disabled={generating}
            className={`w-full py-3 rounded-lg font-mono text-sm font-bold tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer ${
              generating
                ? 'bg-[#ff00ff]/5 border border-[#ff00ff]/20 text-[#ff00ff]/50'
                : 'bg-gradient-to-r from-[#ff00ff]/20 to-[#b43cff]/20 border border-[#ff00ff] text-[#ff00ff] hover:from-[#ff00ff]/30 hover:to-[#b43cff]/30 hover:shadow-[0_0_30px_rgba(255,0,255,0.2)]'
            }`}>
            {generating
              ? <><Loader2 size={16} className="animate-spin" /> {generationProgress || 'GENERATING...'}</>
              : <><Play size={16} /> GENERATE INSTRUMENTAL</>
            }
          </button>

          {/* Generation Status Feedback — always visible */}
          {generationProgress && !generating && (
            <div className={`text-xs font-mono text-center py-1.5 rounded ${
              generationProgress.startsWith('❌') ? 'text-red-400/80' : 'text-[#39ff14]/60'
            }`}>
              {generationProgress}
            </div>
          )}

          {/* Stop Engine */}
          <button onClick={stopEngine}
            className="w-full py-1.5 rounded border border-red-400/15 text-red-400/30 text-[10px] font-mono hover:text-red-400/60 hover:border-red-400/30 transition-all cursor-pointer flex items-center justify-center gap-1">
            <Square size={10} /> STOP ENGINE
          </button>
        </div>
      )}

      {/* Waveform Preview */}
      {previewEnergy && (
        <div className="px-4 pb-3">
          <div className="text-[#e0faec]/30 text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Radio size={10} /> Generated Waveform
          </div>
          <canvas ref={waveformRef} width={600} height={60}
            className="w-full h-14 rounded-lg border border-[#ff00ff]/10 bg-[#050a08]" />
        </div>
      )}

      {/* Generated Track History */}
      {generatedTracks.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-[#e0faec]/30 text-[10px] uppercase tracking-wider mb-2">Generated Tracks</div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#ff00ff]/20">
            {generatedTracks.map((track, i) => (
              <div key={i} className="relative flex flex-col gap-2 bg-black/40 border border-[#ff00ff]/10 rounded-lg px-3 py-2 group">
                {/* Dismiss button */}
                <button
                  onClick={() => setGeneratedTracks(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#e0faec]/30 hover:text-red-400 cursor-pointer p-0.5 rounded hover:bg-red-400/10"
                  title="Remove track"
                >
                  <X size={12} />
                </button>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-[#ff00ff] text-xs font-mono truncate">{track.filename}</div>
                    <div className="text-[#e0faec]/25 text-[9px] font-mono">{track.duration}s · seed {track.seed} · {track.timestamp}</div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 mr-4">
                    <span className="text-[#39ff14] text-[9px] font-mono px-1.5 py-0.5 bg-[#39ff14]/10 rounded">WAV</span>
                  </div>
                </div>
                {track.url && (
                  <audio 
                    controls 
                    src={track.url} 
                    onPlay={() => { if (track.energyPreview) setPreviewEnergy(track.energyPreview); }}
                    className="w-full h-8 outline-none opacity-80" 
                    style={{ filter: 'invert(100%) hue-rotate(180deg) grayscale(100%) brightness(0.8)' }} 
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer info */}
      <div className="px-4 pb-3 border-t border-[#ff00ff]/5 pt-3">
        <div className="text-[#e0faec]/15 text-[9px] font-mono text-center">
          ACE-Step · Apache 2.0 · Commercially Safe · 100% Local · No Cloud
        </div>
      </div>
    </div>
  );
}
