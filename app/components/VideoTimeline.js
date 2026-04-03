"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Film, Music, Type, Plus, Trash2, Play, Upload, ChevronDown, ChevronUp, Zap, Radio, Loader2, Square } from 'lucide-react';

const FONTS = [
  'Impact', 'Montserrat', 'Bebas Neue', 'Comic Sans MS', 'Arial Black',
  'Oswald', 'Roboto Condensed', 'Permanent Marker', 'Press Start 2P', 'Bangers'
];

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok / Reels', ratio: '9:16' },
  { id: 'shorts', label: 'YouTube Shorts', ratio: '9:16' },
  { id: 'twitter', label: 'X', ratio: '16:9' },
  { id: 'youtube', label: 'YouTube', ratio: '16:9' },
  { id: 'feed', label: 'Instagram Feed', ratio: '1:1' },
  { id: 'original', label: 'Original', ratio: 'auto' },
];

const EFFECTS = [
  { id: 'none', label: 'None', color: '#e0faec' },
  { id: 'glitch', label: 'Glitch', color: '#ff003c' },
  { id: 'flash', label: 'Flash', color: '#ffc800' },
  { id: 'chromatic', label: 'Chromatic', color: '#00f0ff' },
  { id: 'double_exposure', label: 'Double Exp', color: '#b43cff' },
  { id: 'vhs', label: 'VHS', color: '#ff6b00' },
  { id: 'slam', label: 'Slam', color: '#39ff14' },
];

const GENRES = [
  'instrumental, cinematic, epic, orchestral',
  'instrumental, chicago drill, booming 808 bass, fast hi-hats',
  'instrumental, lo-fi hip hop, chill, jazzy, warm',
  'instrumental, phonk, memphis, dark, bass heavy',
  'instrumental, synthwave, retro, neon, 80s',
  'instrumental, trap, aggressive, hard-hitting, 808',
  'instrumental, boom bap, old school, vinyl, dusty',
  'instrumental, ambient, atmospheric, ethereal',
];

/**
 * VideoTimeline — Full video editing panel with:
 * - Video + Audio drop zones (unified)
 * - ACE-Step music generation panel
 * - Waveform visualizer with beat markers
 * - Text overlay timeline with time ranges and font selection
 * - Per-beat effect presets
 * - Platform presets for export
 * - ACE-Step status indicator
 */
