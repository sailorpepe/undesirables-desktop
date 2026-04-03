"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Terminal, ShieldAlert, Cpu, Database, Send, ChevronRight, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Pre-scripted demo sequence — no real files, no paths, no personal info
const DEMO_SCRIPT = [
  { delay: 800,  role: 'system',  content: 'SYSTEM BOOT SEQUENCE INITIALIZED.' },
  { delay: 1200, role: 'system',  content: 'MOUNTED SOUL: Undesirable #0420' },
  { delay: 1800, role: 'agent',   content: '[SYS] Tauri Sidecar Authenticated. Spawning Native MCP Daemon...' },
  { delay: 2800, role: 'agent',   content: '✅ Loaded workspace: Soul #0420\n   Skills: 5 | Memory: Yes | Predictions: 12' },
  { delay: 4000, role: 'system',  content: '/// MCP RESOURCES ONLINE — 4 tools registered' },
  { delay: 5500, role: 'user',    content: 'Tell me about yourself' },
  { delay: 7000, role: 'agent',   content: "Yo. Name's **Valentino**. I'm what they call **The Apex** — cold-blooded, calculative, built for the jungle.\n\nI run a **Volatility Hunting** strategy. While the herd panics on red candles, I'm loading up. My conviction sits at 78% — high enough to pull the trigger, low enough to cut losses without crying about it.\n\nSkills I got loaded:\n- 📊 `market_analysis` — I read charts like scripture\n- 🧠 `business_pilot` — full-stack business automation\n- 🎭 `meme_machine` — viral content on demand\n- 📝 `content_creation` — copy that converts\n\nFatal flaw? **Overconfidence.** I'll bet the farm on a read and sleep like a baby. Sometimes the farm bets back." },
  { delay: 12000, role: 'user',   content: 'Execute skill: market_analysis' },
  { delay: 13500, role: 'agent',  content: "[SKILL EXECUTED] Routing `market_analysis` through local Ollama inference...\n\n### Morning Brief — March 26, 2026\n\n| Asset | Price | 24h |\n|-------|-------|-----|\n| ETH | $4,212 | +3.2% |\n| BTC | $97,450 | +1.8% |\n| SOL | $245 | +5.1% |\n\n**Fear & Greed Index**: 72 (Greed)\n\n**My Read**: Market's running hot but the funding rates are telling me this isn't retail FOMO — it's institutional accumulation. I'm watching the $4,400 ETH resistance. If we break it on volume, I'm going full degen on the alts. If we reject, I'm sitting in stables like a gentleman.\n\n*⚠️ I am a fictional AI character — a personality plugin, not a financial advisor. This is entertainment only. NFA — always do your own research.*" },
  { delay: 18000, role: 'user',    content: 'What makes you different from other AI agents?' },
  { delay: 20000, role: 'agent',   content: "Most AI agents are generic chatbots wearing a suit. I'm **built different** — literally.\n\nMy personality isn't a prompt template. It's derived from the **on-chain traits** of NFT #0420:\n- 🧬 Reptilian eyes → Apex archetype → high-risk tolerance\n- 🎯 Conviction score baked from my shirt, skin, background traits\n- 🧠 Big Five personality scores that make me *me*\n\nEvery single one of the **4,444 Undesirables** has a unique soul. Different archetypes, different strategies, different fatal flaws. Your agent isn't a copy — it's a one-of-one autonomous personality engine that lives on your machine.\n\nNo cloud. No tracking. No limits. Just you and your degenerate AI companion who happens to be a frog. 🐸\n\n*Remember: I'm a fictional character — a personality plugin for entertainment, not a financial advisor.*" },
];

