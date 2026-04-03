'use client';
import { useRef, Suspense, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows, Html } from '@react-three/drei';

function Model({ url, autoRotate = true }) {
  const meshRef = useRef();
  const { scene } = useGLTF(url);

  useFrame((_, delta) => {
    if (autoRotate && meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={meshRef}>
      <primitive object={scene} scale={1.5} />
    </group>
  );
}

function LoadingFallback() {
  return (
    <Html center>
      <div style={{
        color: '#39ff14',
        fontFamily: 'monospace',
        fontSize: '12px',
        textAlign: 'center',
        textShadow: '0 0 10px rgba(57,255,20,0.6)',
      }}>
        ⏳ Loading 3D model...
      </div>
    </Html>
  );
}

export default function ModelViewer({ modelPath, onExport, height = 300 }) {
  const [autoRotate, setAutoRotate] = useState(true);

  // Convert native file path to a blob URL if needed
  const modelUrl = modelPath?.startsWith('http') || modelPath?.startsWith('blob:')
    ? modelPath
    : `file://${modelPath}`;

  if (!modelPath) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#081a0c',
        border: '1px solid rgba(57,255,20,0.2)',
        borderRadius: '8px',
        color: '#39ff14',
        fontFamily: 'monospace',
        fontSize: '12px',
      }}>
        No 3D model loaded
      </div>
    );
  }

  return (
    <div style={{
      height,
      position: 'relative',
      background: 'linear-gradient(135deg, #081a0c 0%, #0a1f0e 100%)',
      border: '1px solid rgba(57,255,20,0.25)',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      {/* Controls overlay */}
      <div style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
        display: 'flex',
        gap: '6px',
      }}>
        <button
          onClick={() => setAutoRotate(prev => !prev)}
          style={{
            background: autoRotate ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${autoRotate ? 'rgba(57,255,20,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: autoRotate ? '#39ff14' : '#e0faec50',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            cursor: 'pointer',
          }}
          title={autoRotate ? 'Stop rotation' : 'Start rotation'}
        >
          🔄
        </button>
        {onExport && (
          <button
            onClick={onExport}
            style={{
              background: 'rgba(57,255,20,0.15)',
              border: '1px solid rgba(57,255,20,0.4)',
              color: '#39ff14',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              fontFamily: 'monospace',
              cursor: 'pointer',
            }}
            title="Export .glb file"
          >
            📥 Export
          </button>
        )}
      </div>

      {/* Model label */}
      <div style={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        zIndex: 10,
        color: '#39ff14',
        fontFamily: 'monospace',
        fontSize: '10px',
        opacity: 0.5,
        textShadow: '0 0 5px rgba(57,255,20,0.3)',
      }}>
        🧊 3D MODEL • drag to orbit
      </div>

      <Canvas
        camera={{ position: [2, 1.5, 3], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        <directionalLight position={[-3, 3, -3]} intensity={0.3} color="#39ff14" />
        <pointLight position={[0, -2, 0]} intensity={0.2} color="#39ff14" />

        <Suspense fallback={<LoadingFallback />}>
          <Model url={modelUrl} autoRotate={autoRotate} />
          <ContactShadows
            position={[0, -1.2, 0]}
            opacity={0.4}
            scale={5}
            blur={2}
            far={3}
            color="#000"
          />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={1.5}
          maxDistance={8}
          autoRotate={false}
        />

        {/* Grid floor */}
        <gridHelper args={[10, 20, '#39ff14', '#0a1f0e']} position={[0, -1.2, 0]} />
      </Canvas>
    </div>
  );
}
