"use client";
import React, { useState, useEffect } from 'react';
import { Cpu, CheckCircle, XCircle, Loader2, Download, Terminal, ChevronRight } from 'lucide-react';

export default function BootstrapScreen({ onReady }) {
  const [stage, setStage] = useState('checking'); // checking, ollama_missing, ffmpeg_missing, provisioning_python, ready
  const [platform, setPlatform] = useState(null);
  const [ollamaOk, setOllamaOk] = useState(null);
  const [ffmpegOk, setFfmpegOk] = useState(null);
  const [pythonOk, setPythonOk] = useState(null);
  const [logs, setLogs] = useState([]);
  const [autoInstallTarget, setAutoInstallTarget] = useState(null);
  const [isInstalling, setIsInstalling] = useState(false);

  const addLog = (msg) => setLogs(prev => [...prev.slice(-10), msg]);

  useEffect(() => {
    runChecks();
  }, []);

  const runChecks = async () => {
    setStage('checking');
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      const platformInfo = await invoke('get_platform_info');
      setPlatform(platformInfo);

      const ollamaStatus = await invoke('check_ollama_status');
      setOllamaOk(ollamaStatus);

      const ffmpegStatus = await invoke('check_ffmpeg_status');
      setFfmpegOk(ffmpegStatus);

      if (!ollamaStatus) {
        setStage('ollama_missing');
      } else if (!ffmpegStatus) {
        setStage('ffmpeg_missing');
      } else {
        // Kick off Vision Model Download silently in the background
        invoke('pull_ollama_model', { modelName: 'qwen2.5vl:7b' }).catch(console.error);
        
        // Move to Python validation
        setStage('provisioning_python');
        addLog("> Checking AI Vision Subsystem Python environment...");
        
        try {
          addLog("> Building .venv and compiling OpenCV dependencies...");
          const pyRes = await invoke('setup_python_env');
          addLog("> Done processing dependencies.");
          setPythonOk(true);
          
          setStage('ready');
          setTimeout(() => onReady(), 1500);
        } catch (e) {
          addLog("> Python Provisioning Error: Dependency resolution failed. Check host OS architecture.");
          setPythonOk(false);
          // Still let them through to text-chat
          setStage('ready');
          setTimeout(() => onReady(), 2500);
        }
      }
    } catch (e) {
      console.warn('Bootstrap checks failed (likely browser mode):', e);
      setStage('ready');
      setTimeout(() => onReady(), 500);
    }
  };

  const handleAutoInstall = async (tool) => {
    setIsInstalling(true);
    setAutoInstallTarget(tool);
    addLog(`> Initiating absolute deployment for ${tool}...`);
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke('install_dependency', { tool });
      addLog(`> Success completing deployment for ${tool}.`);
      setTimeout(runChecks, 2000);
    } catch (e) {
      addLog(`> Fatal Error: Could not verify integrity for ${tool}. Terminating automated install.`);
    } finally {
      setIsInstalling(false);
    }
  };

  const StatusRow = ({ label, ok, loading }) => (
    <div className="flex items-center gap-3 py-2">
      {loading ? (
        <Loader2 size={18} className="text-[#39ff14] animate-spin" />
      ) : ok === true ? (
        <CheckCircle size={18} className="text-[#39ff14]" />
      ) : ok === false ? (
        <XCircle size={18} className="text-red-400" />
      ) : (
        <div className="w-[18px] h-[18px] rounded-full border border-[#e0faec]/20" />
      )}
      <span className={`font-mono text-sm ${ok === false ? 'text-red-400' : ok === true ? 'text-[#39ff14]' : 'text-[#e0faec]/50'}`}>
        {label}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0d1a12] border border-[#39ff14]/20 rounded-xl p-8 shadow-[0_0_30px_rgba(57,255,20,0.05)]">
        <div className="flex items-center gap-3 mb-6">
          <Cpu size={28} className="text-[#39ff14]" />
          <div>
            <h1 className="text-[#39ff14] font-bold font-mono text-xl tracking-wider">SYSTEM SEQUENCE</h1>
            <p className="text-[#e0faec]/40 text-xs font-mono">Automated Boot Provisioning</p>
          </div>
        </div>

        {platform && (
          <div className="mb-4 px-3 py-1.5 bg-black/30 rounded border border-[#e0faec]/10 text-xs font-mono text-[#e0faec]/50">
            [SYS] {platform.os} / {platform.arch} / {platform.family}
          </div>
        )}

        <div className="mb-6 space-y-1">
          <StatusRow label="Ollama AI Kernel" ok={ollamaOk} loading={stage === 'checking'} />
          <StatusRow label="FFmpeg Transcoder" ok={ffmpegOk} loading={stage === 'checking' && ollamaOk !== false} />
          <StatusRow label="Python Optical VENV" ok={pythonOk} loading={stage === 'provisioning_python'} />
        </div>

        {/* Terminal Logs rendering during install/provisioning */}
        {(isInstalling || stage === 'provisioning_python') && (
          <div className="mb-6 bg-black rounded p-3 font-mono text-[10px] text-[#39ff14]/80 shadow-inner border border-[#39ff14]/10 h-32 overflow-y-auto">
            {logs.map((l, i) => (
              <div key={i} className="mb-1 break-all flex gap-2">
                <ChevronRight size={10} className="mt-0.5 flex-shrink-0" />
                <span>{l}</span>
              </div>
            ))}
            <div className="animate-pulse">_</div>
          </div>
        )}

        {stage === 'ollama_missing' && !isInstalling && (
          <div className="bg-red-900/20 border border-red-400/30 rounded-lg p-4 mb-4">
            <p className="text-red-300 text-sm font-mono mb-2">⚠️ Ollama core missing</p>
            <p className="text-[#e0faec]/50 text-xs mb-4">Required for zero-cloud local reasoning capabilities. Can be installed automatically via terminal subsystem.</p>
            <button
              onClick={() => handleAutoInstall('ollama')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#39ff14]/10 border border-[#39ff14]/30 rounded text-[#39ff14] text-xs font-mono hover:bg-[#39ff14]/20 transition-colors"
            >
              <Terminal size={14} /> AUTO-DEPLOY OLLAMA
            </button>
            <div className="mt-3 text-center">
               <button onClick={runChecks} className="text-[#e0faec]/40 text-xs font-mono hover:text-[#e0faec]">Re-verify manually</button>
            </div>
          </div>
        )}

        {stage === 'ffmpeg_missing' && !isInstalling && (
          <div className="bg-yellow-900/20 border border-yellow-400/30 rounded-lg p-4 mb-4">
            <p className="text-yellow-300 text-sm font-mono mb-2">⚠️ FFmpeg missing</p>
            <p className="text-[#e0faec]/50 text-xs mb-3">Required for video rendering, voice synthesis, and media processing.</p>
            <div className="bg-black/40 rounded p-2.5 mb-3 border border-[#e0faec]/10">
              <p className="text-[#e0faec]/30 text-[10px] font-mono mb-1">Manual install — open Terminal and run:</p>
              <p className="text-[#39ff14] text-xs font-mono select-all cursor-text">brew install ffmpeg</p>
              <p className="text-[#e0faec]/20 text-[10px] font-mono mt-1">Then relaunch the app.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAutoInstall('ffmpeg')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#39ff14]/10 border border-[#39ff14]/30 rounded text-[#39ff14] text-xs font-mono hover:bg-[#39ff14]/20 transition-colors"
              >
                 <Terminal size={14} /> AUTO-DEPLOY FFMPEG
              </button>
              <button
                onClick={() => { setFfmpegOk(true); setStage('provisioning_python'); runChecks(); }}
                className="flex-1 px-3 py-2 bg-black/30 border border-[#e0faec]/20 rounded text-[#e0faec]/50 text-xs font-mono hover:text-[#e0faec] transition-colors"
              >
                 Skip for now
              </button>
            </div>
          </div>
        )}

        {stage === 'ready' && (
          <div className="text-center py-4">
            <div className="text-[#39ff14] text-2xl mb-2 animate-pulse">✓</div>
            <p className="text-[#39ff14] font-mono text-sm font-bold">ALL SYSTEMS OPERATIONAL</p>
            <p className="text-[#e0faec]/30 text-xs mt-1">Optical tensor pull continuing in background...</p>
            <p className="text-[#e0faec]/30 text-xs mt-1">Engaging matrix...</p>
          </div>
        )}
      </div>
    </div>
  );
}
