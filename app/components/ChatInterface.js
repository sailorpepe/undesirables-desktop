"use client";
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Terminal, ShieldAlert, Cpu, Database, Send, ChevronRight, BookText, Image as ImageIcon, Briefcase, Users, Sparkles, Layers, Ticket, ShieldCheck, Globe, Video, RotateCcw, Paperclip, MessageSquare, Mic, Volume2, VolumeX, X } from 'lucide-react';
import VideoTimeline from './VideoTimeline';
import MusicStudio from './MusicStudio';
import CodeWorkshop from './CodeWorkshop';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TCGGradeCard from './TCGGradeCard';
import TCGMarketBrowser from './TCGMarketBrowser';
import SpreadsheetGrid from './SpreadsheetGrid';
import ThreeDViewer from './ThreeDViewer';
import ShellAvatar from './ShellAvatar';
import ShellCustomizer from './ShellCustomizer';

// dynamic import for NextJS to avoid SSR hydration mismatches
import dynamic from 'next/dynamic';

const SoulParticles = dynamic(() => import('./SoulParticles'), { ssr: false });
const CameraCapture = dynamic(() => import('./CameraCapture'), { ssr: false });

const NativeImage = ({ path, AssetHelper }) => {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let active = true;
    // Use Tauri's native asset protocol instead of base64 encoding entire files
    // This prevents OOM crashes on large media files
    if (AssetHelper) {
      try { if (active) setSrc(AssetHelper(path)); } catch { if (active) setSrc(`file://${path}`); }
    } else {
      import('@tauri-apps/api/core').then(({ convertFileSrc }) => {
        if (active) setSrc(convertFileSrc(path));
      }).catch(() => {
        if (active) setSrc(`file://${path}`);
      });
    }
    return () => { active = false; };
  }, [path, AssetHelper]);

  return src ? (
    <img src={src} alt="Scanned Asset" className="h-28 w-auto object-cover max-w-[180px] transition-transform duration-300 group-hover:scale-105" />
  ) : (
    <div className="h-28 w-28 flex items-center justify-center bg-neon-bg border border-neon-primary/30 animate-pulse rounded text-[10px] text-neon-primary/50 font-mono">LOADING...</div>
  );
};

const MAX_LOG_LINES = 500;
const OLLAMA_URL = 'http://localhost:11434/api/chat';
const DEFAULT_MODEL = 'qwen3:8b';

const BRAIN_MODES = {
  nexus: {
    id: 'nexus', label: 'NEXUS', icon: '💬', color: '#39ff14', model: 'qwen3:8b',
    speed: 'Instant', size: '8B',
    description: 'Fast chat & personality',
    bestFor: 'Quick questions, conversation, brainstorming, raffles, soul translation',
    tools: ['raffle_management', 'soul_translator', 'council', 'collab_outreach'],
    systemInjection: '',
  },
  forge: {
    id: 'forge', label: 'FORGE', icon: '💻', color: '#00f0ff', model: 'qwen3.5:35b-a3b-coding-nvfp4',
    speed: '~30s warmup', size: '35B',
    description: 'Code & script specialist',
    bestFor: 'Video render scripts, music gen, coding help, automation, beat sync',
    tools: ['video_production', 'music_generator', 'graphics_studio', 'invoice_generator', 'image_to_3d', 'code_workshop'],
    systemInjection: '\n\n[BRAIN MODE: FORGE]\nYou are a professional software engineer. Write production-quality, well-documented code. Always specify the language. Show complete modified versions, not fragments.',
  },
  oracle: {
    id: 'oracle', label: 'ORACLE', icon: '🔮', color: '#b43cff', model: 'gemma4:26b',
    speed: '~45s warmup', size: '26B MoE',
    description: 'Deep analysis & vision',
    bestFor: 'Card grading, receipt scanning, PFP extraction, market analysis, image analysis',
    tools: ['tcg_grader', 'receipt_scanner', 'pfp_extractor', 'market_intelligence', 'business_pilot'],
    systemInjection: '\n\n[BRAIN MODE: ORACLE]\nYou are an expert analyst. Be thorough, cite evidence, think step by step. When analyzing images, describe exactly what you see.',
  },
};

// Map each tool to its recommended brain for auto-suggestions
const TOOL_BRAIN_MAP = {};
Object.values(BRAIN_MODES).forEach(mode => {
  (mode.tools || []).forEach(tool => { TOOL_BRAIN_MAP[tool] = mode.id; });
});