export default function VideoTimeline({ onSubmit }) {
  const [videoFile, setVideoFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [useCustomAudio, setUseCustomAudio] = useState(false);
  const [beatSync, setBeatSync] = useState(true);
  const [platform, setPlatform] = useState('tiktok');
  const [textOverlays, setTextOverlays] = useState([
    { id: 1, startTime: '0', endTime: '2', text: '', font: 'Impact', size: 48, color: '#FFFFFF', position: 'center' }
  ]);
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);

  // Music generation state
  const [showMusicGen, setShowMusicGen] = useState(false);
  const [genreTags, setGenreTags] = useState(GENRES[0]);
  const [musicDuration, setMusicDuration] = useState(30);
  const [musicSeed, setMusicSeed] = useState(42);
  const [generating, setGenerating] = useState(false);
  const [aceStatus, setAceStatus] = useState('unknown'); // unknown, offline, starting, ready
  const [aceStarting, setAceStarting] = useState(false);

  // Beat analysis state
  const [beatData, setBeatData] = useState(null); // { beats, energy_curve, bpm, duration }
  const [analyzingBeats, setAnalyzingBeats] = useState(false);
  const [beatEffects, setBeatEffects] = useState({}); // { beatIndex: effectId }
  const waveformRef = useRef(null);

  // RAM state
  const [ramInfo, setRamInfo] = useState(null);

  // Check ACE-Step status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
          const { invoke } = await import('@tauri-apps/api/core');
          // Check RAM
          try {
            const ram = await invoke('get_system_ram');
            setRamInfo(ram);
          } catch(_) {}
          // Check if ACE-Step server is responding
          try {
            const resp = await fetch('http://127.0.0.1:7865/', { signal: AbortSignal.timeout(2000) });
            setAceStatus(resp.ok ? 'ready' : 'offline');
          } catch(_) {
            setAceStatus('offline');
          }
        }
      } catch(_) {}
    };
    checkStatus();
  }, []);

  // Draw waveform when beat data changes
  useEffect(() => {
    if (!beatData || !waveformRef.current) return;
    const canvas = waveformRef.current;
    const ctx = canvas.getContext('2d');
    const { energy_curve, beats, duration } = beatData;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#050a08';
    ctx.fillRect(0, 0, W, H);

    // Draw energy waveform
    if (energy_curve && energy_curve.length > 0) {
      const maxE = Math.max(...energy_curve, 0.01);
      const barW = W / energy_curve.length;

      for (let i = 0; i < energy_curve.length; i++) {
        const norm = energy_curve[i] / maxE;
        const barH = norm * H * 0.85;
        const x = i * barW;
        const y = (H - barH) / 2;

        // Gradient color based on energy
        const r = Math.floor(57 + norm * 198);
        const g = Math.floor(255 - norm * 100);
        const b = Math.floor(20 + norm * 30);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.4 + norm * 0.5})`;
        ctx.fillRect(x, y, Math.max(1, barW - 0.5), barH);
      }
    }

    // Draw beat markers
    if (beats && duration > 0) {
      beats.forEach((bt, idx) => {
        const x = (bt / duration) * W;
        const effect = beatEffects[idx];
        const effectDef = EFFECTS.find(e => e.id === effect);

        ctx.strokeStyle = effectDef ? effectDef.color : '#39ff14';
        ctx.lineWidth = effectDef && effect !== 'none' ? 2 : 1;
        ctx.globalAlpha = effectDef && effect !== 'none' ? 1.0 : 0.4;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();

        // Beat number label
        if (idx % 4 === 0) {
          ctx.fillStyle = '#39ff14';
          ctx.globalAlpha = 0.6;
          ctx.font = '9px monospace';
          ctx.fillText(bt.toFixed(1) + 's', x + 2, H - 3);
        }
        ctx.globalAlpha = 1.0;
      });
    }

    // BPM label
    if (beatData.bpm) {
      ctx.fillStyle = '#39ff14';
      ctx.globalAlpha = 0.8;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`${beatData.bpm} BPM · ${beatData.beat_count} beats · ${beatData.duration}s`, 6, 14);
      ctx.globalAlpha = 1.0;
    }
  }, [beatData, beatEffects]);

  const startAceStep = async () => {
    setAceStarting(true);
    setAceStatus('starting');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('start_acestep_server');
      if (result.status === 'ready' || result.status === 'already_running') {
        setAceStatus('ready');
      } else {
        setAceStatus('offline');
      }
    } catch(e) {
      console.error('[ACE] Start failed:', e);
      setAceStatus('offline');
    }
    setAceStarting(false);
  };

  const stopAceStep = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_acestep_server');
      setAceStatus('offline');
    } catch(e) {
      console.error('[ACE] Stop failed:', e);
    }
  };

  const generateMusic = async () => {
    if (aceStatus !== 'ready') return;
    setGenerating(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('execute_mcp_tool', {
        _serverName: 'default',
        toolName: 'generate_music',
        args: {
          genre_tags: genreTags,
          lyrics: '[inst]',
          duration: musicDuration,
          seed: musicSeed,
          guidance_scale: 15.0,
          output_name: '',
        }
      });
      const data = typeof result === 'string' ? JSON.parse(result) : (result.result ? JSON.parse(result.result) : result);
      if (data.status === 'success' && data.path) {
        // Set generated audio as the audio file
        setAudioFile({ name: data.filename, path: data.path });
        setUseCustomAudio(true);
        // If energy preview available, use it for a quick waveform
        if (data.energy_preview && data.energy_preview.length > 0) {
          setBeatData(prev => ({
            ...prev,
            energy_curve: data.energy_preview,
            duration: data.duration,
            beats: prev?.beats || [],
            bpm: prev?.bpm || 0,
            beat_count: prev?.beat_count || 0,
          }));
        }
      }
    } catch(e) {
      console.error('[MUSIC] Generation failed:', e);
    }
    setGenerating(false);
  };

  const analyzeBeats = async () => {
    if (!audioFile?.path) return;
    setAnalyzingBeats(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('execute_mcp_tool', {
        _serverName: 'default',
        toolName: 'analyze_beats',
        args: { audio_path: audioFile.path }
      });
      const data = typeof result === 'string' ? JSON.parse(result) : (result.result ? JSON.parse(result.result) : result);
      if (data.status === 'success') {
        setBeatData(data);
        // Initialize empty effects for all beats
        const fx = {};
        data.beats.forEach((_, i) => { fx[i] = 'none'; });
        setBeatEffects(fx);
      }
    } catch(e) {
      console.error('[BEATS] Analysis failed:', e);
    }
    setAnalyzingBeats(false);
  };

  const addOverlay = () => {
    const lastEnd = textOverlays.length > 0 ? parseFloat(textOverlays[textOverlays.length - 1].endTime) : 0;
    setTextOverlays(prev => [...prev, {
      id: Date.now(),
      startTime: String(lastEnd),
      endTime: String(lastEnd + 3),
      text: '',
      font: 'Impact',
      size: 48,
      color: '#FFFFFF',
      position: 'center'
    }]);
  };

  const updateOverlay = (id, field, value) => {
    setTextOverlays(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  const removeOverlay = (id) => {
    setTextOverlays(prev => prev.filter(o => o.id !== id));
  };

  const handleSubmit = () => {
    if (!videoFile) return;
    // Build beat effects array for the MCP tool
    const effectsList = beatData?.beats
      ? beatData.beats.map((bt, i) => ({
          beatTime: bt,
          type: beatEffects[i] || 'none',
          intensity: Math.round((beatData.beat_energies?.[i] || 0.5) * 100),
        })).filter(e => e.type !== 'none')
      : [];

    const config = {
      videoPath: videoFile.path || videoFile.name,
      audioPath: useCustomAudio && audioFile ? (audioFile.path || audioFile.name) : null,
      useCustomAudio,
      beatSync,
      platform,
      textOverlays: textOverlays.filter(o => o.text.trim()),
      beatEffects: effectsList,
    };
    onSubmit(config);
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.length) return;

    files.forEach(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      if (type === 'video' || ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) {
        setVideoFile(file);
      } else if (type === 'audio' || ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) {
        setAudioFile(file);
        setUseCustomAudio(true);
      }
    });
  };

  const aceStatusDot = aceStatus === 'ready' ? 'bg-[#39ff14]' : aceStatus === 'starting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500';
  const aceStatusText = aceStatus === 'ready' ? 'Music Engine Online' : aceStatus === 'starting' ? 'Loading Model...' : 'Music Engine Offline';

  return (
    <div className="w-full bg-[#0a0f0d] border border-[#39ff14]/20 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0d1a12] border-b border-[#39ff14]/10">
        <div className="flex items-center gap-2">
          <Film size={18} className="text-[#39ff14]" />
          <span className="text-[#39ff14] font-bold font-mono text-sm tracking-wider">VIDEO PRODUCTION STUDIO</span>
        </div>
        {/* ACE-Step Status */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${aceStatusDot}`} />
          <span className="text-[#e0faec]/50 text-[10px] font-mono">{aceStatusText}</span>
          {ramInfo && (
            <span className="text-[#e0faec]/25 text-[9px] font-mono ml-1">
              {ramInfo.available_gb}GB free
            </span>
          )}
        </div>
      </div>

      {/* Music Generation Panel */}
      <div className="border-b border-[#39ff14]/10">
        <button onClick={() => setShowMusicGen(!showMusicGen)}
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-[#39ff14]/5 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Music size={14} className="text-[#ff00ff]" />
            <span className="text-[#ff00ff] text-xs font-mono font-bold tracking-wider">GENERATE MUSIC (ACE-Step AI)</span>
          </div>
          {showMusicGen ? <ChevronUp size={14} className="text-[#e0faec]/30" /> : <ChevronDown size={14} className="text-[#e0faec]/30" />}
        </button>

        {showMusicGen && (
          <div className="px-4 pb-3 space-y-2">
            {/* ACE-Step Controls */}
            {aceStatus !== 'ready' && (
              <div className="bg-black/40 border border-[#ff00ff]/20 rounded-lg p-3">
                <div className="text-[#e0faec]/60 text-xs font-mono mb-2">
                  {ramInfo && !ramInfo.acestep_safe ? (
                    <span className="text-red-400">⚠️ Low RAM ({ramInfo.available_gb}GB available, need 4GB+). Close apps before starting.</span>
                  ) : (
                    'Start the music engine to generate AI instrumentals (~20s model load)'
                  )}
                </div>
                <button onClick={startAceStep} disabled={aceStarting || (ramInfo && !ramInfo.acestep_safe)}
                  className={`px-4 py-1.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                    aceStarting ? 'bg-yellow-400/20 border border-yellow-400/50 text-yellow-400' :
                    (ramInfo && !ramInfo.acestep_safe) ? 'bg-red-400/10 border border-red-400/30 text-red-400/50 cursor-not-allowed' :
                    'bg-[#ff00ff]/20 border border-[#ff00ff] text-[#ff00ff] hover:bg-[#ff00ff]/30'
                  }`}>
                  {aceStarting ? <><Loader2 size={12} className="inline animate-spin mr-1" /> LOADING MODEL...</> : '⚡ START MUSIC ENGINE'}
                </button>
              </div>
            )}

            {aceStatus === 'ready' && (
              <>
                {/* Genre Tags */}
                <div>
                  <div className="text-[#e0faec]/30 text-[10px] uppercase tracking-wider mb-1">Genre / Style Tags</div>
                  <select value={genreTags} onChange={(e) => setGenreTags(e.target.value)}
                    className="w-full bg-black/60 border border-[#e0faec]/15 rounded px-2 py-1.5 text-[#ff00ff] text-xs font-mono outline-none focus:border-[#ff00ff]/50 cursor-pointer">
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input type="text" value={genreTags} onChange={(e) => setGenreTags(e.target.value)}
                    className="w-full mt-1 bg-black/40 border border-[#e0faec]/10 rounded px-2 py-1 text-[#e0faec]/70 text-[10px] font-mono outline-none focus:border-[#ff00ff]/40 placeholder:text-[#e0faec]/15"
                    placeholder="Custom tags: instrumental, funk, groovy, bass..." />
                </div>

                {/* Duration + Seed */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className="text-[#e0faec]/30 text-[10px] uppercase tracking-wider mb-1">Duration</div>
                    <div className="flex items-center gap-1">
                      <input type="range" min={15} max={60} value={musicDuration} onChange={(e) => setMusicDuration(parseInt(e.target.value))}
                        className="flex-1 accent-[#ff00ff]" />
                      <span className="text-[#ff00ff] text-xs font-mono w-8 text-right">{musicDuration}s</span>
                    </div>
                  </div>
                  <div className="w-24">
                    <div className="text-[#e0faec]/30 text-[10px] uppercase tracking-wider mb-1">Seed</div>
                    <input type="number" value={musicSeed} onChange={(e) => setMusicSeed(parseInt(e.target.value) || 42)}
                      className="w-full bg-black/60 border border-[#e0faec]/15 rounded px-2 py-1 text-[#ff00ff] text-xs font-mono text-center outline-none focus:border-[#ff00ff]/50" />
                  </div>
                </div>

                {/* Generate Button */}
                <div className="flex gap-2">
                  <button onClick={generateMusic} disabled={generating}
                    className={`flex-1 py-2 rounded-lg font-mono text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      generating
                        ? 'bg-[#ff00ff]/10 border border-[#ff00ff]/30 text-[#ff00ff]/60'
                        : 'bg-[#ff00ff]/20 border border-[#ff00ff] text-[#ff00ff] hover:bg-[#ff00ff]/30 hover:shadow-[0_0_20px_rgba(255,0,255,0.15)]'
                    }`}>
                    {generating ? <><Loader2 size={12} className="animate-spin" /> GENERATING...</> : <><Zap size={12} /> GENERATE INSTRUMENTAL</>}
                  </button>
                  <button onClick={stopAceStep} title="Stop Music Engine"
                    className="px-3 py-2 rounded-lg border border-red-400/30 text-red-400/60 hover:text-red-400 hover:border-red-400/60 transition-all cursor-pointer">
                    <Square size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Drop Zones — Unified Video + Audio */}
      <div className="p-4">
        <div
          onDrop={(e) => handleDrop(e, 'auto')}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => videoInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
            videoFile || audioFile ? 'border-[#39ff14]/60 bg-[#39ff14]/5' : 'border-[#e0faec]/20 hover:border-[#39ff14]/40 hover:bg-[#39ff14]/5'
          }`}
        >
          <input ref={videoInputRef} type="file" accept="video/*,audio/*" multiple className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files);
              files.forEach(file => {
                const ext = file.name.split('.').pop().toLowerCase();
                if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) setVideoFile(file);
                if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) { setAudioFile(file); setUseCustomAudio(true); }
              });
            }} />
          
          <div className="flex justify-center items-center gap-6 mb-3">
            <Film size={28} className={videoFile ? 'text-[#39ff14]' : 'text-[#e0faec]/30'} />
            <Music size={28} className={audioFile ? 'text-[#ff00ff]' : 'text-[#e0faec]/30'} />
          </div>

          <div className="text-[#e0faec]/80 text-sm font-bold font-mono uppercase tracking-widest mb-1">
            DROP RAW ASSETS HERE
          </div>
          <div className="text-[#e0faec]/40 text-[10px] font-mono mb-4">
            Drag your video (.mp4) and audio (.mp3) simultaneously
          </div>

          {(videoFile || audioFile) && (
            <div className="flex justify-center items-center gap-4 bg-black/40 rounded-lg p-3 w-fit mx-auto border border-[#39ff14]/10">
              {videoFile && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#39ff14] animate-pulse" />
                  <span className="text-[#39ff14] text-xs font-mono max-w-[120px] truncate">{videoFile.name}</span>
                </div>
              )}
              {videoFile && audioFile && <span className="text-[#e0faec]/20">│</span>}
              {audioFile ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#ff00ff] animate-pulse" />
                  <span className="text-[#ff00ff] text-xs font-mono max-w-[120px] truncate">{audioFile.name}</span>
                </div>
              ) : (
                <div className="text-[#ff00ff]/30 text-[10px] font-mono">[ No Audio Override ]</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Waveform Visualizer + Beat Markers */}
      {audioFile && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[#e0faec]/30 text-[10px] uppercase tracking-wider flex items-center gap-1">
              <Radio size={12} /> Waveform & Beat Analysis
            </div>
            <button onClick={analyzeBeats} disabled={analyzingBeats || !audioFile?.path}
              className={`text-[10px] font-mono flex items-center gap-1 px-2 py-0.5 rounded border transition-all cursor-pointer ${
                analyzingBeats ? 'border-yellow-400/30 text-yellow-400' :
                beatData ? 'border-[#39ff14]/30 text-[#39ff14]/70 hover:text-[#39ff14]' :
                'border-[#ff00ff]/30 text-[#ff00ff] hover:bg-[#ff00ff]/10'
              }`}>
              {analyzingBeats ? <><Loader2 size={10} className="animate-spin" /> Analyzing...</> :
               beatData ? '↻ Re-analyze' : '⚡ Analyze Beats'}
            </button>
          </div>
          <canvas ref={waveformRef} width={600} height={80}
            className="w-full h-20 rounded-lg border border-[#39ff14]/10 bg-[#050a08]" />
        </div>
      )}

      {/* Beat Effect Assignments */}
      {beatData && beatData.beats && beatData.beats.length > 0 && (
        <div className="px-4 pb-3">
          <div className="text-[#e0faec]/30 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1">
            <Zap size={12} /> Beat Effects ({beatData.beats.length} beats)
          </div>
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {beatData.beats.map((bt, i) => (
              <div key={i} className="flex items-center gap-1 bg-black/40 rounded px-1.5 py-0.5 border border-[#e0faec]/5">
                <span className="text-[#39ff14]/50 text-[9px] font-mono w-8">{bt.toFixed(1)}s</span>
                <select value={beatEffects[i] || 'none'}
                  onChange={(e) => setBeatEffects(prev => ({ ...prev, [i]: e.target.value }))}
                  className="bg-transparent border-0 text-[9px] font-mono outline-none cursor-pointer"
                  style={{ color: EFFECTS.find(ef => ef.id === (beatEffects[i] || 'none'))?.color || '#e0faec' }}>
                  {EFFECTS.map(ef => <option key={ef.id} value={ef.id} style={{ background: '#0a0f0d' }}>{ef.label}</option>)}
                </select>
              </div>
            ))}
          </div>
          {/* Quick-fill buttons */}
          <div className="flex gap-1 mt-2">
            {EFFECTS.filter(e => e.id !== 'none').map(ef => (
              <button key={ef.id} onClick={() => {
                const updated = {};
                beatData.beats.forEach((_, i) => {
                  // Assign to every 4th beat for variety
                  updated[i] = (i % 4 === 0) ? ef.id : (beatEffects[i] || 'none');
                });
                setBeatEffects(updated);
              }}
                className="text-[8px] font-mono px-1.5 py-0.5 rounded border transition-all cursor-pointer hover:opacity-100 opacity-50"
                style={{ borderColor: ef.color + '40', color: ef.color }}>
                {ef.label} ×4
              </button>
            ))}
            <button onClick={() => {
              const updated = {};
              beatData.beats.forEach((_, i) => { updated[i] = 'none'; });
              setBeatEffects(updated);
            }}
              className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-[#e0faec]/10 text-[#e0faec]/30 cursor-pointer hover:text-[#e0faec]/60 transition-all">
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Audio Options */}
      {audioFile && (
        <div className="px-4 pb-2 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useCustomAudio} onChange={(e) => setUseCustomAudio(e.target.checked)}
              className="accent-[#ff00ff]" />
            <span className="text-[#ff00ff] text-xs font-mono">Use this audio (discard video audio)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer ml-auto">
            <input type="checkbox" checked={beatSync} onChange={(e) => setBeatSync(e.target.checked)}
              className="accent-[#39ff14]" />
            <span className="text-[#39ff14] text-xs font-mono">🎵 Beat Sync</span>
          </label>
        </div>
      )}

      {/* Platform Preset */}
      <div className="px-4 pb-3">
        <div className="text-[#e0faec]/30 text-[10px] uppercase tracking-wider mb-1.5">Export Format</div>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map(p => (
            <button key={p.id} onClick={() => setPlatform(p.id)}
              className={`px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                platform === p.id
                  ? 'border-[#39ff14] text-[#39ff14] bg-[#39ff14]/10'
                  : 'border-[#e0faec]/15 text-[#e0faec]/40 hover:border-[#e0faec]/30'
              }`}>
              {p.label} <span className="text-[#e0faec]/20 ml-1">{p.ratio}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Text Overlay Timeline */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[#e0faec]/30 text-[10px] uppercase tracking-wider flex items-center gap-1">
            <Type size={12} /> Text Overlays
          </div>
          <button onClick={addOverlay}
            className="text-[#39ff14] text-[10px] font-mono flex items-center gap-1 hover:bg-[#39ff14]/10 px-2 py-0.5 rounded border border-[#39ff14]/20 cursor-pointer transition-all">
            <Plus size={10} /> Add Text
          </button>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {textOverlays.map((overlay, idx) => (
            <div key={overlay.id} className="bg-black/40 border border-[#e0faec]/10 rounded-lg p-2.5">
              {/* Row 1: Time range + delete */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#39ff14]/60 text-[10px] font-mono w-3">{idx + 1}</span>
                <input type="number" min="0" step="0.5" value={overlay.startTime}
                  onChange={(e) => updateOverlay(overlay.id, 'startTime', e.target.value)}
                  className="w-14 bg-black/60 border border-[#e0faec]/15 rounded px-1.5 py-0.5 text-[#39ff14] text-xs font-mono text-center focus:border-[#39ff14]/50 outline-none"
                  placeholder="0" />
                <span className="text-[#e0faec]/20 text-xs">→</span>
                <input type="number" min="0" step="0.5" value={overlay.endTime}
                  onChange={(e) => updateOverlay(overlay.id, 'endTime', e.target.value)}
                  className="w-14 bg-black/60 border border-[#e0faec]/15 rounded px-1.5 py-0.5 text-[#39ff14] text-xs font-mono text-center focus:border-[#39ff14]/50 outline-none"
                  placeholder="3" />
                <span className="text-[#e0faec]/20 text-[10px]">sec</span>

                {/* Font selector */}
                <select value={overlay.font} onChange={(e) => updateOverlay(overlay.id, 'font', e.target.value)}
                  className="flex-1 bg-black/60 border border-[#e0faec]/15 rounded px-1.5 py-0.5 text-[#e0faec]/70 text-[10px] font-mono outline-none focus:border-[#39ff14]/50 cursor-pointer">
                  {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>

                {/* Font size */}
                <input type="number" min="12" max="120" value={overlay.size}
                  onChange={(e) => updateOverlay(overlay.id, 'size', parseInt(e.target.value) || 48)}
                  className="w-12 bg-black/60 border border-[#e0faec]/15 rounded px-1 py-0.5 text-[#e0faec]/60 text-[10px] font-mono text-center outline-none focus:border-[#39ff14]/50"
                  title="Font size" />

                {/* Color picker */}
                <input type="color" value={overlay.color}
                  onChange={(e) => updateOverlay(overlay.id, 'color', e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent" title="Text color" />

                <button onClick={() => removeOverlay(overlay.id)}
                  className="text-red-400/40 hover:text-red-400 p-0.5 cursor-pointer transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Row 2: Text input */}
              <input type="text" value={overlay.text}
                onChange={(e) => updateOverlay(overlay.id, 'text', e.target.value)}
                placeholder={idx === 0 ? "e.g. THE UNDESIRABLES" : "Enter text for this segment..."}
                className="w-full bg-black/40 border border-[#e0faec]/10 rounded px-2 py-1.5 text-white text-sm outline-none focus:border-[#39ff14]/40 placeholder:text-[#e0faec]/15"
                style={{ fontFamily: overlay.font }} />
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="px-4 pb-4">
        <button
          onClick={handleSubmit}
          disabled={!videoFile}
          className={`w-full py-2.5 rounded-lg font-mono text-sm font-bold tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            videoFile
              ? 'bg-[#39ff14]/20 border border-[#39ff14] text-[#39ff14] hover:bg-[#39ff14]/30 hover:shadow-[0_0_20px_rgba(57,255,20,0.2)]'
              : 'bg-[#e0faec]/5 border border-[#e0faec]/10 text-[#e0faec]/20 cursor-not-allowed'
          }`}>
          <Play size={14} />
          {videoFile ? 'PRODUCE VIDEO' : 'DROP A VIDEO TO START'}
        </button>
      </div>
    </div>
  );
}
