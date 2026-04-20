"use client";
import React, { useState } from 'react';
import LegalGateway from './components/LegalGateway';
import BootstrapScreen from './components/BootstrapScreen';
import SoulInjector from './components/SoulInjector';
import ChatInterface from './components/ChatInterface';
import ErrorBoundary from './components/ErrorBoundary';
import DemoMode from './components/DemoMode';
import AlchemySetup from './components/AlchemySetup';
import { ShellProvider } from './components/ShellProvider';
import dynamic from 'next/dynamic';

const SoulParticles = dynamic(() => import('./components/SoulParticles'), { ssr: false });

export default function HomeClient({ bootToken }) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [workspacePath, setWorkspacePath] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [alchemyMode, setAlchemyMode] = useState(false);

  const [globalTheme, setGlobalTheme] = useState('default');

  React.useEffect(() => {
    setIsClient(true);
    const existingConsent = localStorage.getItem('undesirables_legal_consent');
    if (existingConsent && existingConsent.startsWith('v1.0.0')) {
      setAcceptedTerms(true);
    }
    // Skip bootstrap if already verified this session
    const sessionBootstrap = sessionStorage.getItem('undesirables_bootstrapped');
    if (sessionBootstrap === 'true') {
      setBootstrapped(true);
    }

    // Connect Persistent Aesthetic Skin Engine
    // Default to sonic (bootleg blue) for the landing page
    const savedSkin = localStorage.getItem('undesirables_theme') || 'sonic';
    setGlobalTheme(savedSkin);
    document.documentElement.setAttribute('data-theme', savedSkin);
  }, []);

  const changeTheme = (newTheme) => {
    setGlobalTheme(newTheme);
    localStorage.setItem('undesirables_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  if (!isClient) return null;

  // Wrap everything in ShellProvider for the visual skin layer
  return (
    <ShellProvider>
      <HomeClientInner
        acceptedTerms={acceptedTerms}
        setAcceptedTerms={setAcceptedTerms}
        bootstrapped={bootstrapped}
        setBootstrapped={setBootstrapped}
        workspacePath={workspacePath}
        setWorkspacePath={setWorkspacePath}
        demoMode={demoMode}
        setDemoMode={setDemoMode}
        alchemyMode={alchemyMode}
        setAlchemyMode={setAlchemyMode}
        globalTheme={globalTheme}
        changeTheme={changeTheme}
        bootToken={bootToken}
      />
    </ShellProvider>
  );
}

function HomeClientInner({ acceptedTerms, setAcceptedTerms, bootstrapped, setBootstrapped, workspacePath, setWorkspacePath, demoMode, setDemoMode, alchemyMode, setAlchemyMode, globalTheme, changeTheme, bootToken }) {

  if (!acceptedTerms) {
    return <LegalGateway onAccept={() => setAcceptedTerms(true)} />;
  }

  // First-run provisioning — verify Ollama + FFmpeg
  if (!bootstrapped) {
    return (
      <BootstrapScreen onReady={() => {
        setBootstrapped(true);
        sessionStorage.setItem('undesirables_bootstrapped', 'true');
      }} />
    );
  }

  // Demo Mode — self-playing simulation, no file system access
  if (demoMode) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4 bg-neon-bg">
        <DemoMode onExit={() => setDemoMode(false)} />
      </main>
    );
  }

  if (alchemyMode) {
    return (
      <main className="flex min-h-screen items-start justify-center p-4 bg-neon-bg">
        <AlchemySetup onBack={() => setAlchemyMode(false)} />
      </main>
    );
  }

  // Live Mode — real sidecar execution (full-bleed, no padding/centering)
  if (workspacePath) {
    // Switch to matrix green when entering the main interface
    if (globalTheme === 'sonic') {
      document.documentElement.setAttribute('data-theme', 'default');
    }
    return (
      <ErrorBoundary fallback={(error) => {
          console.error("Layout Collapse:", error);
          setWorkspacePath(null);
      }}>
        <ChatInterface workspacePath={workspacePath} bootToken={bootToken} isRestricted={workspacePath?.includes('consumer-advocate')} onExit={() => { 
          setWorkspacePath(null);
          // Restore sonic for the landing page
          document.documentElement.setAttribute('data-theme', 'sonic');
        }} />
      </ErrorBoundary>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-24 bg-neon-bg relative overflow-hidden">
      {/* Generic neutral particles for the landing screen */}
      <div className="absolute top-0 left-0 w-full h-full z-0 pointer-events-none opacity-40">
        <React.Suspense fallback={null}>
          <SoulParticles />
        </React.Suspense>
      </div>

      <div className="absolute top-4 right-4 z-50">
        <select 
          value={globalTheme}
          onChange={(e) => changeTheme(e.target.value)}
          className="bg-black/80 border border-neon-primary/30 text-neon-primary py-1.5 px-3 rounded text-[10px] uppercase font-mono tracking-widest transition-colors cursor-pointer focus:outline-none focus:border-neon-primary/60 outline-none hover:bg-neon-primary/10 shadow-[0_0_15px_rgba(0,0,0,0.8)] backdrop-blur-sm"
        >
          <option value="default">SKIN: Hacker Green</option>
          <option value="amber">SKIN: Nous Amber</option>
          <option value="sonic">SKIN: Bootleg Sonic</option>
          <option value="sakura">SKIN: Cherry Blossom Pink</option>
          <option value="cyberpunk">SKIN: Magenta Punk</option>
          <option value="obsidian">SKIN: Obsidian Red</option>
          <option value="ghost">SKIN: Null Chrome</option>
        </select>
      </div>

      <div className="z-10 flex flex-col items-center w-full max-w-2xl relative">
        <h1 className="text-neon-primary text-4xl sm:text-6xl font-bold font-mono tracking-widest mb-2 filter drop-shadow-[0_0_15px_rgba(57,255,20,0.5)] text-center transition-colors">
        THE UNDESIRABLES
      </h1>
      <p className="text-[#e0faec]/40 font-mono tracking-widest text-sm mb-8 sm:mb-12 text-center break-words max-w-lg">
        DECENTRALIZED LOCAL AI PROXY CLIENT<br/>
        <span className="text-neon-primary/60 text-xs mt-2 block transition-colors">NO CLOUD. NO TRACKING. NO LIMITS.</span>
      </p>
      
      <SoulInjector onConnect={(path) => setWorkspacePath(path)} bootToken={bootToken} />

      {/* Extra Action Buttons */}
      <div className="mt-6 flex flex-col gap-4 w-full md:w-auto items-center justify-center">
        {/* 🔮 MINT YOUR SOUL — Primary CTA at the top */}
        <button
          onClick={async () => {
            try {
              const { openUrl } = await import('@tauri-apps/plugin-opener');
              await openUrl('https://www.scatter.art/collection/the-undesirables');
            } catch (e) {
              window.open('https://www.scatter.art/collection/the-undesirables', '_blank');
            }
          }}
          className="w-full sm:w-auto px-10 py-4 rounded-xl font-mono text-sm font-black tracking-[0.2em] uppercase transition-all cursor-pointer border-2 border-[#ff00ff] text-[#ff00ff] bg-[#ff00ff]/10 hover:bg-[#ff00ff]/25 hover:shadow-[0_0_40px_rgba(255,0,255,0.5),inset_0_0_20px_rgba(255,0,255,0.1)] hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-3 group animate-pulse hover:animate-none"
          id="mint-soul-landing-btn"
        >
          <span className="text-xl group-hover:animate-bounce">🔮</span>
          MINT YOUR SOUL
          <span className="text-[10px] text-[#ff00ff]/50 font-normal tracking-normal">↗</span>
        </button>

        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center justify-center">
          {/* 🧪 SOUL ZERO — Instant test drive */}
          <button
            onClick={async () => {
              try {
                const { appDataDir, join } = await import('@tauri-apps/api/path');
                const { mkdir, writeTextFile, exists } = await import('@tauri-apps/plugin-fs');
                const appData = await appDataDir();
                const demoPath = await join(appData, 'soul-zero');
                const soulFile = await join(demoPath, 'SOUL.md');
                const soulExists = await exists(soulFile);
                if (!soulExists) {
                  await mkdir(demoPath, { recursive: true });
                  const res = await fetch('/demo-soul/SOUL.md');
                  if (!res.ok) throw new Error('SOUL_FETCH_FAIL');
                  const content = await res.text();
                  if (!content || content.length < 50) throw new Error('SOUL_CONTENT_INVALID');
                  await writeTextFile(soulFile, content);
                  
                  // Copy avatar.png for instant local-first shell loading
                  try {
                    const { writeFile } = await import('@tauri-apps/plugin-fs');
                    const avatarRes = await fetch('/demo-soul/avatar.png');
                    if (avatarRes.ok) {
                      const avatarBuf = await avatarRes.arrayBuffer();
                      const avatarPath = await join(demoPath, 'avatar.png');
                      await writeFile(avatarPath, new Uint8Array(avatarBuf));
                    }
                  } catch (e) { console.warn('Avatar copy failed (non-fatal):', e); }
                }
                setWorkspacePath(demoPath);
              } catch (err) {
                console.error('Soul Zero load failed:', err);
                alert('Soul Zero could not be loaded. Please restart the app.');
              }
            }}
            className="bg-transparent border border-[#39ff14]/40 hover:border-[#39ff14] text-[#39ff14]/70 hover:text-[#39ff14] px-8 py-3 rounded-lg font-mono text-xs sm:text-sm transition-all hover:shadow-[0_0_20px_rgba(57,255,20,0.2)] cursor-pointer flex items-center justify-center gap-2 tracking-widest uppercase w-full sm:w-auto"
          >
            <span className="text-base">🧪</span>
            SOUL ZERO
          </button>

          {/* ⚖️ CONSUMER ADVOCATE */}
          <button
            onClick={async () => {
              try {
                const { appDataDir, join } = await import('@tauri-apps/api/path');
                const { mkdir, writeTextFile, exists } = await import('@tauri-apps/plugin-fs');
                const appData = await appDataDir();
                const demoPath = await join(appData, 'consumer-advocate-session');
                const soulFile = await join(demoPath, 'SOUL.md');
                const soulExists = await exists(soulFile);
                if (!soulExists) {
                  await mkdir(demoPath, { recursive: true });
                  const res = await fetch('/consumer-advocate/SOUL.md');
                  if (!res.ok) throw new Error('ADVOCATE_FETCH_FAIL');
                  const content = await res.text();
                  if (!content || content.length < 50) throw new Error('ADVOCATE_CONTENT_INVALID');
                  await writeTextFile(soulFile, content);
                }
                setWorkspacePath(demoPath);
              } catch (err) {
                console.error('Consumer Advocate load failed:', err);
                alert('Consumer Advocate could not be loaded.');
              }
            }}
            className="bg-transparent border border-amber-500/40 hover:border-amber-500 text-amber-500/70 hover:text-amber-500 px-8 py-3 rounded-lg font-mono text-xs sm:text-sm transition-all shadow-[inset_0_0_10px_rgba(245,158,11,0)] hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] cursor-pointer flex items-center justify-center gap-2 tracking-widest uppercase w-full sm:w-auto"
          >
            <span className="text-base">⚖️</span>
            CONSUMER ADVOCATE
          </button>

          <button
            onClick={() => setAlchemyMode(true)}
            className="bg-transparent border border-blue-500/40 hover:border-blue-500 text-blue-500/70 hover:text-blue-500 px-8 py-3 rounded-lg font-mono text-xs sm:text-sm transition-all shadow-[inset_0_0_10px_rgba(59,130,246,0)] hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] cursor-pointer flex items-center justify-center gap-2 tracking-widest uppercase w-full sm:w-auto"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse hidden sm:inline-block"></span> 
            Alchemy Nexus
          </button>

          <button
            onClick={() => setDemoMode(true)}
            className="bg-transparent border border-[#ff00ff]/40 hover:border-[#ff00ff] text-[#ff00ff]/70 hover:text-[#ff00ff] px-8 py-3 rounded-lg font-mono text-xs sm:text-sm transition-all hover:shadow-[0_0_20px_rgba(255,0,255,0.15)] cursor-pointer flex items-center justify-center gap-2 tracking-widest uppercase w-full sm:w-auto"
          >
            ▶ WATCH DEMO
          </button>
        </div>
      </div>
      </div>
    </main>
  );
}