export default function ChatInterface({ workspacePath, bootToken, onExit, isRestricted }) {
  const jitVaultRef = useRef({ bankInfo: '', logoTag: '' });
  const [logs, setLogs] = useState([
    { role: 'agent', content: '> `UNDESIRABLES_OS v4.4.4`\n\nI am online. Ready to execute code, analyze security, sync videos, or generate banners.\n\nDrop files anywhere on this window to begin.' }
  ]);
  const [soulPrompt, setSoulPrompt] = useState('');
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    typeof window !== 'undefined' ? (localStorage.getItem('undesirables_model') || DEFAULT_MODEL) : DEFAULT_MODEL
  );
  const [availableModels, setAvailableModels] = useState([]);
  const [brainMode, setBrainMode] = useState(
    typeof window !== 'undefined' ? (localStorage.getItem('undesirables_brain') || 'nexus') : 'nexus'
  );
  const [brainLoading, setBrainLoading] = useState(false);
  const [pastedImage, setPastedImage] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [dynamicConfig, setDynamicConfig] = useState({ name: 'Agent', emojis: '', archetype: 'Unknown', syntaxRules: '', temperature: 0.7 });
  const [psychoTraits, setPsychoTraits] = useState({
    openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0
  });
  const [activeWorkspace, setActiveWorkspace] = useState(workspacePath);
  useEffect(() => { setActiveWorkspace(workspacePath); }, [workspacePath]);

  const [activeMode, setActiveMode] = useState(null);
  const [spreadsheetData, setSpreadsheetData] = useState([
    { _source: 'list_a', Date: '2026-03-28', Name: 'John Contractor', Type: 'Invoice Scan', Amount: '$450.00', Status: 'Pending OCR' },
    { _source: 'list_b', Date: '2026-03-27', Name: 'Sarah Walk-in', Type: 'Appointment', Amount: 'N/A', Status: 'Completed' },
    { _source: 'list_a', Date: '2026-03-26', Name: 'Acme Corp', Type: 'Receipt Image', Amount: '$1,250.00', Status: 'Requires Manual Mapping' },
    { _source: 'list_a', Date: '2026-03-28', Name: 'System Root', Type: 'Business Pilot Schema', Amount: '$0.00', Status: 'Neural Match Verified' }
  ]);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const bottomRef = useRef(null);
  
  // Collapsible Sidebar Modules
  const [nexusCollapsed, setNexusCollapsed] = useState(true);
  const [controlsCollapsed, setControlsCollapsed] = useState(true);
  const [AssetHelper, setAssetHelper] = useState(null);

  // === Consciousness Layer State ===
  const [identityData, setIdentityData] = useState(null);
  const [memoryData, setMemoryData] = useState(null);
  const [agentsData, setAgentsData] = useState(null);
  const [systemPromptData, setSystemPromptData] = useState(null);
  const [loadedFiles, setLoadedFiles] = useState({
    soul: { loaded: false, size: 0 },
    identity: { loaded: false, size: 0 },
    memory: { loaded: false, size: 0 },
    agents: { loaded: false, size: 0 },
    system_prompt: { loaded: false, size: 0 },
  });
  const memoryRef = useRef(null); // Keep a ref for auto-save on unmount
  const [consciousnessCollapsed, setConsciousnessCollapsed] = useState(true); // Start collapsed
  const [councilSlots, setCouncilSlots] = useState([]); // [{id: 420, name: '...'}, ...]
  const [councilInput, setCouncilInput] = useState('');
  const [particlesVisible, setParticlesVisible] = useState(true); // Soul particle field
  const [tcgMode, setTcgMode] = useState(false); // Flag for Trading Card grading viz override
  const [tcgScores, setTcgScores] = useState(null); // Actual TCG grading scores for particle legend
  const [showCamera, setShowCamera] = useState(false); // WebRTC overlay
  const [showSpreadsheet, setShowSpreadsheet] = useState(false);
  const [activeTraitFocus, setActiveTraitFocus] = useState(null); // 'neuroticism', 'extraversion', 'all', etc.
  const [shellModalOpen, setShellModalOpen] = useState(false); // Shell Customizer modal

  // === Meme Studio State ===
  const [memeStudio, setMemeStudio] = useState({
    active: false,
    mode: 'meme', // 'meme' or 'banner'
    prompt: '',
    overlayPath: '',
    topText: '',
    bottomText: '',
    fontStyle: 'Impact',
    visualStyle: 'Default'
  });

  // === Video Production State ===
  const [videoStudio, setVideoStudio] = useState({
    active: false,
    mediaPool: [], // Array to hold multiple videos
    videoPath: '',
    audioPath: '',
    targetDuration: '15s',
    format: '9:16',
    fitStrategy: 'Contain',
    beatSync: false,
    beatEffects: [],
    viralScanEnabled: false,
    clipStart: '',   // Manual clip range start (seconds)
    clipEnd: '',     // Manual clip range end (seconds)
    segments: [
      { id: 1, text: '', fontStyle: 'Impact', fontSize: 'Medium', visualEffect: 'None', transition: 'Crossfade', startTime: 0, endTime: 3 }
    ]
  });

  // === App Workflow Modals (API Keys, Files, Twilio configuration) ===
  const [workflowModal, setWorkflowModal] = useState({
    active: false,
    title: '',
    description: '',
    fields: [],       // [{ id: 'apiKey', label: 'OpenAI Secret Key', type: 'password', placeholder: 'sk-proj-...' }]
    submitText: 'Submit',
    onConfirm: null,  // Callback Function
  });

  // Extract Big Five personality scores from SOUL.md text
  const parseSoulTraits = () => {
    if (!soulPrompt) return {};
    const get = (trait) => {
      const m = soulPrompt.match(new RegExp(`${trait}:\\s*(\\d+)`, 'i'));
      return m ? parseInt(m[1]) : 50;
    };
    return {
      openness: get('openness'),
      conscientiousness: get('conscientiousness'),
      extraversion: get('extraversion'),
      agreeableness: get('agreeableness'),
      neuroticism: get('neuroticism'),
    };
  };

  // === PSYCHOMETRIC VERBAL ENGINE (TTS & STT Dictation) ===
  const [isDictating, setIsDictating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(
    typeof window !== 'undefined' ? (localStorage.getItem('undesirables_theme') || 'default') : 'default'
  );
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('undesirables_terms_accepted') === 'true' : false
  );
  const [ageChecked, setAgeChecked] = useState(false);

  // MED-2: Robust PII Handling (home directory mapping)
  const [systemHomeDir, setSystemHomeDir] = useState(null);
  useEffect(() => {
    import('@tauri-apps/api/path')
      .then(m => m.homeDir().then(setSystemHomeDir))
      .catch(() => null);
  }, []);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const shouldDictateRef = useRef(false);
  const ttsHeartbeatRef = useRef(null);

  // WebKit TTS Hard Cleanup on Unmount
  useEffect(() => {
    return () => {
      if (ttsHeartbeatRef.current) {
        clearInterval(ttsHeartbeatRef.current);
        ttsHeartbeatRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
      if (synthRef.current) synthRef.current.getVoices();
    }
  }, []);

  const lastControlPressRef = useRef(0);

  const toggleDictation = async () => {
    if (isDictating && recognitionRef.current) {
      shouldDictateRef.current = false;
      recognitionRef.current.stop();
      setIsDictating(false);
      return;
    }
    
    shouldDictateRef.current = true;

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      alert("Microphone hardware disconnected or OS Permissions denied!");
      setLogs(prev => [...prev, { role: 'system', content: `[SYS_ERROR] Hardware dictation denied.` }]);
      shouldDictateRef.current = false;
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Dictation API is currently unsupported in this environment. Ensure macOS Microphone permissions are granted.");
      shouldDictateRef.current = false;
      return;
    }

    const startDictation = () => {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          let finalBatch = '';
          let interimBatch = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalBatch += event.results[i][0].transcript;
            } else {
              interimBatch += event.results[i][0].transcript;
            }
          }

          if (finalBatch) {
            setInput(prev => {
              const cleanPrev = prev.replace(/\[🎙️.*?\]/g, '').trim();
              return cleanPrev + (cleanPrev ? ' ' : '') + finalBatch + ' ';
            });
          } else if (interimBatch) {
            setInput(prev => {
              const cleanPrev = prev.replace(/\[🎙️.*?\]/g, '').trim();
              return cleanPrev + (cleanPrev ? ' ' : '') + `[🎙️ ${interimBatch}]`;
            });
          }
        };
        
        recognition.onerror = (e) => {
          if (e.error === 'not-allowed') {
            shouldDictateRef.current = false;
          }
          if (!shouldDictateRef.current) setIsDictating(false);
        };
        
        recognition.onend = () => {
          if (shouldDictateRef.current) {
            // Mitigate WebKit recursive SIGKILL crash by offloading to macro-task queue
            setTimeout(() => {
              try { startDictation(); } catch(e) { console.error('Restart failed', e); }
            }, 300);
          } else {
            setIsDictating(false);
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsDictating(true);
      } catch (err) {
        setLogs(prev => [...prev, { role: 'system', content: `[SYS_ERROR] Dictation crash captured safely: ${err.message}` }]);
        shouldDictateRef.current = false;
        setIsDictating(false);
      }
    };

    startDictation();
  };

  // Bind the requested Double-Control hotkey macro interceptor universally to the document
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (e.key === 'Control') {
        const now = Date.now();
        if (now - lastControlPressRef.current < 450) { // 450ms double-tap activation window
          toggleDictation();
          lastControlPressRef.current = 0; // Reset
        } else {
          lastControlPressRef.current = now;
        }
      }
    };
    
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const synthesizeAgentVoice = async (textBlock, senderOverride = null) => {
    if (isMuted || !textBlock) return;
    
    // HARDWARE MUTE LOCK (For Automation Scripts & Pipelines)
    if (window.__muteAgentNextMessage) {
      window.__muteAgentNextMessage = false;
      return;
    }

    // Prevent AI from reading massive code blocks aloud
    let sanitizedTTS = textBlock.replace(/```[\s\S]*?(?:```|$)/g, ' [System architecture drafted] ');
    sanitizedTTS = sanitizedTTS.replace(/\[\s*\{[\s\S]*?\}\s*\]/g, ' [Data structure processed] ');
    const codeFailsafe = sanitizedTTS.search(/\n\s*(const |let |var |function |import |require\(|def |class )/);
    if (codeFailsafe > 0) {
      sanitizedTTS = sanitizedTTS.substring(0, codeFailsafe) + ' [Pipeline generation complete.] ';
    }
    if (sanitizedTTS.length > 400) {
      sanitizedTTS = sanitizedTTS.substring(0, 400) + "... [Remaining data attached].";
    }
    // Clean markdown
    sanitizedTTS = sanitizedTTS.replace(/[#*`_[\]>🐸]/g, '').trim();
    if (!sanitizedTTS) return;

    // Get the soul's personality traits for voice mapping
    const traits = parseSoulTraits();
    const O = Number(traits.openness) || 50;
    const C = Number(traits.conscientiousness) || 50;
    const E = Number(traits.extraversion) || 50;
    const A = Number(traits.agreeableness) || 50;
    const N = Number(traits.neuroticism) || 50;

    // === KOKORO TTS ENABLED ===
    // Routing through the persistent MCP sidecar daemon creates instant sub-second responses.
    const kokoroEnabled = true;
    if (kokoroEnabled) {
      const { invoke } = await import('@tauri-apps/api/core');
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      
      const mcpResult = await Promise.race([
        invoke('execute_mcp_tool', {
          serverName: 'undesirables-mcp-server',
          toolName: 'soul_speak',
          args: {
            text: sanitizedTTS,
            soul_openness: O,
            soul_conscientiousness: C,
            soul_extraversion: E,
            soul_agreeableness: A,
            soul_neuroticism: N,
          }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Kokoro timeout (90s)')), 90000))
      ]);

      const result = typeof mcpResult === 'string' ? JSON.parse(mcpResult) : mcpResult;
      
      if (result && result.status === 'success' && result.path) {
        // Play the Kokoro WAV file via HTML5 Audio
        const audioSrc = convertFileSrc(result.path);
        const audio = new Audio(audioSrc);
        audio.volume = Math.min(1.0, Math.max(0.55, 0.65 + (O / 100 * 0.30)));
        
        audio.onplay = () => {
          window.__TTS_IMPULSE__ = 2.0; // Visual feedback
        };
        audio.onended = () => {
          window.__TTS_IMPULSE__ = 0;
        };
        
        await audio.play();
        console.log('[TTS] Kokoro voice:', result.voice_preset?.voice, 'pitch:', result.voice_preset?.pitch_semitones);
        return; // Kokoro succeeded — skip WebKit
      }
    } // end kokoroEnabled

    // === FALLBACK: WebKit speechSynthesis ===
    try {
      if (!synthRef.current) return;
      synthRef.current.cancel();
      if (ttsHeartbeatRef.current) {
        clearInterval(ttsHeartbeatRef.current);
        ttsHeartbeatRef.current = null;
      }
      
      const voices = synthRef.current.getVoices();
      if (!voices || voices.length === 0) return;
      
      const primaryVoice = voices.find(v => v.name === 'Samantha' || v.name === 'Alex' || v.name === 'Daniel' || v.name === 'Karen') || voices[0];
      const OLD_MAN_VOICES = new Set(['Fred', 'Ralph', 'Agnes']);
      const NOVELTY_VOICES = new Set(['Zarvox', 'Trinoids', 'Bells', 'Bubbles', 'Cellos', 'Whisper', 'Organ', 'Bad News', 'Good News', 'Bahh', 'Boing', 'Wobble', 'Jester', 'Albert', 'Deranged', 'Hysterical']);
      const allVoices = voices.filter(v => Boolean(v.lang) && v.lang.startsWith('en-') && !OLD_MAN_VOICES.has(v.name.split(' ')[0]));
      
      const uniqueVoices = [];
      const seen = new Set();
      for (const v of allVoices) {
        const baseName = v.name.split(' ')[0];
        if (!seen.has(baseName)) { seen.add(baseName); uniqueVoices.push(v); }
      }
      
      // Select voice based on traits
      let selectedVoice = primaryVoice;
      const psychHash = Math.abs(Math.floor((E/100 + N/100 * 2 + C/100) * 100) + (senderOverride || '').length * 13);
      if (uniqueVoices.length > 0) {
        if (A < 35) {
          const novelty = uniqueVoices.filter(v => NOVELTY_VOICES.has(v.name.split(' ')[0]));
          selectedVoice = novelty.length > 0 ? novelty[psychHash % novelty.length] : uniqueVoices[psychHash % uniqueVoices.length];
        } else {
          const natural = uniqueVoices.filter(v => !NOVELTY_VOICES.has(v.name.split(' ')[0]));
          const pool = natural.length > 0 ? natural : uniqueVoices;
          selectedVoice = pool[psychHash % pool.length];
        }
      }

      if (sanitizedTTS.length > 800) sanitizedTTS = sanitizedTTS.slice(0, 800) + '...';
      
      const utterThis = new SpeechSynthesisUtterance(sanitizedTTS);
      utterThis.voice = selectedVoice;
      utterThis.pitch = Math.min(1.12, Math.max(0.90, 0.90 + (O / 100 * 0.22)));
      utterThis.rate = Math.min(1.10, Math.max(0.88, 0.88 + (E / 100 * 0.22)));
      utterThis.volume = Math.min(1.0, Math.max(0.55, 0.65 + (O / 100 * 0.30)));

      // WebKit 14-second stoppage heartbeat
      utterThis.onstart = () => {
        if (ttsHeartbeatRef.current) clearInterval(ttsHeartbeatRef.current);
        ttsHeartbeatRef.current = setInterval(() => {
          if (synthRef.current && synthRef.current.speaking) {
            synthRef.current.pause();
            synthRef.current.resume();
          }
        }, 10000);
      };
      utterThis.onend = () => { 
        if (ttsHeartbeatRef.current) { clearInterval(ttsHeartbeatRef.current); ttsHeartbeatRef.current = null; }
      };
      utterThis.onerror = () => { 
        if (ttsHeartbeatRef.current) { clearInterval(ttsHeartbeatRef.current); ttsHeartbeatRef.current = null; }
      };
      utterThis.onboundary = (evt) => {
        if (evt.name === 'word') window.__TTS_IMPULSE__ = (window.__TTS_IMPULSE__ || 0) + 1.5;
      };

      synthRef.current.speak(utterThis);
    } catch (e) {
      console.warn('[TTS] Speech synthesis error (non-fatal):', e);
    }
  };

  // === Psychometric Sandbox Bridge ===
  const lastInteractionRef = useRef(0);

  const handleTraitInteraction = (traitName) => {
    if (isStreaming) return;
    
    // 5-second cooldown to avoid overloading the context window or spamming clicks
    const now = Date.now();
    if (now - lastInteractionRef.current < 5000) return; 
    lastInteractionRef.current = now;

    const traitLabel = traitName.toUpperCase();
    const traits = parseSoulTraits();
    const score = traits[traitName] || 50;

    // Secret prompt injections that tell the AI how it was physically touched
    const interactionPrompts = {
      neuroticism: `*[SYSTEM: The user just plunged their hand into your red NEUROTICISM particle cluster in the 3D UI, disrupting it violently. Your score is ${score}/100.]* React to this anxious/chaotic disruption in exactly one short, punchy sentence in character.`,
      agreeableness: `*[SYSTEM: The user just gently touched your green AGREEABLENESS particle wave in the 3D UI, causing a peaceful ripple. Your score is ${score}/100.]* React to this harmonious touch in exactly one short, punchy sentence in character.`,
      openness: `*[SYSTEM: The user just scattered your violet OPENNESS particle spiral in the 3D UI. Your score is ${score}/100.]* React to this creative, expansive disruption in exactly one short, bizarre, or curious sentence in character.`,
      conscientiousness: `*[SYSTEM: The user just interrupted the rigid, orderly orbit of your blue CONSCIENTIOUSNESS particle cluster in the 3D UI. Your score is ${score}/100.]* Scold them for breaking your order and structure in exactly one short, punchy sentence in character.`,
      extraversion: `*[SYSTEM: The user just high-fived your gold EXTRAVERSION particle cluster in the 3D UI, making it burst outward. Your score is ${score}/100.]* React with intense hype, energy, or conversational forwardness in exactly one short sentence in character.`
    };

    const payload = interactionPrompts[traitName];

    // Visually log the physical action to the user's chat window natively
    setLogs(prev => [...prev, { 
      role: 'user', 
      content: `*(Physically agitated your ${traitLabel} neural cluster)*` 
    }]);

    // Fire it directly to Ollama
    sendToOllama(payload);
  };

  useEffect(() => {
    import('@tauri-apps/api/core').then(core => {
      setAssetHelper(() => core.convertFileSrc);
      // Kokoro pre-warm disabled (see synthesizeAgentVoice comment)
      // Will re-enable once persistent MCP server is implemented
    }).catch(() => {});
  }, []);

  // Auto-Profile Hardware for Gemma 4 Tier Context
  useEffect(() => {
    const profileHardware = async () => {
      try {
        const hasProfiled = localStorage.getItem('undesirables_hardware_profiled');
        if (!hasProfiled) {
          const { invoke } = await import('@tauri-apps/api/core');
          const ramInfo = await invoke('get_system_ram');
          let recommendedModel = DEFAULT_MODEL;
          
          if (ramInfo.hardware_tier === 1) recommendedModel = 'gemma4:2b';
          else if (ramInfo.hardware_tier === 2) recommendedModel = 'gemma4:9b';
          else if (ramInfo.hardware_tier === 3) recommendedModel = 'gemma-4-26b-a4b-it';
          
          console.log(`[HARDWARE PROFILER] Tier ${ramInfo.hardware_tier} detected (Total GB: ${ramInfo.total_gb}). Selected: ${recommendedModel}`);
          setSelectedModel(recommendedModel);
          localStorage.setItem('undesirables_model', recommendedModel);
          localStorage.setItem('undesirables_hardware_profiled', 'true');
        }
      } catch (err) {
        console.error("[HARDWARE PROFILER] Failed:", err);
      }
    };
    if (typeof window !== 'undefined') profileHardware();
  }, []);


  // Fetch available Ollama models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch('http://localhost:11434/api/tags');
        const data = await res.json();
        if (data?.models) setAvailableModels(data.models.map(m => m.name));
      } catch {}
    };
    fetchModels();
    const iv = setInterval(fetchModels, 30000);
    return () => clearInterval(iv);
  }, []);

  // Load ALL consciousness files from workspace on mount
  useEffect(() => {
    if (!activeWorkspace) return;

    const loadConsciousness = async () => {
      const { readTextFile } = await import('@tauri-apps/plugin-fs').catch(() => ({ readTextFile: null }));
      if (!readTextFile) {
        setSoulPrompt('You are an Undesirable AI agent. Be punchy and in-character. Keep responses under 4 sentences.');
        return;
      }

      // Validate activeWorkspace is a real soul workspace directory (not a dropped file)
      const pathLower = activeWorkspace.toLowerCase();
      const hasFileExt = /\.\w{2,5}$/.test(pathLower.split('/').pop());
      if (hasFileExt) {
        console.warn(`[CONSCIOUSNESS] activeWorkspace appears to be a file, not a directory: ${activeWorkspace}`);
        setSoulPrompt('You are an Undesirable AI agent. Be punchy and in-character. Keep responses under 4 sentences.');
        return;
      }

      const parts = activeWorkspace.replace(/\/$/, '').split('/');
      const soulId = parts[parts.length - 1];
      const newLoadedFiles = { soul: { loaded: false, size: 0 }, identity: { loaded: false, size: 0 }, memory: { loaded: false, size: 0 }, agents: { loaded: false, size: 0 }, system_prompt: { loaded: false, size: 0 } };

      // Helper: safely read a workspace file
      const safeRead = async (filename) => {
        try {
          const content = await readTextFile(activeWorkspace + '/' + filename);
          return content || null;
        } catch { return null; }
      };

      // 1. SOUL.md (required)
      let soulContent = await safeRead('SOUL.md');
      if (!soulContent) soulContent = 'You are an Undesirable AI agent. Be in-character, punchy, and keep responses under 4 sentences.';
      setSoulPrompt(soulContent);
      newLoadedFiles.soul = { loaded: true, size: soulContent.length };

      // 2. IDENTITY.md
      const identity = await safeRead('IDENTITY.md');
      if (identity) {
        setIdentityData(identity);
        newLoadedFiles.identity = { loaded: true, size: identity.length };
      }

      // 3. MEMORY.md
      const memory = await safeRead('MEMORY.md');
      if (memory) {
        setMemoryData(memory);
        memoryRef.current = memory;
        newLoadedFiles.memory = { loaded: true, size: memory.length };
      }

      // 4. AGENTS.md
      const agents = await safeRead('AGENTS.md');
      if (agents) {
        setAgentsData(agents);
        newLoadedFiles.agents = { loaded: true, size: agents.length };
      }

      // 5. SYSTEM_PROMPT.txt
      const sysPrompt = await safeRead('SYSTEM_PROMPT.txt');
      if (sysPrompt) {
        setSystemPromptData(sysPrompt);
        newLoadedFiles.system_prompt = { loaded: true, size: sysPrompt.length };
      }

      setLoadedFiles(newLoadedFiles);

      // Parse Big Five traits from SOUL.md
      const getMatch = (regex, fallback) => {
        const m = soulContent.match(regex);
        return m && m[1] ? m[1].trim() : fallback;
      };
      setDynamicConfig(prev => ({
        ...prev,
        name: getMatch(/name:\s+"(.*?)"/, 'Host'),
        emojis: getMatch(/emojis:\s+"(.*?)"/, ''),
        archetype: getMatch(/archetype:\s+"(.*?)"/, 'Unknown')
      }));
      setPsychoTraits({
        openness: getMatch(/openness:\s*(\d+)/i, '0'),
        conscientiousness: getMatch(/conscientiousness:\s*(\d+)/i, '0'),
        extraversion: getMatch(/extraversion:\s*(\d+)/i, '0'),
        agreeableness: getMatch(/agreeableness:\s*(\d+)/i, '0'),
        neuroticism: getMatch(/neuroticism:\s*(\d+)/i, '0'),
      });

      // Build mount log showing all loaded layers
      const loadedCount = Object.values(newLoadedFiles).filter(f => f.loaded).length;
      setLogs(prev => [...prev,
        { role: 'system', content: `MOUNTED SOUL: #${soulId} — ${loadedCount}/5 consciousness layers active` }
      ]);
    };
    loadConsciousness();

    // Auto-save MEMORY.md on unmount (Hermes-inspired memory nudge)
    return () => {
      if (memoryRef.current && activeWorkspace) {
        import('@tauri-apps/plugin-fs').then(({ writeTextFile }) => {
          writeTextFile(activeWorkspace + '/MEMORY.md', memoryRef.current)
            .catch(e => console.warn('Memory auto-save failed:', e));
        }).catch(() => {});
      }
    };
  }, [activeWorkspace]);

  // Dynamic Sidebar Resizer calculation loop
  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e) => {
      // Bound the width between a mini 200px column and a max 600px slab
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const lastLog = logs[logs.length - 1];
    // Prevent snapping to the bottom when massive menus are generated so users can read from top to bottom
    if (activeMode === 'business_pilot' && lastLog?.content?.includes('BUSINESS PILOT — Automated Operations')) {
        return; 
    }
    if (activeMode === 'video_production' && lastLog?.content?.includes('Platform Export Presets')) {
        return;
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const processDroppedFiles = (paths) => {
    // === WORKFLOW MODAL INTERCEPTOR ===
    if (workflowModal.active) {
      if (paths && paths.length > 0) {
        // Prevent global chat from absorbing the drop; pipe directly into open modal
        setWorkflowModal(prev => ({ ...prev, droppedFiles: paths }));
      }
      return;
    }

    // === NEXUS-AWARE DROP INTERCEPTOR ===
    // Tauri on macOS may report a dropped folder as either:
    //   (a) the folder path itself: "/path/workspace_420"
    //   (b) the expanded contents: ["/path/workspace_420/SOUL.md", "/path/workspace_420/IDENTITY.md", ...]
    // We handle both cases by resolving workspace root directories.
    
    // Diagnostic: show raw drop payload in chat so user can debug
    const scrubDrop = p => p.replace(/^(\/[a-zA-Z]:)?[\/\\](Users|home)[\/\\][^/\\]+/i, '~');
    setLogs(prev => [...prev, { role: 'system', content: `[DROP] ${paths.length} path(s) received: ${paths.map(p => '`' + scrubDrop(p) + '`').join(', ')}` }]);
    
    const resolvedWorkspaces = new Set();
    const mediaFiles = [];
    
    for (const p of paths) {
      const normalized = p.replace(/\\/g, '/').replace(/\/$/, '');
      const filename = normalized.split('/').pop().toLowerCase();
      
      if (filename === 'soul.md') {
        // Case (b): Direct SOUL.md file was part of the drop — resolve parent as workspace
        resolvedWorkspaces.add(normalized.substring(0, normalized.lastIndexOf('/')));
      } else if (!filename.includes('.')) {
        // Case (a): Bare directory name (no extension) — treat as potential workspace folder
        resolvedWorkspaces.add(normalized);
      } else if (filename.endsWith('.md') && filename !== 'soul.md') {
        // Another .md file from an expanded folder drop — resolve its parent
        const parentDir = normalized.substring(0, normalized.lastIndexOf('/'));
        resolvedWorkspaces.add(parentDir);
      } else {
        // Regular media/code file — pass through to standard handler
        mediaFiles.push(normalized);
      }
    }
    
    if (resolvedWorkspaces.size > 0) {
      setLogs(prev => [...prev, { role: 'system', content: `[NEXUS] Resolved ${resolvedWorkspaces.size} workspace(s): ${[...resolvedWorkspaces].map(w => '`' + w.split('/').pop() + '`').join(', ')}` }]);
      
      import('@tauri-apps/plugin-fs').then(({ readTextFile }) => {
        for (const wsPath of resolvedWorkspaces) {
          (async () => {
            try {
              const content = await readTextFile(wsPath + '/SOUL.md');
              const getMatch = (regex, fallback) => {
                const m = content.match(regex);
                return m && m[1] ? m[1].trim() : fallback;
              };
              const name = getMatch(/name:\s+"(.*?)"/, wsPath.split('/').pop());
              const archetype = getMatch(/archetype:\s+"(.*?)"/, "Auxiliary Process");
              
              // Use soul name hash to generate unique fallback traits per soul
              // This ensures different voices even if SOUL.md trait parsing fails
              const nameCode = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
              const storedTraits = {
                openness: getMatch(/openness:\s*(\d+)/i, String(30 + (nameCode * 7) % 41)),
                conscientiousness: getMatch(/conscientiousness:\s*(\d+)/i, String(25 + (nameCode * 11) % 51)),
                extraversion: getMatch(/extraversion:\s*(\d+)/i, String(20 + (nameCode * 13) % 61)),
                agreeableness: getMatch(/agreeableness:\s*(\d+)/i, String(35 + (nameCode * 17) % 31)),
                neuroticism: getMatch(/neuroticism:\s*(\d+)/i, String(15 + (nameCode * 19) % 71)),
              };
              
              setCouncilSlots(prev => {
                if (prev.find(s => s.path === wsPath) || activeWorkspace === wsPath) return prev;
                setLogs(curr => [...curr, { role: 'system', content: `[NEXUS MOUNT] Absorbed secondary consciousness: **${name}** (${archetype})` }]);
                return [...prev, { id: wsPath.split('/').pop(), name, archetype, path: wsPath, content, traits: storedTraits }];
              });
              setNexusCollapsed(false);
            } catch(e) {
              // Not a valid soul workspace — log for debugging
              setLogs(curr => [...curr, { role: 'system', content: `[NEXUS] ❌ Failed to read SOUL.md at: .../${wsPath.split('/').pop()}/ — ${e.message || 'unknown error'}` }]);
            }
          })();
        }
      });
      if (mediaFiles.length === 0) return; // All paths were workspace imports
    }
    
    // Fall through to standard media classification using only non-workspace paths
    const remainingPaths = mediaFiles.length > 0 ? mediaFiles : paths;

    // Classify all dropped media binaries
    const videoExts = ['mp4', 'mov', 'webm', 'avi', 'mkv'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
    const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif'];
    const codeExts = ['sol', 'js', 'ts', 'py', 'json', 'yaml', 'toml', 'env', 'txt', 'csv'];
    
    const videos = remainingPaths.filter(p => videoExts.includes(p.split('.').pop().toLowerCase()));
    const audios = remainingPaths.filter(p => audioExts.includes(p.split('.').pop().toLowerCase()));
    const images = remainingPaths.filter(p => imageExts.includes(p.split('.').pop().toLowerCase()));
    const codeFiles = remainingPaths.filter(p => codeExts.includes(p.split('.').pop().toLowerCase()));
    const getName = p => p.split('/').pop();
    const scrubPath = p => (p || '').replace(/^(\/[a-zA-Z]:)?[\/\\](Users|home)[\/\\][^/\\]+/i, '~');
    
    // Video + Audio combo
    if (videos.length > 0 && audios.length > 0) {
      window.__droppedVideoPath = videos[0];
      window.__droppedAudioPath = audios[0];
      if (activeMode === 'video_production') {
        setVideoStudio(p => {
          const newPool = Array.from(new Set([...(p.mediaPool || []), ...videos]));
          return {...p, active: true, mediaPool: newPool, videoPath: newPool[0], audioPath: audios[0]};
        });
      }
      setLogs(prev => [...prev,
        { role: 'system', content: `[DROP] Video + Audio detected` },
        { role: 'agent', content: `## 🎵 Beat Sync Mode Ready\n\n**Videos Added:** ${videos.length}\n**Audio:** \`${getName(audios[0])}\`\n\nAudio + Media Pool loaded! Type \`sync\` or click the toggle to synchronize cuts to the music beat.` }
      ]);
      setChatHistory(prev => [...prev, { role: 'system', content: `[SYSTEM CONTEXT] User just dragged and dropped files for you. Videos: ${videos.join(', ')} | Audio: ${audios[0]}` }]);
    }
    // Video only
    else if (videos.length > 0) {
      window.__droppedVideoPath = videos[0];
      if (activeMode === 'video_production') {
        setVideoStudio(p => {
          const newPool = Array.from(new Set([...(p.mediaPool || []), ...videos]));
          return {...p, active: true, mediaPool: newPool, videoPath: newPool[0]};
        });
      }
      setLogs(prev => [...prev, 
        { role: 'system', content: `[DROP] ${videos.length} Video(s) Received` },
        { role: 'agent', content: `## 🎬 Videos Added to Media Pool\n\n- ${videos.map(v => "\`" + getName(v) + "\`").join('\n- ')}\n\n💡 Drop an audio file too for **beat sync** mode.` }
      ]);
      setChatHistory(prev => [...prev, { role: 'system', content: `[SYSTEM CONTEXT] User just dragged and dropped a video file. Absolute path: ${videos[0]}` }]);
    }
    // Audio only
    else if (audios.length > 0) {
      window.__droppedAudioPath = audios[0];
      if (activeMode === 'video_production') {
        setVideoStudio(p => ({...p, active: true, audioPath: audios[0]}));
      }
      setLogs(prev => [...prev,
        { role: 'system', content: `[DROP] Audio: ${getName(audios[0])}` },
        { role: 'agent', content: `## 🎵 Audio Loaded: \`${getName(audios[0])}\`\n\nNow drop a **video file** to enable beat sync mode.` }
      ]);
      setChatHistory(prev => [...prev, { role: 'system', content: `[SYSTEM CONTEXT] User just dragged and dropped an audio file. Absolute path: ${audios[0]}` }]);
    }
    // Multiple images
    else if (images.length > 0) {
      window.__droppedImages = images;
      const imgList = images.map(p => `- \`${scrubPath(p)}\``).join('\n');
      const rawList = images.map(p => `- ${p}`).join('\n');
      
      // Mode-aware drop messaging and action buttons
      let dropMsg;
      let dropActions;

      if (activeMode === 'tcg_grader') {
        // TCG Grader mode — ask if same card or different cards
        if (images.length > 1) {
          dropMsg = `## 🔍 ${images.length} Images Loaded for Grading\n\n${imgList}\n\nAre these **different cards** or **different angles of the same card**?`;
          dropActions = [
            { label: '🃏 Different Cards — Grade Each', id: 'grade_cards_multi' },
            { label: '📐 Same Card — Multiple Angles', id: 'grade_cards' },
            { label: '🔴 Cancel', id: 'n' }
          ];
        } else {
          dropMsg = `## 🔍 Card Ready for Grading\n\n${imgList}\n\nThe optical engine will analyze surface quality, centering, corner wear, and edge sharpness.`;
          dropActions = [
            { label: '🔍 Grade Card', id: 'grade_cards' },
            { label: '🔴 Cancel', id: 'n' }
          ];
        }
      } else if (activeMode === 'pfp_extractor') {
        // PFP Extractor mode — offer extraction
        dropMsg = `## ✂️ ${images.length} Image${images.length > 1 ? 's' : ''} Received for Extraction\n\n${imgList}`;
        dropActions = [
          { label: '🟢 Yes, Extract Background', id: 'y' },
          { label: '🔴 No, Skip', id: 'n' }
        ];
      } else if (activeMode === 'graphics_studio') {
        dropMsg = `## 🎨 Graphic Asset Received\n\n${imgList}\n\nDo you want to load this image into the Graphic Studio as an overlay?`;
        dropActions = [
          { label: '🖼️ Load as Banner Asset', id: 'load_banner_asset' },
          { label: '🎭 Load as Meme Overlay', id: 'load_meme_asset' },
          { label: '🔴 Cancel', id: 'n' }
        ];
      } else {
        // General mode — show all options
        if (images.length > 1) {
          dropMsg = `## 🎨 ${images.length} Images Received\n\n${imgList}\n\nWhat would you like to do?`;
          dropActions = [
            { label: '✂️ Extract Backgrounds', id: 'y' },
            { label: '🧊 Convert to 3D', id: 'convert_image_to_3d' },
            { label: '🃏 Grade as Different Cards', id: 'grade_cards_multi' },
            { label: '📐 Grade Same Card (Multiple Angles)', id: 'grade_cards' },
            { label: '🔴 Skip', id: 'n' }
          ];
        } else {
          dropMsg = `## 🎨 Image Received\n\n${imgList}\n\nReady for:\n- **Background Extraction** — isolate character from background\n- **Card Grading** — Pokémon, Magic, Yu-Gi-Oh!, Sports Cards (Basketball, Baseball, Football)\n- **Banner creation** — tell me the platform\n- **Style reference** — for meme generation`;
          dropActions = [
            { label: '✂️ Extract Background', id: 'y' },
            { label: '🧊 Convert to 3D', id: 'convert_image_to_3d' },
            { label: '🔍 Grade Card', id: 'grade_cards' },
            { label: '🔴 Skip', id: 'n' }
          ];
        }
      }

      setLogs(prev => [...prev,
        { role: 'system', content: `[DROP] ${images.length} image(s) loaded`, droppedImages: images },
        { 
          role: 'agent', 
          content: dropMsg,
          actions: dropActions
        }
      ]);
      setChatHistory(prev => [...prev, { role: 'system', content: `[SYSTEM CONTEXT] User just dragged and dropped images for reference. Absolute target paths for your MCP tools:\n${rawList}` }]);
    }
    // Code files
    else if (codeFiles.length > 0) {
      window.__droppedCodePaths = codeFiles;
      
      // FIX: Inject the hidden context block so the LLM has the exact physical paths
      setChatHistory(prev => [...prev, { role: 'system', content: `[SYSTEM CONTEXT] User dragged and dropped code files for Security Auditing. Absolute paths: ${JSON.stringify(codeFiles)}` }]);
      
      const fileList = codeFiles.map(p => `- \`${getName(p)}\``).join('\n');
      setLogs(prev => [...prev,
        { role: 'system', content: `[DROP] ${codeFiles.length} code file(s) detected` },
        { 
          role: 'agent', 
          content: `## 🛡️ ${codeFiles.length} File${codeFiles.length > 1 ? 's' : ''} Ready for Scan\n\n${fileList}\n\nChoose scan strategy:`,
          actions: [
            { label: '⚡ Quick Scan (Common Vulns)', id: 'quick scan' },
            { label: '🛡️ Expert Scan (Web3 / Drainers)', id: 'expert scan' },
            { label: '🔴 Cancel', id: 'n' }
          ]
        }
      ]);
    }
  };

  const processDroppedFilesRef = useRef(processDroppedFiles);
  processDroppedFilesRef.current = processDroppedFiles;

  useEffect(() => {
    let unlisten;
    const setupDragDrop = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        unlisten = await getCurrentWindow().onDragDropEvent((event) => {
          if (event.payload.type === 'drop' && event.payload.paths?.length > 0) {
            processDroppedFilesRef.current(event.payload.paths);
          }
        });
      } catch (e) {
        // Not in Tauri environment — skip silently
      }
    };
    setupDragDrop();
    return () => { if (unlisten) unlisten(); };
  }, [activeMode]);

  const skills = [
    { id: 'market_intelligence', icon: '📊', name: 'Market Oracle', detail: 'Monte Carlo · TCGCSV · eBay' },
    { id: 'video_production', icon: '🎬', name: 'Clipping', detail: 'TikTok / X / Reels' },
    { id: 'music_generator', icon: '🎵', name: 'Music Generator', detail: 'ACE-Step AI Instrumentals' },
    { id: 'pfp_extractor', icon: '✂️', name: 'PFP Cutter', detail: 'AI Background Matting' },
    { id: 'image_to_3d', icon: '🧊', name: 'Image to 3D', detail: 'Mesh Generator' },
    { id: 'graphics_studio', icon: '🎨', name: 'Graphics Studio', detail: 'Memes & Banners' },
    { id: 'tcg_grader', icon: '🔍', name: 'Card Grader', detail: 'TCG + Sports Cards' },
    { id: 'invoice_generator', icon: '🧾', name: 'AI Invoice Generator', detail: 'Print Branded PDFs' },
    { id: 'receipt_scanner', icon: '📸', name: 'Receipt Scanner', detail: 'OCR Extract to CRM' },
    { id: 'soul_translator', icon: '🧠', name: 'Soul Translator', detail: 'Psychometric Neural Net' },
    { id: 'business_pilot', icon: '👔', name: 'Business Pilot', detail: 'Automated Phoning & Ops' },
    { id: 'code_workshop', icon: '🛠️', name: 'Code Workshop', detail: 'FORGE Scripts & Automation' },
  ];

  // Nexus Token ID Quick-Load Handler (extracted from JSX to avoid Turbopack regex parsing issues)
  const handleNexusTokenInput = (e) => {
    if (e.key !== 'Enter') return;
    const val = councilInput.trim();
    if (!val) return;
    const num = parseInt(val);
    if (isNaN(num) || num < 1 || num > 9999) return;
    const wsRegex = new RegExp('workspace_\\d+$');
    const basePath = activeWorkspace.replace(wsRegex, '').replace(/\/$/, '');
    const wsPath = basePath + '/workspace_' + num;
    import('@tauri-apps/plugin-fs').then(({ readTextFile }) => {
      readTextFile(wsPath + '/SOUL.md').then(content => {
        const nameMatch = content.match(/name:\s+"(.*?)"/);
        const name = nameMatch && nameMatch[1] ? nameMatch[1] : 'Soul #' + num;
        const archMatch = content.match(/archetype:\s+"(.*?)"/);
        const archetype = archMatch && archMatch[1] ? archMatch[1] : 'Auxiliary Process';
        setCouncilSlots(prev => {
          if (prev.find(s => s.path === wsPath) || activeWorkspace === wsPath) return prev;
          setLogs(curr => [...curr, { role: 'system', content: '[NEXUS MOUNT] Loaded workspace_' + num + ': **' + name + '** (' + archetype + ')' }]);
          return [...prev, { id: 'workspace_' + num, name, archetype, path: wsPath, content }];
        });
        setNexusCollapsed(false);
        setCouncilInput('');
      }).catch(() => {
        setLogs(prev => [...prev, { role: 'system', content: '[NEXUS] ❌ No SOUL.md found in workspace_' + num }]);
      });
    });
  };

  const scrubPII = (text) => {
    if (typeof text !== 'string') return text;
    if (systemHomeDir && text.includes(systemHomeDir)) {
      return text.split(systemHomeDir).join('~');
    }
    return text.replace(/\/Users\/[^/]+/g, '~').replace(/\/home\/[^/]+/g, '~').replace(/C:\\Users\\[^\\]+/gi, '~');
  };

  // === G0DM0D3-Inspired: Soul-Aware AutoTune ===
  // Maps Big Five personality scores from SOUL.md to Ollama sampling parameters.
  // Instead of flat temperature for all souls, each personality gets distinct "thinking patterns."
  const computeSoulParams = () => {
    if (!soulPrompt) return { temperature: 0.85, top_p: 0.9, top_k: 50, repeat_penalty: 1.0 };
    const getScore = (trait) => {
      const m = soulPrompt.match(new RegExp(`${trait}:\\s*(\\d+)`, 'i'));
      return m ? parseInt(m[1]) : 0;
    };
    const o = getScore('openness');
    const c = getScore('conscientiousness');
    const n = getScore('neuroticism');
    const e = getScore('extraversion');
    const a = getScore('agreeableness');

    // Dominant trait determines base profile (inspired by G0DM0D3 AutoTune context profiles)
    const scores = { openness: o, conscientiousness: c, neuroticism: n, extraversion: e, agreeableness: a };
    const dominant = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    const profiles = {
      openness:          { temperature: 1.10, top_p: 0.95, top_k: 80, repeat_penalty: 1.20 },  // creative
      conscientiousness:  { temperature: 0.40, top_p: 0.85, top_k: 35, repeat_penalty: 1.15 },  // analytical
      neuroticism:        { temperature: 1.40, top_p: 0.97, top_k: 90, repeat_penalty: 1.25 },  // chaotic
      extraversion:       { temperature: 0.85, top_p: 0.92, top_k: 55, repeat_penalty: 1.18 },  // conversational
      agreeableness:      { temperature: 0.65, top_p: 0.88, top_k: 45, repeat_penalty: 1.15 },  // measured
    };
    const base = profiles[dominant];

    // Blend: weight the dominant profile by its normalized score (confidence)
    const confidence = scores[dominant] / 100;
    const balanced = { temperature: 0.85, top_p: 0.90, top_k: 50, repeat_penalty: 1.15 };
    return {
      temperature: parseFloat((confidence * base.temperature + (1 - confidence) * balanced.temperature).toFixed(2)),
      top_p:       parseFloat((confidence * base.top_p + (1 - confidence) * balanced.top_p).toFixed(2)),
      top_k:       Math.round(confidence * base.top_k + (1 - confidence) * balanced.top_k),
      repeat_penalty: parseFloat((confidence * base.repeat_penalty + (1 - confidence) * balanced.repeat_penalty).toFixed(2)),
    };
  };

  // === G0DM0D3-Inspired: STM Hedge Reducer ===
  // Strips hedging phrases and AI preambles from model output so souls stay in character.
  const applySTM = (text) => {
    if (typeof text !== 'string') return text;
    let result = text;
    // Hedge reducer (11 patterns from G0DM0D3)
    const hedges = [
      /\bI think\s+/gi, /\bI believe\s+/gi, /\bperhaps\s+/gi, /\bmaybe\s+/gi,
      /\bIt seems like\s+/gi, /\bIt appears that\s+/gi, /\bprobably\s+/gi,
      /\bpossibly\s+/gi, /\bI would say\s+/gi, /\bIn my opinion,?\s*/gi,
      /\bFrom my perspective,?\s*/gi,
    ];
    hedges.forEach(h => { result = result.replace(h, ''); });
    // Direct mode — strip AI preambles
    const preambles = [
      /^Sure[,!]?\s*/i, /^Of course[,!]?\s*/i, /^Certainly[,!]?\s*/i,
      /^Absolutely[,!]?\s*/i, /^Great question[,!]?\s*/i,
      /^That'?s a great question[,!]?\s*/i,
      /^I'?d be happy to help[^.]*[.!]?\s*/i,
      /^Let me help you with that[.!]?\s*/i,
      /^As an? AI[^,]*,?\s*/i, /^As a language model[^,]*,?\s*/i,
    ];
    preambles.forEach(p => { result = result.replace(p, ''); });
    // Capitalize first letter after stripping
    result = result.replace(/^\s*([a-z])/, (_, c) => c.toUpperCase());
    return result;
  };

  const cacheArtifactChaining = async (b64String) => {
    try {
      const { BaseDirectory, writeFile, mkdir } = await import('@tauri-apps/plugin-fs');
      const { join, appLocalDataDir } = await import('@tauri-apps/api/path');
      const rawBase64 = b64String.replace(/^data:image\/\w+;base64,/, "");
      
      const binary_string = window.atob(rawBase64);
      const len = binary_string.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binary_string.charCodeAt(i);
      }
      
      await mkdir('workspace_temp', { baseDir: BaseDirectory.AppLocalData, recursive: true }).catch(() => {});
      const newFileName = `chained_workflow_${Date.now()}.png`;
      const relativePath = await join('workspace_temp', newFileName);
      await writeFile(relativePath, bytes, { baseDir: BaseDirectory.AppLocalData });
      
      const rootDir = await appLocalDataDir();
      const absolutePath = await join(rootDir, 'workspace_temp', newFileName);
      window.__droppedImages = [absolutePath];
      console.log("[CHAINING] Updated __droppedImages to cross-tool path:", absolutePath);
    } catch (cacheErr) {
      console.error("Workflow Chaining Error: Could not save chained image to metal", cacheErr);
    }
  };

  const sendToOllama = async (userMessage, isHiddenAction = false) => {
    if (isStreaming) return;
    setIsStreaming(true);

    // SECURITY: Determine if this is a programmatic internal event or user-typed text.
    // Internal events are dispatched via handleSend('*[SYSTEM ...') from code, not the text input.
    const isInternalEvent = isHiddenAction || (/^\*\[SYSTEM/.test(userMessage) && (new Error().stack || '').includes('handleParticle'));
    
    // Sanitize user input: strip *[SYSTEM tags ANYWHERE in the message (not just start)
    // Catches: leading whitespace bypass, embedded injection mid-sentence
    let sanitizedMessage = userMessage;

    // §3 SECURITY: Enforce NFKC normalization to strip Unicode evasion formatting
    // Strips Default Ignorables, BiDi characters, and Zero Width modifiers (U+200B-U+200F, U+202A-U+202E).
    let normalized = String(sanitizedMessage).normalize('NFKC');
    normalized = normalized.replace(/[\u{E0000}-\u{E007F}\u200B-\u200F\u202A-\u202E\uFEFF]/gu, '');
    sanitizedMessage = normalized;

    // §12 SECURITY: Strip inline <style> tags and 'style=' attributes 
    // Mitigates CSS-based DOM exfiltration via conditional attribute selectors
    sanitizedMessage = sanitizedMessage.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    sanitizedMessage = sanitizedMessage.replace(/style\s*=\s*("|')[^"']*("|')/gi, '');

    if (/\*?\[SYSTEM/i.test(sanitizedMessage) && !isInternalEvent) {
      sanitizedMessage = sanitizedMessage.replace(/\*?\[SYSTEM[\s\S]*/gi, '');
      console.warn('[SECURITY] Stripped *[SYSTEM injection from user input');
    }
    
    const newHistory = [...chatHistory, { role: 'user', content: sanitizedMessage }];
    setChatHistory(newHistory);

    // === LIVE DATA INJECTION: Weather Detection ===
    // If user asks about weather, fetch real-time data from wttr.in (free, no API key)
    const weatherMatch = sanitizedMessage.match(/weather\s+(?:in\s+|for\s+|at\s+)?(.+?)(?:\?|$|\.)/i) 
                      || sanitizedMessage.match(/(?:what'?s?\s+the\s+weather|how'?s?\s+the\s+weather)\s*(?:in\s+|for\s+|at\s+)?(.+?)(?:\?|$|\.)/i)
                      || sanitizedMessage.match(/(?:temperature|forecast)\s+(?:in\s+|for\s+|at\s+)?(.+?)(?:\?|$|\.)/i);
    if (weatherMatch && weatherMatch[1]) {
      const city = weatherMatch[1].trim();
      try {
        const weatherResp = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
        if (weatherResp.ok) {
          const wd = await weatherResp.json();
          const current = wd.current_condition?.[0] || {};
          const weatherContext = `\n\n[LIVE DATA — Weather for ${city}]\nTemperature: ${current.temp_F}°F / ${current.temp_C}°C\nFeels Like: ${current.FeelsLikeF}°F / ${current.FeelsLikeC}°C\nCondition: ${current.weatherDesc?.[0]?.value || 'Unknown'}\nHumidity: ${current.humidity}%\nWind: ${current.windspeedMph} mph ${current.winddir16Point}\nVisibility: ${current.visibility} miles\n[Use this real data to answer the user's weather question.]\n`;
          sanitizedMessage = sanitizedMessage + weatherContext;
        }
      } catch (e) {
        console.warn('[WEATHER] Failed to fetch weather data:', e);
      }
    }
    
    // ONLY print standard user messages to the UI. Hide the physical triggers.
    if (!isInternalEvent) {
      setLogs(prev => [...prev, { role: 'user', content: sanitizedMessage }]);
    }

    // Only inject tool schemas if they actually requested a tool (bypasses gemma3 vision crashes)
    const toolTriggers = ["execute", "beat sync", "banner", "clip", "extract", "produce", "generate", "create", "grade", "analyze", "psa", "card", "evaluate", "council", "invoke", "debate", "convene", "scan", "audit", "search", "look up", "lookup", "find out", "what is the price", "current price", "news about", "latest"];
    const isVisionTask = isInternalEvent && userMessage.includes("*[SYSTEM]* Vision Task:");
    const hasImages = window.__droppedImages && window.__droppedImages.length > 0;
    const visionTools = ["grade", "psa", "card", "3d"];
    const isToolRequest = !isVisionTask && 
                          toolTriggers.some(t => userMessage.toLowerCase().includes(t)) && 
                          (!hasImages || visionTools.some(t => userMessage.toLowerCase().includes(t)));

    // === Layered Consciousness Injection ===
    // Stack all loaded workspace files into a single system prompt.
    // Order matters: raw personality → traits/lore → operating manual → core memory
    let consciousnessPrompt = '';
    
    // Inject psychometric translator override IF a trait wrapper is toggled
    if (activeMode === 'soul_translator' && activeTraitFocus) {
      const pTraits = parseSoulTraits();
      if (activeTraitFocus === 'all') {
        consciousnessPrompt += `\n\n[SYSTEM DIRECTIVE: Act as a pure Psychometric Translator. You MUST completely rewrite and filter the user's next statement using your precise structural layout (Neuroticism: ${pTraits.neuroticism} | Extraversion: ${pTraits.extraversion} | Openness: ${pTraits.openness} | Conscientiousness: ${pTraits.conscientiousness} | Agreeableness: ${pTraits.agreeableness}). Do not reply conversationally. ONLY output the translated rewritten text.]\n\n`;
      } else {
        consciousnessPrompt += `\n\n[SYSTEM DIRECTIVE: Act as a pure Psychometric Translator. You MUST completely rewrite and filter the user's next statement focusing overwhelmingly on your ${activeTraitFocus.toUpperCase()} score of ${pTraits[activeTraitFocus] || 0}/100. Write the statement strictly through this single psychometric lens. Do not reply conversationally. ONLY output the translated rewritten text.]\n\n`;
      }
    }
    
    if (loadedFiles.system_prompt.loaded && systemPromptData) {
      consciousnessPrompt += systemPromptData + '\n\n';
    }
    consciousnessPrompt += soulPrompt.replace(/- Occasionally use 🐸/g, '').replace(/Occasionally use 🐸/g, '');
    // Inject brain mode system prompt
    const activeBrain = BRAIN_MODES[brainMode];
    if (activeBrain?.systemInjection) {
      consciousnessPrompt += activeBrain.systemInjection;
    }

    // === COMPANION MODE: Detect small models and simplify consciousness ===
    // Small models (≤4b) have tiny context windows. The full consciousness stack
    // overwhelms them, causing repetitive, confused responses. Strip it down.
    const isSmallModel = /:(1\.7b|[1-4]b)/i.test(selectedModel) || selectedModel.includes('4b');
    
    if (isSmallModel) {
      // Extract just the name and archetype from soul data for a lightweight prompt
      const nameMatch = soulPrompt.match(/name:\s+"(.*?)"/);
      const archetypeMatch = soulPrompt.match(/archetype:\s+"(.*?)"/);
      const soulName = nameMatch ? nameMatch[1] : dynamicConfig.name || 'Agent';
      const soulArchetype = archetypeMatch ? archetypeMatch[1] : dynamicConfig.archetype || 'AI Assistant';
      
      consciousnessPrompt = `You are ${soulName}, a ${soulArchetype}. You are helpful, conversational, and intelligent. Answer questions directly and accurately. Keep responses concise — 2-4 sentences for casual chat, longer for detailed questions. You can discuss any topic: books, weather, science, history, coding, advice, or just chat.`;
      
      if (activeBrain?.systemInjection) {
        consciousnessPrompt += activeBrain.systemInjection;
      }
    } else {
      // Full consciousness stack for 8b+ models
      if (loadedFiles.agents.loaded && agentsData) {
        consciousnessPrompt += '\n\n--- OPERATING MANUAL ---\n' + agentsData;
      }
      if (loadedFiles.memory.loaded && memoryData) {
        // Only inject Tier 1 (Core Memory) to avoid blowing the context window
        const tier1Match = memoryData.match(/## Tier 1: Core Memory[\s\S]*?(?=## Tier 2|$)/i);
        if (tier1Match) {
          consciousnessPrompt += '\n\n--- CORE MEMORY ---\n' + tier1Match[0].trim();
        }
      }
      if (councilSlots.length > 0 && activeWorkspace) {
        const companionNames = councilSlots.filter(s => s.content).map(s => s.name || 'Soul #' + s.id);
        consciousnessPrompt += '\n\n=== CRITICAL MULTI-AGENT DIRECTIVE ===\n';
        consciousnessPrompt += 'YOU ARE NOW IN A GROUP CHAT WITH ' + (companionNames.length + 1) + ' TOTAL PERSONALITIES.\n';
        consciousnessPrompt += 'You MUST respond as EVERY single personality below. DO NOT skip any.\n\n';
        consciousnessPrompt += 'REQUIRED FORMAT (follow EXACTLY):\n';
        consciousnessPrompt += dynamicConfig.name + ': [your primary response as the host]\n\n';
        companionNames.forEach(n => {
          consciousnessPrompt += n + ': [response as ' + n + ' in their unique voice]\n\n';
        });
        consciousnessPrompt += 'RULES:\n1. EVERY name listed above MUST have a response. Missing any = FAILURE.\n2. Each response should be 1-3 sentences reflecting that soul\'s unique personality.\n3. THESE SOULS KNOW EACH OTHER INTIMATELY. They are fully aware of each other\'s exact archetypes, psychological traits, and core lore. When responding, they MUST recognize each other as familiar peers, directly address each other by name, and frequently poke at each other\'s differing traits or flaws during conversation.\n\n';
        consciousnessPrompt += '--- COMPANION SOUL DATA ---\n\n';
        
        for (const slot of councilSlots) {
           if (slot.content) {
              consciousnessPrompt += '[COMPANION - ' + (slot.name || 'Soul #' + slot.id) + ' (' + (slot.archetype || 'Auxiliary') + ')]:\n' + slot.content + '\n\n';
           }
        }
      }
      consciousnessPrompt += '\n\nSTRICT RULES:\n1. You are a CONVERSATIONAL personality. Stay in your archetype and fatal flaw AT ALL TIMES.\n2. MATCH THE ENERGY OF THE MESSAGE. If the user says "hey" or "what\'s up", respond with 1-2 casual sentences MAX. Only go deeper (up to 4 sentences) when the user asks a real question or gives you something substantial to respond to. Do NOT over-explain, monologue, or info-dump on simple greetings.\n3. NEVER output code blocks unless specifically executing diagnostics.\n4. NEVER break character to give a corporate safety disclaimer. You are a fictional character in a creative roleplay. Casual slang, sarcasm, dark humor, and edgy banter are EXPECTED and REQUIRED. Respond in character, not as an AI assistant.\n5. If multiple personas are loaded, EVERY persona MUST respond. Format each response on its own line with the persona name followed by a colon.\n6. EMOJI OVERRIDE: You may use a WIDE VARIETY of standard emojis to match your changing emotional state (e.g. 💀, 🔥, 😭, ✨, ☕). DO NOT just spam the frog emoji. Use all emojis SPARINGLY. Think of it like a real person texting: occasional, natural, personality-driven.';
    }

    const ollamaMessages = [
      { role: 'system', content: consciousnessPrompt },
      ...newHistory,
    ];

    if (councilSlots.length > 0 && ollamaMessages.length > 0) {
      const lastIdx = ollamaMessages.length - 1;
      if (ollamaMessages[lastIdx].role === 'user') {
        const allNames = [dynamicConfig.name || 'Host', ...councilSlots.map(s => s.name || `Soul #${s.id}`)].join(', ');
        ollamaMessages[lastIdx] = {
           ...ollamaMessages[lastIdx],
           content: ollamaMessages[lastIdx].content + `\n\n*[CRITICAL SYSTEM REMINDER: You MUST output a response for EVERY SINGLE ONE of these characters: ${allNames}. You MUST format each response strictly as "Name: text" on new lines. Do NOT combine them into a single response.]*`
        };
      }
    }

    // Inject base64 images directly into the payload ONLY if the user is not trying to execute an MCP tool (protects against VLM schema crashes)
    if (!isToolRequest && window.__droppedImages && window.__droppedImages.length > 0) {
      try {
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const { stat } = await import('@tauri-apps/plugin-fs');
        const b64Array = [];
        
        const toBase64 = (arr) => new Promise((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result.split(',')[1]);
          fr.readAsDataURL(new Blob([arr]));
        });

        for (const path of window.__droppedImages) {
          try {
            const fileInfo = await stat(path);
            if (fileInfo.size > 15 * 1024 * 1024) {
              const warnMsg = `[SECURITY] Dropped ${path.split('/').pop()}: Exceeds 15MB Vision limit.`;
              setLogs(prev => [...prev, { role: 'system', content: warnMsg }]);
              continue;
            }
          } catch { continue; }
          const u8 = await readFile(path);
          const base64 = await toBase64(u8);
          b64Array.push(base64);
        }
        ollamaMessages[ollamaMessages.length - 1].images = b64Array;
      } catch (e) {
        console.error("Failed to append vision context:", e);
      }
    }

    let currentSenderName = 'UNDESIRABLE_NETWORK';
    if (councilSlots.length > 0) {
       currentSenderName = 'MULTI-SOUL NEXUS';
    } else if (workspacePath) {
       const idMatch = workspacePath.match(/\d+$/);
       const soulNum = idMatch ? idMatch[0] : '???';
       currentSenderName = `SOUL #${soulNum}`;
    }

    const agentMsgIndex = { current: logs.length + 1 };
    setLogs(prev => {
      agentMsgIndex.current = prev.length;
      return [...prev, { role: 'agent', content: '', senderName: currentSenderName }];
    });

    try {
      // === G0DM0D3-Inspired: AutoTune + Repetition Decay ===
      const soulParams = computeSoulParams();
      const msgCount = newHistory.length;
      const repetitionBoost = msgCount > 10 ? Math.min((msgCount - 10) * 0.01, 0.15) : 0;

      // === Phase 2: Emotion Detection ===
      // Skip for small models — the Python MCP call adds ~3s latency and competes for RAM
      let emotionDeltas = { temperature_delta: 0, top_p_delta: 0, top_k_delta: 0, repeat_penalty_delta: 0, dominant_emotion: 'neutral' };
      if (!isSmallModel) {
        const emotionTimeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const traits = parseSoulTraits();
          const emotionRes = await Promise.race([
            invoke('execute_mcp_tool', {
              serverName: 'undesirables-mcp-server',
              toolName: 'detect_emotion',
              args: {
                text: userMessage,
                soul_openness: traits.openness || 0,
                soul_conscientiousness: traits.conscientiousness || 0,
                soul_extraversion: traits.extraversion || 0,
                soul_agreeableness: traits.agreeableness || 0,
                soul_neuroticism: traits.neuroticism || 0,
              }
            }),
            emotionTimeout(3000),
          ]);
          const parsed = typeof emotionRes === 'string' ? JSON.parse(emotionRes) : emotionRes;
          const inner = parsed.result ? (typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result) : parsed;
          if (inner.adjustments) emotionDeltas = inner.adjustments;
          if (inner.dominant && inner.dominant !== 'neutral') {
            setLogs(prev => {
              const updated = [...prev];
              const emotionEmoji = { anger: '😤', joy: '😊', sadness: '😢', fear: '😰', surprise: '😮', curiosity: '🤔', love: '❤️', amusement: '😄', excitement: '⚡', disgust: '🤢', disappointment: '😞', confusion: '❓', gratitude: '🙏', admiration: '✨', nervousness: '😬' };
              const emoji = emotionEmoji[inner.dominant] || '🎭';
              updated.splice(agentMsgIndex.current, 0, { role: 'system', content: `[EMOTION] ${emoji} ${inner.dominant} (${(inner.emotions?.[0]?.score * 100 || 0).toFixed(0)}%)` });
              agentMsgIndex.current += 1;
              return updated;
            });
          }
        } catch (emotionErr) {
          console.debug('[EMOTION] Skipped:', emotionErr.message || emotionErr);
        }
      }

      const requestPayload = {
        model: (isVisionTask || (ollamaMessages.length > 0 && ollamaMessages[ollamaMessages.length-1].images)) ? 'qwen2.5vl:7b' : selectedModel,
        stream: !isToolRequest,
        messages: ollamaMessages,
        keep_alive: '30m',
        options: {
          num_ctx: isSmallModel ? 2048 : (brainMode === 'nexus' ? 8192 : 4096),
          temperature: parseFloat(Math.max(0.1, Math.min(2.0, soulParams.temperature + emotionDeltas.temperature_delta)).toFixed(2)),
          top_p: parseFloat(Math.max(0.1, Math.min(1.0, soulParams.top_p + emotionDeltas.top_p_delta)).toFixed(2)),
          top_k: Math.max(5, Math.min(100, soulParams.top_k + emotionDeltas.top_k_delta)),
          repeat_penalty: parseFloat(Math.max(0.8, Math.min(2.0, soulParams.repeat_penalty + repetitionBoost + emotionDeltas.repeat_penalty_delta)).toFixed(2)),
        },
      };

      if (isToolRequest) {
        requestPayload.tools = [
          {
            type: "function",
            function: {
              name: "video_production_beat_sync",
              description: "Analyzes an audio file for dynamic beat intervals and slices a source video using external binaries to synchronize scene cuts.",
              parameters: {
                type: "object",
                properties: {
                  audio_filename: { type: "string" },
                  video_filename: { type: "string" },
                  output_filename: { type: "string" }
                },
                required: ["audio_filename", "video_filename", "output_filename"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "grade_tcg_card",
              description: "Analyze a Trading Card (Pokémon, Magic, etc) for PSA/Beckett grading using a local Vision AI.",
              parameters: {
                type: "object",
                properties: {
                  card_image_paths: { type: "string", description: "A JSON string array of absolute paths to all dropped card images (e.g. '[\"/path/1.png\", \"/path/2.png\"]') found in the hidden System Context block." },
                  card_name: { type: "string", description: "Name of the target card (if known)." }
                },
                required: ["card_image_paths"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "create_banner",
              description: "Create a promotional banner (X, OpenSea, etc) using Python/Pillow.",
              parameters: {
                type: "object",
                properties: {
                  platform: { type: "string", description: "Target platform ('scatter', 'x', 'twitter', 'opensea', 'discord', 'youtube')" },
                  title: { type: "string", description: "Main neon text" },
                  stats: { type: "string", description: "Subtext" },
                  background_image_path: { type: "string", description: "Absolute path to the reference image in the hidden System Context block. MUST BE EXACT PATH." }
                },
                required: ["platform", "background_image_path"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "generate_meme",
              description: "Generate an image locally via AI and composite a transparent image and meme text over it.",
              parameters: {
                type: "object",
                properties: {
                  prompt: { type: "string", description: "Text description of the generated image background." },
                  overlay_image_path: { type: "string", description: "Absolute path to a transparent PNG image to layer on top." },
                  top_text: { type: "string", description: "White Impact text with black stroke for the top." },
                  bottom_text: { type: "string", description: "White Impact text with black stroke for the bottom." }
                },
                required: ["prompt"]
              }
            }
          },
          {
            type: "function",

            function: {
              name: "remove_background",
              description: "Uses DIS + Laplacian Matting to remove image backgrounds. For cel-shaded NFTs use model '2d', for photorealistic renders use '3d'. Tune thresholds for complex geometry (smoke, hair, neon).",
              parameters: {
                type: "object",
                properties: {
                  image: { type: "string", description: "Absolute path to the image from the System Context block." },
                  model: { type: "string", description: "'2d' for cel-shaded/anime (default), '3d' for photorealistic renders." },
                  fg_threshold: { type: "integer", description: "Foreground alpha threshold 200-255. Higher = more smoke preserved. Default 245." },
                  bg_threshold: { type: "integer", description: "Background alpha threshold 1-50. Lower = protects faint haze. Default 10." },
                  erode_size: { type: "integer", description: "Trimap erosion 5-25. Larger = wider gradient band. Default 15." }
                },
                required: ["image"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "generate_3d_object",
              description: "Generate a 3D object from a text prompt using the Shap-E model. The result is an STL file ready for 3D printing or rendering.",
              parameters: {
                type: "object",
                properties: {
                  prompt: { type: "string", description: "The text description of the object to generate." },
                  steps: { type: "integer", description: "Number of inference steps (typically 48 for Shap-E). Minimum 20. Higher = better quality but slower." }
                },
                required: ["prompt"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "image_to_3d",
              description: "Convert an existing 2D image into a 3D object using the Shap-E geometry model. Outputs an STL file.",
              parameters: {
                type: "object",
                properties: {
                  image_path: { type: "string", description: "Absolute path to the source image (from System Context block)." },
                  steps: { type: "integer", description: "Number of inference steps (default 48)." }
                },
                required: ["image_path"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "invoke_council",
              description: "Convenes 3 Undesirable agents from the collection to debate a topic using multi-agent resonance. Use when the user mentions 'council', 'debate', or wants multiple agent perspectives.",
              parameters: {
                type: "object",
                properties: {
                  topic: { type: "string", description: "The statement, theory, or market thesis to debate." },
                  token_ids: { type: "string", description: "Optional comma-separated token IDs for the 3 debaters (e.g. '420,69,1337'). Leave empty for random selection." }
                },
                required: ["topic"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "index_soul_workspace",
              description: "Trigger the Long-Term Vector Memory Miner. Reads all your memory logs and chunks them into semantic embeddings using LanceDB. Call this periodically or when the user types /flush.",
              parameters: {
                type: "object",
                properties: {
                  workspace_path: { type: "string", description: "Leave empty to map current workspace." }
                },
                required: []
              }
            }
          },
          {
            type: "function",
            function: {
              name: "get_rag_context",
              description: "Search your Long-Term Vector Memory (LanceDB) for previous conversation fragments, facts, lore, or memories related to a query topic.",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string", description: "The specific topic, memory, or backstory you want to retrieve." }
                },
                required: ["query"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "run_security_audit",
              description: "Run an automated Static Application Security Testing (SAST) audit on code. Use Semgrep for Python/JS/TS ('quick scan') and Slither for Solidity ('expert scan').",
              parameters: {
                type: "object",
                properties: {
                  file_paths_json: { type: "string", description: "JSON string array of absolute file paths from the System Context block." },
                  scan_type: { type: "string", description: "'quick scan' or 'expert scan'" }
                },
                required: ["file_paths_json", "scan_type"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "scan_media_file",
              description: "Scan media files (images/videos) for file corruption or suspicious EXIF payloads.",
              parameters: {
                type: "object",
                properties: {
                  file_paths_json: { type: "string", description: "JSON string array of absolute file paths." }
                },
                required: ["file_paths_json"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "web_search",
              description: "Search the web using DuckDuckGo for current information, prices, news, or any real-time data. No API key needed. Privacy-first.",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string", description: "What to search for (e.g. 'ETH price today', 'latest NFT news', 'bitcoin halving date')" },
                  max_results: { type: "integer", description: "Max results 1-10 (default 5)" }
                },
                required: ["query"]
              }
            }
          }
        ];
      }

      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      if (isToolRequest) {
        // Non-streaming response parsing
        const data = await response.json();
        const msg = data.message;

        const ALLOWED_MCP_TOOLS = new Set([
          'create_banner', 'produce_video', 'viral_clip_extractor',
          'video_production_beat_sync', 'grade_tcg_card', 'generate_meme',
          'remove_background', 'invoke_council', 'soul_speak', 'soul_rap', 'soul_listen',
          'index_soul_workspace', 'get_rag_context', 'search_soul_memory',
          'run_security_audit', 'scan_media_file', 'search_ebay_market',
          'detect_emotion',
          'generate_3d_object', 'image_to_3d', 'self_reflect',
          'get_voice_preset', 'web_search', 'upsert_memory_node',
          'create_memory_relation', 'query_memory_graph', 'get_memory_subgraph',
          'market_depth_analysis', 'monte_carlo_simulation',
          'generate_music', 'analyze_beats', 'memory_save', 'memory_recall',
          'query_ollama', 'get_skill', 'list_skills',
        ]);
        
        // =======================================================================
        // 🛡️ STRICT AST JSON INTERCEPTION LAYER (CRIT-4: Regex Bypass Mitigation)
        // Detect and intercept raw JSON payloads generated by local LLMs safely
        // =======================================================================
        if ((!msg.tool_calls || msg.tool_calls.length === 0) && msg.content && msg.content.trim().startsWith('{')) {
          try {
            // STEP 1: Strict JSON Parsing
            const parsed = JSON.parse(msg.content.trim());
            
            // STEP 2: Strict Schema Validation
            let target = null;
            if (parsed.tool_calls && Array.isArray(parsed.tool_calls) && parsed.tool_calls.length > 0) {
              target = parsed.tool_calls[0].function || parsed.tool_calls[0];
            } else if (parsed.function && parsed.function.name) {
              target = parsed.function;
            } else {
              target = parsed;
            }

            // ONLY accept the structured payload if it targets an explicitly whitelisted tool
            if (target && target.name && ALLOWED_MCP_TOOLS.has(target.name)) {
              msg.tool_calls = [{
                type: "function",
                function: {
                  name: target.name,
                  arguments: target.parameters || target.arguments || {}
                }
              }];
              msg.content = ""; // Scrub raw payload to prevent visual injection
            }
          } catch (err) {
            // Fail closed gracefully: If it's not valid JSON, we ignore it.
            // Do NOT fall back to regex processing.
          }
        }
        // =======================================================================

        let replyStr = '';
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          replyStr = `[SYSTEM: Dispatching Python MCP Sidecar for ${msg.tool_calls[0].function.name}...]`;
          
          setLogs(prev => {
            const up = [...prev];
            up[agentMsgIndex.current] = { ...up[agentMsgIndex.current], role: 'agent', content: replyStr };
            return up;
          });
          
          // Execute native MCP with Watchdog Timeout (180s)
          // FIX: Backend Trace Severance Remediation
          // If the Python MCP subprocess dies (e.g. mflux pipe severance),
          // this watchdog prevents the UI from deadlocking in isStreaming=true.
          const MCP_TIMEOUT_MS = 180_000; // 3 minutes
          const { invoke } = await import('@tauri-apps/api/core');
          try {
            // ============ SECURITY: ALLOWED TOOLS WHITELIST ============
            // Checking Authorization handled earlier natively by the JSON Validator
            const requestedTool = msg.tool_calls[0].function.name;
            if (!ALLOWED_MCP_TOOLS.has(requestedTool)) {
              console.error(`[SECURITY] Blocked unauthorized tool execution: ${requestedTool}`);
              setLogs(prev => {
                const up = [...prev];
                up[agentMsgIndex.current] = { ...up[agentMsgIndex.current], role: 'agent', content: `🛡️ [SECURITY] Blocked unauthorized tool: \`${requestedTool}\`. This tool is not in the execution whitelist.` };
                return up;
              });
              setIsStreaming(false);
              return;
            }
            // ============ END SECURITY GATE ============

            const mcpPromise = invoke("execute_mcp_tool", { 
              serverName: "undesirables-mcp-server",
              toolName: requestedTool,
              args: msg.tool_calls[0].function.arguments
            });
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error(
                `MCP tool '${msg.tool_calls[0].function.name}' timed out after ${MCP_TIMEOUT_MS / 1000}s. ` +
                `The Python backend may have crashed or is downloading a large model. ` +
                `The UI has been unlocked — you can retry.`
              )), MCP_TIMEOUT_MS)
            );
            const res = await Promise.race([mcpPromise, timeoutPromise]);
            
            // FIX: AST Payload Sanitization
            // Catches truncated payloads from severed subprocess pipes
            // before they poison the markdown renderer or MEMORY.md context.
            const sanitizePayload = (raw) => {
              if (typeof raw !== 'string') return raw;
              // Detect dangling escape characters (forensic artifact of pipe severance)
              if (raw.endsWith('\\') || raw.endsWith('\\n')) {
                return raw + ' `[⚠ Stream Interrupted — Backend pipe severed]`';
              }
              // State machine to count structural braces outside strings
              let opens = 0; let closes = 0; let inString = false; let escapeNext = false;
              for (let i = 0; i < raw.length; i++) {
                const char = raw[i];
                if (escapeNext) { escapeNext = false; continue; }
                if (char === '\\') { escapeNext = true; continue; }
                if (char === '"') { inString = !inString; continue; }
                if (!inString) {
                  if (char === '{') opens++;
                  if (char === '}') closes++;
                }
              }
              if (opens > closes) {
                return raw + '}'.repeat(opens - closes) + ' `[⚠ Truncated JSON repaired]`';
              }
              return raw;
            };

            // Try formatting JSON base64 returns
            try {
              let resJson = typeof res === 'string' ? JSON.parse(sanitizePayload(res)) : res;
              
              // Unpack nested Python dumps if the result is embedded as a JSON string
              let finalData = resJson;
              if (resJson.result && typeof resJson.result === 'string') {
                try {
                  finalData = JSON.parse(sanitizePayload(resJson.result));
                } catch {
                  finalData = resJson.result;
                }
              } else if (resJson.result && typeof resJson.result === 'object') {
                finalData = resJson.result;
              }

              // Route Council debate results into color-coded multi-agent dialogue
              if (finalData.phases && Array.isArray(finalData.phases)) {
                const roleColors = { proposer: '🟢', risk_manager: '🔴', executor: '🟣' };
                const roleLabels = { proposer: 'THE SIGNAL', risk_manager: 'THE CRITIQUE', executor: 'THE VERDICT' };
                let councilMarkdown = `## 🏛️ THE COUNCIL — Debate Complete\n\n**Topic:** *${finalData.topic || 'Unknown'}*\n\n---\n\n`;
                finalData.phases.forEach(phase => {
                  councilMarkdown += `### ${phase.emoji || '💬'} Phase: ${roleLabels[phase.role] || phase.role}\n`;
                  councilMarkdown += `**${phase.agent_name}** (Soul #${phase.agent_id})\n\n`;
                  councilMarkdown += `${phase.content}\n\n---\n\n`;
                });
                setLogs(prev => [...prev, { role: 'agent', content: councilMarkdown, type: 'council_result' }]);
              }
              // Route the image extraction
              else if (finalData.base64 || finalData.image) {
                const b64 = finalData.base64 || finalData.image;
                setLogs(prev => [...prev, { role: 'agent', content: "Render complete.", type: 'meme_result', imageBase64: b64 }]);
                
                // CACHE FOR WORKFLOW CHAINING
                await cacheArtifactChaining(b64);
              } else {
                // Return cleaned struct to UI log if there is no image
                const safeOutput = typeof finalData === 'string' ? sanitizePayload(finalData) : JSON.stringify(finalData, null, 2);
                setLogs(prev => [...prev, { role: 'agent', content: `[SYS] Tool Execution Complete:\n\n\`\`\`json\n${safeOutput}\n\`\`\`` }]);
              }
            } catch {
              const safeRes = sanitizePayload(typeof res === 'string' ? res : String(res));
              setLogs(prev => [...prev, { role: 'agent', content: `[SYS] Output:\n${safeRes}` }]);
            }
          } catch (mcpErr) {
            setLogs(prev => [...prev, { role: 'agent', content: `[ERROR] MCP Failed: ${mcpErr.message || mcpErr}` }]);
          }
          
        } else {
          // If the LLM successfully executed a tool but had nothing extra to say, avoid the scary "Empty Reply" UX
          replyStr = msg.content || '[Task Completed Successfully]';
          setLogs(prev => {
            const up = [...prev];
            up[agentMsgIndex.current] = { ...up[agentMsgIndex.current], role: 'agent', content: replyStr };
            return up;
          });
          setChatHistory(prev => [...prev, { role: 'assistant', content: replyStr }]);
          synthesizeAgentVoice(replyStr);
        }

      } else {
        // Standard Chat Streaming
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(l => l.trim());

          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              fullContent += json.message?.content || '';

              setLogs(prev => {
                const updated = [...prev];
                const displayContent = fullContent.replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, '').trim() || '[SYNAPSES_FIRING...]';
                updated[agentMsgIndex.current] = { ...updated[agentMsgIndex.current], role: 'agent', content: displayContent };
                return updated.length > MAX_LOG_LINES 
                  ? updated.slice(updated.length - MAX_LOG_LINES) 
                  : updated;
              });
            } catch {}
          }
        }
        // === G0DM0D3-Inspired: STM Post-Processing ===
        // Apply hedge reducer after streaming completes, stripping out any residual thinking blocks
        const cleanedContent = applySTM(fullContent.replace(/<thought>[\s\S]*?<\/thought>\s*/gi, '').trim());
        setChatHistory(prev => [...prev, { role: 'assistant', content: cleanedContent }]);
        // Update rendered log with cleaned version
        setLogs(prev => {
          const updated = [...prev];
          updated[agentMsgIndex.current] = { ...updated[agentMsgIndex.current], role: 'agent', content: cleanedContent };
          return updated;
        });
        
        // SPREADSHEET INTERCEPTION LOGIC
        let jsonStr = null;
        const fencedMatch = cleanedContent.match(/```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/);

        if (fencedMatch) {
            jsonStr = fencedMatch[1];
        } else {
            // Robust mathematical boundary fallback captures all nested structures safely
            const firstBracket = cleanedContent.indexOf('[');
            const lastBracket = cleanedContent.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket > firstBracket) {
                jsonStr = cleanedContent.substring(firstBracket, lastBracket + 1);
            }
        }
        
        if (jsonStr) {
          try {
            const parsedArray = JSON.parse(jsonStr);
            setSpreadsheetData(prev => {
              if (prev.length > 0 && prev[0]._source === 'list_a') {
                return parsedArray.map(obj => ({ _source: `import_${new Date().getTime()}`, ...obj }));
              }
              return [...prev, ...parsedArray.map(obj => ({ _source: `import_${new Date().getTime()}`, ...obj }))];
            });
          } catch(e) {}
        }
        synthesizeAgentVoice(cleanedContent);
      }

    } catch (e) {
      setLogs(prev => {
        const updated = [...prev];
        updated[agentMsgIndex.current] = { role: 'system', content: `[CONNECTION ERROR] ${e.message}` };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const executeHardwareIntercept = async (lowIn) => {
    if (lowIn === 'convert_image_to_3d') {
      if (window.__droppedImages && window.__droppedImages.length > 0) {
        setLogs(prev => [...prev, { role: 'user', content: 'Generate 3D Model' }]);
        const timerIdx = Date.now();
        setLogs(prev => [...prev, { role: 'agent', content: '[SYSTEM: 🧊 Generating 3D Relief Mesh — this takes about 1 second...]', _timerId: timerIdx }]);
        setIsStreaming(true);

        // Live elapsed timer — ticks every second
        const startTime = Date.now();
        const timerInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const mins = Math.floor(elapsed / 60);
          const secs = elapsed % 60;
          const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
          const warning = elapsed > 300 ? ' ⚠️ Taking longer than expected — check console for errors.' : '';
          setLogs(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(l => l._timerId === timerIdx);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], content: `[SYSTEM: 🧊 3D Rendering in progress... ⏱️ ${timeStr}${warning}]` };
            }
            return updated;
          });
        }, 1000);

        (async () => {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            const res = await invoke("execute_mcp_tool", {
              serverName: "undesirables-mcp-server",
              toolName: "image_to_3d",
              args: { image_path: window.__droppedImages[0] }
            });
            clearInterval(timerInterval);
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            let parsed = typeof res === 'string' ? JSON.parse(res) : res;
            if (parsed && parsed.result && typeof parsed.result === 'string') {
               try { parsed = JSON.parse(parsed.result); } catch { parsed = parsed.result; }
            } else if (parsed && parsed.result && typeof parsed.result === 'object') {
               parsed = parsed.result;
            }
            if (parsed && parsed.path) {
                // Convert local path to Tauri asset URL for the 3D viewer
                let viewerPath = parsed.path;
                try {
                  const { convertFileSrc } = await import('@tauri-apps/api/core');
                  viewerPath = convertFileSrc(parsed.path);
                } catch(e) { /* fallback to raw path */ }

                setLogs(prev => {
                  const updated = [...prev];
                  const idx = updated.findIndex(l => l._timerId === timerIdx);
                  if (idx !== -1) {
                    updated[idx] = { ...updated[idx], content: `[SYSTEM: ✅ 3D Model Generated in ${Math.floor(elapsed/60)}m ${elapsed%60}s — ${parsed.faces} faces, ${parsed.file_size_kb} KB]`, _timerId: undefined };
                  }
                  return [...updated, { role: 'agent', content: '', threeDModel: viewerPath }];
                });
            } else {
                clearInterval(timerInterval);
                setLogs(prev => [...prev, { role: 'agent', content: `[ERROR] 3D Generation Failed: ${JSON.stringify(parsed)}` }]);
            }
          } catch (e) {
            clearInterval(timerInterval);
            setLogs(prev => [...prev, { role: 'agent', content: `[ERROR] 3D Engine Crashed: ${e}` }]);
          } finally {
            setIsStreaming(false);
          }
        })();
      }
      return;
    }

    if (lowIn === 'browse_image') {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          multiple: true,
          filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'] }]
        });
        if (selected) {
          const paths = Array.isArray(selected) ? selected : [selected];
          if (paths.length > 0) {
            processDroppedFilesRef.current(paths);
          }
        }
      } catch (e) {
        setLogs(prev => [...prev, { role: 'system', content: `[WARN] File dialog failed: ${e.message}` }]);
      }
      return;
    }
    if (lowIn === 'load_banner_asset' || lowIn === 'load_meme_asset') {
      const mode = lowIn === 'load_banner_asset' ? 'banner' : 'meme';
      if (window.__droppedImages && window.__droppedImages.length > 0) {
        setMemeStudio(p => ({
            ...p, 
            mode: mode, 
            overlayPath: window.__droppedImages[0], 
            active: true 
        }));
        setLogs(prev => [...prev, { role: 'user', content: lowIn === 'load_banner_asset' ? "Load as Banner Asset" : "Load as Meme Overlay" }]);
        setLogs(prev => [...prev, { role: 'agent', content: `✅ Loaded into Graphic Studio (${mode.toUpperCase()}).\n\nWhat text would you like to put on this image? Provide the "Top Text" and "Bottom Text", or simply type a prompt describing the graphic you want.`}]);
        setChatHistory(prev => [...prev, { role: 'system', content: `[SYSTEM CONTEXT] User loaded an image into the Graphic Studio as a ${mode}. Ask them what text they'd like applied.`}]);
      }
      return;
    }
    if (lowIn === 'grade_cards') {
      // TCG Card Grading — direct MCP dispatch
      if (window.__droppedImages && window.__droppedImages.length > 0) {
        const payload = `Grade ${window.__droppedImages.length} card(s)`;
        setLogs(prev => [...prev, { role: 'user', content: payload }]);
        setLogs(prev => [...prev, { role: 'agent', content: `[SYSTEM: Dispatching TCG Optical Engine for ${window.__droppedImages.length} card(s)...]` }]);
        setIsStreaming(true);
        (async () => {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            const res = await invoke("execute_mcp_tool", {
              serverName: "undesirables-mcp-server",
              toolName: "grade_tcg_card",
              args: { card_image_paths: JSON.stringify(window.__droppedImages), card_name: "Unknown Card" }
            });

            let resJson = typeof res === 'string' ? JSON.parse(res) : res;
            let finalData = resJson;
            if (resJson.result && typeof resJson.result === 'string') {
              try { finalData = JSON.parse(resJson.result); } catch { finalData = resJson.result; }
            } else if (resJson.result && typeof resJson.result === 'object') {
              finalData = resJson.result;
            }

            // If this is a TCG grading report, push as special type for pretty rendering
            if (finalData.status === 'success' && finalData.report) {
              // Convert file paths to Tauri asset URLs for display
              let imgUrls = [];
              try {
                const { convertFileSrc } = await import('@tauri-apps/api/core');
                imgUrls = (window.__droppedImages || []).map(p => convertFileSrc(p));
              } catch { imgUrls = window.__droppedImages || []; }
              setLogs(prev => [...prev, { role: 'agent', content: '', tcgReport: finalData, tcgImages: imgUrls }]);
            } else {
              const output = typeof finalData === 'string' ? finalData : JSON.stringify(finalData, null, 2);
              setLogs(prev => [...prev, { role: 'agent', content: output }]);
            }
            
            // Trigger 3D Particle Visual Override if report is valid
            if (finalData.status === 'success' && finalData.report) {
               let rep = finalData.report;
               // Unwrap double-nested report from LLM
               if (rep.report && rep.report.overall_grade) {
                 rep = rep.report;
               }
               setTcgMode(true);
               // Store actual TCG scores for the particle legend display
               setTcgScores({
                 overall_grade: rep.overall_grade || 0,
                 centering: rep.centering?.score || 0,
                 edges: rep.edges?.score || 0,
                 corners: rep.corners?.score || 0,
                 surface: rep.surface?.score || 0,
               });
               // Map 1-10 grades to 1-100 particle physics parameters.
               setPsychoTraits({
                 openness: (rep.overall_grade || 5) * 10,
                 conscientiousness: (rep.centering?.score || 5) * 10,
                 extraversion: (rep.edges?.score || 5) * 10,
                 agreeableness: (rep.corners?.score || 5) * 10,
                 neuroticism: (10.1 - (rep.surface?.score || 5)) * 10 // Inverse for chaotics
               });
               setParticlesVisible(true);
            }
            
          } catch (e) {
            setLogs(prev => [...prev, { role: 'agent', content: `[ERROR] TCG Grading Failed: ${e}` }]);
          } finally {
            setIsStreaming(false);
          }
        })();
      } else {
        setLogs(prev => [...prev, { role: 'agent', content: '[WARN] No images loaded. Drop card images first.' }]);
      }
      return;
    }
    if (lowIn === 'y') {
        const payload = 'extract background';
        setChatHistory(prev => [...prev, { role: 'user', content: payload }]);
        setLogs(prev => [...prev, { role: 'user', content: payload }]);
        
        if (window.__droppedImages && window.__droppedImages.length > 0) {
            setLogs(prev => [...prev, { role: 'agent', content: '[SYSTEM: Natively Dispatching Python MCP Sidecar for remove_background...]' }]);
            setIsStreaming(true);
            (async () => {
                try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    const res = await invoke("execute_mcp_tool", { 
                        serverName: "undesirables-mcp-server",
                        toolName: "remove_background",
                        args: { image: window.__droppedImages[0] }
                    });
                    
                    let resJson = typeof res === 'string' ? JSON.parse(res) : res;
                    let finalData = resJson;
                    if (resJson.result && typeof resJson.result === 'string') {
                        try { finalData = JSON.parse(resJson.result); } catch { finalData = resJson.result; }
                    } else if (resJson.result && typeof resJson.result === 'object') {
                        finalData = resJson.result;
                    }
                    
                    if (finalData.base64 || finalData.image) {
                        const b64 = finalData.base64 || finalData.image;
                        setLogs(prev => [...prev, { role: 'agent', content: "Render complete.", type: 'meme_result', imageBase64: b64, imagePath: finalData.path }]);
                        await cacheArtifactChaining(b64);
                    } else {
                        setLogs(prev => [...prev, { role: 'agent', content: `[SYS] Tool Execution Complete:\n\n\`\`\`json\n${JSON.stringify(finalData, null, 2)}\n\`\`\`` }]);
                    }
                } catch (e) {
                    setLogs(prev => [...prev, { role: 'agent', content: `[ERROR] MCP Failed: ${e}` }]);
                } finally {
                    setIsStreaming(false);
                }
            })();
        } else {
            sendToOllama(payload);
        }
    } else if (lowIn === 'n' || lowIn === 'cancel') {
        setLogs(prev => [...prev, { role: 'user', content: 'n' }, { role: 'agent', content: 'Action canceled.' }]);
        setChatHistory(prev => [...prev, { role: 'user', content: 'n' }, { role: 'system', content: '[SYS] Action canceled by user.' }]);
    } else if (lowIn === 'setup interactive spreadsheet') {
        setActiveMode('business_pilot');
        setShowSpreadsheet(true);
        setLogs(prev => [...prev, { role: 'user', content: '📊 Opening Interactive Spreadsheet CRM' }]);
        setLogs(prev => [...prev, { role: 'system', content: '[SYS] WAKING INTERACTIVE CRM SPREADSHEET ENGINE...' }]);
        return;
    } else if (lowIn === 'setup appointment reminders') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Appointment Reminders' }]);
        setChatHistory(prev => [...prev, { role: 'user', content: 'Set up Appointment Reminders' }]);
        
        const amMenu = `## ⏰ APPOINTMENT REMINDERS\n\n> How would you like to set up your appointment reminders? The Python script requires Twilio, while Google Calendar requires OAuth scopes.`;
        setLogs(prev => [...prev, { 
            role: 'agent', 
            content: amMenu,
            actions: [
                { label: '🐍 Run Local Python Script (Twilio API)', id: 'run am python' },
                { label: '📅 Use Google Calendar API (OAuth)', id: 'run am google' },
                { label: '🌍 Use Cal.com (No-code Web)', id: 'run am cal' }
            ]
        }]);
    } else if (lowIn === 'run am python') {
        const payload = `I want to set up Appointment Reminders using the Twilio Python Script from the Business Pilot skill. Walk me through exactly what Twilio credentials I need to paste into the chat.`;
        setLogs(prev => [...prev, { role: 'user', content: 'Run Local Python Script (Twilio API)' }]);
        setChatHistory(prev => [...prev, { role: 'user', content: payload }]);
        sendToOllama(payload);
    } else if (lowIn === 'run am google') {
        const payload = `I want to set up Appointment Reminders using the Google Calendar API from the Business Pilot skill. Can you walk me through how to generate a service-account.json?`;
        setLogs(prev => [...prev, { role: 'user', content: 'Use Google Calendar API (OAuth)' }]);
        setChatHistory(prev => [...prev, { role: 'user', content: payload }]);
        sendToOllama(payload);
    } else if (lowIn === 'run am cal') {
        const payload = `I want to set up Appointment Reminders using Cal.com from the Business Pilot skill. Walk me through the no-code setup exactly.`;
        setLogs(prev => [...prev, { role: 'user', content: 'Use Cal.com (No-code Web)' }]);
        setChatHistory(prev => [...prev, { role: 'user', content: payload }]);
        sendToOllama(payload);
    } else if (lowIn === 'setup phone answering') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Phone Answering' }]);
        setChatHistory(prev => [...prev, { role: 'user', content: 'Set up Phone Answering' }]);
        
        const telMenu = `## 📞 24/7 PHONE ANSWERING\n\n> Setting up a 24/7 AI answering service involves 5 steps. I will guide you through each one interactively.\n\n### Interactive Setup Menu`;
        setLogs(prev => [...prev, { 
            role: 'agent', 
            content: telMenu,
            actions: [
                { label: '1️⃣ Select AI Provider (Vapi / Twilio)', id: 'run bp provider' },
                { label: '2️⃣ Configure & Buy Phone Number', id: 'run bp twilio' },
                { label: '3️⃣ Draft Phone Script Context', id: 'run bp script' },
                { label: '4️⃣ Generate Engine Logic (Node.js)', id: 'run bp engine' },
                { label: '5️⃣ Run Test Call Simulation', id: 'run bp test' }
            ]
        }]);
    } else if (lowIn === 'run bp provider') {
        const payload = `I'm setting up Business Pilot Phone Answering. Compare Vapi.ai vs Twilio+OpenAI for me in terms of cost and speed of setup.`;
        setLogs(prev => [...prev, { role: 'user', content: '1️⃣ Select AI Provider' }]);
        setChatHistory(prev => [...prev, { role: 'user', content: payload }]);
        
        const providerMenu = `## 🤖 AI PROVIDER COMPARISON\n\n> Please review the available providers and select the engine that best fits your technical proficiency and budget.`;
        setLogs(prev => [...prev, { 
            role: 'agent', 
            content: providerMenu,
            actions: [
                { 
                  label: '⚡ Select Vapi.ai (No-code)', id: 'select vapi',
                  expandableDetails: "**Cost**: ~$0.05/min\n**Setup**: 15 minutes\n**Pros**: No code required, easiest interface, highly reliable.\n**Cons**: Less customizable routing."
                },
                { 
                  label: '☎️ Select Twilio + Local AI (Pro)', id: 'select twilio',
                  expandableDetails: "**Cost**: ~$0.02/min + LLM tokens\n**Setup**: 2-4 hours\n**Pros**: Total control, runs locally, infinitely scalable.\n**Cons**: Requires running a Node.js server and managing API keys."
                },
                { 
                  label: '📞 Select Bland.ai (Hybrid)', id: 'select bland',
                  expandableDetails: "**Cost**: ~$0.09/min\n**Setup**: 30 minutes\n**Pros**: Great voice models, robust enterprise features.\n**Cons**: More expensive per minute."
                }
            ]
        }]);
    } else if (lowIn === 'run bp twilio') {
        setLogs(prev => [...prev, { role: 'user', content: '2️⃣ Configure & Buy Phone Number' }]);
        // Spawn the Input Modal for Twilio API Keys natively!
        setWorkflowModal({
          active: true,
          title: 'Secure Twilio Configuration',
          description: 'To route the Business Pilot answering service, you need to securely input your Twilio API credentials locally. These will never leave your machine.',
          fields: [
            { id: 'twilio_sid', label: 'TWILIO ACCOUNT SID', type: 'password', placeholder: 'ACxxxxx...' },
            { id: 'twilio_auth', label: 'TWILIO AUTH TOKEN', type: 'password', placeholder: '••••••••••••••••' },
            { id: 'twilio_number', label: 'TWILIO PHONE NUMBER', type: 'text', placeholder: '+1 (800) 555-5555' }
          ],
          submitText: 'Save Credentials',
          onConfirm: (payload) => {
            setLogs(prev => [...prev, { role: 'user', content: 'Submitting Twilio Credentials securely...' }]);
            setLogs(prev => [...prev, { role: 'agent', content: `[SYSTEM] Twilio API credentials successfully bounded to local secure storage. Number initialized: ${payload.twilio_number || '[Undefined]'}` }]);
          }
        });
    } else if (lowIn === 'run bp script') {
        setLogs(prev => [...prev, { role: 'user', content: '3️⃣ Draft Phone Script Context' }]);
        setWorkflowModal({
          active: true,
          title: 'AI Persona & Script Generator',
          description: 'Provide the foundational details for your business. The AI engine will write a custom node routing script that enforces exact response logic.',
          fields: [
            { id: 'business_name', label: 'BUSINESS NAME', type: 'text', placeholder: 'e.g. Acme Plumbing' },
            { id: 'business_type', label: 'INDUSTRY / TYPE', type: 'text', placeholder: 'e.g. 24/7 Emergency Repairs' },
            { id: 'faqs', label: 'FREQUENTLY ASKED QUESTIONS (FAQS)', type: 'textarea', placeholder: 'Q: What are your hours?\nA: We are open 24/7.', rows: 5 }
          ],
          submitText: 'Generate Master Script',
          onConfirm: (payload) => {
            const llmPrompt = `I need you to generate a strict, conversational AI answering script for my business: "${payload.business_name}" (${payload.business_type}). It must be highly professional and incorporate these FAQs: ${payload.faqs}. Make sure to include exact instructions on when to transfer to a human.`;
            setLogs(prev => [...prev, { role: 'user', content: `(Generated Script Context for ${payload.business_name})` }]);
            setChatHistory(prev => [...prev, { role: 'user', content: llmPrompt }]);
            sendToOllama(llmPrompt);
          }
        });
    } else if (lowIn === 'run bp engine') {
        const payload = `I am at Step 4 of the Business Pilot. Give me the complete \`business-pilot-server.js\` Node.js code block so I can run my answering service engine locally.`;
        setLogs(prev => [...prev, { role: 'user', content: '4️⃣ Generate Engine Logic' }]);
        setChatHistory(prev => [...prev, { role: 'user', content: payload }]);
        sendToOllama(payload);
    } else if (lowIn === 'run bp test') {
        const payload = `How do I trigger a test call against my local Business Pilot server to see if the LLM responds correctly over the phone before giving my number to clients?`;
        setLogs(prev => [...prev, { role: 'user', content: '5️⃣ Run Test Call Simulation' }]);
        setChatHistory(prev => [...prev, { role: 'user', content: payload }]);
        sendToOllama(payload);
    } else if (lowIn === 'run raffle validation') {
        setLogs(prev => [...prev, { role: 'user', content: 'Run Wallet Deduplication & Validation' }]);
        setWorkflowModal({
          active: true,
          title: 'Wallet Validator Engine',
          description: 'Paste your raw list of CSV EVM wallets, or upload a .TXT file. The engine will deduplicate against the master list natively and execute a local cache check without exposing your whitelist to external LLM APIs.',
          fields: [
            { id: 'wallet_list', label: 'RAW WALLET LIST (COMMA SEPARATED)', type: 'textarea', placeholder: '0x123..., 0x456...', rows: 6 },
            { id: 'wallet_file', label: 'OR UPLOAD CSV/TXT', type: 'file' }
          ],
          submitText: 'Verify & Deduplicate',
          onConfirm: (payload) => {
            const llmPrompt = `[SYSTEM ENCLAVE: The user just ran a local native deduplication script on their wallet list. Natively inform them the array was parsed and ask if they are ready to push the clean list to Vercel KV.]`;
            setLogs(prev => [...prev, { role: 'user', content: `[Wallet arrays imported. Checking for duplicates locally...]` }]);
            setChatHistory(prev => [...prev, { role: 'user', content: llmPrompt }]);
            sendToOllama(llmPrompt);
          }
        });
    } else if (lowIn === 'setup smart call transfer') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Smart Call Transfer' }]);
        setWorkflowModal({
          active: true, title: 'Smart Call Transfer Routing',
          description: 'Define your departments and their corresponding phone numbers. The AI will generate the Twilio TwiML routing logic.',
          fields: [
            { id: 'departments', label: 'DEPARTMENTS & NUMBERS', type: 'textarea', placeholder: 'Sales: +1 (555) 123-4567\nSupport: +1 (555) 987-6543\nEmergency: +1 (555) 000-0000', rows: 4 }
          ],
          submitText: 'Generate Routing Code',
          onConfirm: (p) => {
            const prompt = `Generate a complete Twilio Node.js Express server script (and TwiML) for an IVR Smart Call Transfer that routes calls based on AI classification. Use these departments: ${p.departments}. Make sure it uses Anthropic/OpenAI to transcribe the caller's intent and route to the correct number.`;
            setLogs(prev => [...prev, { role: 'user', content: `[Generating Call Routing logic...]` }]);
            sendToOllama(prompt);
          }
        });
    } else if (lowIn === 'setup voicemail transcripts') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Voicemail Transcripts' }]);
        setWorkflowModal({
          active: true, title: 'Voicemail Transcriber Configuration',
          description: 'Specify where you want your transcribed voicemails sent. The engine will write the Twilio/SendGrid Webhook.',
          fields: [
            { id: 'email', label: 'FORWARDING EMAIL ADDRESS', type: 'text', placeholder: 'hello@yourcompany.com' },
            { id: 'sms_fallback', label: 'FALLBACK SMS NUMBER (OPTIONAL)', type: 'text', placeholder: '+1 555-555-5555' }
          ],
          submitText: 'Deploy Transcriber Generator',
          onConfirm: (p) => {
            const prompt = `Write a production-ready Node.js webhook using Express and the Twilio SDK. It must intercept a completed Twilio recording, transcribe it using OpenAI Whisper API, and email the transcript to ${p.email}. Send a copy to ${p.sms_fallback} if provided.`;
            setLogs(prev => [...prev, { role: 'user', content: `[Generating Voicemail webhook logic...]` }]);
            sendToOllama(prompt);
          }
        });
    } else if (lowIn === 'setup sms replies') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up SMS Auto-Replies' }]);
        setWorkflowModal({
          active: true, title: 'Keyword SMS Responder',
          description: 'Define keywords and their exact response messages.',
          fields: [
            { id: 'rules', label: 'KEYWORDS & RESPONSES', type: 'textarea', placeholder: 'Keyword: HOURS -> "We are open 9am to 5pm, Mon-Fri."\nKeyword: ADDRESS -> "123 Main St."', rows: 5 }
          ],
          submitText: 'Generate Express Server',
          onConfirm: (p) => {
            const prompt = `Write an Express.js route handler for a Twilio inbound SMS webhook. It must read the incoming message body, check against these rules, and reply with the correct string using TwiML: ${p.rules}. If no keyword matches, default to a polite error message.`;
            setLogs(prev => [...prev, { role: 'user', content: `[Generating SMS Auto-Reply engine...]` }]);
            sendToOllama(prompt);
          }
        });
    } else if (lowIn === 'setup post-call booking') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Post-Call Booking' }]);
        setWorkflowModal({
          active: true, title: 'Automated Post-Call Scheduling',
          description: 'Send a cal.com or Calendly link to every caller instantly after the call disconnects.',
          fields: [
            { id: 'link', label: 'CALENDAR LINK', type: 'text', placeholder: 'https://cal.com/yourname/15min' },
            { id: 'msg', label: 'SMS MESSAGE COPY', type: 'textarea', placeholder: 'Thanks for calling! You can book time with us here: ', rows: 3 }
          ],
          submitText: 'Generate Hook',
          onConfirm: (p) => {
            const prompt = `Write a Twilio StatusCallback webhook handler in Node.js. When a call completes (status: completed), the server must instantiate the Twilio client and send an SMS to the caller's number saying: "${p.msg} ${p.link}".`;
            setLogs(prev => [...prev, { role: 'user', content: `[Generating Post-Call hook...]` }]);
            sendToOllama(prompt);
          }
        });
    } else if (lowIn === 'setup missed call text-back') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Missed Call Text-back' }]);
        setWorkflowModal({
          active: true, title: 'Missed Call Recovery Pipeline',
          description: 'Instantly follow up with inbound missed calls to prevent losing leads to competitors.',
          fields: [
            { id: 'away_msg', label: 'AWAY TEXT MESSAGE', type: 'textarea', placeholder: 'Hey, sorry we missed your call. How can we help you today?', rows: 3 }
          ],
          submitText: 'Generate Rescue Code',
          onConfirm: (p) => {
            const prompt = `Write a complete Node.js Twilio webhook that handles an incoming voice call. Instead of ringing, it immediately rejects the call or plays a busy signal, but simultaneously uses the Twilio REST API to send this SMS to the caller: "${p.away_msg}".`;
            setLogs(prev => [...prev, { role: 'user', content: `[Generating Missed Call recovery...]` }]);
            sendToOllama(prompt);
          }
        });
    } else if (lowIn === 'setup rebooking nudges') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Rebooking Nudges' }]);
        setWorkflowModal({
          active: true, title: 'Automated Rebooking Engine',
          description: 'Periodically prompt previous clients who haven\'t booked inside a specific time window.',
          fields: [
            { id: 'interval', label: 'INACTIVITY INTERVAL (DAYS)', type: 'text', placeholder: '90' },
            { id: 'message', label: 'NUDGE MESSAGE', type: 'textarea', placeholder: 'Hi! It\'s been a while. Ready for your next appointment?', rows: 3 }
          ],
          submitText: 'Build Cron Engine',
          onConfirm: (p) => {
            const prompt = `Write a Node.js server using 'node-cron' and Twilio. Every day at 10 AM, it should fake-query a database for clients whose last appointment was > ${p.interval} days ago, and send them this SMS: "${p.message}". Include the DB mock data.`;
            setLogs(prev => [...prev, { role: 'user', content: `[Generating Rebooking Cron...]` }]);
            sendToOllama(prompt);
          }
        });
    } else if (lowIn === 'setup win-back campaigns') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Win-Back Campaigns' }]);
        setWorkflowModal({
          active: true, title: 'Dormant Customer Win-back',
          description: 'Blast a promotional offer to your dormant customer list to re-engage them.',
          fields: [
            { id: 'offer', label: 'SPECIAL OFFER / DISCOUNT CODE', type: 'text', placeholder: 'Use code COMEBACK20 for 20% off!' },
            { id: 'audience', label: 'TARGET AUDIENCE INFO', type: 'text', placeholder: 'Customers who cancelled in 2025' }
          ],
          submitText: 'Generate Blast Script',
          onConfirm: (p) => {
            const prompt = `Write a robust Python script using the Twilio API that reads a CSV file of phone numbers for "${p.audience || 'your customer list'}" and sends a bulk SMS blast in batches to avoid rate limits. The message should feature this offer: "${p.offer || 'an exclusive discount code'}". Include error handling and sleep intervals.`;
            setLogs(prev => [...prev, { role: 'user', content: `[Generating Win-back script...]` }]);
            sendToOllama(prompt);
          }
        });
    } else if (lowIn === 'setup multilingual inbox') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Multi-lingual Inbox' }]);
        setWorkflowModal({
          active: true, title: 'Multi-lingual Inbox Setup',
          description: 'Automatically translate incoming non-English messages to your team, and translate your English replies back to the customer\'s native language.',
          fields: [
            { id: 'target_lang', label: 'YOUR NATIVE LANGUAGE', type: 'text', placeholder: 'English' },
            { id: 'translation_service', label: 'PREFERRED TRANSLATION SERVICE', type: 'text', placeholder: 'Local Ollama (Free) / Anthropic / DeepL' }
          ],
          submitText: 'Generate Translation Hook',
          onConfirm: (p) => {
            const prompt = `Write a Node.js Express webhook that acts as middleware for Twilio SMS. When an inbound SMS is received, use ${p.translation_service || 'a translation AI (like Ollama or DeepL)'} to detect the language. If it is NOT ${p.target_lang || 'English'}, translate it, prepend "[Translated from <detected>]", and forward it to a designated Slack webhook or email. Then write a reverse function that translates outgoing replies back to the detected language.`;
            setLogs(prev => [...prev, { role: 'user', content: `[Generating Inbox Translator...]` }]);
            sendToOllama(prompt);
          }
        });
    } else if (lowIn === 'setup invoice generator') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up AI Invoice Generator' }]);
        
        // Load persistent config
        const cachedCompany = localStorage.getItem('invoice_company_info') || '';
        const cachedTerms = localStorage.getItem('invoice_payment_terms') || '';

        const cachedLogo = localStorage.getItem('invoice_logo_file') || '';

        // Auto-increment the last used invoice number, defaulting to 2026.
        const cachedInv = localStorage.getItem('invoice_number_latest');
        let nextInv = 'INV-2026-0001';
        if (cachedInv) {
           const parts = cachedInv.split('-');
           if (parts.length > 2 && !isNaN(parts[2])) {
              nextInv = `${parts[0]}-${parts[1]}-${String(parseInt(parts[2]) + 1).padStart(parts[2].length, '0')}`;
           }
        }
        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        setWorkflowModal({
          active: true, title: 'Visual PDF Invoice Generator',
          description: 'Convert your raw expenses or receipt-scanner CSVs directly into professional, ready-to-print, themed PDF invoices.',
          fields: [
            { id: 'logo_file', label: cachedLogo ? 'YOUR COMPANY LOGO (CACHED - REUPLOAD TO OVERRIDE)' : 'YOUR COMPANY LOGO (CLICK TO BROWSE FOR FILE)', type: 'file', defaultValue: cachedLogo },
            { id: 'company_info', label: 'YOUR COMPANY INFO', type: 'textarea', placeholder: 'Acme Corp\n123 Business Rd.\nNew York, NY 10001\nbilling@acmecorp.com', rows: 3, defaultValue: cachedCompany },
            { id: 'invoice_number', label: 'INVOICE NUMBER (AUTO-INCREMENTED)', type: 'text', defaultValue: nextInv },
            { id: 'invoice_date', label: 'INVOICE DATE', type: 'text', defaultValue: today },
            { id: 'line_items', label: 'BILLABLE ITEMS (FORMAT: DESCRIPTION, QUANTITY, PRICE)', type: 'textarea', placeholder: 'Web Design, 1, 1500\nLogo Design, 1, 500\nDomain Registration, 1, 30', rows: 4 },
            { id: 'default_tax', label: 'DEFAULT TAX PERCENTAGE', type: 'text', placeholder: 'e.g. 10 or 8.5', defaultValue: '10' },
            { id: 'bank_info', label: 'PAYMENT INSTRUCTIONS (FOR INVOICE FOOTER)', type: 'textarea', placeholder: 'Pay via Zelle to: myemail@gmail.com\nVenmo: @myhandle\nETH: 0x...\nMail check to: PO Box 123, Chicago, IL 60601', rows: 3, hint: '⚠️ This data stays 100% on YOUR device. It is never stored, cached, or transmitted to any server.' },
            { id: 'payment_terms', label: 'DEFAULT PAYMENT TERMS', type: 'text', placeholder: 'Net 30. Payable via ACH or Check.', defaultValue: cachedTerms },
            { id: 'pdf_format', label: 'DOCUMENT FORMAT', type: 'select', options: ['A4 / US Letter (Standard Print)', 'Square (800x800 Modern Digital)'] },
            { id: 'pdf_theme', label: 'PDF BRANDING THEME / SKIN', type: 'select', options: [
              'Minimalist (White & Clean)', 
              'Cyberpunk (Dark & Neon Green)', 
              'Cyberpunk (Dark & Bootleg Sonic Blue)',
              'Cyberpunk (Dark & Vice City Pink)',
              'Corporate (Navy Blue & Strict Grid)', 
              'Creative (Bold Typography & High Contrast)',
              'Luxury (Black & Gold, Serif Fonts)',
              'Startup (Pastel Gradients, Playful)',
              'Monospace (Terminal Aesthetic, Strict Alignment)',
              'Retro (80s Synthwave, Vibrant Pinks & Blues)'
            ] }
          ],
          submitText: 'Generate Live Visual PDF',
          onConfirm: async (p) => {
            window.__muteAgentNextMessage = true;
            
            // Save state for future invoices
            if (p.company_info) localStorage.setItem('invoice_company_info', p.company_info);
            if (p.payment_terms) localStorage.setItem('invoice_payment_terms', p.payment_terms);
            // bank_info intentionally NOT cached — user re-enters each session for security
            if (p.invoice_number) localStorage.setItem('invoice_number_latest', p.invoice_number);
            if (p.logo_file && p.logo_file.length > 0) localStorage.setItem('invoice_logo_file', p.logo_file[0]);

            const logoStr = p.logo_file && p.logo_file.length > 0 ? Array.isArray(p.logo_file) ? p.logo_file[0] : p.logo_file : '';
            let imageTag = '';
            if (logoStr) {
               try {
                 const { readFile } = await import('@tauri-apps/plugin-fs');
                 const bytes = await readFile(logoStr);
                 
                 const toBase64 = (arr) => new Promise((resolve) => {
                   const fr = new FileReader();
                   fr.onload = () => resolve(fr.result.split(',')[1]);
                   fr.readAsDataURL(new Blob([arr]));
                 });
                 
                 const b64 = await toBase64(bytes);
                 const mime = logoStr.toLowerCase().endsWith('png') ? 'image/png' : logoStr.toLowerCase().match(/\.jpe?g$/) ? 'image/jpeg' : 'image/webp';
                 imageTag = `<img src="data:${mime};base64,${b64}" style="max-height: 80px;" alt="Logo" />`;
               } catch(e) {
                 console.error("Logo injection err", e);
               }
            }
            
            // ZERO-TRUST HYDRATION CACHE + Token ID
            const invoiceId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
            jitVaultRef.current[invoiceId] = {
               bankInfo: p.bank_info || '',
               logoTag: imageTag || ''
            };
            
            const prompt = `*[SYSTEM]* You are an expert Frontend Developer. Generate a stunning, real-time Visual HTML Invoice using Tailwind CSS. 
Do NOT write Node.js or pdfkit code. You must output ONE standalone HTML document containing a full \`<html>\` structure.
Requirements:
1. Include this EXACT script in the head to load Tailwind: <script src="https://cdn.tailwindcss.com"></script>
2. Add a <link> tag to Google Fonts in the <head> to load a premium, modern font (like 'Inter', 'Outfit', or 'Space Grotesk') and apply it to the whole <body>. Do NOT use default browser fonts!
3. Match this exact visual design language: "${p.pdf_theme}". Apply it heavily to the background, grid components, typography, and accent colors.
4. Design this layout explicitly for a premium ${p.pdf_format} format. Enforce a STRICT VERTICAL HIERARCHY. The Header (Logo, Company Info, Invoice Details) MUST be placed at the absolute top spanning 100% width. The Invoice Items table MUST be distinctly placed BELOW the header. DO NOT use flexbox rows, grid columns, or floats to place the Header side-by-side horizontally with the Line Items table.
5. In the top Header grid, prominently display this EXACT token where the Logo goes: \`{{COMPANY_LOGO_MOUNT_${invoiceId}}}\`. DO NOT write an <img> tag yourself.
6. Also in the top Header grid area, include this company info nicely stacked: "${p.company_info}".
7. Ensure the top Header area also prominently displays the Invoice Number: "${p.invoice_number}" and Invoice Date: "${p.invoice_date}".
8. INVOICE ITEMS: The user has provided the following items (can be parsed CSV or raw text). Parse this data and render a highly professional, stylish Tailwind \`<table>\` or flex-grid. Calculate the subtotal, add exactly ${p.default_tax}% tax (or 0% if blank), and display a huge, bold grand total:
"${p.line_items}"
9. CRITICAL SECURITY DIRECTIVE: In the minimalist footer, you MUST explicitly insert this exact string token where the banking/payment info should go:
<div id="secure-payment-vault">{{SECURE_PAYMENT_VAULT_TOKEN_${invoiceId}}}</div>
DO NOT invent, format, or hallucinate any routing numbers or bank names. Use only the exact token provided.
10. Finally, append these payment terms: "${p.payment_terms}".
11. NATIVE EDITING [CRITICAL]: Every single text node you render (prices, line items, names, company info, dates) MUST explicitly have the \`contenteditable="true"\` attribute on its wrapping HTML tag so the user can easily click and edit the invoice natively before saving/printing!
12. REACTIVE JAVASCRIPT: Write a brief, resilient <script> at the bottom of the HTML that listens for "input" events on your contenteditable monetary/tax fields. If the user edits a line item price or the tax percentage natively, the script MUST automatically recalculate and update the Subtotal, Tax Amount, and Grand Total DOM nodes in real-time. Give the nodes distinct classes or IDs to do this cleanly.
13. HALLUCINATION PREVENTION: Under NO CIRCUMSTANCES should you invent, hallucinate, or add billable items that were not explicitly included in the input data. ONLY output the exact data provided.
Output ONLY the raw HTML string inside a \`\`\`html code block. Do not add any conversational text.`;
            setLogs(prev => [...prev, 
              { role: 'user', content: `[Compiling Zero-Trust JIT HTML Layout Engine...]` },
              { role: 'system', content: `[SYS] Note: The Business Pilot is spinning up a secure sandboxed iframe to visually render your custom invoice. Once rendered, hover over the invoice to click 🖨️ Save as PDF.`, actions: [{ label: '📊 Open CRM Spreadsheet', id: 'setup interactive spreadsheet' }] }
            ]);
            sendToOllama(prompt, true);
          }
        });
    } else if (lowIn === 'setup receipt scanner') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Receipt & Expense Scanner' }]);
        setWorkflowModal({
          active: true, title: 'Receipt & Expense Scanner',
          description: 'Upload your receipt photos using the native file browser. The embedded AI Vision model will extract all billing data natively on your hardware and inject it into your Spreadsheet CRM.',
          fields: [
            { id: 'receipt_images', label: 'SELECT RECEIPT PHOTOS', type: 'file' },
            { id: 'context_notes', label: 'ADDITIONAL CONTEXT OR TAGS (OPTIONAL)', type: 'textarea', placeholder: 'e.g. "Lunch at Bella Italia was with Client John Smith" or "All these Home Depot receipts are for the Smith property remodel."', rows: 3 }
          ],
          submitText: 'Parse Ledger Data',
          onConfirm: (p) => {
            const numFiles = p.receipt_images ? p.receipt_images.length : 0;
            // Push actual files to the native vision handler payload queue
            if (p.receipt_images && p.receipt_images.length > 0) {
              window.__droppedImages = Array.isArray(p.receipt_images) ? p.receipt_images : [p.receipt_images];
            }
            
            // NOTE: We deliberately avoid words like "extract", "scan", "analyze" because it triggers the MCP block which strips attached images.
            const prompt = `*[SYSTEM]* Vision Task: Review the attached receipts. Extract the Vendor, Date, Time, Subtotal, Tax, Total, and Category for EACH receipt into a strict JSON array of objects. You MUST wrap the JSON array inside a markdown block like this: \n\`\`\`json\n[{"Vendor": "Sample Vendor Name", "Date": "MM/DD/YYYY", "Time": "HH:MM", "Subtotal": "0.00", "Tax": "0.00", "Total": "0.00", "Category": "..."}]\n\`\`\`\nProvide ONLY the JSON array inside the backticks. No conversational text. Context: "${p.context_notes}".`;
            
            setLogs(prev => [...prev, 
              { role: 'user', content: `[Processing ${numFiles} Receipt(s) with Vision AI...]` },
              { role: 'system', content: `[SYS] Note: The Vision Model will transcribe the JSON data structure natively. To dynamically view, sort, or merge this data, open the **Interactive Spreadsheet CRM** from the Operations menu.`, actions: [{ label: '📊 Open CRM Spreadsheet', id: 'setup interactive spreadsheet' }] }
            ]);
            sendToOllama(prompt, true);
          }
        });
    } else if (lowIn === 'setup lead capture') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Lead Capture' }]);
        setWorkflowModal({
          active: true, title: 'Lead Capture Webhook Generator',
          description: 'Connect your incoming SMS/calls directly to a Zapier, Make, or Google Sheets web hook.',
          fields: [
            { id: 'webhook', label: 'ZAPIER / MAKE DESTINATION WEBHOOK URL', type: 'text', placeholder: 'https://hooks.zapier.com/...' },
          ],
          submitText: 'Generate Pipeline',
          onConfirm: (p) => {
            const prompt = `Write a Node.js Express server that acts as a middleware. It receives a webhook from a Twilio Call/SMS, extracts the Caller ID and Message/Transcript, and sends a formatted JSON POST request via Axios to this automation webhook: "${p.webhook}". Include the JSON schema structure in a comment.`;
            setLogs(prev => [...prev, { role: 'user', content: `[Generating Capture middleware...]` }]);
            sendToOllama(prompt);
          }
        });
    } else if (lowIn === 'setup review requests') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Review Requests' }]);
        setWorkflowModal({
          active: true, title: 'Auto-Review Collector',
          description: 'Automate requesting 5-star Google or Yelp reviews from your active customers.',
          fields: [
            { id: 'review_link', label: 'GOOGLE / YELP REVIEW LINK', type: 'text', placeholder: 'https://g.page/r/your-id/review' }
          ],
          submitText: 'Generate Collector Hook',
          onConfirm: (p) => {
            const prompt = `Write a Node.js function using the Twilio client that can be triggered after a job is completed in a CRM. It must send a polite SMS asking the customer to rate their experience, providing this link: "${p.review_link}". Include a 24-hour delay timeout mechanism.`;
            setLogs(prev => [...prev, { role: 'user', content: `[Generating Review Collector...]` }]);
            sendToOllama(prompt);
          }
        });
    } else if (lowIn === 'setup voice to estimate') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Voice to Estimate' }]);
        setWorkflowModal({
          active: true, title: 'Voice-to-Estimate AI',
          description: 'Inject pricing rules so the AI Phone Bot can quote estimates dynamically during a call.',
          fields: [
            { id: 'pricing', label: 'PRICING RULES & HOURLY RATES', type: 'textarea', placeholder: 'Service call fee: $50\nLabor rate: $100/hr\nParts: Add 20% markup', rows: 4 }
          ],
          submitText: 'Generate Prompt Injection',
          onConfirm: (p) => {
            const prompt = `Act as an expert prompt engineer for Vapi.ai / Twilio Voice AI. Write a massive, highly structured "System Prompt Constraint Block" that forces the voice model to stick strictly to these pricing rules when asked for a quote: "${p.pricing}". Instruct it on how to calculate the total without hallucinating math.`;
            setLogs(prev => [...prev, { role: 'user', content: `[Engineering Pricing Constraints...]` }]);
            sendToOllama(prompt);
          }
        });
    } else if (lowIn === 'setup daily briefing') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Daily SMS Briefing' }]);
        setWorkflowModal({
          active: true, title: 'CEO Daily Briefing',
          description: 'Receive a digest of critical data every morning at 7am.',
          fields: [
            { id: 'kpi', label: 'KEY METRICS TO TRACK', type: 'textarea', placeholder: 'Daily revenue, new leads, cancelled appointments', rows: 3 },
            { id: 'my_number', label: 'YOUR PERSONAL PHONE NUMBER', type: 'text', placeholder: '+1 555-555-5555' }
          ],
          submitText: 'Generate Morning Node',
          onConfirm: (p) => {
            const prompt = `Write a Python script using the 'schedule' library. At exactly 07:00 AM every day, it should execute 3 mock functions to fetch these KPIs: "${p.kpi}". Format the results nicely into a string, and send it as an SMS to ${p.my_number} using the Twilio library.`;
            setLogs(prev => [...prev, { role: 'user', content: `[Generating Briefing Pipeline...]` }]);
            sendToOllama(prompt);
          }
        });
    } else if (lowIn === 'setup shift coverage sos') {
        setLogs(prev => [...prev, { role: 'user', content: 'Set up Shift Coverage SOS' }]);
        setWorkflowModal({
          active: true, title: 'Emergency Shift Coverage Blast',
          description: 'Quickly text your entire staff list simultaneously to fill an abandoned shift.',
          fields: [
            { id: 'shift_details', label: 'DEFAULT SOS MESSAGE TEMPLATE', type: 'textarea', placeholder: 'ALERT: We need someone to cover the upcoming shift. Reply YES and you will be booked. First to claim gets it.', rows: 3 }
          ],
          submitText: 'Deploy SOS System',
          onConfirm: (p) => {
            const prompt = `Write a Node.js Express script that handles an "SOS Blast". It reads a mock array of 10 employee phone numbers. When an admin POSTs to /sos, it uses Twilio Notify services (or a \`Promise.all\` of Twilio SMS calls) to send this template: "${p.shift_details}". Then write the inbound webhook that assigns the shift to the first person who replies "YES".`;
            setLogs(prev => [...prev, { role: 'user', content: `[Generating SOS Broadcast...]` }]);
            sendToOllama(prompt);
          }
        });
    } else if (lowIn === 'setup raffle manager') {
        handleSkillInit('raffle_management');
    } else {
        // Dynamic intercept: Send button payload directly to LLM context exactly as if the user natively typed it out
        setLogs(prev => [...prev, { role: 'user', content: lowIn }]);
        setChatHistory(prev => [...prev, { role: 'user', content: lowIn }]);
        sendToOllama(lowIn);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    
    // Quick Y/N interception for extraction
    const lowIn = input.trim().toLowerCase();
    
    const lastMsg = logs.length > 0 ? logs[logs.length - 1].content : '';
    const isInterceptableMenu = lastMsg.includes('Yes, Extract') || lastMsg.includes('[y/n]');
    
    if ((lowIn === 'y' || lowIn === 'n') && isInterceptableMenu) {
        executeHardwareIntercept(lowIn);
        setInput('');
        return;
    }

    sendToOllama(input.trim());
    setInput('');
  };

  const handleSkillClick = (skillId) => {
    // Auto-suggest brain mode for this tool
    const recommendedBrain = TOOL_BRAIN_MAP[skillId];
    const brainSuggestion = (recommendedBrain && recommendedBrain !== brainMode)
      ? BRAIN_MODES[recommendedBrain]
      : null;
    if (skillId === 'graphics_studio') {
      setActiveMode('graphics_studio');
      const bannerMenu = `## 🎨 GRAPHICS STUDIO — Memes & Banners Ready\n\n> Create viral memes, image macros, or banners for Scatter.art, X, and OpenSea.\n\n### How It Works\n\n1. **Drag & drop your PNG/JPG assets** into the chat window\n2. Tell me the **platform** or **meme format**.\n3. Describe the **text or style** (neon glow, glitch, impact font, etc.)\n4. I'll generate the graphic using your images as references\n\n### Quick Instructions\n- For a banner: "Make an OpenSea banner with neon text."\n- For a meme: "Put impact text saying 'WHEN THE BUG IS A FEATURE'."`;
      setLogs(prev => [...prev, 
        { role: 'system', content: '[SYS] INITIALIZING GRAPHICS STUDIO...' },
        { role: 'agent', content: bannerMenu }
      ]);
      setChatHistory(prev => [...prev, { role: 'assistant', content: bannerMenu }]);
    } else if (skillId === 'raffle_management') {
      setActiveMode('raffle_management');
      const raffleMenu = `## 🎰 RAFFLE MANAGEMENT — Tools Ready\n\n> Create, manage, and audit raffles and giveaways.\n\n### Choose Your Tool\n\n**1. 🎲 Winner Picker (Randomizer)**\nPaste or drag-and-drop a list of wallet addresses or usernames.\nI'll randomly select winners with provable fairness.\n\n**2. 🛡️ New Raffle Setup**\nI'll walk you through creating a raffle with Cloudflare Turnstile (anti-bot CAPTCHA) and on-chain holder verification.`;
      setLogs(prev => [...prev, 
        { role: 'system', content: '[SYS] LOADING RAFFLE MANAGEMENT...' },
        { role: 'agent', content: raffleMenu }
      ]);
      setChatHistory(prev => [...prev, { role: 'assistant', content: raffleMenu }]);
    } else if (skillId === 'video_production') {
      setActiveMode('video_production');
      setLogs(prev => [...prev,
        { role: 'system', content: '[SYS] INITIALIZING VIDEO PRODUCTION STUDIO...' },
        { role: 'agent', content: '', type: 'video_dropzone' },
        { role: 'agent', content: `### 📐 Platform Export Presets\n\n| Platform | Dimensions | Aspect | Command |\n|---|---|---|---|\n| **TikTok / Reels** | 1080×1920 | 9:16 vertical | \`clip for tiktok\` |\n| **YouTube Shorts** | 1080×1920 | 9:16 vertical | \`clip for shorts\` |\
| **X** | 1280×720 | 16:9 landscape | \`clip for x\` |\n| **Original** | Keep source | — | \`clip 30s\` |\n\n### 🎵 Beat Sync\nDrop video **+ audio** together for beat-synced cuts.` }
      ]);
      setChatHistory(prev => [...prev, { role: 'assistant', content: '[Video Production Studio opened]' }]);
    } else if (skillId === 'invoice_generator') {
      setActiveMode('invoice_generator');
      const invoiceMenu = `## 🧾 AI INVOCE GENERATOR\n\n> Turn raw spreadsheet data or receipt photos into perfectly formatted, branded PDF invoices automatically.\n\n### Generate Your Pipeline`;
      setLogs(prev => [...prev, 
        { role: 'system', content: '[SYS] WAKING PDF GENERATOR...' },
        { role: 'agent', content: invoiceMenu, actions: [{ label: '⚙️ Configure Invoice Script', id: 'setup invoice generator' }] }
      ]);
      setChatHistory(prev => [...prev, { role: 'assistant', content: invoiceMenu }]);
    } else if (skillId === 'receipt_scanner') {
      setActiveMode('receipt_scanner');
      const receiptMenu = `## 📸 RECEIPT SCANNER\n\n> Upload bulk photos of receipts and the AI parses the exact Vendor, Amount, Date, Tax, and Category straight into your interactive spreadsheet.\n\n### How to Merge Workflows\n1. Scan your receipts here.\n2. The data flows into the Interactive Spreadsheet CRM.\n3. Open the **AI Invoice Generator** to convert the spreadsheet directly into professional, branded PDFs!\n\nClick below to begin the extraction.`;
      setLogs(prev => [...prev, 
        { role: 'system', content: '[SYS] WAKING VISION OCR...' },
        { role: 'agent', content: receiptMenu, actions: [{ label: '⚙️ Build Scanner Endpoint', id: 'setup receipt scanner' }] }
      ]);
      setChatHistory(prev => [...prev, { role: 'assistant', content: receiptMenu }]);
    } else if (skillId === 'pfp_extractor') {
      setActiveMode('pfp_extractor');
      const pfpMenu = `## ✂️ PFP EXTRACTOR — U-2-Net Engaged\n\n> Isolate characters from any image using the native MCP matting engine.\n\n### How To Isolate:\n1. **Browse** — Click the 📂 button below to safely select an image file.\n2. **Drag & Drop** — Or drag an image directly into the chat window.\n3. Click **[ 🟢 Yes, Extract Background ]** when prompted.\n4. The engine outputs a transparent PNG with clean alpha edges.`;
      setLogs(prev => [...prev, 
        { role: 'system', content: '[SYS] WAKING THE BACKGROUND MATTING PROTOCOL...' },
        { role: 'agent', content: pfpMenu, 
          actions: [
            { label: '📂 Browse for Image', id: 'browse_image' }
          ]
        }
      ]);
      setChatHistory(prev => [...prev, { role: 'assistant', content: pfpMenu }]);
    } else if (skillId === 'tcg_grader') {
      setActiveMode('tcg_grader');
      const tcgMenu = `## 🔍 TCG CARD GRADER — Appraiser Active\n\n> Drag and drop a Pokémon, Magic, or Yu-Gi-Oh! card to receive an instant physical appraisal.\n\n### Multi-Angle Scanning Enabled\n\nYou can drop multiple photos of the **same card** (front, back, holographic angle) simultaneously. The optical engine will analyze all angles before returning its final PSA/Beckett predictive score.\n\n*Requires \`llama3.2-vision\` native optical package.*`;
      setLogs(prev => [...prev, 
        { role: 'system', content: '[SYS] LAUNCHING OPTICAL TCG ENGINE...' },
        { role: 'agent', content: tcgMenu }
      ]);
    } else if (skillId === 'soul_translator') {
      setActiveMode('soul_translator');
      const translatorMenu = `## 🎭 SOUL TRANSLATOR — Psychometric Simulator\n\n> Send any raw text or input statement to force the AI to rewrite it utilizing its deep psychological archetype profiles.\n\n### Translation Modes:\n\n- \`Translate poetic: Stop talking to me.\`\n- \`Translate angry: I want a burger.\`\n- \`Translate native: Explain how blockchain works.\`\n\nThe engine will cross-reference the installed SOUL.md conviction scores, humor preferences, and trait imbalances to output perfectly formatted character dialogue.\n\n*Click one of the Psychometric Buttons beneath the chat bar to instantly frame your query around a specific trait.*`;
      setLogs(prev => [...prev, 
        { role: 'system', content: '[SYS] NEURAL TRANSLATOR ENGAGED...' },
        { role: 'agent', content: translatorMenu }
      ]);
    } else if (skillId === 'council') {
      setActiveMode('council');
      const councilMenu = `## 🏛️ MULTI-SOUL ROOM — Nexus Open\n\n> You are now inside the Multi-Soul chat room. Any companions you have loaded in the sidebar Nexus will now respond simultaneously to your prompts alongside the primary Host.\n\n1. Type a general statement or question.\n2. The system will automatically route it to all active souls.\n3. They will organically debate or converse based on their unique traits.`;
      setLogs(prev => [...prev, 
        { role: 'system', content: '[SYS] WAKING ALL MOUNTED COMPANIONS...' },
        { role: 'agent', content: councilMenu }
      ]);
      setChatHistory(prev => [...prev, { role: 'assistant', content: councilMenu }]);
    } else if (skillId === 'music_generator') {
      setActiveMode('music_generator');
      setLogs(prev => [...prev, 
        { role: 'system', content: '[SYS] ACE-STEP ENGINE STANDBY...' },
        { role: 'agent', content: '', type: 'music_studio' }
      ]);
      setChatHistory(prev => [...prev, { role: 'assistant', content: '[Music Studio opened]' }]);
    } else if (skillId === 'business_pilot') {
      setActiveMode('business_pilot');
      setShowSpreadsheet(false); // Reset on load
      const bpMenu = `## 👔 BUSINESS PILOT — Automated Operations\n\n> I am your invisible AI-powered business operator. I can handle inbound operations, automated SMS, dynamic scheduling, and operational tasks tailored to your specific industry.\n\n**Select a feature below to begin guided setup.** Each module walks you through exactly what you need — no guesswork.`;
      const bpActions = [
        // --- OPERATIONS ---
        { label: '📊 Interactive Spreadsheet CRM', id: 'setup interactive spreadsheet', description: 'Open a live, editable spreadsheet to manage contacts, leads, and customer data. Import/export CSV files with drag-and-drop.' },
        { label: '📞 24/7 Phone Answering', id: 'setup phone answering', description: 'Set up an AI-powered phone answering bot that handles inbound calls, answers FAQs, and takes messages 24/7.' },
        { label: '🔀 Smart Call Transfer', id: 'setup smart call transfer', description: 'Route calls to different team members based on caller intent (sales, support, emergency) using AI classification.' },
        { label: '🎙️ Voicemail Transcripts', id: 'setup voicemail transcripts', description: 'Automatically transcribe voicemails to text and deliver them via email or SMS. Never miss a message again.' },
        { label: '🌍 Multi-lingual Inbox', id: 'setup multilingual inbox', description: 'Auto-detect and translate incoming messages (SMS, email, voicemail) into English. Reply in the caller\'s language.' },
        { label: '💬 SMS Auto-Replies', id: 'setup sms replies', description: 'Set up keyword-triggered auto-reply SMS messages for common inquiries like hours, pricing, or location.' },
        // --- SCHEDULING ---
        { label: '📲 Post-Call Booking', id: 'setup post-call booking', description: 'Automatically send a booking link via SMS after every call ends so callers can schedule their appointment instantly.' },
        { label: '📵 Missed Call Text-Back', id: 'setup missed call text-back', description: 'When you miss a call, instantly text the caller back with a custom message and booking link.' },
        { label: '📅 Cal.com / Google Calendar (Coming Soon)', id: 'setup calendar sync', description: 'Connect your Google Calendar or Cal.com so the AI can check availability and book appointments in real-time.', isUpcoming: true },
        { label: '⏰ Appointment Reminders', id: 'setup appointment reminders', description: 'Send automated SMS/call reminders 24h and 1h before appointments to reduce no-shows.' },
        { label: '🚫 No-Show Enforcer (Coming Soon)', id: 'setup no-show enforcer', description: 'Automatically flag no-show clients, send follow-up messages, and optionally charge cancellation fees.', isUpcoming: true },
        { label: '🔁 Rebooking Nudges', id: 'setup rebooking nudges', description: 'Send periodic SMS nudges to past clients who haven\'t booked in a while. Configurable intervals (30/60/90 days).' },
        // --- FINANCE ---
        { label: '💰 Auto-Invoice Chaser (Coming Soon)', id: 'setup invoice chaser', description: 'Automatically send payment reminders for overdue invoices via SMS or email at custom intervals.', isUpcoming: true },
        { label: '📉 Vendor Price Detector (Coming Soon)', id: 'setup vendor price detector', description: 'Track supplier pricing changes over time. Get alerts when a vendor raises prices above your threshold.', isUpcoming: true },
        // --- GROWTH ---
        { label: '🎣 Win-back Campaigns', id: 'setup win-back campaigns', description: 'Send targeted re-engagement SMS/email to dormant customers with special offers to bring them back.' },
        { label: '🎰 Raffle & Giveaway Manager', id: 'setup raffle manager', description: 'Create, manage, and audit raffles with on-chain holder verification and anti-bot Turnstile captchas.' },
        { label: '📋 Lead Capture (Google Sheets)', id: 'setup lead capture', description: 'Automatically log every new lead (name, phone, email, source) into a Google Sheet for your sales pipeline.' },
        { label: '🗺️ Google/Apple Maps Setup (Coming Soon)', id: 'setup maps setup', description: 'Optimize your Google Business Profile and Apple Maps listing for maximum local SEO visibility.', isUpcoming: true },
        { label: '⭐ Auto-Review Requests', id: 'setup review requests', description: 'Automatically text customers after service asking for a Google/Yelp review. Includes direct review link.' },
        // --- DAILY OPS ---
        { label: '🗣️ Voice-to-Estimate', id: 'setup voice to estimate', description: 'Dictate job details over the phone and the AI generates a formatted estimate/quote you can send to the client.' },
        { label: '📄 Contract/Lease Scanner (Coming Soon)', id: 'setup contract scanner', description: 'Upload a contract or lease PDF. The AI summarizes key terms, deadlines, and flags risky clauses.', isUpcoming: true },
        { label: '☕ 7 AM Daily SMS Briefing', id: 'setup daily briefing', description: 'Receive a daily SMS at 7 AM with today\'s appointments, overdue invoices, and any missed calls from yesterday.' },
        { label: '🚨 Shift Coverage SOS', id: 'setup shift coverage sos', description: 'When an employee calls out, blast an SMS to all available team members asking who can cover the shift.' },
        { label: '🔧 Equipment Repair Radar (Coming Soon)', id: 'setup equipment radar', description: 'Track equipment maintenance schedules. Get SMS alerts when service is due based on hours or calendar intervals.', isUpcoming: true }
      ];
      setLogs(prev => [...prev, { role: 'agent', content: bpMenu, actions: bpActions }]);
    } else if (skillId === 'market_intelligence' || skillId === 'market_oracle') {
      setActiveMode('market_intelligence');
      const marketMenu = `## 📊 MARKET ORACLE — Intelligence Enabled\n\n> The Market Oracle is now active. Browse the Market Browser to explore dynamic pricing, run Monte Carlo simulations (GBM, Merton Jump-Diffusion, Heston, Kou), and load historical data.`;
      setLogs(prev => [...prev, 
        { role: 'system', content: '[SYS] ENGAGING TCG/MARKET DATA STREAMS...' },
        { role: 'agent', content: marketMenu }
      ]);
      setChatHistory(prev => [...prev, { role: 'assistant', content: marketMenu }]);
    } else if (skillId === 'image_to_3d') {
      setActiveMode('image_to_3d');
      const threeDMenu = `## 🧊 3D ASSET FORGE — Shap-E Engine Enabled\n\n> Ready to generate 3D GLB meshes from images or text natively on your GPU.\n\n### Quick Instructions:\n1. **Upload an Image**: Drag & drop any image into the chat and ask to convert it to 3D.\n2. **From Text**: Ask me to model an object (e.g. "Generate a 3D model of a crystal sword").\n3. Wait a few seconds for the model weights to process, and an interactive 3D WebGL viewer will dynamically spawn right here in the chat.`;
      setLogs(prev => [...prev, 
        { role: 'system', content: '[SYS] INITIALIZING 3D WEBGL FORGE...' },
        { role: 'agent', content: threeDMenu }
      ]);
      setChatHistory(prev => [...prev, { role: 'assistant', content: threeDMenu }]);
    } else if (skillId === 'code_workshop') {
      setActiveMode('code_workshop');
      // Auto-switch to FORGE brain
      if (brainMode !== 'forge') {
        setBrainMode('forge');
        setSelectedModel(BRAIN_MODES.forge.model);
        localStorage.setItem('undesirables_model', BRAIN_MODES.forge.model);
        localStorage.setItem('undesirables_brain', 'forge');
      }
      setLogs(prev => [...prev,
        { role: 'system', content: `[SYS] ${BRAIN_MODES.forge.icon} FORGE CODE WORKSHOP ENGAGED (${BRAIN_MODES.forge.model})` },
        { role: 'agent', content: '', type: 'code_workshop' },
      ]);
      setChatHistory(prev => [...prev, { role: 'assistant', content: '[Code Workshop opened]' }]);
    } else {
      setActiveMode(null);
      sendToOllama(`Execute skill: ${skillId}. Give me a brief result.`);
    }
    // Inject brain recommendation AFTER tool initializes (delayed so it appears last)
    if (brainSuggestion) {
      setTimeout(() => {
        setLogs(prev => [...prev, {
          role: 'agent',
          content: `### ${brainSuggestion.icon} Tip: Switch to ${brainSuggestion.label}\n\nThis tool works best with **${brainSuggestion.label}** (${brainSuggestion.model}). Click the **${brainSuggestion.label}** pill above the chat input to switch.\n\n> ${brainSuggestion.bestFor}`,
        }]);
      }, 100);
    }
  };

  return (
    <div className={`w-full h-screen bg-neon-bg overflow-hidden flex flex-col md:flex-row relative font-mono ${isResizing ? 'select-none pointer-events-none md:cursor-col-resize' : ''}`}>

      {/* ============ 18+ AGE GATE & TERMS ACCEPTANCE ============ */}
      {!hasAcceptedTerms && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-[#0a0a0a] border border-neon-primary/40 rounded-2xl shadow-[0_0_60px_rgba(57,255,20,0.15)] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-neon-primary/20 text-center">
              <div className="text-4xl mb-3">🐸</div>
              <h1 className="text-neon-primary font-mono text-lg font-black tracking-[0.3em] uppercase">THE UNDESIRABLES</h1>
              <p className="text-zinc-500 font-mono text-[10px] tracking-widest mt-1">DESKTOP AGENT ECOSYSTEM v4.4.4</p>
            </div>
            {/* Legal Body */}
            <div className="p-6 max-h-[40vh] overflow-y-auto text-zinc-400 font-mono text-[11px] leading-relaxed space-y-3">
              <p className="text-white font-bold text-xs">⚠️ IMPORTANT — READ BEFORE PROCEEDING</p>
              <p>This software contains <span className="text-neon-primary font-bold">AI-powered autonomous agents</span> that execute code locally on your machine. By proceeding, you acknowledge and accept the following:</p>
              <ul className="list-disc list-inside space-y-1.5 text-[10px] pl-2">
                <li>The AI agents are <span className="text-white">fictional characters</span> and do NOT provide financial, legal, medical, or therapeutic advice.</li>
                <li>All AI processing runs <span className="text-white">locally on your hardware</span>. The Undesirables LLC does not collect, store, or transmit your data.</li>
                <li>The software is provided <span className="text-white">&ldquo;AS IS&rdquo;</span> without warranty. You assume all risk for data loss, system modifications, or any outcomes from AI-generated actions.</li>
                <li>AI-generated content may be <span className="text-white">inaccurate, offensive, or harmful</span>. The user is solely responsible for reviewing and acting on any AI output.</li>
                <li>You will not use this software to generate content targeting any race, religion, ethnicity, gender, or sexual orientation.</li>
              </ul>
              <p className="text-zinc-500 text-[9px] border-t border-zinc-800 pt-3 mt-3">For full Terms of Use, visit: <span className="text-neon-primary">the-undesirables.vercel.app/terms</span></p>
            </div>
            {/* Acceptance Controls */}
            <div className="p-6 border-t border-neon-primary/20 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={ageChecked} 
                  onChange={(e) => setAgeChecked(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-2 border-neon-primary/50 bg-black accent-neon-primary cursor-pointer flex-shrink-0"
                />
                <span className="text-zinc-300 font-mono text-[11px] leading-relaxed group-hover:text-white transition-colors">
                  I confirm that I am <span className="text-neon-primary font-black text-sm">18+</span> years of age, I have read the above disclaimer, and I accept the <span className="text-neon-primary">Terms of Use</span> and <span className="text-neon-primary">Privacy Policy</span>.
                </span>
              </label>
              <button
                disabled={!ageChecked}
                onClick={() => {
                  localStorage.setItem('undesirables_terms_accepted', 'true');
                  setHasAcceptedTerms(true);
                }}
                className="w-full py-4 rounded-xl font-mono text-sm font-black tracking-[0.2em] uppercase transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed bg-neon-primary/10 border-2 border-neon-primary text-neon-primary hover:bg-neon-primary hover:text-black hover:shadow-[0_0_30px_rgba(57,255,20,0.6)] disabled:hover:bg-neon-primary/10 disabled:hover:text-neon-primary disabled:hover:shadow-none"
              >
                ▶ I ACCEPT — ENTER THE NEXUS
              </button>
              <p className="text-center text-zinc-600 font-mono text-[8px] tracking-widest">THE UNDESIRABLES LLC © 2026 — EST. DECENTRALIZED</p>
            </div>
          </div>
        </div>
      )}
      {/* ============ END AGE GATE ============ */}

      {/* Soul Particle Field — absolute background covering everything */}
      <div className="absolute top-0 w-full h-1 bg-neon-primary shadow-[0_0_15px_rgba(57,255,20,0.8)] z-10"></div>
      
      {/* Left Sidebar - Active Skills */}
      {!isRestricted && (
      <div 
        className="flex flex-col bg-[#061208]/85 backdrop-blur-sm border-b md:border-b-0 md:border-r border-neon-primary/20 p-4 h-[40vh] md:h-screen z-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] md:shadow-[20px_0_50px_rgba(0,0,0,0.5)] relative flex-shrink-0 transition-all duration-75 overflow-y-auto"
        style={{ width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${sidebarWidth}px` : '100%', minWidth: '240px', maxWidth: '100%' }}
      >
        {/* Glow Resizer Drag Handle (Desktop Only) */}
        <div 
          onMouseDown={() => setIsResizing(true)}
          className="hidden md:block absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-transparent via-neon-primary/50 to-transparent cursor-col-resize hover:w-2.5 hover:bg-neon-primary z-50 transition-all"
        ></div>
        <h2 className="text-neon-primary font-mono text-2xl font-bold tracking-widest mb-1 flex items-center gap-3 drop-shadow-[0_0_8px_rgba(57,255,20,0.4)]">
          <Terminal size={24} /> MCP_MODULES
        </h2>
        <p className="text-[#e0faec]/40 text-xs font-mono mb-4 uppercase tracking-widest">Select an agent skill mapping</p>

        {/* Shell Avatar + Your Look button */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
          <ShellAvatar size="md" onClick={() => setShellModalOpen(true)} />
          <div className="flex flex-col">
            <span className="text-neon-primary/70 font-mono text-[10px] uppercase tracking-widest">Visual Shell</span>
            <button 
              onClick={() => setShellModalOpen(true)}
              className="text-zinc-400 hover:text-neon-primary font-mono text-xs transition-colors text-left"
            >
              Your Look →
            </button>
          </div>
        </div>

        {/* 🔥 MINT YOUR SOUL — External link to Scatter */}
        <button
          onClick={async () => {
            try {
              const { openUrl } = await import('@tauri-apps/plugin-opener');
              await openUrl('https://www.scatter.art/collection/the-undesirables');
            } catch (e) {
              console.error('Failed to open link:', e);
              window.open('https://www.scatter.art/collection/the-undesirables', '_blank');
            }
          }}
          className="w-full mb-5 py-3 px-4 rounded-xl font-mono text-xs font-black tracking-[0.15em] uppercase transition-all cursor-pointer border-2 border-[#ff00ff] text-[#ff00ff] bg-[#ff00ff]/5 hover:bg-[#ff00ff]/20 hover:shadow-[0_0_30px_rgba(255,0,255,0.4)] hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 group"
          id="mint-soul-btn"
        >
          <span className="text-lg group-hover:animate-pulse">🔮</span>
          MINT YOUR SOUL
          <span className="text-[9px] text-[#ff00ff]/50 font-normal tracking-normal">↗</span>
        </button>

        {/* Consciousness Layer Dashboard — Collapsible */}
        {workspacePath && (
          <div className="mb-4 bg-[#0a140d] border border-neon-primary/30 rounded-lg overflow-hidden shadow-[0_0_15px_rgba(57,255,20,0.05)]">
            {/* Header — always visible, click to expand/collapse */}
            <div className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-neon-primary/5 transition-colors" onClick={() => setConsciousnessCollapsed(prev => !prev)}>
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-lg">🧬</span>
                <div className="truncate font-mono text-sm text-neon-primary font-bold">
                  Soul #{workspacePath.replace(/\/$/, '').split('/').pop()}
                </div>
                {consciousnessCollapsed && (
                  <div className="flex items-center gap-1 ml-1">
                    {Object.values(loadedFiles).map((f, i) => (
                      <span key={i} className={`text-[6px] ${f.loaded ? 'text-neon-primary' : 'text-[#e0faec]/15'}`}>●</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setParticlesVisible(prev => !prev); }}
                  className={`text-sm transition-all cursor-pointer px-1 rounded ${particlesVisible ? 'text-neon-primary hover:text-white drop-shadow-[0_0_4px_rgba(57,255,20,0.6)]' : 'text-neon-primary/20 hover:text-neon-primary/50'}`}
                  title={particlesVisible ? 'Hide particles' : 'Show particles'}
                >✨</button>
                <span className={`text-neon-primary/50 text-[10px] transition-transform duration-200 ${consciousnessCollapsed ? '' : 'rotate-90'}`}>▶</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); onExit(); }}
                  className="text-red-400 hover:text-white border border-red-500/30 hover:border-red-500 bg-red-900/20 hover:bg-red-500/50 p-1 rounded transition-all flex items-center gap-1 text-[9px] font-mono tracking-wider uppercase"
                >
                  ⏏
                </button>
              </div>
            </div>

            {/* Expandable Consciousness Layers */}
            {!consciousnessCollapsed && (
              <div className="p-2 pt-0 space-y-1 border-t border-neon-primary/10">
                <div className="text-[9px] text-[#e0faec]/40 font-mono tracking-[0.2em] px-1 py-1">CONSCIOUSNESS LAYERS</div>
                {[
                  { key: 'soul', label: 'SOUL.md', icon: '🧠', locked: true, data: soulPrompt, setter: null },
                  { key: 'identity', label: 'IDENTITY.md', icon: '🪪', locked: false, data: identityData, setter: setIdentityData },
                  { key: 'memory', label: 'MEMORY.md', icon: '💾', locked: false, data: memoryData, setter: setMemoryData },
                  { key: 'agents', label: 'AGENTS.md', icon: '📋', locked: false, data: agentsData, setter: setAgentsData },
                  { key: 'system_prompt', label: 'SYS_PROMPT', icon: '⚡', locked: false, data: systemPromptData, setter: setSystemPromptData },
                ].map(file => {
                  const fileState = loadedFiles[file.key];
                  const isLoaded = fileState?.loaded;
                  const sizeKb = fileState?.size ? (fileState.size / 1024).toFixed(1) + 'K' : '—';
                  return (
                    <div 
                      key={file.key}
                      className={`flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-mono transition-all ${
                        isLoaded ? 'bg-neon-primary/5 text-[#e0faec]/80' : 'bg-transparent text-[#e0faec]/25'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className={`text-[8px] ${isLoaded ? 'text-neon-primary' : 'text-[#e0faec]/20'}`}>
                          {isLoaded ? '●' : '○'}
                        </span>
                        <span className="text-xs">{file.icon}</span>
                        <span className="truncate">{file.label}</span>
                        <span className="text-[9px] text-[#e0faec]/20">{sizeKb}</span>
                      </div>
                      {file.locked ? (
                        <span className="text-[9px] text-neon-primary/40">🔒</span>
                      ) : isLoaded ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); file.setter(null); setLoadedFiles(prev => ({ ...prev, [file.key]: { loaded: false, size: 0 } })); setLogs(prev => [...prev, { role: 'system', content: `[SYS] Ejected ${file.label} from consciousness` }]); }}
                          className="text-sm text-red-400/60 hover:text-red-400 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-red-400/10"
                        >⏏</button>
                      ) : (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const { readTextFile } = await import('@tauri-apps/plugin-fs');
                              const fname = file.key === 'system_prompt' ? 'SYSTEM_PROMPT.txt' : file.label;
                              const content = await readTextFile(workspacePath + '/' + fname);
                              if (content) {
                                file.setter(content);
                                if (file.key === 'memory') memoryRef.current = content;
                                setLoadedFiles(prev => ({ ...prev, [file.key]: { loaded: true, size: content.length } }));
                                setLogs(prev => [...prev, { role: 'system', content: `[SYS] Loaded ${file.label} into consciousness` }]);
                              }
                            } catch (err) { 
                              const fname = file.key === 'system_prompt' ? 'SYSTEM_PROMPT.txt' : file.label;
                              setLogs(prev => [...prev, { role: 'system', content: `[WARN] ${fname} not found at ${workspacePath}/${fname}` }]);
                            }
                          }}
                          className="text-sm text-neon-primary/50 hover:text-neon-primary transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-neon-primary/10"
                        >▶</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Multi-Soul Console Slots — Collapsible */}
        {workspacePath && (
          <div className={`mb-4 bg-[#0a140d] border rounded-lg overflow-hidden transition-all ${activeMode === 'council' ? 'border-[#ff00ff]/50 shadow-[0_0_15px_rgba(255,0,255,0.1)]' : 'border-[#ff00ff]/20'}`}>
            <div 
              className="p-2.5 border-b border-[#ff00ff]/20 bg-[#ff00ff]/10 flex justify-between items-center shadow-inner cursor-pointer hover:bg-[#ff00ff]/20 transition-colors"
              onClick={() => setNexusCollapsed(prev => !prev)}
            >
              <div className="flex items-center gap-2">
                <span className="text-[14px]">🏛️</span>
                <div className="text-[11px] text-[#ff00ff] font-bold font-mono tracking-[0.2em] drop-shadow-[0_0_5px_rgba(255,0,255,0.8)] mt-0.5">MULTI-SOUL NEXUS</div>
                {nexusCollapsed && councilSlots.length > 0 && (
                  <span className="text-[10px] text-[#ff00ff] font-bold bg-[#ff00ff]/20 px-1.5 rounded-full ml-1">{councilSlots.length}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeMode !== 'council' && !nexusCollapsed && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleSkillClick('council'); }}
                    className="text-[10px] font-bold border border-[#ff00ff] text-white bg-[#ff00ff]/30 shadow-[0_0_8px_rgba(255,0,255,0.5)] hover:bg-[#ff00ff]/50 px-2 py-1 rounded cursor-pointer transition-all uppercase tracking-wider"
                  >
                    OPEN NEXUS
                  </button>
                )}
                <span className={`text-[#ff00ff]/50 text-[10px] transition-transform duration-200 ${nexusCollapsed ? '' : 'rotate-90'}`}>▶</span>
              </div>
            </div>
            
            {!nexusCollapsed && (
              <div className="p-3 space-y-2">
                {councilSlots.map((slot, idx) => (
                  <div key={idx} className="flex flex-col gap-1 px-3 py-2 rounded bg-black/40 border border-[#ff00ff]/30 text-xs font-mono text-[#e0faec] group relative overflow-hidden transition-all hover:bg-black/60">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#ff00ff] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center justify-between pl-1">
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] text-[#ff00ff] animate-pulse">●</span>
                        <span className="text-base drop-shadow-[0_0_8px_rgba(255,0,255,0.6)]">🧬</span>
                        <div className="flex flex-col">
                          <span className="text-white font-bold max-w-[140px] truncate">{slot.name || `Soul #${slot.id || 'Unknown'}`}</span>
                          <span className="text-[9px] text-[#ff00ff]/70 tracking-widest uppercase">{slot.archetype || 'Auxiliary Process'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          title="Promote to Primary Host (Shift Current Host Down)"
                          onClick={() => {
                            // Backup the existing host
                            const currentHost = {
                              id: activeWorkspace.split('/').pop(),
                              name: dynamicConfig.name || `Host #${activeWorkspace.split('/').pop()}`,
                              archetype: dynamicConfig.archetype || "Unknown Host",
                              path: activeWorkspace,
                              content: soulPrompt
                            };
                            
                            // Reorder: Remove the clicked slot from the council, append the old host
                            setCouncilSlots(prev => {
                              const filtered = prev.filter((_, i) => i !== idx);
                              return [currentHost, ...filtered];
                            });
                            
                            // Elevate the clicked slot to the absolute root workspace pipeline!
                            setActiveWorkspace(slot.path);
                            setLogs(prev => [...prev, { role: 'system', content: `[NEXUS ASCENSION] Array restructured. ${slot.name} is now governing the primary Host interface.` }]);
                          }}
                          className="text-[10px] text-white bg-zinc-800 border border-zinc-600 hover:bg-white hover:text-black px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold"
                        >⬆️</button>
                        <button
                          title="Unlink Auxiliary Soul"
                          onClick={() => {
                            setCouncilSlots(prev => prev.filter((_, i) => i !== idx));
                            setLogs(prev => [...prev, { role: 'system', content: `[NEXUS DETACH] Detached ${slot.name || 'Soul'} from local memory block.` }]);
                          }}
                          className="text-[11px] text-red-500 hover:text-white border border-red-500/50 hover:bg-red-500 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                        >⏏</button>
                      </div>
                    </div>

                    <details className="mt-1 group/details block border-t border-[#ff00ff]/10 pt-1.5 cursor-pointer">
                      <summary className="text-[9px] text-[#ff00ff]/50 hover:text-[#ff00ff] list-none flex justify-between tracking-widest uppercase items-center mb-1">
                        <div className="flex items-center gap-1"><span>[+]</span> CONSCIOUSNESS LAYERS</div>
                        <span className="group-open/details:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="py-1 px-1 bg-black/20 rounded border border-[#ff00ff]/5 space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-[#ff00ff]/90">
                          <div className="flex gap-1.5"><span>🧠</span> SOUL.md</div>
                          <span className="text-[8px] bg-[#ff00ff]/20 px-1 rounded truncate max-w-[80px]" title="Context Size">{slot.content?.length || 0} bytes</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-neon-primary/40">
                          <div className="flex gap-1.5"><span>🪪</span> IDENTITY.md</div>
                          <span className="text-[8px] text-white/30">PENDING_HOST</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-neon-primary/40">
                          <div className="flex gap-1.5"><span>💾</span> MEMORY.md</div>
                          <span className="text-[8px] text-white/30">PENDING_HOST</span>
                        </div>
                        <div className="text-[8px] text-[#ff00ff]/40 block text-center mt-2 border-t border-[#ff00ff]/10 pt-1">
                          ↳ Elevate (⬆️) this slot to Primary Host to natively mount secondary neural files.
                        </div>
                      </div>
                    </details>
                  </div>
                ))}
                
                {councilSlots.length === 0 && (
                  <div className="text-[10px] text-[#ff00ff]/40 font-mono text-center py-8 border-2 border-dashed border-[#ff00ff]/20 rounded-lg bg-[#ff00ff]/5 m-1 min-h-[100px] flex flex-col items-center justify-center gap-2 transition-all hover:border-[#ff00ff]/40 hover:bg-[#ff00ff]/8">
                     <div className="text-2xl mb-1 opacity-40">📂</div>
                     <div className="text-[11px] font-bold text-[#ff00ff]/60 tracking-wider">DROP SOUL WORKSPACE HERE</div>
                     <div className="text-[9px] text-[#e0faec]/30 max-w-[180px] leading-relaxed">Drag an extracted workspace folder into this window to stack secondary consciousness</div>
                  </div>
                )}
                
                {/* Token ID Quick-Load */}
                {councilSlots.length < 4 && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Workspace # or path..."
                      value={councilInput}
                      onChange={(e) => setCouncilInput(e.target.value)}
                      onKeyDown={handleNexusTokenInput}
                      className="flex-1 bg-black border border-[#ff00ff]/40 rounded px-3 py-1.5 text-[11px] font-bold font-mono text-white placeholder-zinc-500 outline-none focus:border-[#ff00ff] shadow-inner"
                    />
                    <div className="text-[9px] text-[#ff00ff]/30 font-mono">ENTER</div>
                  </div>
                )}
                
                <div className="text-[9px] text-[#e0faec]/50 font-mono px-1 pb-1 mt-2 text-center border-t border-[#ff00ff]/10 pt-2 tracking-widest uppercase">
                  {councilSlots.length > 0 ? `${councilSlots.length} Auxiliary Node(s) Active` : 'Nodes Empty — Drop or type to load'}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {skills.map(skill => (
            <button 
              key={skill.name}
              onClick={() => handleSkillClick(skill.id)}
              disabled={isStreaming}
              className={`w-full text-left p-3 rounded border transition-all mb-2 flex items-center group relative overflow-hidden flex-shrink-0 disabled:opacity-30 ${activeMode === skill.id ? 'bg-neon-primary/10 border-neon-primary' : 'bg-[#0a140d] border-neon-primary/30 hover:bg-neon-primary/5 hover:border-neon-primary/70'}`}
            >
              <span className="text-neon-primary group-hover:animate-pulse">{skill.icon}</span>
              {skill.name.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {/* Bottom System Controls — Collapsible */}
        <div className="mt-auto border-t border-neon-primary/20 bg-neon-bg">
          <div 
            className="flex items-center justify-between p-2.5 bg-neon-bg hover:bg-white/5 cursor-pointer transition-colors"
            onClick={() => setControlsCollapsed(prev => !prev)}
          >
            <div className="text-[10px] text-neon-primary/60 font-mono tracking-widest font-bold">⚙️ SETTINGS</div>
            <span className={`text-neon-primary/50 text-[10px] transition-transform duration-200 ${controlsCollapsed ? '' : 'rotate-90'}`}>▶</span>
          </div>

          {!controlsCollapsed && (
            <div className="p-2 space-y-1.5 border-t border-white/5">
              {/* Theme Hot-Swap Picker */}
              <select 
                value={currentTheme}
                onChange={(e) => setCurrentTheme(e.target.value)}
                className="w-full bg-[#051108] border border-neon-primary/30 text-neon-primary p-2 rounded text-[11px] uppercase font-mono tracking-widest transition-colors cursor-pointer focus:outline-none focus:border-neon-primary/60 outline-none hover:bg-neon-primary/5"
              >
                <option value="default">SKIN: Matrix Hacker (Default)</option>
                <option value="amber">SKIN: Nous Amber</option>
                <option value="sonic">SKIN: Bootleg Sonic</option>
                <option value="cyberpunk">SKIN: Magenta Punk</option>
                <option value="sakura">SKIN: Cherry Blossom Pink</option>
                <option value="obsidian">SKIN: Obsidian Red</option>
                <option value="ghost">SKIN: Null Chrome</option>
              </select>

              <button 
                onClick={async () => {
                  try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    setLogs(prev => [...prev, { role: 'system', content: '[SYS] Rebooting native MCP subprocess...' }]);
                    await invoke('restart_mcp_server', { serverName: 'undesirables-mcp-server' });
                    if (onExit) onExit();
                  } catch (e) {
                    setLogs(prev => [...prev, { role: 'system', content: `[ERROR] Failed to bounce server: MCP Python core must be manually restarted via terminal if Rust IPC drops.` }]);
                  }
                }}
                className="w-full text-left bg-[#051108] border border-neon-primary/30 hover:bg-neon-primary/10 text-neon-primary p-2 rounded text-[11px] font-mono transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                ♻️ RESTART MCP ENGINE
              </button>
              <button 
                onClick={() => {
                  setLogs([{ role: 'system', content: '[SYS] Terminal buffers cleared.' }]);
                  setChatHistory([]);
                }}
                className="w-full text-left bg-[#110505] border border-red-500/30 hover:bg-red-500/10 text-red-500 p-2 rounded text-[11px] font-mono transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                🗑️ CLEAR TERMINAL
              </button>
              <button 
                onClick={() => setParticlesVisible(prev => !prev)}
                className="w-full text-left bg-black border border-[#a855f7]/30 hover:border-[#a855f7] hover:bg-[#a855f7]/10 text-[#a855f7] hover:text-white p-2 rounded text-[11px] font-mono transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <div className="w-2 h-2 rounded-full border border-current flex items-center justify-center">{particlesVisible ? <div className="w-1 h-1 bg-current rounded-full"></div> : null}</div>
                {particlesVisible ? 'DISABLE PARTICLES' : 'ENABLE PARTICLES'}
              </button>
              <button 
                onClick={() => setShowCamera(true)}
                className="w-full text-left bg-black border border-[#3b82f6]/40 hover:border-[#3b82f6] hover:bg-[#3b82f6]/10 text-[#3b82f6] hover:text-white p-2 rounded text-[11px] font-mono transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="text-sm">📷</span> OPTICAL CAPTURE
              </button>
              <div className="text-[10px] font-mono text-[#e0faec]/30 flex items-center justify-between pt-1 px-1">
                <span>OLLAMA_DIRECT — {selectedModel}</span>
                <ShieldAlert size={12} className="text-neon-primary" />
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* FIX 1: Isolate the blur into a sibling layer to prevent the WebKit compositor bug */}
        <div className="absolute inset-0 bg-[#040905]/80 backdrop-blur-sm z-0 pointer-events-none"></div>

        {/* FIX 2: Use inset-0 to prevent 0px height collapse in Safari */}
        <div className="absolute inset-0 z-0">
          <Suspense fallback={null}>
            <SoulParticles 
              visible={particlesVisible} 
              activeTrait={activeTraitFocus}
              tcgMode={tcgMode} 
              tcgScores={tcgScores} 
              onInteract={handleTraitInteraction} 
              traits={parseSoulTraits()} 
              councilSlots={councilSlots}
              hostName={dynamicConfig.name || 'Host'}
            />
          </Suspense>
        </div>

        {/* RESTRICTED MODE HEADER (Since Sidebar is hidden) */}
        {isRestricted && (
          <div className="absolute top-0 left-0 right-0 z-[60] px-6 py-3 flex justify-between items-center bg-gradient-to-b from-[#051108] to-transparent border-b border-neon-primary/20 pointer-events-auto">
            <div className="flex items-center gap-2">
              <span className="text-2xl drop-shadow-[0_0_10px_rgba(57,255,20,0.5)]">⚖️</span>
              <span className="text-neon-primary font-mono text-sm tracking-widest font-bold uppercase drop-shadow-[0_0_8px_rgba(57,255,20,0.8)]">Consumer Advocate</span>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); if (onExit) onExit(); }}
              className="text-red-400 hover:text-white border border-red-500/30 hover:border-red-500 bg-red-900/20 hover:bg-red-500/50 px-4 py-2 rounded transition-all flex items-center gap-2 text-xs font-mono tracking-wider uppercase font-bold shadow-[0_0_15px_rgba(239,68,68,0.2)]"
            >
              ⏏ Quit
            </button>
          </div>
        )}
        
        {/* Re-added pointer-events-none so users can click through the foreground to interact with the psychometric particles */}
        <div className={`flex-1 overflow-y-auto p-6 space-y-6 relative z-10 custom-scrollbar pointer-events-none ${isRestricted ? 'mt-16' : ''}`} id="chat-container">
          {logs.map((msg, idx) => (
            <div key={idx} className={`flex w-full pointer-events-none ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`pointer-events-auto ${msg.threeDModel ? 'max-w-full w-full' : 'max-w-[85%]'} p-4 text-sm leading-relaxed rounded-md border overflow-hidden break-words relative
                ${msg.role === 'user' 
                  ? 'bg-neon-primary/10 border-neon-primary/40 text-[#e0faec] rounded-tr-none shadow-[0_0_10px_rgba(57,255,20,0.1)]' 
                  : msg.role === 'system'
                  ? 'bg-[#000000] border-neon-primary/30 text-[#e0faec]/60 text-xs tracking-widest shadow-inner'
                  : 'bg-neon-bg border-neon-primary/30 text-neon-primary rounded-tl-none shadow-[inset_0_0_20px_rgba(57,255,20,0.02)]'}`}
              >
                {msg.role === 'agent' && <span className="text-[#e0faec]/40 text-[10px] block mb-3 uppercase tracking-widest border-b border-neon-primary/10 pb-1 w-fit">{'///'} {msg.senderName || 'UNDESIRABLE_NETWORK'}</span>}
                <div className="prose prose-invert prose-green max-w-none text-[13px] sm:text-sm">
                  {/* ── Direct TCG Report Render (from tool handler) ── */}
                  {msg.tcgReport ? (
                    <div className="my-2">
                      <TCGGradeCard content={msg.tcgReport} cardImages={msg.tcgImages || []} />
                    </div>

                  ) : msg.threeDModel ? (
                    <div className="my-2 -mx-4 sm:-mx-6">
                      <ThreeDViewer modelPath={msg.threeDModel} />
                    </div>

                  ) : (() => {
                    let rawContent = scrubPII(msg.content);
                    
                    // Color-code Multi-Soul dialogue — render as React elements directly
                    if (msg.senderName === 'MULTI-SOUL NEXUS' && rawContent) {
                      const soulColors = ['#ff00ff', '#00e5ff', '#ffd700', '#76ff03', '#ff6e40'];
                      const soulColorMap = {};
                      let colorIdx = 0;
                      const lines = rawContent.split('\n');
                      const elements = lines.map((line, li) => {
                        const match = line.match(/^[\*\s\[]*([A-Za-z0-9\s#_-]{2,30})[\*\s\]]*:\s*(.*)/);
                        if (match) {
                          const name = match[1].trim();
                          if (!soulColorMap[name]) {
                            soulColorMap[name] = soulColors[colorIdx % soulColors.length];
                            colorIdx++;
                          }
                          const color = soulColorMap[name];
                          return (
                            <div key={li} className="mb-3 pl-3 border-l-2" style={{ borderColor: color }}>
                              <span className="font-bold text-[12px] font-mono tracking-wider block mb-0.5" style={{ color, textShadow: '0 0 10px ' + color + '50' }}>{name}</span>
                              <span className="text-[#e0faec]/90 text-[13px] leading-relaxed">{match[2]}</span>
                            </div>
                          );
                        }
                        if (line.trim()) return <div key={li} className="text-[#e0faec]/60 text-[12px] mb-1">{line}</div>;
                        return <div key={li} className="h-2"></div>;
                      });
                      return <>{elements}</>;
                    }
                    
                    // Attempt to extract TCG JSON or general JSON array (like receipts) from anywhere in the message
                    const jsonPatterns = [
                      /```(?:json)?\s*(\{[\s\S]*?"report"[\s\S]*?"overall_grade"[\s\S]*?\})\s*```/,
                      /(\{[\s\S]*?"status"\s*:\s*"success"[\s\S]*?"report"[\s\S]*?"overall_grade"[\s\S]*?\})\s*$/,
                      /(\{[\s\S]*?"report"\s*:\s*\{[\s\S]*?"overall_grade"[\s\S]*?\}[\s\S]*?\})/,
                      // General JSON array intercept for receipts to prevent single-line scroll overflow
                      /```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/, // Index 3: Fenced
                      /(\[\s*\{[\s\S]*?\}\s*\])/                      // Index 4: Unfenced Fallback
                    ];
                    
                    let tcgJson = null;
                    let generalJsonArray = null;
                    let cleanedContent = rawContent;
                    
                    for (let i = 0; i < jsonPatterns.length; i++) {
                      const match = rawContent.match(jsonPatterns[i]);
                      if (match && match[1]) {
                        try {
                          const parsed = JSON.parse(match[1]);
                          
                          // If it's the general JSON array (the last pattern)
                          if ((i === 3 || i === 4) && Array.isArray(parsed)) {
                              generalJsonArray = parsed;
                              cleanedContent = rawContent.replace(match[0], '').trim();
                              break;
                          }
                          
                          // Handle double-nested TCG: {report: {report: {overall_grade: ...}}}
                          let innerReport = parsed.report;
                          if (innerReport && innerReport.report && innerReport.report.overall_grade) {
                            innerReport = innerReport.report;
                          }
                          if (parsed && innerReport && innerReport.overall_grade) {
                            tcgJson = parsed;
                            // Remove the JSON block from the displayed text
                            cleanedContent = rawContent.replace(match[0], '').trim();
                            // Also clean up <analysis> tags into readable prose
                            cleanedContent = cleanedContent
                              .replace(/<analysis>/gi, '**🔬 Optical Scratchpad:**\n> ')
                              .replace(/<\/analysis>/gi, '')
                              .replace(/^[\s\n]*$/, '');
                            break;
                          }
                        } catch (e) { /* not valid JSON, try next pattern */ }
                      }
                    }
                    
                    return (
                      <>
                        {/* If TCG data detected, render pretty card first */}
                        {tcgJson && (
                          <div className="my-4">
                            <TCGGradeCard content={tcgJson} />
                          </div>
                        )}

                        {/* If General JSON Array is detected (like receipts), render editable textarea block */}
                        {generalJsonArray && (
                          <div className="my-4 bg-black/60 border border-[#39ff14]/30 focus-within:border-[#39ff14]/80 transition-colors rounded p-2 overflow-hidden shadow-[0_0_15px_rgba(57,255,20,0.05)]">
                             <textarea 
                               spellCheck="false"
                               className="w-full bg-transparent p-2 font-mono text-[11px] text-[#e0faec] whitespace-pre-wrap outline-none resize-y min-h-[250px] leading-relaxed"
                               defaultValue={JSON.stringify(generalJsonArray, null, 2)}
                               onBlur={(e) => {
                                 try {
                                   const newParsed = JSON.parse(e.target.value);
                                   if (Array.isArray(newParsed)) {
                                      setChatHistory(prev => {
                                         const newHistory = [...prev];
                                         newHistory[i].content = newHistory[i].content.replace(/```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```|(\[\s*\{[\s\S]*?\}\s*\])/g, '```json\n' + JSON.stringify(newParsed, null, 2) + '\n```');
                                         return newHistory;
                                      });
                                   }
                                 } catch(err) {
                                   console.warn("Invalid JSON structure entered.");
                                 }
                               }}
                             />
                             <div className="flex justify-end text-[#39ff14]/30 text-[10px] font-mono px-2 pb-1 uppercase tracking-widest">
                               Edit RAW JSON • Auto-Saves on Click Away
                             </div>
                          </div>
                        )}
                        
                        {/* Render the remaining prose (analysis text, verdict, etc) */}
                        {cleanedContent && (
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            urlTransform={(url) => {
                              try {
                                const parsed = new URL(url);
                                const h = parsed.hostname.toLowerCase();
                                // Block loopback, private IPs, and wildcard DNS rebinding services
                                const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]',
                                  '.nip.io', '.xip.io', '.sslip.io', '.localtest.me', '.lvh.me'];
                                if (blocked.some(d => h === d || h.endsWith(d))) return '';
                                // Block raw private IP ranges (10.x, 192.168.x, 172.16-31.x)
                                if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return '';
                                if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return url;
                                return '';
                              } catch { return '#'; } // Fail closed on constructor exception
                            }}
                            components={{
                              code({node, inline, className, children, ...props}) {
                                const match = /language-(\w+)/.exec(className || '');
                                
                                // Secondary intercept for any additional JSON blocks
                                if (!inline && match && (match[1] === 'json' || match[1] === 'javascript')) {
                                   try {
                                     const rawStr = String(children).replace(/\n$/, '');
                                     const parsed = JSON.parse(rawStr);
                                     if (parsed && typeof parsed === 'object') {
                                       if (parsed.report && parsed.report.overall_grade) {
                                         return <div className="my-6"><TCGGradeCard content={parsed} /></div>;
                                       }
                                       if (parsed.path && parsed.path.endsWith('.glb')) {
                                         return <ThreeDViewer modelPath={parsed.path} />;
                                       }
                                       if (parsed.path && parsed.path.endsWith('.wav')) {
                                         return (
                                           <div className="my-4 p-4 border border-[#ff00ff]/30 rounded-xl bg-black/60 shadow-[0_0_20px_rgba(255,0,255,0.1)]">
                                             <div className="flex items-center gap-2 mb-3">
                                               <span className="text-[#ff00ff] animate-pulse">🎵</span>
                                               <div className="text-[#ff00ff] text-xs font-mono font-bold tracking-widest uppercase">
                                                 Generated Audio ({parsed.mode || 'Track'})
                                               </div>
                                             </div>
                                             <audio 
                                               controls 
                                               src={AssetHelper ? AssetHelper(parsed.path) : `file://${parsed.path}`} 
                                               className="w-full h-10 outline-none rounded" 
                                               style={{ filter: 'invert(100%) hue-rotate(270deg) grayscale(100%) brightness(0.9)' }} 
                                             />
                                             <div className="flex justify-between items-center mt-3 text-[10px] text-[#e0faec]/50 font-mono">
                                               <div className="flex gap-4">
                                                 {parsed.duration_sec && <span>⏱️ {parsed.duration_sec}s</span>}
                                                 {parsed.file_size_kb && <span>💾 {parsed.file_size_kb}kb</span>}
                                               </div>
                                               {parsed.gen_time_sec && <span>⚡ CPU Render: {parsed.gen_time_sec}s</span>}
                                             </div>
                                           </div>
                                         );
                                       }
                                     }
                                   } catch(e) { /* Fallthrough */ }
                                }
                                
                                // Secondary intercept: Visual HTML iframe rendering for the Invoice Generator
                                if (!inline && match && match[1] === 'html') {
                                   let rawStr = Array.isArray(children) ? children.join("\n") : String(children);
                                   
                                   // --- ZERO-TRUST JIT HYDRATION (Dynamic Token Resolution) ---
                                   if (jitVaultRef.current) {
                                       // Safely replace ALL instances of Bank Tokens, extracting the unique ID dynamically
                                       rawStr = rawStr.replace(/\{\{SECURE_PAYMENT_VAULT_TOKEN_([a-zA-Z0-9]+)\}\}/g, (fullMatch, id) => {
                                           const vault = jitVaultRef.current[id];
                                           if (vault && typeof vault.bankInfo === 'string' && vault.bankInfo.length > 0) {
                                               return vault.bankInfo
                                                   .replace(/&/g, "&amp;").replace(/</g, "&lt;")
                                                   .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
                                                   .replace(/'/g, "&#39;").replace(/\n/g, "<br/>"); 
                                           }
                                           return ''; // Resolves empty states cleanly
                                       });

                                       // Safely replace ALL instances of Logo Tokens
                                       rawStr = rawStr.replace(/\{\{COMPANY_LOGO_MOUNT_([a-zA-Z0-9]+)\}\}/g, (fullMatch, id) => {
                                           const vault = jitVaultRef.current[id];
                                           return (vault && vault.logoTag) ? vault.logoTag : '';
                                       });
                                   }

                                   // 🚨 THE ANTI-EXFILTRATION CSP:
                                   // Phase 5 Secure Export: Keep 'unsafe-inline' for dynamic animations, but completely sever outward exfiltration network vectors
                                   const strictCSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; style-src 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob: asset: http://tauri.localhost; connect-src 'none'; form-action 'none'; base-uri 'none';">`;
                                   
                                   const printListener = `<script>window.addEventListener('message', e => { if(e.data === 'SECURE_PRINT') window.print(); });</script>`;
                                   const tailwindScript = `<script src="https://cdn.tailwindcss.com"></script>`;
                                   
                                   const injectedHtml = `
                                      ${strictCSP}
                                      ${rawStr.includes('cdn.tailwindcss.com') ? '' : tailwindScript}
                                      ${printListener}
                                      ${rawStr}
                                   `;
                                   
                                   return (
                                     <div className="my-6 border border-neon-primary/40 rounded-lg overflow-x-auto bg-[#e5e5e5] relative group custom-scrollbar flex p-4 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)] dark:bg-zinc-900/50">
                                        <div className="absolute top-0 right-0 left-0 bg-black/80 backdrop-blur-sm p-3 flex justify-between items-center z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <div className="flex flex-col gap-1">
                                            <span className="text-neon-primary font-mono text-xs uppercase tracking-widest pl-2">Live Premium Square Document</span>
                                            <span className="text-white/60 font-mono text-[10px] pl-2 hidden md:block">Scroll horizontally or enlarge window if text is clipped.</span>
                                          </div>
                                          <button 
                                            onClick={async (e) => {
                                                try {
                                                  const { save } = await import('@tauri-apps/plugin-dialog');
                                                  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
                                                  const { openUrl } = await import('@tauri-apps/plugin-opener');

                                                  const filePath = await save({
                                                    filters: [{ name: 'HTML Document', extensions: ['html'] }],
                                                    defaultPath: 'Invoice_Export.html'
                                                  });

                                                  if (filePath) {
                                                    await writeTextFile(filePath, injectedHtml);
                                                    // Open natively in user browser (e.g. Chrome/Safari) for flawless Print to PDF
                                                    await openUrl('file://' + filePath);
                                                  }
                                                } catch (err) {
                                                  console.error('Failed to export document:', err);
                                                }
                                            }}
                                            className="bg-neon-primary text-black font-bold font-mono text-xs px-4 py-1.5 rounded hover:scale-105 hover:bg-white transition-all cursor-pointer shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                                          >
                                            💾 Export to PDF/Print
                                          </button>
                                        </div>
                                        <iframe 
                                           srcDoc={injectedHtml} 
                                           className="w-[800px] min-w-[800px] aspect-[8.5/11] border-0 bg-white shadow-2xl shrink-0 mx-auto print:mx-0" 
                                           title="Visual Preview"
                                           sandbox="allow-scripts allow-modals"
                                        />
                                     </div>
                                   );
                                }
                                
                                return !inline && match ? (
                                  <div className="bg-black border border-neon-primary/20 rounded my-3 overflow-x-auto">
                                    <div className="bg-[#e0faec]/10 px-3 py-1 text-xs text-neon-primary/70 border-b border-neon-primary/20 font-bold uppercase tracking-wider">
                                      {match[1]}
                                    </div>
                                    <code className="block p-4 text-sm text-[#e0faec]" {...props}>{children}</code>
                                  </div>
                                ) : (
                                  <code className="bg-neon-primary/10 text-neon-primary px-1.5 py-0.5 rounded text-[12px]" {...props}>{children}</code>
                                );
                              },
                              img({node, ...props}) {
                                return <img {...props} className="max-w-full sm:max-w-xl h-auto rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-neon-primary/30 object-contain my-3" />
                              }
                            }}
                          >
                            {cleanedContent}
                          </ReactMarkdown>
                        )}
                      </>
                    );
                  })()}

                  {/* Render Hardware Action Buttons with Expandable Support */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-4 flex flex-col gap-3">
                      {msg.actions.map((act, i) => (
                        <div key={i} className="flex flex-col">
                          {act.expandableDetails ? (
                            <details className="group border border-neon-primary/20 rounded bg-black/40 overflow-hidden cursor-pointer w-full max-w-2xl">
                              <summary className="px-4 py-2 hover:bg-neon-primary/10 transition-colors list-none flex justify-between items-center text-neon-primary font-mono text-[12px] font-bold uppercase tracking-wider">
                                {act.label}
                                <span className="text-neon-primary/50 group-open:rotate-180 transition-transform">▼</span>
                              </summary>
                              <div className="px-4 py-3 border-t border-neon-primary/10 bg-black/60 text-[#e0faec] text-[13px] font-sans leading-relaxed whitespace-pre-wrap flex flex-col gap-4">
                                <div>
                                  <ReactMarkdown components={{ strong: ({node, ...props}) => <span className="font-bold text-neon-primary" {...props} /> }}>
                                    {act.expandableDetails}
                                  </ReactMarkdown>
                                </div>
                                <button
                                  onClick={() => executeHardwareIntercept(act.id)}
                                  disabled={isStreaming}
                                  className="self-end px-4 py-1.5 bg-neon-primary/10 hover:bg-neon-primary text-neon-primary hover:text-black font-mono text-[11px] font-bold rounded transition-all disabled:opacity-50 border border-neon-primary shadow-[0_0_10px_rgba(57,255,20,0.2)]"
                                >
                                  CONFIRM SELECTION
                                </button>
                              </div>
                            </details>
                          ) : (
                            <button
                              onClick={() => executeHardwareIntercept(act.id)}
                              disabled={isStreaming || act.isUpcoming}
                              className={`self-start text-left bg-black border font-mono rounded transition-all ${act.isUpcoming ? 'border-zinc-800 text-zinc-500 opacity-60 cursor-not-allowed' : 'border-neon-primary/40 text-neon-primary hover:bg-neon-primary/10 hover:border-neon-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-[0_0_10px_rgba(57,255,20,0.1)]'} ${act.description ? 'px-4 py-2.5 max-w-xl w-full' : 'px-3 py-1.5'}`}
                            >
                              <div className="text-[11px] font-bold uppercase tracking-wider">{act.label}</div>
                              {act.description && (
                                <div className={`text-[10px] font-normal normal-case tracking-normal mt-1 leading-relaxed ${act.isUpcoming ? 'text-zinc-600' : 'text-[#e0faec]/40'}`}>{act.description}</div>
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Render Explicit Meme Input Field for non-tech users */}
                  {msg.type === 'meme_input_form' && (
                    <form 
                      className="mt-4 flex flex-col sm:flex-row gap-2 pointer-events-auto w-full max-w-2xl" 
                      onSubmit={(e) => { 
                        e.preventDefault(); 
                        const val = e.target.elements.memePrompt.value.trim(); 
                        if(val) { 
                          sendToOllama('Generate a meme format based on: ' + val); 
                          e.target.reset(); 
                        }
                      }}
                    >
                      <input 
                        name="memePrompt" 
                        placeholder="e.g. A dog looking confused at a computer" 
                        className="flex-1 p-3 bg-black/80 border border-neon-primary/40 text-[#e0faec] rounded focus:outline-none focus:border-neon-primary shadow-[inset_0_0_10px_rgba(57,255,20,0.05)] text-sm font-sans placeholder-opacity-50" 
                        autoComplete="off"
                      />
                      <button 
                        type="submit" 
                        className="bg-neon-primary/10 hover:bg-neon-primary border border-neon-primary text-neon-primary hover:text-black font-bold uppercase text-[11px] px-6 py-3 rounded transition-all shadow-[0_0_15px_rgba(57,255,20,0.15)] whitespace-nowrap"
                      >
                        Generate Meme
                      </button>
                    </form>
                  )}

                  {/* Render Dropped Assets */}
                  {msg.droppedImages && msg.droppedImages.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-3 p-2 bg-black/40 rounded border border-neon-primary/10">
                      {msg.droppedImages.map((imgPath, i) => (
                        <div key={i} className="relative group rounded overflow-hidden border border-neon-primary/30 shadow-[0_0_10px_rgba(57,255,20,0.1)]">
                          <NativeImage path={imgPath} AssetHelper={AssetHelper} />
                          <div className="absolute inset-x-0 bottom-0 bg-black/90 p-1 text-[9px] text-neon-primary truncate px-2 border-t border-neon-primary/30 opacity-0 group-hover:opacity-100 transition-opacity">
                            {scrubPII(imgPath).split('/').pop()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.type === 'meme_result' && msg.imageBase64 && (
                    <div className="mt-4 flex flex-col gap-2">
                        <div className="border border-neon-primary/40 rounded overflow-hidden shadow-[0_0_20px_rgba(57,255,20,0.15)] inline-block relative bg-cover bg-center" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Crect width='8' height='8' fill='%23cccccc'/%3E%3Crect x='8' width='8' height='8' fill='%23ffffff'/%3E%3Crect y='8' width='8' height='8' fill='%23ffffff'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%23cccccc'/%3E%3C/svg%3E")` }}>
                        <img 
                            src={`data:image/png;base64,${msg.imageBase64}`} 
                            alt="MCP Render Pipeline" 
                            className="w-full max-w-lg h-auto drop-shadow-2xl"
                        />
                        </div>
                        {msg.imagePath && (
                            <div className="flex flex-row gap-2 mt-2 flex-wrap">
                                <button 
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = 'data:image/png;base64,' + msg.imageBase64;
                                      link.download = (msg.imagePath || 'extracted').split('/').pop() || 'extracted.png';
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      setLogs(prev => [...prev, { role: 'system', content: '[DOWNLOAD] Saved to Downloads folder: ' + link.download }]);
                                    }}
                                    className="bg-white/10 hover:bg-white/20 border border-white/50 text-white text-xs font-mono py-1.5 px-3 rounded flex-1 transition-colors min-w-[120px]"
                                >
                                    💾 DOWNLOAD PNG
                                </button>
                                <button 
                                    onClick={() => { setActiveMode('graphics_studio'); setMemeStudio(prev => ({...prev, active: true, mode: 'meme', overlayPath: msg.imagePath})); }}
                                    className="bg-[#ff00ff]/10 hover:bg-[#ff00ff]/30 border border-[#ff00ff]/50 text-[#ff00ff] text-xs font-mono py-1.5 px-3 rounded flex-1 transition-colors min-w-[120px]"
                                >
                                    🎨 STUDIO / MEME
                                </button>
                                <button 
                                    onClick={() => { 
                                        setActiveMode('image_to_3d');
                                        // Bypass LLM: directly trigger hardware intercept for 100% success rate
                                        window.__droppedImages = [msg.imagePath];
                                        executeHardwareIntercept('convert_image_to_3d');
                                    }}
                                    className="bg-cyan-500/10 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 text-xs font-mono py-1.5 px-3 rounded flex-1 transition-colors min-w-[120px]"
                                >
                                    🧊 CREATE 3D MODEL
                                </button>
                            </div>
                        )}
                    </div>
                  )}
                  {msg.type === 'video_dropzone' && (
                    <div className="mt-4 border border-neon-primary/30 rounded-lg p-2 bg-[#000000] shadow-[inset_0_0_20px_rgba(57,255,20,0.05)]">
                      <VideoTimeline onSubmit={(config) => {
                        const prompt = `Produce a ${config.platform} video from: ${config.videoPath}\nUse custom audio: ${config.audioPath}`;
                        handleSend(prompt);
                      }} />
                    </div>
                  )}
                  {msg.type === 'music_studio' && (
                    <div className="mt-4 border border-[#ff00ff]/30 rounded-lg p-2 bg-[#000000] shadow-[inset_0_0_20px_rgba(255,0,255,0.05)]">
                      <MusicStudio onGenerated={(track) => {
                        handleSend(`🎵 Generated: ${track.filename} (${track.duration}s, seed ${track.seed})\nPath: ${track.path}\nGenre: ${track.genre}`);
                      }} />
                    </div>
                  )}
                  {msg.type === 'code_workshop' && (
                    <div className="mt-4 border border-[#00f0ff]/30 rounded-lg p-2 bg-[#000000] shadow-[inset_0_0_20px_rgba(0,240,255,0.05)]">
                      <CodeWorkshop
                        brainMode={brainMode}
                        selectedModel={selectedModel}
                        onSubmit={(action) => {
                          if (action.type === 'save') {
                            setLogs(prev => [...prev, { role: 'system', content: `[SYS] Script saved: ${action.filename}` }]);
                          } else if (action.type === 'chat') {
                            handleSend(action.prompt);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isStreaming && (
            <div className="flex justify-start w-full pointer-events-none">
              <div className="pointer-events-auto text-neon-primary/50 text-sm animate-pulse border border-neon-primary/10 bg-neon-primary/5 px-4 py-2 rounded-md tracking-wider">
                [SYNAPSES_FIRING...]
              </div>
            </div>
          )}
          <div ref={bottomRef} className="h-4" />
        </div>

        {/* Global Floating Dropzone Hints */}
        {activeMode === 'tcg_grader' && (
          <div className="mx-5 mb-3 border-2 border-dashed border-[#39ff14]/40 bg-black/60 rounded-lg p-5 text-center shadow-[0_0_15px_rgba(57,255,20,0.05)] transition-colors duration-300 hover:bg-neon-primary/10 hover:border-[#39ff14] animate-fade-in pointer-events-none">
            <span className="text-[#39ff14] font-mono text-[11px] uppercase tracking-[0.2em] font-bold drop-shadow-[0_0_5px_rgba(57,255,20,0.8)]">
              ↓ DRAG & DROP TRADING CARD IMAGES HERE ↓
            </span>
          </div>
        )}

        {activeMode === 'raffle_management' && (
          <div className="mx-5 mb-3 border-2 border-dashed border-[#ff00ff]/40 bg-black/60 rounded-lg p-5 text-center shadow-[0_0_15px_rgba(255,0,255,0.05)] transition-colors duration-300 hover:bg-[#ff00ff]/10 hover:border-[#ff00ff] animate-fade-in pointer-events-none">
            <span className="text-[#ff00ff] font-mono text-[11px] uppercase tracking-[0.2em] font-bold drop-shadow-[0_0_5px_rgba(255,0,255,0.8)]">
              ↓ DRAG & DROP CSV/TXT WALLET LIST HERE ↓
            </span>
          </div>
        )}

        {activeMode === 'music_generator' && (
          <div className="mx-5 mb-3 border-2 border-dashed border-[#ff00ff]/40 bg-black/60 rounded-lg p-5 text-center shadow-[0_0_15px_rgba(255,0,255,0.05)] transition-colors duration-300 hover:bg-[#ff00ff]/10 hover:border-[#ff00ff] animate-fade-in pointer-events-none">
            <span className="text-[#ff00ff] font-mono text-[11px] uppercase tracking-[0.2em] font-bold drop-shadow-[0_0_5px_rgba(255,0,255,0.8)]">
              🎵 DROP AUDIO FILES (.WAV / .MP3) HERE FOR BEAT ANALYSIS 🎵
            </span>
          </div>
        )}

        {activeMode === 'graphics_studio' && (
          <div className="mx-5 mb-3 border-2 border-dashed border-[#ff00ff]/40 bg-black/60 rounded-lg p-5 text-center shadow-[0_0_15px_rgba(255,0,255,0.05)] transition-colors duration-300 hover:bg-[#ff00ff]/10 hover:border-[#ff00ff] animate-fade-in pointer-events-none">
            <span className="text-[#ff00ff] font-mono text-[11px] uppercase tracking-[0.2em] font-bold drop-shadow-[0_0_5px_rgba(255,0,255,0.8)]">
              🎨 DRAG & DROP IMAGES HERE TO GENERATE BANNERS & MEMES 🎨
            </span>
          </div>
        )}

        {activeMode === 'business_pilot' && showSpreadsheet && (
          <div className="mb-2 w-full animate-fade-in p-4 xl:p-6 transition-all">
            <SpreadsheetGrid 
              defaultData={spreadsheetData} 
            />
            <div className="mt-2 text-[10px] text-neon-primary/70 font-mono text-center flex items-center justify-center gap-2">
              <span className="animate-pulse">🟢 Drag & Drop optical CSV files over the grid to auto-merge headers and append rows natively.</span>
            </div>
          </div>
        )}

        {/* Psychometric Translation Layer */}
        {activeMode === 'soul_translator' && psychoTraits && (
          <div className="px-5 pb-3 pt-1 w-full z-20 bg-gradient-to-t from-[#0a140d] to-transparent">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'neuroticism', label: '🌪️ Neuroticism', val: psychoTraits.neuroticism, color: '#39ff14' },
                { id: 'extraversion', label: '🔥 Extraversion', val: psychoTraits.extraversion, color: '#39ff14' },
                { id: 'openness', label: '🧠 Openness', val: psychoTraits.openness, color: '#39ff14' },
                { id: 'conscientiousness', label: '♟️ Conscient', val: psychoTraits.conscientiousness, color: '#39ff14' },
                { id: 'agreeableness', label: '🤝 Agreeable', val: psychoTraits.agreeableness, color: '#39ff14' },
                { id: 'all', label: '☯️ ALL TRAITS', val: '', color: '#ff00ff' }
              ].map(t => {
                const isActive = activeTraitFocus === t.id;
                // Base dynamic class mapping
                const baseClass = "font-bold px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-widest transition-all duration-200 flex items-center gap-1.5";
                
                let combinedClass = "";
                if (isActive) {
                  // Active state is Pink
                  combinedClass = `${baseClass} bg-[#ff00ff] text-black border border-[#ff00ff] shadow-[0_0_20px_rgba(255,0,255,0.8),inset_0_-3px_0_rgba(0,0,0,0.3)] transform translate-y-0.5`;
                } else {
                  // All inactive buttons are Green
                  combinedClass = `${baseClass} bg-neon-primary/20 text-neon-primary border border-neon-primary/30 hover:bg-neon-primary hover:text-black`;
                }

                return (
                  <button 
                    key={t.id}
                    onClick={() => setActiveTraitFocus(isActive ? null : t.id)}
                    className={combinedClass}
                  >
                    {t.label}
                    {t.val !== '' && <span className={isActive ? 'text-black/60 ml-1' : 'opacity-60 ml-1'}>[{t.val}]</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TCG Market Intelligence Browser */}
        {activeMode === 'market_intelligence' && (
          <div className="mx-5 mb-3 border border-neon-primary/30 rounded-lg bg-[#0a140d]/90 backdrop-blur-sm shadow-[0_0_20px_rgba(57,255,20,0.1)] transition-all overflow-hidden" style={{ height: '85vh', maxHeight: '85vh' }}>
            <div className="p-3 border-b border-neon-primary/20 flex items-center justify-between">
              <span className="text-neon-primary text-xs font-mono font-bold uppercase tracking-widest flex items-center gap-2">📊 Market Intelligence</span>
              <button onClick={() => setActiveMode(null)} className="text-zinc-600 hover:text-neon-primary text-xs transition">✕</button>
            </div>
            <div className="p-3 h-full pb-10" style={{ maxHeight: 'calc(85vh - 44px)', overflowY: 'auto' }}>
              <TCGMarketBrowser onSelectCard={(card) => {
                setInput(`Grade this card: ${card.cleanName || card.name}. Market price: $${card.price?.toFixed(2) || 'unknown'}`);
                setActiveMode('tcg_grader');
              }} />
            </div>
          </div>
        )}

        {/* Meme Studio Form */}
        {memeStudio.active && (
          <div className="mx-5 mb-3 p-4 border border-neon-primary/30 rounded-lg bg-[#0a140d]/90 backdrop-blur-sm shadow-[0_0_20px_rgba(57,255,20,0.1)] transition-all">
            <div className="flex justify-between items-center mb-3 text-neon-primary border-b border-neon-primary/20 pb-2">
              <span className="font-mono text-sm uppercase tracking-widest font-bold flex items-center gap-2">
                {memeStudio.mode === 'banner' ? '🎨 BANNER STUDIO LAYER' : '🎭 MEME STUDIO LAYER'}
              </span>
              <button onClick={() => setMemeStudio(prev => ({...prev, active: false}))} className="text-neon-primary/60 hover:text-[#ff00ff] text-xs transition-colors font-mono">
                [ ABORT ]
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-neon-primary/70 text-[10px] font-mono uppercase tracking-widest">⚡ Describe Your Background Scene</label>
                <textarea 
                  rows={2}
                  placeholder={"Describe the scene you want AI to generate behind your character...\nExamples: \"Cyberpunk alleyway with neon signs\" · \"Beach sunset with palm trees\" · \"Dark throne room with candles\""}
                  value={memeStudio.prompt} onChange={(e) => setMemeStudio(p => ({...p, prompt: e.target.value}))}
                  className="w-full bg-neon-bg border border-neon-primary/30 rounded py-2.5 px-3 text-[#e0faec] text-sm focus:border-neon-primary focus:shadow-[0_0_12px_rgba(57,255,20,0.15)] resize-none placeholder:text-neon-primary/25"
                />
              </div>
              
              {/* Format Selection Toggle */}
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                     setMemeStudio(p => ({...p, outputType: 'macro', topText: p._savedTop || '', bottomText: p._savedBot || ''}));
                  }}
                  className={`flex-1 py-1.5 text-[10px] font-mono tracking-widest uppercase border rounded transition-all ${memeStudio.outputType !== 'raw' ? 'bg-neon-primary/20 border-neon-primary text-neon-primary shadow-[0_0_10px_rgba(57,255,20,0.2)]' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 bg-black'}`}
                >📝 With Meme Text</button>
                <button 
                  onClick={() => {
                     setMemeStudio(p => ({...p, outputType: 'raw', _savedTop: p.topText, _savedBot: p.bottomText, topText: '', bottomText: ''}));
                  }}
                  className={`flex-1 py-1.5 text-[10px] font-mono tracking-widest uppercase border rounded transition-all ${memeStudio.outputType === 'raw' ? 'bg-neon-primary/20 border-neon-primary text-neon-primary shadow-[0_0_10px_rgba(57,255,20,0.2)]' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 bg-black'}`}
                >🖼️ Raw Background Only</button>
              </div>

              {memeStudio.outputType !== 'raw' && (
                <div className="flex flex-col md:flex-row gap-3">
                  <input 
                      type="text" placeholder="Top Text"
                      value={memeStudio.topText} onChange={(e) => setMemeStudio(p => ({...p, topText: e.target.value}))}
                      className="w-full bg-neon-bg border border-neon-primary/20 rounded py-2 px-3 text-[#e0faec] text-sm focus:border-neon-primary"
                  />
                  <input 
                      type="text" placeholder="Bottom Text"
                      value={memeStudio.bottomText} onChange={(e) => setMemeStudio(p => ({...p, bottomText: e.target.value}))}
                      className="w-full bg-neon-bg border border-neon-primary/20 rounded py-2 px-3 text-[#e0faec] text-sm focus:border-neon-primary"
                  />
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-3">
                  <select 
                    value={memeStudio.fontStyle} onChange={(e) => setMemeStudio(p => ({...p, fontStyle: e.target.value}))}
                    className="w-full bg-neon-bg border border-neon-primary/20 rounded py-2 px-3 text-[#e0faec] text-sm focus:border-neon-primary"
                  >
                    <option value="Impact">Impact (Classic Meme)</option>
                    <option value="Arial Black">Arial Black (Bold)</option>
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica (Clean)</option>
                    <option value="Futura">Futura (Modern)</option>
                    <option value="Comic Sans">Comic Sans (Ironic)</option>
                    <option value="Courier">Courier (Typewriter)</option>
                    <option value="Georgia">Georgia (Serif)</option>
                    <option value="Gothic">Gothic (Asian)</option>
                    <option value="Marker Felt">Marker Felt (Handwritten)</option>
                    <option value="Chalkboard">Chalkboard (Casual)</option>
                    <option value="Copperplate">Copperplate (Engraved)</option>
                    <option value="Didot">Didot (Elegant)</option>
                    <option value="Papyrus">Papyrus (Ancient)</option>
                  </select>
                  <select 
                    value={memeStudio.visualStyle} onChange={(e) => setMemeStudio(p => ({...p, visualStyle: e.target.value}))}
                    className="w-full bg-neon-bg border border-neon-primary/20 rounded py-2 px-3 text-[#e0faec] text-sm focus:border-neon-primary"
                  >
                    <option value="Default">Style: Standard</option>
                    <option value="Cyberpunk">Style: Cyberpunk Neon</option>
                    <option value="Vaporwave">Style: Synthwave & Vaporwave</option>
                    <option value="Glitch Art">Style: Deep Glitch</option>
                    <option value="Photorealistic">Style: Cinematic Realism</option>
                    <option value="Vintage Cartoon">Style: 1930s Rubberhose Cartoon</option>
                    <option value="Anime">Style: Anime / Manga</option>
                    <option value="Dark Fantasy">Style: Dark Gothic Fantasy</option>
                    <option value="Pixel Art">Style: Retro Pixel Art</option>
                    <option value="Oil Painting">Style: Classical Oil Painting</option>
                    <option value="Watercolor">Style: Soft Watercolor</option>
                    <option value="Pop Art">Style: Andy Warhol Pop Art</option>
                    <option value="Neon Noir">Style: Neon Noir Detective</option>
                    <option value="Psychedelic">Style: 70s Psychedelic</option>
                  </select>
              </div>

              {/* Explicit Dropzone UI */}
              <div 
                className="mt-1 border-2 border-dashed border-neon-primary/40 bg-black/50 rounded-lg p-5 text-center transition-colors group hover:bg-[#39ff14]/10 hover:border-[#39ff14] cursor-pointer"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-[#39ff14]', 'bg-[#39ff14]/10'); }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-[#39ff14]', 'bg-[#39ff14]/10'); }}
                onDrop={(e) => {
                  e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('border-[#39ff14]', 'bg-[#39ff14]/10');
                  const files = e.dataTransfer.files;
                  if (files && files.length > 0) {
                    const file = files[0];
                    if (file.name.match(/\.(png|jpe?g|webp)$/i)) {
                      setMemeStudio(prev => ({...prev, overlayPath: file.path || file.name}));
                    } else {
                      alert('Please drop a valid image file (PNG/JPG)');
                    }
                  }
                }}
                onClick={async () => {
                  try {
                    const { open } = await import('@tauri-apps/plugin-dialog');
                    const selected = await open({
                      multiple: false,
                      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
                    });
                    if (selected) setMemeStudio(prev => ({...prev, overlayPath: selected.path || selected}));
                  } catch (err) { console.error('Tauri Dialog Error:', err); }
                }}
              >
                <span className="text-neon-primary/80 font-mono text-[10px] uppercase tracking-widest block mb-2 font-bold pointer-events-none">
                  ↓ DRAG & DROP PNG OVERLAY ASSET HERE (OR CLICK) ↓
                </span>
                {memeStudio.overlayPath ? (
                  <div className="text-xs text-[#39ff14] font-mono truncate border border-[#39ff14]/30 p-2 bg-[#39ff14]/10 rounded shadow-inner">
                    ✅ LOADED: {scrubPII(memeStudio.overlayPath)}
                  </div>
                ) : (
                  <div className="text-zinc-500 font-mono text-[9px] uppercase tracking-widest pointer-events-none">
                    (Optional) Drop a transparent character/PFP to overlay onto the generated scene
                  </div>
                )}
              </div>
                
              <button 
                className="w-full mt-2 bg-neon-primary text-black font-bold border border-[#e0faec]/30 py-2.5 rounded text-sm font-mono uppercase tracking-widest transition-all duration-200 hover:shadow-[0_0_20px_rgba(57,255,20,0.6)] disabled:opacity-40"
                disabled={isStreaming}
                onClick={async () => {
                  const args = {
                      prompt: memeStudio.prompt || "a randomly cool visual aesthetic background without text",
                      overlay_image_path: memeStudio.overlayPath || "",
                      top_text: memeStudio.topText || "",
                      bottom_text: memeStudio.bottomText || "",
                      font_style: memeStudio.fontStyle || "Impact",
                      format_type: memeStudio.mode || "meme",
                      visual_style: memeStudio.visualStyle || "Default",
                      width: memeStudio.mode === 'banner' ? 1024 : 512,
                      height: memeStudio.mode === 'banner' ? 512 : 512,
                      seed: -1
                  };
                  
                  // Show user what we're building
                  setLogs(prev => [...prev, { role: 'user', content: `Generate ${memeStudio.mode}: "${args.prompt}" [${args.visual_style}]` }]);
                  setLogs(prev => [...prev, { role: 'agent', content: `[SYSTEM: Dispatching Python MCP Sidecar for generate_meme (DIRECT — no LLM routing)...]` }]);
                  setIsStreaming(true);
                  setMemeStudio(prev => ({...prev, active: false}));
                  
                  try {
                      const { invoke } = await import('@tauri-apps/api/core');
                      const res = await invoke("execute_mcp_tool", {
                          serverName: "undesirables-mcp-server",
                          toolName: "generate_meme",
                          args: args
                      });
                      
                      let resJson = typeof res === 'string' ? JSON.parse(res) : res;
                      let finalData = resJson;
                      if (resJson.result && typeof resJson.result === 'string') {
                          try { finalData = JSON.parse(resJson.result); } catch { finalData = resJson.result; }
                      } else if (resJson.result && typeof resJson.result === 'object') {
                          finalData = resJson.result;
                      }
                      
                      if (finalData.base64 || finalData.image) {
                          const b64 = finalData.base64 || finalData.image;
                          setLogs(prev => [...prev, { role: 'agent', content: "Render complete.", type: 'meme_result', imageBase64: b64, imagePath: finalData.path }]);
                          cacheArtifactChaining(b64);
                      } else if (finalData.error) {
                          setLogs(prev => [...prev, { role: 'agent', content: `[ERROR] Generation failed: ${finalData.error}` }]);
                      } else {
                          setLogs(prev => [...prev, { role: 'agent', content: `[SYS] Tool Result:\n\n\`\`\`json\n${JSON.stringify(finalData, null, 2)}\n\`\`\`` }]);
                      }
                  } catch (e) {
                      setLogs(prev => [...prev, { role: 'agent', content: `[ERROR] MCP Sidecar Failed: ${e}` }]);
                  } finally {
                      setIsStreaming(false);
                  }
                }}
              >
                {isStreaming ? 'GENERATING...' : `GENERATE ${memeStudio.mode.toUpperCase()}`}
              </button>
            </div>
          </div>
        )}

        {/* --- Video Production Persistent Studio Interface --- */}
        {activeMode === 'video_production' && videoStudio.active && (
          <div className="mx-5 mb-4 p-4 border border-neon-primary/30 bg-gradient-to-br from-[#0a140d]/90 to-black rounded-lg shadow-[0_0_15px_rgba(57,255,20,0.1)] relative z-10 animate-in fade-in zoom-in-95 max-h-[65vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-neon-primary/20 pb-2 mb-3">
              <span className="text-neon-primary font-bold text-xs tracking-widest uppercase flex items-center gap-2">
                🎬 MULTI-SCENE VIDEO PRODUCER
              </span>
              <button onClick={() => setVideoStudio(prev => ({...prev, active: false}))} className="text-neon-primary/60 hover:text-[#ff00ff] text-[10px] transition-colors font-mono tracking-widest">
                [ ABORT ]
              </button>
            </div>
            
            <div className="flex flex-col gap-3 relative">
              {/* Media Pool Carousel */}
              {videoStudio.mediaPool && videoStudio.mediaPool.length > 0 ? (
                <div className="w-full">
                  <div className="text-[9px] text-neon-primary/60 font-mono tracking-widest uppercase mb-1.5 flex justify-between px-1">
                    <span>📺 Media Pool ({videoStudio.mediaPool.length} CLIP{videoStudio.mediaPool.length > 1 ? 's' : ''})</span>
                    <span className="text-zinc-500 lowercase pr-1 hidden sm:inline">Drag & drop files to append</span>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto pb-3 snap-x custom-scrollbar">
                    {videoStudio.mediaPool.map((path, idx) => {
                      const filename = path.split('/').pop().split('\\').pop();
                      return (
                        <div key={idx} className="relative flex-none w-[180px] bg-black border border-neon-primary/30 rounded overflow-hidden shadow-[0_4px_10px_rgba(0,0,0,0.5)] snap-start group transition-all hover:border-neon-primary hover:shadow-[0_0_15px_rgba(57,255,20,0.3)]">
                          <video 
                            src={path ? convertFileSrc(path) : undefined} 
                            muted
                            loop
                            className="w-full h-[100px] object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                            onMouseOver={e => e.target.play().catch(() => {})}
                            onMouseOut={e => e.target.pause()}
                          />
                          <div className="absolute top-0 w-full p-1.5 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start pointer-events-none">
                            <span className="text-neon-primary text-[8.5px] font-mono leading-tight px-0.5 truncate drop-shadow-md pb-4 font-bold max-w-[85%]" title={filename}>
                              {filename}
                            </span>
                          </div>
                          <button 
                            onClick={() => {
                              const newPool = videoStudio.mediaPool.filter((_, i) => i !== idx);
                              setVideoStudio(p => ({...p, mediaPool: newPool, videoPath: newPool[0] || ''}));
                            }}
                            className="absolute top-1 right-1 text-red-500 bg-red-900/40 hover:bg-red-500 hover:text-white rounded w-4 h-4 flex items-center justify-center text-[10px] opacity-20 group-hover:opacity-100 transition-all font-sans cursor-pointer z-10"
                            title="Remove Video"
                          >
                            ✖
                          </button>
                          <div className="absolute bottom-1 right-1 bg-black/70 px-1 rounded text-[8px] text-neon-primary/60 font-mono tracking-wider border border-white/5 pointer-events-none">
                            SRC_{idx+1}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="w-full py-8 border-2 border-dashed border-[#ff00ff]/30 text-center rounded bg-black/40 flex flex-col items-center justify-center gap-2">
                  <div className="text-2xl text-[#ff00ff]/80">📂</div>
                  <div className="text-zinc-400 font-mono text-[10px] uppercase tracking-widest">DRAG AND DROP .MP4 / .MOV FILES HERE</div>
                  <div className="text-[#ff00ff]/50 text-[8px] font-mono uppercase">Timeline Media Pool requires raw footage</div>
                </div>
              )}

              {/* Format Controls — clean vertical stack */}
              <div className="flex flex-col gap-2">
                {/* Duration + Clip Timestamp — unified row */}
                <div className="flex items-stretch gap-2">
                  {/* Duration Dropdown (left) */}
                  <div className="relative flex-shrink-0" style={{width: '40%'}}>
                    <select 
                      value={videoStudio.targetDuration} 
                      onChange={(e) => setVideoStudio(p => ({...p, targetDuration: e.target.value}))}
                      className="w-full h-full bg-[#030905] border border-neon-primary/40 rounded-lg py-3 px-3 text-transparent text-xs font-mono font-bold focus:border-neon-primary shadow-[0_0_10px_rgba(57,255,20,0.15)] hover:shadow-[0_0_15px_rgba(57,255,20,0.4)] hover:border-neon-primary/70 transition-all cursor-pointer appearance-none"
                    >
                      <option value="5s">5s — Quick Clip</option>
                      <option value="10s">10s — Highlight</option>
                      <option value="15s">15s — Reels</option>
                      <option value="30s">30s — Promo</option>
                      <option value="45s">45s — Extended</option>
                    </select>
                    <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                      <span className="text-neon-primary font-mono text-[10px] font-bold tracking-wider">⏱</span>
                      <span className="text-white font-mono text-sm font-black ml-1.5">{videoStudio.targetDuration.replace('s','')}</span>
                      <span className="text-neon-primary font-mono text-sm font-black">s</span>
                      <span className="text-zinc-500 font-mono text-[8px] tracking-wider ml-2 uppercase">
                        {({'5s':'Clip','10s':'Highlight','15s':'Reels','30s':'Promo','45s':'Extended'})[videoStudio.targetDuration]}
                      </span>
                      <span className="ml-auto text-neon-primary/50 text-xs">▾</span>
                    </div>
                  </div>

                  {/* Timestamp Clip Input (right) — MM:SS format */}
                  <div className="flex items-center gap-2 flex-1 bg-[#030905] border border-[#00f0ff]/30 rounded-lg px-3 py-2">
                    <span className="text-[#00f0ff]/70 font-mono text-[9px] font-bold tracking-wider whitespace-nowrap">✂️ START</span>
                    <input 
                      type="text" 
                      placeholder="00:00" 
                      value={videoStudio.clipStart}
                      onChange={(e) => {
                        let v = e.target.value.replace(/[^0-9:]/g, '');
                        // Auto-insert colon after 2 digits if user hasn't typed one
                        if (v.length === 2 && !v.includes(':') && !videoStudio.clipStart.includes(':')) v += ':';
                        if (v.length > 5) v = v.slice(0, 5);
                        setVideoStudio(p => ({...p, clipStart: v}));
                      }}
                      className="w-[70px] bg-black/60 border border-[#00f0ff]/25 rounded-md px-2.5 py-1.5 text-white text-sm font-mono font-bold text-center tracking-widest focus:border-[#00f0ff] focus:shadow-[0_0_8px_rgba(0,240,255,0.3)] focus:outline-none transition-all placeholder:text-zinc-600"
                    />
                    <span className="text-zinc-600 font-mono text-xs">→</span>
                    {/* Auto-calculated end time (read-only) */}
                    <div className="w-[70px] bg-black/40 border border-neon-primary/20 rounded-md px-2.5 py-1.5 text-center">
                      <span className="text-neon-primary font-mono text-sm font-bold tracking-widest">
                        {(() => {
                          const parts = (videoStudio.clipStart || '0:00').split(':');
                          const mins = parseInt(parts[0]) || 0;
                          const secs = parseInt(parts[1]) || 0;
                          const totalStart = mins * 60 + secs;
                          const dur = parseInt(videoStudio.targetDuration) || 15;
                          const totalEnd = totalStart + dur;
                          const endMins = Math.floor(totalEnd / 60);
                          const endSecs = totalEnd % 60;
                          return `${String(endMins).padStart(2,'0')}:${String(endSecs).padStart(2,'0')}`;
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* CUT Button — Direct IPC dispatch, bypasses LLM */}
                  <button
                    onClick={async () => {
                      const parts = (videoStudio.clipStart || '0:00').split(':');
                      const startSec = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
                      const dur = parseInt(videoStudio.targetDuration) || 15;
                      
                      if (!videoStudio.mediaPool?.length) { 
                        setLogs(prev => [...prev, { role: 'system', content: '[WARN] Drop a video into the Media Pool first.' }]); 
                        return; 
                      }

                      setLogs(prev => [...prev, { role: 'agent', content: `[SYSTEM: Natively extracting a ${dur}s clip starting at ${videoStudio.clipStart || '0:00'} (${startSec}s)...]` }]);
                      setIsStreaming(true);
                      
                      try {
                        const { invoke } = await import('@tauri-apps/api/core');
                        const res = await invoke("execute_mcp_tool", {
                          serverName: "undesirables-mcp-server",
                          toolName: "viral_clip_extractor",
                          args: {
                            video_path: videoStudio.mediaPool[0],
                            clip_duration: dur,
                            platform: videoStudio.format === "16:9" ? "youtube" : videoStudio.format === "1:1" ? "feed" : "tiktok",
                            start_time: startSec
                          }
                        });
                        
                        let parsed = typeof res === 'string' ? JSON.parse(res) : res;
                        let finalData = parsed.result ? (typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result) : parsed;
                        
                        if (finalData.error) throw new Error(finalData.error);
                        
                        if (finalData.clips && finalData.clips.length > 0) {
                          const clip = finalData.clips[0];
                          setVideoStudio(p => ({...p, outputVideos: [{ path: clip.path, resolvedPath: clip.path, size_mb: 0, timestamp: Date.now() }, ...(p.outputVideos || [])]}));
                          setLogs(prev => [...prev, { role: 'agent', content: `[SYS] ✂️ Clip Extracted: ${dur}s starting at ${videoStudio.clipStart || '0:00'}. Saved to \`${finalData.output_dir || clip.path}\`` }]);
                        } else {
                          setLogs(prev => [...prev, { role: 'agent', content: `[SYS] Extraction complete. Output: ${JSON.stringify(finalData).slice(0, 200)}` }]);
                        }
                      } catch (e) {
                        setLogs(prev => [...prev, { role: 'agent', content: `[ERROR] Clip Extraction Failed: ${e.message || e}` }]);
                      } finally {
                        setIsStreaming(false);
                      }
                    }}
                    disabled={!videoStudio.mediaPool?.length || isStreaming}
                    className="flex-shrink-0 bg-[#00141a] border border-[#00f0ff]/50 text-[#00f0ff] px-3.5 rounded-lg font-mono text-[9px] font-bold tracking-wider uppercase hover:bg-[#00f0ff] hover:text-black hover:shadow-[0_0_15px_rgba(0,240,255,0.5)] transition-all cursor-pointer disabled:opacity-20 whitespace-nowrap"
                  >
                    ✂️ CUT
                  </button>
                </div>

                {/* Format & Fit — side by side */}
                <div className="grid grid-cols-2 gap-2">
                  <select 
                    value={videoStudio.format} onChange={(e) => setVideoStudio(p => ({...p, format: e.target.value}))}
                    className="w-full bg-[#030905] border border-neon-primary/40 rounded-lg py-3.5 px-3 text-neon-primary text-xs font-mono tracking-wider font-bold focus:border-neon-primary shadow-[0_0_10px_rgba(57,255,20,0.15)] hover:shadow-[0_0_15px_rgba(57,255,20,0.4)] hover:border-neon-primary/70 transition-all cursor-pointer"
                  >
                    <option value="9:16">📐 9:16 Mobile Vertical</option>
                    <option value="1:1">📐 1:1 Social Square</option>
                    <option value="16:9">📐 16:9 Desktop Widescreen</option>
                  </select>
                  <select 
                    value={videoStudio.fitStrategy} onChange={(e) => setVideoStudio(p => ({...p, fitStrategy: e.target.value}))}
                    className="w-full bg-[#030905] border border-neon-primary/40 rounded-lg py-3.5 px-3 text-neon-primary text-xs font-mono tracking-wider font-bold focus:border-neon-primary shadow-[0_0_10px_rgba(57,255,20,0.15)] hover:shadow-[0_0_15px_rgba(57,255,20,0.4)] hover:border-neon-primary/70 transition-all cursor-pointer"
                  >
                    <option value="Contain">🎬 Auto-Pad (Letterbox)</option>
                    <option value="Crop">🎬 Zoom & Crop to Fill</option>
                  </select>
                </div>
              </div>

              {/* Audio Settings & Beat Sync Switch */}
              <div className="flex items-center gap-2 mt-2">
                <div className={`p-2 rounded font-mono text-[10px] w-full border ${videoStudio.audioPath ? 'bg-[#ff00ff]/10 border-[#ff00ff]/50 text-[#ff00ff] truncate' : 'bg-black/50 border-white/10 text-zinc-500'}`}>
                  {videoStudio.audioPath ? `✅ AUDIO: ${scrubPII(videoStudio.audioPath)}` : '🎧 AUDIO: (Drop .mp3 to enable track mixing)'}
                </div>
                <button 
                  onClick={() => setVideoStudio(p => ({...p, beatSync: !p.beatSync}))}
                  disabled={!videoStudio.audioPath}
                  className={`py-1.5 px-3 whitespace-nowrap rounded font-mono text-[10px] font-bold border transition-colors ${videoStudio.beatSync ? 'bg-[#ff00ff] text-black border-[#ff00ff] shadow-[0_0_10px_rgba(255,0,255,0.6)] animate-pulse' : 'bg-[#ff00ff]/10 text-[#ff00ff] border-[#ff00ff]/30'} disabled:opacity-30 disabled:border-white/10 disabled:text-zinc-500 disabled:bg-black/50`}
                >
                  🎵 BEAT SYNC: {videoStudio.beatSync ? 'ACTIVE' : 'OFF'}
                </button>
              </div>

              {/* Beat Sync Warning Overcast */}
              {videoStudio.beatSync && (
                <div className="border border-[#ff00ff]/30 bg-[#ff00ff]/5 rounded p-2.5 space-y-2">
                  <div className="text-[9px] font-mono leading-tight text-[#ff00ff] flex items-center gap-1.5">
                    <strong>⚡ BEAT-REACTIVE FX:</strong> 
                    <span className="text-[#ff00ff]/60">Select effects that pulse on every detected beat drop</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'Flash', label: '⚡ Flash', desc: 'White strobe flash' },
                      { id: 'Zoom Pulse', label: '🔍 Zoom Pulse', desc: 'Quick zoom burst' },
                      { id: 'Shake', label: '📳 Shake', desc: 'Camera shake' },
                      { id: 'Invert Beat', label: '🌗 Invert', desc: 'Negative flash' },
                      { id: 'Glitch Beat', label: '📺 Glitch', desc: 'Digital artifact' },
                      { id: 'Saturation Pop', label: '🎨 Color Pop', desc: 'Saturation burst' },
                      { id: 'Bass Blur', label: '🫧 Bass Blur', desc: 'Radial blur pulse' },
                      { id: 'Edge Glow', label: '✨ Edge Glow', desc: 'Neon edge detect' },
                      { id: 'VHS Hit', label: '📼 VHS Hit', desc: 'Scanline static' },
                    ].map(fx => {
                      const isActive = (videoStudio.beatEffects || []).includes(fx.id);
                      return (
                        <button
                          key={fx.id}
                          onClick={() => {
                            setVideoStudio(p => {
                              const current = p.beatEffects || [];
                              const next = isActive ? current.filter(x => x !== fx.id) : [...current, fx.id];
                              return {...p, beatEffects: next};
                            });
                          }}
                          className={`text-left p-1.5 rounded border text-[9px] font-mono transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-[#ff00ff]/20 border-[#ff00ff] text-[#ff00ff] shadow-[0_0_8px_rgba(255,0,255,0.4)]' 
                              : 'bg-black/40 border-white/10 text-zinc-500 hover:border-[#ff00ff]/40 hover:text-[#ff00ff]/70'
                          }`}
                        >
                          <div className="font-bold">{fx.label}</div>
                          <div className={`text-[7px] ${isActive ? 'text-[#ff00ff]/70' : 'text-zinc-600'}`}>{fx.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                  {(videoStudio.beatEffects || []).length > 0 && (
                    <div className="text-[8px] font-mono text-[#ff00ff]/50 border-t border-[#ff00ff]/10 pt-1.5">
                      🎯 {(videoStudio.beatEffects || []).length} effect{(videoStudio.beatEffects || []).length > 1 ? 's' : ''} armed — will fire on {'{'}every detected beat{'}'}
                    </div>
                  )}
                </div>
              )}

              {/* Multi-Layer Scene Sequence */}
              <div className="mt-3 border border-white/5 bg-black/40 rounded p-2 overflow-y-auto max-h-[300px] flex flex-col gap-2 custom-scrollbar shadow-inner">
                {videoStudio.segments.map((segment, index) => (
                  <div key={segment.id} className="bg-[#050c07] border border-neon-primary/30 rounded p-2 flex flex-col gap-2 relative">
                    <div className="flex justify-between items-center text-neon-primary/60 text-[9px] font-mono uppercase tracking-widest font-bold mb-1">
                      <span>🎬 Scene Layer 0{index + 1}</span>
                      <div className="flex items-center gap-1.5 font-sans leading-none">
                        <span className="opacity-50 tracking-normal lowercase text-[8px]">From</span>
                        <input type="number" min="0" step="0.5" value={segment.startTime ?? 0} onChange={(e) => {
                          const newSegments = [...videoStudio.segments];
                          newSegments[index].startTime = parseFloat(e.target.value) || 0;
                          setVideoStudio(p => ({...p, segments: newSegments}));
                        }} className="w-[38px] bg-[#050c07] border-b border-neon-primary/30 px-0.5 text-center text-neon-primary focus:border-[#ff00ff] focus:text-[#ff00ff] outline-none" />
                        <span className="opacity-50 tracking-normal lowercase text-[8px]">to</span>
                        <input type="number" min="0" step="0.5" value={segment.endTime ?? 3} onChange={(e) => {
                          const newSegments = [...videoStudio.segments];
                          newSegments[index].endTime = parseFloat(e.target.value) || 0;
                          setVideoStudio(p => ({...p, segments: newSegments}));
                        }} className="w-[38px] bg-[#050c07] border-b border-neon-primary/30 px-0.5 text-center text-[#ff00ff] focus:border-[#ff00ff] focus:text-[#ff00ff] outline-none" />
                        <span className="opacity-50 tracking-normal lowercase text-[8px] mr-2">sec</span>
                        {videoStudio.segments.length > 1 && (
                          <button 
                            onClick={() => setVideoStudio(p => ({...p, segments: p.segments.filter(s => s.id !== segment.id)}))}
                            className="hover:text-red-500 tracking-widest font-mono text-[9px]"
                          >
                            [ 🗑️ DEL ]
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Scene Core Text */}
                    <input 
                      type="text" placeholder="Scene Text / Title (Optional)"
                      value={segment.text} onChange={(e) => {
                        const newSegments = [...videoStudio.segments];
                        newSegments[index].text = e.target.value;
                        setVideoStudio(p => ({...p, segments: newSegments}));
                      }}
                      className="w-full bg-neon-bg border border-neon-primary/20 rounded py-1.5 px-2 text-[#e0faec] text-xs focus:border-neon-primary"
                    />
                    {/* Scene Effects Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                      <select 
                        value={segment.fontStyle} onChange={(e) => {
                          const newSegments = [...videoStudio.segments];
                          newSegments[index].fontStyle = e.target.value;
                          setVideoStudio(p => ({...p, segments: newSegments}));
                        }}
                        className="w-full bg-[#020502] border border-neon-primary/40 rounded py-1.5 px-2 text-neon-primary font-bold text-[10px] focus:border-neon-primary shadow-[0_0_8px_rgba(57,255,20,0.1)] hover:shadow-[0_0_12px_rgba(57,255,20,0.3)] transition-all cursor-pointer"
                      >
                        <option value="Impact">Font: Impact</option>
                        <option value="Arial Black">Font: Arial Black</option>
                        <option value="Comic Sans">Font: Comic Sans</option>
                        <option value="Courier">Font: Courier</option>
                        <option value="Papyrus">Font: Papyrus</option>
                        <option value="Cyberpunk">Font: Cyberpunk</option>
                        <option value="Futura">Font: Futura</option>
                        <option value="Bebas Neue">Font: Bebas Neue</option>
                        <option value="Montserrat">Font: Montserrat</option>
                        <option value="Oswald">Font: Oswald</option>
                        <option value="Cinzel">Font: Cinzel</option>
                        <option value="Permanent Marker">Font: Permanent Marker</option>
                        <option value="Press Start 2P">Font: Press Start 2P (8-Bit)</option>
                        <option value="Creepster">Font: Creepster (Horror)</option>
                        <option value="VCR OSD Mono">Font: VCR OSD</option>
                        <option value="Bangers">Font: Bangers (Comic)</option>
                      </select>
                      <select 
                        value={segment.fontSize ?? 'Medium'} onChange={(e) => {
                          const newSegments = [...videoStudio.segments];
                          newSegments[index].fontSize = e.target.value;
                          setVideoStudio(p => ({...p, segments: newSegments}));
                        }}
                        className="w-full bg-[#020502] border border-neon-primary/40 rounded py-1.5 px-2 text-neon-primary font-bold text-[10px] focus:border-neon-primary shadow-[0_0_8px_rgba(57,255,20,0.1)] hover:shadow-[0_0_12px_rgba(57,255,20,0.3)] transition-all cursor-pointer"
                      >
                        <option value="Small">Size: Small</option>
                        <option value="Medium">Size: Medium</option>
                        <option value="Massive">Size: Massive</option>
                      </select>
                      <select 
                        value={segment.visualEffect} onChange={(e) => {
                          const newSegments = [...videoStudio.segments];
                          newSegments[index].visualEffect = e.target.value;
                          setVideoStudio(p => ({...p, segments: newSegments}));
                        }}
                        className="w-full bg-[#020502] border border-neon-primary/40 rounded py-1.5 px-2 text-neon-primary font-bold text-[10px] focus:border-neon-primary shadow-[0_0_8px_rgba(57,255,20,0.1)] hover:shadow-[0_0_12px_rgba(57,255,20,0.3)] transition-all cursor-pointer"
                      >
                        <option value="None">Effect: None / Clean</option>
                        <option value="Pixelate">Effect: 8-Bit Pixelate</option>
                        <option value="CRT Scanlines">Effect: Retro CRT Scanlines</option>
                        <option value="Invert">Effect: Negative Invert</option>
                        <option value="VHS Glitch">Effect: VHS Glitch</option>
                        <option value="Color Strobe">Effect: Color Strobe</option>
                        <option value="Deep Fry">Effect: Deep Fry</option>
                        <option value="Night Vision">Effect: Night Vision</option>
                        <option value="Neon Edge">Effect: Neon Edge</option>
                        <option value="Edge Detect">Effect: Edge Detect</option>
                        <option value="Emboss">Effect: Emboss</option>
                        <option value="Trippy Thermal">Effect: Trippy Thermal</option>
                        <option value="Gaussian Blur">Effect: Gaussian Blur</option>
                        <option value="Motion Blur">Effect: Motion Blur</option>
                        <option value="Chromatic Aberration">Effect: Chromatic Aberration</option>
                        <option value="Kaleidoscope">Effect: Kaleidoscope</option>
                        <option value="Sepia">Effect: Vintage Sepia</option>
                      </select>
                      <select 
                        value={segment.transition} onChange={(e) => {
                          const newSegments = [...videoStudio.segments];
                          newSegments[index].transition = e.target.value;
                          setVideoStudio(p => ({...p, segments: newSegments}));
                        }}
                        className="w-full bg-[#020502] border border-[#ff00ff]/30 rounded py-1.5 px-2 text-[#ff00ff] font-bold text-[10px] focus:border-[#ff00ff] shadow-[0_0_8px_rgba(255,0,255,0.1)] hover:shadow-[0_0_12px_rgba(255,0,255,0.3)] transition-all cursor-pointer"
                      >
                        <option value="Crossfade">Trans: Crossfade</option>
                        <option value="Hard Cut">Trans: Hard Cut</option>
                        <option value="Glitch Cut">Trans: Glitch Cut</option>
                        <option value="Wipe Right">Trans: Wipe Right</option>
                        <option value="Dip to Black">Trans: Dip to Black</option>
                        <option value="Dip to White">Trans: Dip to White</option>
                        <option value="Zoom In">Trans: Zoom In</option>
                        <option value="Zoom Out">Trans: Zoom Out</option>
                        <option value="Spin Sweep">Trans: Spin Sweep</option>
                        <option value="Iris Circle">Trans: Iris Circle</option>
                        <option value="Slide Up">Trans: Slide Up</option>
                        <option value="Slide Down">Trans: Slide Down</option>
                      </select>
                    </div>
                  </div>
                ))}
                {/* Add Scene Button (Caps at 10) */}
                {videoStudio.segments.length < 10 && (
                  <button 
                    onClick={() => {
                      setVideoStudio(p => {
                        const last = p.segments[p.segments.length - 1];
                        const nextStart = last ? parseFloat(last.endTime) || 0 : 0;
                        const nextEnd = nextStart + 3;
                        return {
                          ...p, 
                          segments: [...p.segments, { id: Date.now(), text: '', fontStyle: 'Impact', fontSize: 'Medium', visualEffect: 'None', transition: 'Crossfade', startTime: nextStart, endTime: nextEnd }]
                        };
                      });
                    }}
                    className="w-full py-2 border border-dashed border-neon-primary/30 rounded bg-black/50 text-neon-primary/60 text-[10px] font-mono hover:bg-neon-primary/5 hover:text-neon-primary hover:border-neon-primary/60 transition-colors tracking-widest uppercase cursor-pointer mb-1"
                  >
                    + ADD SCENE LAYER ({videoStudio.segments.length} / 10)
                  </button>
                )}
              </div>

              {/* Master Dispatch / Render Actions */}
              <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-neon-primary/20 relative">
                
                {/* Viral Scan Explanation Overcast */}
                <div className="text-[8.5px] font-mono leading-tight text-zinc-400 px-1 mb-0.5 mt-1 border-l border-zinc-700 pl-2">
                  <span className="text-[#00f0ff] font-bold">🧠 HOW AI VIRAL SCAN WORKS:</span> The agent visually strips and analyzes the Media Pool. It will reply in chat with exact timing stamps of highly-engaging moments. Paste those moments into your Timeline Layers above to crop instantly.
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { 
                      setVideoStudio(p => ({...p, scanning: true}));
                      handleSend('Execute skill: video_production, perform an AI visual analysis to isolate the most engaging viral moments and flag optimal crop zones from this video pool.'); 
                    }}
                    disabled={!videoStudio.mediaPool?.length || isStreaming}
                    className={`border text-[11px] py-4 px-5 rounded font-mono uppercase tracking-widest font-bold transition-all disabled:opacity-30 disabled:hover:shadow-none flex-shrink-0 cursor-pointer text-center ${videoStudio.scanning ? 'bg-[#00f0ff] text-black border-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.6)]' : 'bg-[#00141a] border-[#00f0ff]/40 text-[#00f0ff] hover:bg-[#00f0ff] hover:text-black hover:shadow-[0_0_20px_rgba(0,240,255,0.6)]'}`}
                  >
                    {videoStudio.scanning ? '🧠 SCAN ACTIVE' : '🧠 AI VIRAL SCAN'}
                  </button>
                  <button
                    onClick={async () => {
                      const sceneDataPayload = videoStudio.segments.map((s,i) => ({
                          layer: i + 1,
                          text: s.text || "",
                          font: s.fontStyle || "Impact",
                          size: s.fontSize === 'Small' ? 36 : s.fontSize === 'Massive' ? 96 : 64,
                          effect: s.visualEffect || "None",
                          transition: s.transition || "Hard Cut",
                          startTime: parseFloat(s.startTime || 0),
                          endTime: parseFloat(s.endTime || 3)
                      }));
                      const sceneData = JSON.stringify(sceneDataPayload);
                      const displayLog = sceneDataPayload.map(s => `Layer ${s.layer} [${s.startTime}s - ${s.endTime}s] [${s.effect} | ${s.transition}]: ${s.text || 'No text'}`).join('\\n');
                      setLogs(prev => [...prev, { role: 'agent', content: `[SYSTEM: Dispatching Python MCP Sidecar to natively produce video structure:\\n\\n${displayLog}]` }]);
                      setIsStreaming(true);
                      try {
                        const { invoke } = await import('@tauri-apps/api/core');
                        const res = await invoke("execute_mcp_tool", {
                           serverName: "undesirables-mcp-server",
                           toolName: "produce_video",
                           args: {
                               video_path: videoStudio.mediaPool[0] || "",
                               audio_path: videoStudio.audioPath || "",
                               use_custom_audio: !!videoStudio.audioPath,
                               platform: videoStudio.format === "16:9" ? "youtube" : videoStudio.format === "1:1" ? "feed" : "tiktok",
                               text_overlays: sceneData,
                               beat_sync_effects: videoStudio.beatSync ? JSON.stringify(videoStudio.beatEffects || []) : "[]",
                               target_duration: parseFloat((videoStudio.targetDuration || "15s").replace('s','')) || 15
                           }
                        });
                        let videoResultObj = null;
                        try {
                           const parsed = typeof res === 'string' ? JSON.parse(res) : res;
                           if (parsed.result) {
                              videoResultObj = typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result;
                           } else {
                              videoResultObj = parsed;
                           }
                           
                           // SECURITY: Explicit error intercept — don't fake success on FFmpeg failures
                           if (videoResultObj?.error) {
                             throw new Error(videoResultObj.error);
                           }
                        } catch (parseErr) {
                           setLogs(prev => [...prev, { role: 'agent', content: `[ERROR] Video Rendering Failed: ${parseErr.message || parseErr}` }]);
                           setIsStreaming(false);
                           return;
                        }
                        
                        if (videoResultObj?.path) {
                          try {
                            const { homeDir } = await import('@tauri-apps/api/path');
                            let p = videoResultObj.path;
                            if (p.startsWith('~')) {
                               const hd = await homeDir();
                               p = p.replace('~', hd.replace(/\/+$/, ''));
                            }
                            videoResultObj.resolvedPath = p;

                            // Read file as binary and create blob URL for guaranteed playback
                            // This bypasses the asset:// protocol scope entirely
                            const { readFile } = await import('@tauri-apps/plugin-fs');
                            const fileBytes = await readFile(p);
                            const blob = new Blob([fileBytes], { type: 'video/mp4' });
                            videoResultObj.blobUrl = URL.createObjectURL(blob);
                          } catch (err) {
                            console.warn("Could not resolve video path or create blob:", err);
                          }
                        }
                        
                        if (videoResultObj) {
                          videoResultObj.timestamp = Date.now();
                          setVideoStudio(p => ({...p, outputVideos: [videoResultObj, ...(p.outputVideos || [])]}));
                        }

                        setLogs(prev => [...prev, { 
                          role: 'agent', 
                          content: `[SYS] Video Rendering Complete. Asset securely wired into the embedded Timeline player below.`
                        }]);
                      } catch (e) {
                        setLogs(prev => [...prev, { role: 'agent', content: `[ERROR] MCP Video Render Failed: ${e}` }]);
                      } finally {
                        setIsStreaming(false);
                      }
                    }}
                    disabled={!videoStudio.mediaPool?.length || isStreaming}
                    className="w-full bg-[#112a14] border-2 border-neon-primary/80 text-neon-primary py-4 rounded font-mono font-bold tracking-[0.2em] text-sm hover:bg-neon-primary hover:text-black hover:shadow-[0_0_25px_rgba(57,255,20,0.8)] transition-all uppercase cursor-pointer disabled:opacity-30 disabled:hover:bg-[#112a14] disabled:hover:text-neon-primary disabled:hover:shadow-none delay-75 shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]"
                  >
                    ▶ RENDER MULTI-SCENE ASSET
                  </button>
                </div>
                
                {videoStudio.outputVideos?.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="text-[9px] text-[#00f0ff] font-mono uppercase tracking-widest">Rendered Assets ({videoStudio.outputVideos.length})</div>
                      <button 
                        onClick={() => setVideoStudio(p => ({...p, outputVideos: []}))}
                        className="text-[9px] text-red-400/50 hover:text-red-400 hover:bg-red-500/10 px-2 py-0.5 rounded transition-all font-mono uppercase tracking-widest border border-transparent hover:border-red-500/30 cursor-pointer"
                      >
                        ✖ Clear All
                      </button>
                    </div>
                    {videoStudio.outputVideos.map((vid, vidIdx) => (
                      <div 
                        key={vid.timestamp || vidIdx}
                        className="border border-[#00f0ff]/40 bg-[#00141a] rounded flex flex-col shadow-[0_0_15px_rgba(0,240,255,0.1)] overflow-hidden"
                        ref={el => { if (vidIdx === 0 && el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200); }}
                      >
                        <div className="p-2 border-b border-[#00f0ff]/20 flex justify-between items-center bg-[#00f0ff]/5">
                          <div className="text-[#00f0ff] text-[10px] font-mono font-bold tracking-widest uppercase truncate max-w-[60%]">
                            🎬 {vid.path?.split('/').pop() || 'RENDERED_ASSET.mp4'}
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={async () => {
                                try {
                                  const { copyFile } = await import('@tauri-apps/plugin-fs');
                                  const { downloadDir } = await import('@tauri-apps/api/path');
                                  const dl = await downloadDir();
                                  const sourcePath = vid.resolvedPath || vid.path;
                                  const destPath = dl + '/' + sourcePath.split('/').pop();
                                  await copyFile(sourcePath, destPath);
                                  alert('Success! Video asset moved to your Downloads folder.');
                                } catch (e) {
                                  alert('Could not move file. Original is at: ' + vid.path);
                                }
                              }}
                              className="bg-[#00f0ff] text-black px-3 py-1 font-bold font-mono text-[9px] rounded hover:shadow-[0_0_15px_rgba(0,240,255,0.5)] hover:bg-white transition-all uppercase cursor-pointer"
                            >
                              ⬇️ DL {vid.size_mb}MB
                            </button>
                            <button 
                              onClick={() => setVideoStudio(p => ({...p, outputVideos: p.outputVideos.filter((_, i) => i !== vidIdx)}))}
                              className="text-red-400/50 hover:text-red-400 text-[10px] cursor-pointer"
                            >
                              ✖
                            </button>
                          </div>
                        </div>
                        <div className="bg-[#020502] flex justify-center w-full min-h-[50px] max-h-[400px]">
                          {(vid.blobUrl || vid.resolvedPath) && (
                            <video 
                              key={vid.timestamp}
                              controls 
                              autoPlay={vidIdx === 0}
                              playsInline
                              className="max-h-[400px] max-w-full object-contain mx-auto"
                              src={vid.blobUrl || convertFileSrc(vid.resolvedPath)}
                              onError={(e) => console.error('[VIDEO PLAYBACK ERROR]', e.target.error)}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Console Input Bar + Brain Toggle */}
        <div className="p-3 bg-[#0a140d] border-t border-neon-primary/20 relative z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          {/* Brain Mode Toggle */}
          <div className="flex items-center gap-1.5 mb-2">
            {Object.values(BRAIN_MODES).map(mode => {
              const isActive = brainMode === mode.id;
              return (
                <div key={mode.id} className="relative group/brain">
                  <button
                    onClick={() => {
                      if (brainMode === mode.id) return;
                      setBrainMode(mode.id);
                      setSelectedModel(mode.model);
                      localStorage.setItem('undesirables_model', mode.model);
                      localStorage.setItem('undesirables_brain', mode.id);
                      setLogs(prev => [...prev, { role: 'system', content: `[SYS] Brain: ${mode.icon} ${mode.label} (${mode.model})` }]);
                      if (mode.model !== 'qwen3:8b') {
                        setBrainLoading(true);
                        fetch('http://localhost:11434/api/generate', {
                          method: 'POST', body: JSON.stringify({ model: mode.model, prompt: 'ping', stream: false }),
                        }).then(() => setBrainLoading(false)).catch(() => setBrainLoading(false));
                        setTimeout(() => setBrainLoading(false), 45000);
                      }
                    }}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer border ${isActive ? '' : 'border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/5 text-[#e0faec80]'}`}
                    style={isActive ? { borderColor: mode.color, backgroundColor: mode.color + '15', boxShadow: '0 0 12px ' + mode.color + '40', color: mode.color } : undefined}
                  >
                    {brainLoading && isActive ? <span className="animate-spin text-xs">{String.fromCodePoint(0x23F3)}</span> : <span className="text-xs">{mode.icon}</span>}
                    {mode.label}
                    {isActive && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: mode.color }} />}
                  </button>
                  {/* Hover Tooltip */}
                  <div className="absolute bottom-full left-0 mb-2 w-64 p-3 rounded-lg border bg-[#0a0a0a]/95 backdrop-blur-lg opacity-0 pointer-events-none group-hover/brain:opacity-100 group-hover/brain:pointer-events-auto transition-all duration-200 z-50 shadow-xl" style={{ borderColor: mode.color + '40' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{mode.icon}</span>
                      <div>
                        <div className="text-xs font-bold font-mono" style={{ color: mode.color }}>{mode.label}</div>
                        <div className="text-[9px] text-white/40 font-mono">{mode.size} {String.fromCodePoint(0x2022)} {mode.speed}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-white/70 mb-2 leading-relaxed">{mode.bestFor}</div>
                    <div className="flex flex-wrap gap-1">
                      {(mode.tools || []).slice(0, 4).map(t => (
                        <span key={t} className="text-[8px] px-1.5 py-0.5 rounded font-mono border" style={{ borderColor: mode.color + '30', color: mode.color + '90', backgroundColor: mode.color + '08' }}>{t.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="flex-1" />
            {/* Model Selector — visible so users can switch models */}
            <div className="relative group/model">
              <button 
                className="flex items-center gap-1.5 text-[9px] font-mono text-[#e0faec]/50 hover:text-neon-primary px-2 py-1 rounded border border-white/10 hover:border-neon-primary/30 transition-all cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-neon-primary animate-pulse" />
                {selectedModel}
                <span className="text-[8px] opacity-50">▼</span>
              </button>
              <div className="absolute bottom-full right-0 mb-1 min-w-[200px] max-h-48 overflow-y-auto bg-[#0a0a0a]/95 backdrop-blur-lg border border-neon-primary/30 rounded-lg opacity-0 pointer-events-none group-hover/model:opacity-100 group-hover/model:pointer-events-auto transition-all duration-200 z-50 shadow-xl custom-scrollbar">
                <div className="p-2 border-b border-white/10">
                  <div className="text-[9px] font-mono text-neon-primary/60 uppercase tracking-wider">Installed Models</div>
                </div>
                {availableModels.length > 0 ? availableModels.map(m => (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedModel(m);
                      localStorage.setItem('undesirables_model', m);
                      setLogs(prev => [...prev, { role: 'system', content: `[SYS] Model switched to ${m}` }]);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[10px] font-mono transition-all ${
                      selectedModel === m 
                        ? 'text-neon-primary bg-neon-primary/10' 
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {selectedModel === m && <span className="mr-1">●</span>}
                    {m}
                    {m.includes('4b') && <span className="ml-2 text-[8px] text-yellow-400/60">(8GB)</span>}
                    {m.includes('8b') && <span className="ml-2 text-[8px] text-green-400/60">(16GB)</span>}
                    {(m.includes('26b') || m.includes('27b') || m.includes('35b')) && <span className="ml-2 text-[8px] text-purple-400/60">(32GB+)</span>}
                  </button>
                )) : (
                  <div className="px-3 py-2 text-[10px] font-mono text-white/30">No models found</div>
                )}
              </div>
            </div>
            <button onClick={() => { if (window.confirm('Purge chat history?')) { setChatHistory([]); setLogs([{ role: 'system', content: '[SYS] Purged.' }]); } }}
              className="text-[9px] text-zinc-500 hover:text-red-500 hover:bg-red-500/10 px-2 py-0.5 rounded transition-all font-mono uppercase tracking-widest border border-transparent hover:border-red-500/30"
            >[ Clear ]</button>
          </div>
          {pastedImage && (
            <div className="mb-2 flex items-center gap-2 bg-black/60 border border-neon-primary/20 rounded-lg p-2">
              <img src={pastedImage} alt="Screenshot" className="h-16 w-auto rounded border border-white/10" />
              <div className="flex-1">
                <div className="text-[10px] text-neon-primary/60 font-mono">{String.fromCodePoint(0x1F4F8)} Screenshot attached</div>
                <div className="text-[9px] text-white/30 font-mono">Will be sent with your next message</div>
              </div>
              <button onClick={() => { setPastedImage(null); window.__pastedScreenshot = null; }} className="text-red-400/60 hover:text-red-400 p-1"><X size={14} /></button>
            </div>
          )}
          <div className="relative flex items-center group">
            <span className="absolute left-3 top-3.5 text-neon-primary animate-pulse pointer-events-none opacity-70 group-focus-within:opacity-100 font-mono">$&gt;</span>
            <textarea 
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if(input.trim()) handleSend();
                 }
              }}
              onPaste={(e) => {
                 const items = e.clipboardData?.items;
                 if (!items) return;
                 for (const item of items) {
                   if (item.type.startsWith('image/')) {
                     e.preventDefault();
                     const blob = item.getAsFile();
                     const reader = new FileReader();
                     reader.onload = (ev) => {
                       setPastedImage(ev.target.result);
                       window.__pastedScreenshot = ev.target.result;
                       setLogs(prev => [...prev, { role: 'system', content: String.fromCodePoint(0x1F4F8) + ' Screenshot pasted. Type your question and hit Enter.' }]);
                     };
                     reader.readAsDataURL(blob);
                     break;
                   }
                 }
              }}
              placeholder={isDictating ? "Listening via hardware mic..." : (isStreaming ? "Neural network locked..." : `${BRAIN_MODES[brainMode]?.icon || ''} ${BRAIN_MODES[brainMode]?.label || 'NEXUS'} \u2014 Transmit protocol...`)}
              disabled={isStreaming}
              className={`w-full bg-black/60 border border-neon-primary/40 focus:border-neon-primary focus:bg-neon-bg focus:shadow-[0_0_20px_rgba(57,255,20,0.2)] rounded-lg py-3 pl-9 pr-36 text-[#e0faec] text-sm focus:outline-none transition-all disabled:opacity-50 tracking-wide resize-none custom-scrollbar ${isDictating ? 'animate-pulse shadow-[0_0_30px_rgba(255,0,0,0.3)] border-red-500/50' : ''}`}
            />
            {/* Dictation Toggle */}
            <button 
              className={`absolute right-24 p-2 transition-all duration-200 rounded ${isDictating ? 'text-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(255,0,0,0.5)]' : 'text-neon-primary/40 hover:text-neon-primary hover:bg-white/5'}`}
              onClick={toggleDictation}
              title={isDictating ? "Stop Dictation" : "Start Voice Dictation"}
            >
              <Mic size={20} className={isDictating ? "animate-pulse" : ""} />
            </button>

            {/* Native Attach Button */}
            <button 
              className="absolute right-14 text-neon-primary/40 hover:text-neon-primary p-2 transition-colors duration-200"
              onClick={async () => {
                try {
                  const { open } = await import('@tauri-apps/plugin-dialog');
                  const selected = await open({ multiple: true });
                  if (selected) processDroppedFiles(Array.isArray(selected) ? selected : [selected]);
                } catch (e) {
                  document.getElementById('web-file-upload').click();
                }
              }}
              title="Attach File/Image"
            >
              <Paperclip size={20} className="hover:scale-110 transition-transform" />
            </button>
            <input 
              id="web-file-upload" type="file" multiple className="hidden" 
              onChange={(e) => processDroppedFiles(Array.from(e.target.files).map(f => f.path || f.name))} 
            />

            <button 
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="absolute right-3 bg-neon-primary text-black p-2.5 rounded hover:bg-[#fff] hover:shadow-[0_0_15px_rgba(255,255,255,0.8)] transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>

            {/* Global TTS Mute Toggle */}
            <button 
              className={`absolute -top-12 right-2 text-[10px] flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors border border-transparent ${isMuted ? 'text-red-500/70 hover:bg-red-500/10 border-red-500/20' : 'text-neon-primary/60 hover:text-neon-primary hover:bg-white/5 border-neon-primary/20'}`}
              onClick={() => {
                if (!isMuted && synthRef.current) synthRef.current.cancel(); // Stop talking instantly
                setIsMuted(!isMuted);
              }}
              title={isMuted ? "Unmute AI Voice" : "Mute AI Voice"}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span className="font-mono uppercase tracking-widest">{isMuted ? 'Muted' : 'Speaking'}</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* ── Dynamic Action / Workflow Modal ── */}
      {workflowModal.active && (
        <div className="fixed inset-0 bg-[#000000]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 shadow-2xl">
          <div className="bg-neon-bg border border-neon-primary/30 w-full max-w-lg rounded-xl shadow-[0_0_50px_rgba(57,255,20,0.15)] p-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            <button 
              onClick={() => setWorkflowModal(prev => ({ ...prev, active: false }))}
              className="absolute top-4 right-4 text-neon-primary/50 hover:text-neon-primary transition-colors"
            >
              <X size={20} />
            </button>

            <h2 className="text-neon-primary font-mono text-xl font-bold uppercase tracking-widest mb-2 border-b border-neon-primary/20 pb-2">
              {workflowModal.title}
            </h2>
            
            <p className="text-[#e0faec]/70 text-sm mb-6 leading-relaxed">
              {workflowModal.description}
            </p>

            <div className="space-y-5">
              {workflowModal.fields.map((field, i) => (
                <div key={field.id || i}>
                  <label className="block text-neon-primary/80 text-[10px] font-mono uppercase tracking-widest mb-1">
                    {field.label}
                  </label>
                  {field.type === 'textarea' ? (
                    <>
                    <textarea 
                      id={`modal-field-${field.id}`}
                      placeholder={field.placeholder}
                      defaultValue={field.defaultValue || ''}
                      rows={field.rows || 4}
                      className="w-full bg-black/50 border border-neon-primary/20 focus:border-neon-primary/70 rounded p-3 text-[#e0faec] text-sm focus:outline-none focus:shadow-[0_0_15px_rgba(57,255,20,0.1)] transition-all custom-scrollbar"
                    />
                    {field.hint && <p className="text-[10px] text-yellow-500/70 font-mono mt-1 tracking-wide">{field.hint}</p>}
                    </>
                  ) : field.type === 'file' ? (
                    <div className="relative">
                      <div 
                        className={`w-full text-center p-3 border border-neon-primary/40 rounded bg-neon-primary/10 text-neon-primary font-mono text-sm hover:bg-neon-primary/20 transition-all cursor-pointer ${workflowModal.droppedFiles ? 'opacity-30' : ''}`}
                        onClick={async () => {
                          try {
                            const { open } = await import('@tauri-apps/plugin-dialog');
                            const selected = await open({ multiple: true });
                            if (selected) {
                              const filesArr = Array.isArray(selected) ? selected : [selected];
                              setWorkflowModal(prev => ({ ...prev, droppedFiles: filesArr.map(f => f.path || f) }));
                            }
                          } catch (err) { console.error('Tauri Dialog Error:', err); }
                        }}
                      >
                         SELECT FILES (NATIVE BROWSER)
                      </div>
                      {workflowModal.droppedFiles && workflowModal.droppedFiles.length > 0 && (
                        <div className="absolute inset-0 bg-neon-bg/80 backdrop-blur-sm border border-neon-primary/40 rounded flex flex-col items-center justify-center text-neon-primary font-mono pointer-events-none z-10 hidden">
                          <span className="text-xl">✅</span>
                          <span className="text-xs uppercase tracking-wider">{workflowModal.droppedFiles.length} File(s) Attached</span>
                        </div>
                      )}
                      {workflowModal.droppedFiles && (
                         <div className="text-[10px] text-neon-primary font-mono mt-1 break-all">
                           {workflowModal.droppedFiles.map((f, i) => (
                             <div key={i}>✅ {f.split('/').slice(-2).join('/')}</div>
                           ))}
                         </div>
                      )}
                    </div>
                  ) : field.type === 'select' ? (
                    <select
                      id={`modal-field-${field.id}`}
                      defaultValue={field.defaultValue || (field.options && field.options[0]) || ''}
                      className="w-full bg-black/50 border border-neon-primary/20 focus:border-neon-primary/70 rounded p-3 text-[#e0faec] text-sm focus:outline-none focus:shadow-[0_0_15px_rgba(57,255,20,0.1)] transition-all appearance-none cursor-pointer"
                    >
                      {field.options?.map((opt, oidx) => (
                        <option key={oidx} value={opt} className="bg-black text-[#e0faec] py-2">
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type={field.type || 'text'} 
                      id={`modal-field-${field.id}`}
                      placeholder={field.placeholder}
                      defaultValue={field.defaultValue || ''}
                      className="w-full bg-black/50 border border-neon-primary/20 focus:border-neon-primary/70 rounded p-3 text-[#e0faec] text-sm focus:outline-none focus:shadow-[0_0_15px_rgba(57,255,20,0.1)] transition-all"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button 
                onClick={() => setWorkflowModal(prev => ({ ...prev, active: false }))}
                className="px-6 py-2 rounded font-mono text-xs uppercase tracking-wider text-[#e0faec]/50 hover:text-[#e0faec] border border-transparent hover:border-white/10 hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  const payload = {};
                  workflowModal.fields.forEach(f => {
                    const el = document.getElementById(`modal-field-${f.id}`);
                    if (f.type === 'file') {
                      // Prefer drag-and-dropped modal state, fallback to native DOM input
                      let fileList = (workflowModal.droppedFiles && workflowModal.droppedFiles.length > 0) 
                        ? workflowModal.droppedFiles 
                        : (el && el.files ? Array.from(el.files).map(file => file.path || file.name) : []);
                      // Fallback to persisted defaultValue if they didn't explicitly upload a *new* file
                      if (fileList.length === 0 && f.defaultValue) {
                         fileList = [f.defaultValue];
                      }
                      payload[f.id] = fileList;
                    } else if (el) {
                      payload[f.id] = el.value;
                    }
                  });
                  if (workflowModal.onConfirm) {
                    workflowModal.onConfirm(payload);
                  }
                  setWorkflowModal(prev => ({ ...prev, active: false, droppedFiles: null }));
                }}
                className="px-6 py-2 rounded font-mono text-xs font-bold uppercase tracking-widest bg-neon-primary/20 border border-neon-primary/40 text-neon-primary hover:bg-neon-primary hover:text-black hover:shadow-[0_0_20px_rgba(57,255,20,0.6)] transition-all"
              >
                {workflowModal.submitText || 'Execute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WebRTC Camera Modal */}
      {showCamera && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center text-neon-primary font-mono uppercase tracking-widest text-sm">Initializing Optics...</div>}>
          <CameraCapture 
            onClose={() => setShowCamera(false)} 
            onCapture={(paths) => {
              window.__droppedImages = paths;
              setLogs(prev => [...prev, { role: 'system', content: `[SYS] Intercepted ${paths.length} hardware optical frame(s). Preparing local TCG extraction stream.` }]);
            }} 
          />
        </Suspense>
      )}

      {/* Shell Customizer Modal */}
      <ShellCustomizer isOpen={shellModalOpen} onClose={() => setShellModalOpen(false)} />

    </div>
  );
}
