"use client";
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export default function ThreeDViewer({ modelPath, width = "100%", height = "600px" }) {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvedPath, setResolvedPath] = useState(null);

  // Step 1: Resolve the path via Tauri's convertFileSrc
  useEffect(() => {
    async function resolve() {
      let p = modelPath;
      if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__ && modelPath && !modelPath.startsWith('asset://') && !modelPath.startsWith('blob:')) {
        try {
          const { convertFileSrc } = await import('@tauri-apps/api/core');
          if (modelPath.startsWith('/')) {
            p = convertFileSrc(modelPath);
          }
        } catch(e) {
          console.warn("Tauri convertFileSrc unavailable:", e);
        }
      }
      setResolvedPath(p);
    }
    resolve();
  }, [modelPath]);

  // Step 2: Once path is resolved, set up the Three.js scene
  useEffect(() => {
    if (!resolvedPath) return;
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#11131a');

    const camera = new THREE.PerspectiveCamera(45, currentMount.clientWidth / currentMount.clientHeight, 0.1, 100);
    camera.position.set(2, 2, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    currentMount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 10, 7.5);
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xaabbff, 1);
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);

    let loadedModel = null;

    // Load Model
    const loader = new GLTFLoader();
    loader.load(
      resolvedPath,
      (gltf) => {
        setLoading(false);
        loadedModel = gltf.scene;

        const box = new THREE.Box3().setFromObject(loadedModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const s = 3.0 / maxDim;
          loadedModel.scale.setScalar(s);
        }

        loadedModel.position.x += (loadedModel.position.x - center.x) * loadedModel.scale.x;
        loadedModel.position.y += (loadedModel.position.y - center.y) * loadedModel.scale.y;
        loadedModel.position.z += (loadedModel.position.z - center.z) * loadedModel.scale.z;
        loadedModel.position.y -= 0.5;

        scene.add(loadedModel);
      },
      undefined,
      (err) => {
        console.error("ThreeDViewer load error:", err);
        setError("Failed to load 3D model.");
        setLoading(false);
      }
    );

    // Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      if (loadedModel) {
        loadedModel.position.y += Math.sin(Date.now() * 0.002) * 0.001;
      }
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const handleResize = () => {
      if (!currentMount) return;
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.clear();
    };
  }, [resolvedPath]);

  return (
    <div className="relative border border-neon-primary/30 rounded-lg overflow-hidden my-4 group shadow-[0_0_20px_rgba(34,197,94,0.15)]" style={{ width, height }}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
          <div className="w-8 h-8 border-2 border-neon-primary border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs font-mono tracking-widest text-neon-primary animate-pulse">RENDERING ASSET...</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <span className="text-xs font-mono text-red-500">{error}</span>
        </div>
      )}
      <div 
        ref={mountRef} 
        style={{ width: '100%', height: '100%' }} 
        className="cursor-move"
        title="Left Click: Rotate | Right Click: Pan | Scroll: Zoom"
      />
      <div className="absolute bottom-2 left-2 bg-black/50 text-white/50 border border-white/10 px-2 py-1 text-[10px] font-mono rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        INTERACTIVE 3D STAGE
      </div>
    </div>
  );
}
