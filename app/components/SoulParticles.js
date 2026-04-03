'use client';
import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Module-level ref shared between Canvas internals and DOM legend
const sharedInteractRef = {
  clicks: { openness: 0, conscientiousness: 0, extraversion: 0, neuroticism: 0, agreeableness: 0 }
};

const TRAIT_COLORS = {
  openness:          new THREE.Color('#a855f7'), // violet
  conscientiousness: new THREE.Color('#3b82f6'), // blue
  extraversion:      new THREE.Color('#facc15'), // gold
  neuroticism:       new THREE.Color('#ef4444'), // red
  agreeableness:     new THREE.Color('#22c55e'), // green
};

const TRAIT_HEX = {
  openness:          '#a855f7',
  conscientiousness: '#3b82f6',
  extraversion:      '#facc15',
  neuroticism:       '#ef4444',
  agreeableness:     '#22c55e',
};

function getDominantTrait(traits) {
  let max = 0, dominant = 'agreeableness';
  for (const [key, val] of Object.entries(traits)) {
    if (val > max) { max = val; dominant = key; }
  }
  return { name: dominant, score: max };
}

// ─────────────────────────────────────────────────
// Particle Field — Psychometric Interaction Engine
// ─────────────────────────────────────────────────
function ParticleField({ traits = {}, activeTrait = null, onTraitClick }) {
  const meshRef = useRef();
  const timeRef = useRef(0);
  
  const { raycaster, gl } = useThree();

  // Expand Raycaster Threshold so moving points are easily clickable
  useEffect(() => {
    raycaster.params.Points.threshold = 0.15; 
  }, [raycaster]);

  // Stateless interaction tracking (prevents React re-renders)
  const interactRef = useRef({
    hovered: null,
    clicks: sharedInteractRef.clicks
  });

  const o = (traits.openness ?? 0) / 100;
  const c = (traits.conscientiousness ?? 0) / 100;
  const e = (traits.extraversion ?? 0) / 100;
  const n = (traits.neuroticism ?? 0) / 100;
  const a = (traits.agreeableness ?? 0) / 100;

  const traitScores = { openness: o, conscientiousness: c, extraversion: e, neuroticism: n, agreeableness: a };
  const traitNames = Object.keys(traitScores);

  const countPerTrait = useMemo(() => {
    return traitNames.map(t => {
      const s = traitScores[t];
      if (s === 0) return 1; // Exactly one origin dot to prove structural presence of the token
      // Cubic ramp: low traits stay sparse, dominant traits visually explode
      // s=0.1 → ~13pts,  s=0.5 → ~45pts,  s=0.8 → ~153pts,  s=1.0 → ~290pts
      return Math.floor(10 + Math.pow(s, 3) * 280);
    });
  }, [o, c, e, n, a]);

  const totalCount = useMemo(() => countPerTrait.reduce((s, v) => s + v, 0), [countPerTrait]);
  const MAX_PARTICLES = 5000;

  const { positions, colors, traitIndices, seeds } = useMemo(() => {
    const pos = new Float32Array(MAX_PARTICLES * 3);
    const col = new Float32Array(MAX_PARTICLES * 3);
    const idx = new Int32Array(MAX_PARTICLES);    
    const sd  = new Float32Array(MAX_PARTICLES);  

    let offset = 0;
    for (let t = 0; t < 5; t++) {
      const count = countPerTrait[t];
      const traitColor = TRAIT_COLORS[traitNames[t]];

      for (let i = 0; i < count; i++) {
        const pi = offset + i;
        const i3 = pi * 3;

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        // Tightened minimum radius to make the globe feel 'more together'
        const r = 0.6 + Math.random() * 2.0;

        pos[i3]     = r * Math.sin(phi) * Math.cos(theta);
        pos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i3 + 2] = r * Math.cos(phi) * 0.5;

        const variation = 0.85 + Math.random() * 0.3;
        col[i3]     = Math.min(1, traitColor.r * variation);
        col[i3 + 1] = Math.min(1, traitColor.g * variation);
        col[i3 + 2] = Math.min(1, traitColor.b * variation);

        idx[pi] = t;
        sd[pi] = Math.random() * 1000;
      }
      offset += count;
    }
    // Fill remainder with zeroes beyond active range
    for (let i = totalCount; i < MAX_PARTICLES; i++) {
        const i3 = i * 3;
        pos[i3] = 0; pos[i3+1] = 0; pos[i3+2] = 0;
        col[i3] = 0; col[i3+1] = 0; col[i3+2] = 0;
        idx[i] = 0; sd[i] = 0;
    }

    return { positions: pos, colors: col, traitIndices: idx, seeds: sd };
  }, [totalCount, countPerTrait]);

  // Native WebGL Array Initialization (Guarantees attributes exist BEFORE first frame shader compilation)
  const particleGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    // Wrap in native Float32Array to decouple physics baseline
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    geo.setDrawRange(0, totalCount);
    return geo;
  }, [positions, colors, totalCount]);

  // ─── Interaction Handlers ───
  const handlePointerMove = (e) => {
    e.stopPropagation();
    if (e.index !== undefined) {
      interactRef.current.hovered = traitNames[traitIndices[e.index]];
      gl.domElement.style.cursor = 'crosshair';
    }
  };

  const handlePointerOut = () => {
    interactRef.current.hovered = null;
    gl.domElement.style.cursor = 'auto';
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (e.index !== undefined) {
      const traitName = traitNames[traitIndices[e.index]];
      interactRef.current.clicks[traitName] = 2.0; // Spike the physics force!
      if (onTraitClick) onTraitClick(traitName); // Bridge to Chat AI
    }
  };

  // ─── Core Physics Loop ───
  useFrame((_, delta) => {
    if (!meshRef.current || !meshRef.current.geometry) return;
    const geo = meshRef.current.geometry;
    
    // R3F v9 Safety Check: Wait for attributes to physically attach before attempting to read buffer arrays
    if (!geo.attributes.position || !geo.attributes.color) return;

    const posAttr = geo.attributes.position;
    const colAttr = geo.attributes.color;
    const arr = posAttr.array;
    const carr = colAttr.array;

    timeRef.current += delta;
    const t = timeRef.current;

    // Global Speech TTS Envelope Array Decay (Rapid pop when syllables drop offline)
    if (typeof window !== 'undefined' && window.__TTS_IMPULSE__ > 0.01) {
      window.__TTS_IMPULSE__ *= 0.82; 
    } else if (typeof window !== 'undefined') {
      window.__TTS_IMPULSE__ = 0;
    }
    const ttsForce = typeof window !== 'undefined' ? window.__TTS_IMPULSE__ || 0 : 0;

    // Mathematical Decay (Friction) for Clicks
    for (const key in interactRef.current.clicks) {
      if (interactRef.current.clicks[key] > 0.01) {
        interactRef.current.clicks[key] *= 0.92; // Decay
      } else {
        interactRef.current.clicks[key] = 0;
      }
    }

    const dom = getDominantTrait(traits);
    const activeIdx = activeTrait ? traitNames.indexOf(activeTrait) : traitNames.indexOf(dom.name);

    for (let i = 0; i < totalCount; i++) {
      const i3 = i * 3;
      const traitIdx = traitIndices[i];
      const seed = seeds[i];
      const traitName = traitNames[traitIdx];
      
      const isActive = traitIdx === activeIdx;
      const hoverScale = interactRef.current.hovered === traitName ? 1 : 0;
      const clickForce = interactRef.current.clicks[traitName];
      const interactMultiplier = 1 + (hoverScale * 0.2) + clickForce + (ttsForce * 0.4);

      let basex = positions[i3];
      let basey = positions[i3 + 1];
      let basez = positions[i3 + 2];

      let x = basex;
      let y = basey;
      let z = basez;

      const traitScore = traitScores[traitName];
      const intensity = traitScore * (isActive ? 1.5 : 0.4);
      const spd = 0.15 + traitScore * 0.3; // Slower, more flowing velocity

      // ── Physics Override Engine ──
      switch (traitName) {
        case 'openness':
          const spiralAngle = t * spd * 0.5 + seed + (clickForce * 2);
          const spiralR = (0.3 + Math.sin(t * 0.2 + seed) * 0.4 * intensity) * interactMultiplier;
          x += Math.cos(spiralAngle) * spiralR;
          y += Math.sin(spiralAngle) * spiralR;
          z += Math.sin(t * 0.3 + seed * 0.5) * 0.15 * intensity;
          break;

        case 'conscientiousness':
          const orbitAngle = t * spd * 0.4 + seed;
          const orbitR = (0.2 + traitScore * 0.3) * interactMultiplier;
          x += Math.cos(orbitAngle) * orbitR;
          y += Math.sin(orbitAngle) * orbitR;
          z += Math.sin(orbitAngle * 0.5) * 0.05;
          if (clickForce > 0) {
            // Snap perfectly rigid to grid
            const snap = Math.min(clickForce, 1);
            x += (Math.round(x / 0.5) * 0.5 - x) * snap;
            y += (Math.round(y / 0.5) * 0.5 - y) * snap;
            z += (Math.round(z / 0.5) * 0.5 - z) * snap;
          }
          break;

        case 'extraversion':
          const pulse = Math.abs(Math.sin(t * spd * 1.2 + seed));
          const burstR = pulse * 0.6 * intensity * interactMultiplier;
          const burstAngle = seed * Math.PI * 2;
          x += Math.cos(burstAngle) * burstR;
          y += Math.sin(burstAngle) * burstR;
          z += (pulse - 0.5) * 0.3 * intensity;
          if (clickForce > 0) {
            x += basex * clickForce * 1.5;
            y += basey * clickForce * 1.5;
            z += basez * clickForce * 1.5;
          }
          break;

        case 'neuroticism':
          const jitterScale = (intensity * 0.35) * interactMultiplier + (clickForce * 1.5);
          x += Math.sin(t * 2.5 + seed * 7.3) * jitterScale;
          y += Math.cos(t * 3.1 + seed * 5.1) * jitterScale;
          z += Math.sin(t * 3.7 + seed * 3.7) * jitterScale * 0.6;
          if (clickForce > 0) { // Add pure chaos on click
             x += (Math.random() - 0.5) * clickForce * 2;
             y += (Math.random() - 0.5) * clickForce * 2;
             z += (Math.random() - 0.5) * clickForce * 2;
          }
          break;

        case 'agreeableness':
          const waveFreq = 0.5 + traitScore * 0.3;
          x += Math.sin(t * waveFreq + seed) * 0.3 * intensity * interactMultiplier;
          y += Math.cos(t * waveFreq * 0.7 + seed * 1.3) * 0.25 * intensity * interactMultiplier;
          z += Math.sin(t * waveFreq * 0.4 + seed * 0.7) * 0.1 * intensity * interactMultiplier;
          if (clickForce > 0) {
            // Mathematical ripple outward like a pond
            const dist = Math.sqrt(basex*basex + basey*basey + basez*basez) || 1;
            const ripple = Math.sin(dist * 10 - t * 8) * clickForce * 1.5;
            x += (basex / dist) * ripple;
            y += (basey / dist) * ripple;
            z += (basez / dist) * ripple;
          }
          break;
      }

      arr[i3]     = x;
      arr[i3 + 1] = y;
      arr[i3 + 2] = z;

      // ── Dynamic Color Intensity ──
      const traitColor = TRAIT_COLORS[traitName];
      let finalBrightness = isActive ? 0.9 + Math.sin(t * 3 + seed) * 0.2 : 0.5 + Math.sin(t * 0.5 + seed) * 0.1;
      
      if (hoverScale > 0) finalBrightness *= 1.5;
      if (clickForce > 0) finalBrightness += clickForce * 1.5; // Flash white hot

      carr[i3]     = Math.min(1, traitColor.r * finalBrightness);
      carr[i3 + 1] = Math.min(1, traitColor.g * finalBrightness);
      carr[i3 + 2] = Math.min(1, traitColor.b * finalBrightness);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <points 
      ref={meshRef}
      geometry={particleGeo}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <pointsMaterial size={0.06} vertexColors transparent opacity={0.85} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function CoreGlow({ traits = {}, activeTrait = null }) {
  const meshRef = useRef();
  const dom = getDominantTrait(traits);
  const activeColor = TRAIT_HEX[activeTrait || dom.name] || '#22c55e';
  const e = (traits.extraversion ?? 0) / 100;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const tts = typeof window !== 'undefined' ? window.__TTS_IMPULSE__ || 0 : 0;
    const pulse = 1 + Math.sin(clock.getElapsedTime() * (0.5 + e)) * 0.12 + (tts * 0.15);
    meshRef.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.5, 16, 16]} />
      <meshBasicMaterial color={activeColor} transparent opacity={0.04} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// ─── Phase 3: Metaverse GLTF Exporter Bridge ───
function ExporterBridge({ setExportFn }) {
  const { scene } = useThree();
  
  useEffect(() => {
    setExportFn(() => () => {
      const exporter = new GLTFExporter();
      exporter.parse(
        scene,
        (gltf) => {
          const blob = new Blob([gltf], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.setAttribute('href', url);
          a.setAttribute('download', 'AI_Soul_Particle_Matrix.glb');
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        },
        (error) => {
          console.error('[GLTFExporter] Serialization failed:', error);
        },
        { binary: true } // Export as .glb
      );
    });
  }, [scene, setExportFn]);
  
  return null;
}


export default function SoulParticles({ traits = {}, visible = true, activeTrait = null, onTraitClick, tcgMode = false, tcgScores = null, councilSlots = [], hostName = 'Host' }) {
  const [exportScene, setExportScene] = useState(null);

  if (!visible) return null;

  const handleLegendClick = (traitName) => {
    sharedInteractRef.clicks[traitName] = 3.0;
    if (!tcgMode) {
      onTraitClick?.(traitName);
    }
  };

  const tcgScoreMap = {
    openness: tcgScores?.overall_grade || 0,
    conscientiousness: tcgScores?.centering || 0,
    extraversion: tcgScores?.edges || 0,
    agreeableness: tcgScores?.corners || 0,
    neuroticism: tcgScores?.surface || 0,
  };

  const getScoreStr = (trait, specificTraits) => {
    if (tcgMode && tcgScores) {
      return `${Number(tcgScoreMap[trait]).toFixed(1)}/10`;
    }
    const val = (specificTraits && specificTraits[trait]) ?? 50;
    return `${val}%`;
  };

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 0.9 }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }} gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }} style={{ background: 'transparent' }}>
        <ParticleField traits={traits} activeTrait={activeTrait} onTraitClick={onTraitClick} />
        <CoreGlow traits={traits} activeTrait={activeTrait} />
        <ExporterBridge setExportFn={setExportScene} />
      </Canvas>
      <div 
        className="absolute bottom-24 right-6 flex flex-col gap-3 z-50 pointer-events-none"
        style={{ isolation: 'isolate', willChange: 'transform' }}
      >
        {[{ name: hostName, traits: traits }, ...councilSlots].map((soul, idx) => (
          <div key={idx} className="flex flex-col gap-1 bg-black/60 p-3 rounded-lg border border-white/10 text-[11px] font-mono backdrop-blur-md select-none pointer-events-auto shadow-2xl">
            <div className="text-[#e0faec]/60 font-bold uppercase tracking-widest border-b border-white/10 pb-1 mb-1 truncate w-[220px]">
              [ {soul.name} ] LAYER
            </div>
            <div onClick={() => handleLegendClick('openness')} className="flex justify-between w-[220px] cursor-pointer hover:bg-white/10 px-1.5 py-0.5 rounded transition-all active:scale-95" style={{color: '#a855f7'}}>
              <span>{tcgMode ? 'Overall Grade' : 'Openness'}</span>
              <span className="flex items-center gap-2"><span className="text-[9px] opacity-50">{tcgMode ? '' : 'Spiral'}</span> <span className="font-bold">{getScoreStr('openness', soul.traits)}</span></span>
            </div>
            <div onClick={() => handleLegendClick('conscientiousness')} className="flex justify-between w-[220px] cursor-pointer hover:bg-white/10 px-1.5 py-0.5 rounded transition-all active:scale-95" style={{color: '#3b82f6'}}>
              <span>{tcgMode ? 'Centering' : 'Conscientiousness'}</span>
              <span className="flex items-center gap-2"><span className="text-[9px] opacity-50">{tcgMode ? '' : 'Orbit'}</span> <span className="font-bold">{getScoreStr('conscientiousness', soul.traits)}</span></span>
            </div>
            <div onClick={() => handleLegendClick('extraversion')} className="flex justify-between w-[220px] cursor-pointer hover:bg-white/10 px-1.5 py-0.5 rounded transition-all active:scale-95" style={{color: '#facc15'}}>
              <span>{tcgMode ? 'Edges' : 'Extraversion'}</span>
              <span className="flex items-center gap-2"><span className="text-[9px] opacity-50">{tcgMode ? '' : 'Pulse'}</span> <span className="font-bold">{getScoreStr('extraversion', soul.traits)}</span></span>
            </div>
            <div onClick={() => handleLegendClick('agreeableness')} className="flex justify-between w-[220px] cursor-pointer hover:bg-white/10 px-1.5 py-0.5 rounded transition-all active:scale-95" style={{color: '#22c55e'}}>
              <span>{tcgMode ? 'Corners' : 'Agreeableness'}</span>
              <span className="flex items-center gap-2"><span className="text-[9px] opacity-50">{tcgMode ? '' : 'Wave'}</span> <span className="font-bold">{getScoreStr('agreeableness', soul.traits)}</span></span>
            </div>
            <div onClick={() => handleLegendClick('neuroticism')} className="flex justify-between w-[220px] cursor-pointer hover:bg-white/10 px-1.5 py-0.5 rounded transition-all active:scale-95" style={{color: '#ef4444'}}>
              <span>{tcgMode ? 'Surface' : 'Neuroticism'}</span>
              <span className="flex items-center gap-2"><span className="text-[9px] opacity-50">{tcgMode ? '' : 'Chaos'}</span> <span className="font-bold">{getScoreStr('neuroticism', soul.traits)}</span></span>
            </div>
            {idx === 0 && (
              <div className="text-[#e0faec]/40 mt-1 pt-1 border-t border-white/10 text-center text-[9px] uppercase tracking-widest cursor-default mb-1">
                {tcgMode ? 'Interactive Physics Enabled' : 'Interactive: Hover & Click'}
              </div>
            )}
          </div>
        ))}
        
        {/* Metaverse Exporter Hook */}
        <button 
          className="bg-white/5 border border-white/10 hover:bg-[#39ff14]/20 hover:border-[#39ff14]/50 hover:text-[#39ff14] text-zinc-400 font-bold uppercase tracking-widest text-[9px] py-1.5 rounded transition-all w-full flex items-center justify-center gap-2"
          onClick={() => exportScene && exportScene()}
          title="Serialize Particle Grid to .GLB Binary for Mona/Decentraland"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export 3D Mesh
        </button>
      </div>
    </div>
  );
}