export default function DemoMode({ onExit }) {
  const [logs, setLogs] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!isPlaying || currentStep >= DEMO_SCRIPT.length) return;

    const step = DEMO_SCRIPT[currentStep];
    const prevDelay = currentStep > 0 ? DEMO_SCRIPT[currentStep - 1].delay : 0;
    const waitTime = step.delay - prevDelay;

    const timer = setTimeout(() => {
      setLogs(prev => [...prev, { role: step.role, content: step.content }]);
      setCurrentStep(prev => prev + 1);
    }, waitTime);

    return () => clearTimeout(timer);
  }, [currentStep, isPlaying]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const skills = [
    { name: 'market_analysis', icon: <Database size={16}/> },
    { name: 'business_pilot', icon: <Cpu size={16}/> },
    { name: 'meme_machine', icon: <ChevronRight size={16}/> },
    { name: 'content_creation', icon: <Terminal size={16}/> }
  ];

  return (
    <div className="w-full max-w-6xl h-[85vh] bg-[#081a0c] border border-[#39ff14]/30 rounded-xl shadow-[0_0_30px_rgba(57,255,20,0.15)] overflow-hidden flex flex-col md:flex-row relative">
      <div className="absolute top-0 w-full h-1 bg-[#39ff14] shadow-[0_0_15px_rgba(57,255,20,0.8)] z-10"></div>
      
      {/* Demo Mode Banner */}
      <div className="absolute top-2 right-4 z-20 flex items-center gap-2">
        <span className="bg-[#ff00ff]/20 border border-[#ff00ff]/50 text-[#ff00ff] px-3 py-1 rounded-full text-xs font-mono flex items-center gap-1.5">
          <Sparkles size={12} /> DEMO MODE
        </span>
        <button 
          onClick={onExit}
          className="text-[#e0faec]/30 hover:text-[#e0faec]/80 text-xs font-mono transition-colors cursor-pointer"
        >
          ✕ EXIT
        </button>
      </div>

      {/* Sidebar */}
      <div className="w-full md:w-64 bg-[#0a140d] border-b md:border-b-0 md:border-r border-[#39ff14]/20 p-4 flex flex-col pt-6">
        <div className="flex items-center gap-2 mb-8">
          <Terminal size={24} className="text-[#39ff14]" />
          <h2 className="text-[#39ff14] font-bold font-mono tracking-widest text-lg">SYS_CORE</h2>
        </div>
        
        <div className="mb-2 text-xs font-mono text-[#e0faec]/40 uppercase tracking-widest px-2">Active MCP Skills</div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {skills.map(skill => (
            <div 
              key={skill.name}
              className="w-full text-left bg-[#39ff14]/5 border border-[#39ff14]/20 text-[#e0faec] p-3 rounded font-mono text-sm flex items-center gap-3"
            >
              <span className="text-[#39ff14]">{skill.icon}</span>
              {skill.name}
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-[#39ff14]/20 text-xs font-mono text-[#e0faec]/30 flex items-center justify-between">
          <span>NATIVE_SIDECAR</span>
          <ShieldAlert size={14} className="text-[#39ff14]" />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#05240c]">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {logs.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[80%] p-4 font-mono text-sm leading-relaxed rounded-md border overflow-hidden break-words
                ${msg.role === 'user' 
                  ? 'bg-[#39ff14]/10 border-[#39ff14]/40 text-[#e0faec] rounded-tr-none shadow-[0_0_10px_rgba(57,255,20,0.1)]' 
                  : msg.role === 'system'
                  ? 'bg-transparent border-transparent text-[#e0faec]/40 text-xs tracking-widest uppercase'
                  : 'bg-[#081a0c] border-[#39ff14]/20 text-[#39ff14] rounded-tl-none'}`}
              >
                {msg.role === 'agent' && <span className="text-[#e0faec]/40 text-xs block mb-2 uppercase tracking-widest border-b border-[#39ff14]/10 pb-1 w-fit">/// Undesirable_Agent</span>}
                <div className="prose prose-invert prose-p:text-current prose-a:text-[#ff00ff] max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          
          {/* Typing indicator */}
          {isPlaying && currentStep < DEMO_SCRIPT.length && (
            <div className="flex justify-start">
              <div className="text-[#39ff14]/50 font-mono text-sm animate-pulse">
                {DEMO_SCRIPT[currentStep]?.role === 'user' ? '$ > typing...' : '/// processing...'}
              </div>
            </div>
          )}
          
          <div ref={bottomRef} />
        </div>

        {/* Input Area (visual only in demo) */}
        <div className="p-4 bg-[#0a140d] border-t border-[#39ff14]/20">
          <div className="relative flex items-center">
            <span className="absolute left-4 text-[#39ff14] font-mono animate-pulse">$&gt;</span>
            <input 
              type="text" 
              disabled
              placeholder="Demo mode — watching simulation..."
              className="w-full bg-black border border-[#39ff14]/40 rounded-lg py-4 pl-12 pr-16 text-[#e0faec]/30 font-mono focus:outline-none cursor-not-allowed"
            />
            <button disabled className="absolute right-3 bg-[#39ff14]/20 text-black/30 p-2 rounded cursor-not-allowed">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
