import React, { useRef, useState, useCallback } from 'react';
import { Camera, Video, XCircle, RotateCcw } from 'lucide-react';

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [errorText, setErrorText] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  // Device Enumeration
  React.useEffect(() => {
    let active = true;
    const initDevices = async () => {
      try {
        // Ping for initial permissions first so enumerateDevices can fetch labels
        await navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(s => s.getTracks().forEach(t => t.stop()));
        const all = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = all.filter(d => d.kind === 'videoinput');
        if (active && videoInputs.length > 0) {
          setDevices(videoInputs);
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      } catch (err) {
        if (active) setErrorText("Camera Access Denied or Missing. Check OS Privacy settings.");
      }
    };
    initDevices();
    return () => { active = false; };
  }, []);

  // Initialize Camera Stream when a device is selected
  React.useEffect(() => {
    let active = true;
    let localStream = null;

    const startCamera = async () => {
      if (!selectedDeviceId) return;
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        if (active) {
          localStream = s;
          setStream(s);
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        } else {
          // Unmounted before stream returned
          s.getTracks().forEach(t => t.stop());
        }
      } catch (err) {
        console.error("Swap Error:", err);
      }
    };

    startCamera();

    return () => {
      active = false;
      if (localStream) localStream.getTracks().forEach(t => t.stop());
    };
  }, [selectedDeviceId]);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (stream) stream.getTracks().forEach(t => t.stop());
  }, [stream]);

  // Handle Close
  const handleClose = () => {
    stopCamera();
    onClose();
  };

  // Extract raw Uint8Array from blob to save natively
  const saveNativeBlob = async (blob, prefix, extension) => {
    try {
      const { tempDir } = await import('@tauri-apps/api/path');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const ab = await blob.arrayBuffer();
      const u8 = new Uint8Array(ab);
      const tempPath = await tempDir();
      const filePath = `${tempPath.replace(/\/$/, '')}/${prefix}_${Date.now()}.${extension}`;
      await writeFile(filePath, u8);
      return filePath;
    } catch (e) {
      console.error("Native save failed:", e);
      return null;
    }
  };

  // Capture Single Photo Frame 
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL("image/jpeg", 0.9);
    
    fetch(b64)
      .then(res => res.blob())
      .then(async blob => {
        const path = await saveNativeBlob(blob, 'capture', 'jpg');
        if (path) {
          onCapture([path]); 
        }
        handleClose();
      });
  };

  // Start 3-Second Video Recording
  const startVideo = () => {
    if (!stream) return;
    let localChunks = [];
    
    // MP4/WebM
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm'; 
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        localChunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      setTimeout(async () => {
        const blob = new Blob(localChunks, { type: mimeType });
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const path = await saveNativeBlob(blob, 'video', extension);
        if (path) {
          onCapture([path]);
        }
        handleClose();
      }, 100);
    };

    recorder.start();
    setIsRecording(true);

    // 3 Second Countdown Loop
    let count = 3;
    setCountdown(count);
    const iv = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(iv);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
      <div className="bg-[#051108] border border-[#39ff14]/30 rounded-lg p-4 shadow-[0_0_30px_rgba(57,255,20,0.15)] flex flex-col gap-4 max-w-2xl w-full">
        <div className="flex justify-between items-center text-[#e0faec] flex-wrap gap-2">
          <h3 className="text-[#39ff14] text-lg uppercase tracking-widest font-bold flex items-center gap-2">
            <Camera /> Card Scanner
          </h3>
          <div className="flex items-center gap-4">
            {devices.length > 1 && (
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="bg-black border border-[#39ff14]/30 text-[#39ff14]/80 text-xs py-1 px-2 rounded outline-none w-48 truncate"
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
            <button onClick={handleClose} className="hover:text-red-500 transition-colors">
              <XCircle />
            </button>
          </div>
        </div>

        <div className="relative bg-black rounded overflow-hidden aspect-video border border-[#39ff14]/20 flex items-center justify-center">
          {errorText ? (
            <div className="text-red-500 text-sm">{errorText}</div>
          ) : (
            <>
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover" 
                autoPlay 
                playsInline 
                muted 
              />
              
              {/* Card-shaped scanning overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative" style={{width: '55%', aspectRatio: '2.5/3.5'}}>
                  <div className="absolute inset-0 border-2 border-[#39ff14] rounded-lg opacity-60"></div>
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-3 border-l-3 border-[#39ff14] rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-3 border-r-3 border-[#39ff14] rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-3 border-l-3 border-[#39ff14] rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-3 border-r-3 border-[#39ff14] rounded-br-lg"></div>
                  <div className="absolute top-2 left-0 right-0 text-center text-[#39ff14] text-[9px] font-mono uppercase tracking-[0.3em] opacity-60">Align Card Here</div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#39ff14]/40 animate-pulse" style={{animation: 'scanLine 2s ease-in-out infinite'}}></div>
                </div>
              </div>

              {/* Recording Indicator */}
              {isRecording && (
                <div className="absolute top-4 right-4 text-red-500 font-bold animate-pulse flex items-center gap-2 bg-black/50 px-3 py-1 rounded">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  REC ({countdown}s)
                </div>
              )}
            </>
          )}
        </div>

        {!errorText && (
           <div className="flex justify-between items-center bg-[#000] p-3 rounded border border-white/5 gap-4">
             <button 
               onClick={capturePhoto}
               disabled={isRecording}
               className="flex-1 bg-[#39ff14]/10 hover:bg-[#39ff14]/20 border border-[#39ff14]/50 text-[#39ff14] p-3 rounded uppercase text-sm tracking-widest cursor-pointer transition-all disabled:opacity-50"
             >
               📸 SCAN CARD
             </button>
             <button 
               onClick={startVideo}
               disabled={isRecording}
               className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-500 p-3 rounded uppercase text-sm tracking-widest cursor-pointer transition-all flex justify-center items-center gap-2 disabled:opacity-50"
             >
               <Video size={16} /> {isRecording ? 'Recording...' : 'Record Holo (3s)'}
             </button>
           </div>
        )}
      </div>
    </div>
  );
}
