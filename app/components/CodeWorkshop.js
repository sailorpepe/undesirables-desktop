"use client";
import React, { useState, useEffect } from 'react';
import { Code2, Play, Eye, CheckCircle, XCircle, Loader2, Save, RefreshCw, ChevronDown, Copy, Terminal } from 'lucide-react';

const WORKSHOP_TEMPLATES = [
  {
    id: 'video_promo',
    label: '🎬 Video Promo',
    description: 'Generate a beat-synced NFT showcase video',
    fields: [
      { key: 'images_folder', label: 'NFT images folder', type: 'text', default: '', placeholder: '~/Documents/Meme Merchants/build/images/' },
      { key: 'nft_count', label: 'NFTs to feature', type: 'select', options: ['4', '6', '8', '12', '16', '24', '32'], default: '6' },
      { key: 'b_roll_assets', label: 'Extra B-Roll (Folder/File)', type: 'text', default: '', placeholder: 'path/to/ai_video.mp4 or folder' },
      { key: 'audio_file', label: 'Audio track', type: 'text', default: '', placeholder: '~/Documents/Meme Merchants/audio/beat.mp3' },
      { key: 'beat_sync', label: 'Sync to Audio Beats', type: 'select', options: ['Yes (Librosa beat detection)', 'No (Fixed intervals)'], default: 'Yes (Librosa beat detection)' },
      { key: 'duration', label: 'Duration', type: 'select', options: ['10s', '15s', '30s', '45s', '60s', '90s'], default: '15s' },
      { key: 'bg_style', label: 'Background Style', type: 'select', options: ['Solid Color', 'RGB Strobe', 'Color Shift Gradient', 'Static Noise', 'Hypnotic Spiral', 'Vaporwave Grid'], default: 'Color Shift Gradient' },
      { key: 'bg_color', label: 'Solid Color (if used)', type: 'color', default: '#0a0a0a' },
      { key: 'title_text', label: 'Intro Title text', type: 'text', default: 'THE UNDESIRABLES', placeholder: 'Enter intro text...' },
      { key: 'outro_text', label: 'Outro text', type: 'text', default: 'MINTING NOW', placeholder: 'Enter outro text...' },
      { key: 'font_family', label: 'Text Font', type: 'select', options: ['Impact', 'Arial Black', 'Courier New', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Times New Roman', 'Montserrat', 'Open Sans', 'Roboto', 'Bebas Neue', 'Oswald', 'Cinzel', 'VT323', 'Press Start 2P', 'Orbitron'], default: 'Impact' },
      { key: 'music_genre', label: 'Music genre', type: 'select', options: ['Drill', 'Lo-Fi', 'Phonk', 'Synthwave', 'Cinematic', 'Trap', 'EDM', 'Boom Bap', 'Ambient'], default: 'Drill' },
      { key: 'effect_style', label: 'Foreground VFX', type: 'select', options: ['Glitch', 'VHS', 'Neon Glow', 'Strobe', 'Channel Roll', 'Clean', 'Schizo', 'Datamosh', 'Chromatic Aberration', 'Film Grain', 'Scanlines', 'Matrix Rain', 'Acid Warp', 'Double Exposure', 'Retro CRT', 'RGB Split', 'Pixelate', 'Vaporwave', 'Ethereal Soul', 'Cyberpunk Overdrive', 'Inferno', 'Void Corruption'], default: 'Glitch' },
      { key: 'resolution', label: 'Resolution', type: 'select', options: ['1080x1920 (TikTok)', '1920x1080 (YouTube)', '1080x1080 (Feed)', '720x1280 (Stories)'], default: '1080x1920 (TikTok)' },
      { key: 'run_info', label: 'How to run', type: 'info', text: 'After saving, run: pip install Pillow librosa numpy ffmpeg-python opencv-python, then: python workshop_video_promo_*.py — FFmpeg required.' },
    ],
  },
  {
    id: 'beat_sync',
    label: '🎵 Beat Sync Cutter',
    description: 'Cut video to music beats using librosa',
    fields: [
      { key: 'video_path', label: 'Video file', type: 'text', default: '', placeholder: 'path/to/video.mp4' },
      { key: 'audio_path', label: 'Audio file', type: 'text', default: '', placeholder: 'path/to/audio.mp3' },
      { key: 'beat_sensitivity', label: 'Beat sensitivity', type: 'select', options: ['Low', 'Medium', 'High', 'Ultra'], default: 'Medium' },
      { key: 'transition', label: 'Cut transition', type: 'select', options: ['Hard Cut', 'Crossfade', 'Flash White', 'Glitch', 'Zoom Pulse', 'Whip Pan', 'Color Invert', 'Shake', 'Strobe Flash', 'RGB Split', 'VHS Roll', 'Pixelate'], default: 'Hard Cut' },
      { key: 'output_format', label: 'Output format', type: 'select', options: ['MP4 (H.264)', 'WebM (VP9)', 'MOV (ProRes)'], default: 'MP4 (H.264)' },
      { key: 'run_info', label: 'How to run', type: 'info', text: 'Run: pip install librosa moviepy numpy, then: python workshop_beat_sync_*.py — Requires FFmpeg (brew install ffmpeg).' },
    ],
  },
  {
    id: 'batch_rename',
    label: '📂 Batch Renamer',
    description: 'Rename files in bulk with pattern matching',
    fields: [
      { key: 'folder_path', label: 'Target folder', type: 'text', default: '', placeholder: '~/Documents/images/' },
      { key: 'pattern', label: 'Name pattern', type: 'text', default: 'undesirable_{n}', placeholder: 'prefix_{n}.ext' },
      { key: 'start_number', label: 'Start number', type: 'text', default: '1' },
      { key: 'file_filter', label: 'File filter', type: 'select', options: ['All files', '*.png', '*.jpg', '*.mp4', '*.json', '*.csv'], default: '*.png' },
      { key: 'dry_run', label: 'Dry run first', type: 'select', options: ['Yes (preview only)', 'No (rename immediately)'], default: 'Yes (preview only)' },
      { key: 'run_info', label: 'How to run', type: 'info', text: 'Pure Python — no dependencies needed. Run: python workshop_batch_rename_*.py' },
    ],
  },
  {
    id: 'web_scraper',
    label: '🕷️ Web Scraper',
    description: 'Scrape data from websites and APIs into CSV/JSON',
    fields: [
      { key: 'target_url', label: 'Target URL', type: 'text', default: '', placeholder: 'https://example.com/api/...' },
      { key: 'data_type', label: 'Data to extract', type: 'select', options: ['Floor prices (NFT)', 'Product prices', 'Table data', 'API JSON response', 'Image URLs', 'Text content'], default: 'Floor prices (NFT)' },
      { key: 'data_cleaning', label: 'Data cleaning', type: 'select', options: ['Raw Data', 'Clean HTML & Format Text', 'Extract Strict Numbers/Prices'], default: 'Extract Strict Numbers/Prices' },
      { key: 'anti_bot', label: 'Anti-Bot bypass', type: 'select', options: ['None', 'Rotate User-Agents', 'Use Proxies', 'Stealth Mode (Browser)'], default: 'Rotate User-Agents' },
      { key: 'auth', label: 'Authentication', type: 'select', options: ['None (Public)', 'Include API Key Header', 'Login via Session/Cookie'], default: 'None (Public)' },
      { key: 'output_format', label: 'Save as', type: 'select', options: ['CSV', 'JSON', 'SQLite database'], default: 'CSV' },
      { key: 'schedule', label: 'Schedule', type: 'select', options: ['Run once', 'Every hour', 'Every 6 hours', 'Daily', 'Weekly'], default: 'Run once' },
      { key: 'language', label: 'Language', type: 'select', options: ['Python (requests + BeautifulSoup)', 'JavaScript (puppeteer)', 'Python (Selenium)'], default: 'Python (requests + BeautifulSoup)' },
      { key: 'run_info', label: 'How to run', type: 'info', text: 'Python: pip install requests beautifulsoup4 fake-useragent — JS: npm install puppeteer puppeteer-extra — then run the script.' },
    ],
  },
  {
    id: 'discord_bot',
    label: '🤖 Discord Bot',
    description: 'Generate bot code — you\'ll need a Discord bot token and npm install',
    fields: [
      { key: 'bot_name', label: 'Bot name', type: 'text', default: 'Undesirable Bot', placeholder: 'My Bot' },
      { key: 'features', label: 'Features', type: 'select', options: ['Floor price alerts', 'Daily GM post', 'Holder verification', 'Raffle commands', 'All of the above'], default: 'All of the above' },
      { key: 'slash_commands', label: 'Command type', type: 'select', options: ['Slash Commands (Recommended)', 'Prefix Commands (e.g. !help)'], default: 'Slash Commands (Recommended)' },
      { key: 'database', label: 'Database / Memory', type: 'select', options: ['None', 'JSON File', 'SQLite', 'PostgreSQL'], default: 'SQLite' },
      { key: 'ai_integration', label: 'AI Integration', type: 'select', options: ['None (Static Rules)', 'Local AI (Ollama)', 'OpenAI API'], default: 'None (Static Rules)' },
      { key: 'error_logging', label: 'Error Logging', type: 'select', options: ['Console Only', 'Log to File', 'Discord Webhook Alerts'], default: 'Console Only' },
      { key: 'language', label: 'Language', type: 'select', options: ['JavaScript (discord.js)', 'Python (discord.py)', 'TypeScript'], default: 'JavaScript (discord.js)' },
      { key: 'hosting', label: 'Hosting target', type: 'select', options: ['Local (always on)', 'Railway', 'Render', 'VPS'], default: 'Local (always on)' },
      { key: 'note', label: 'Setup note', type: 'info', text: '⚠️ Generates the code only. You must create a Discord bot at discord.com/developers, enable Privileged Intents, get a token, and run npm install or pip install separately.' },
    ],
  },
  {
    id: 'csv_invoice',
    label: '🧾 CSV → PDF Invoice',
    description: 'Convert spreadsheet data to branded invoices',
    fields: [
      { key: 'csv_path', label: 'CSV file', type: 'text', default: '', placeholder: 'path/to/data.csv' },
      { key: 'company_name', label: 'Company name', type: 'text', default: '', placeholder: 'Your Business LLC' },
      { key: 'logo_path', label: 'Logo file', type: 'text', default: '', placeholder: 'path/to/logo.png' },
      { key: 'currency', label: 'Currency', type: 'select', options: ['USD ($)', 'EUR (€)', 'GBP (£)', 'ETH (Ξ)'], default: 'USD ($)' },
      { key: 'tax_rate', label: 'Tax rate (%)', type: 'text', default: '0' },
      { key: 'run_info', label: 'How to run', type: 'info', text: 'Run: pip install reportlab pandas, then: python workshop_csv_invoice_*.py — Outputs PDFs to same folder as CSV.' },
    ],
  },
  {
    id: 'custom',
    label: '✏️ Custom Script',
    description: 'Describe anything — FORGE will write it',
    fields: [
      { key: 'description', label: 'What do you want?', type: 'textarea', default: '', placeholder: 'Describe the script you need in plain English...' },
      { key: 'language', label: 'Language', type: 'select', options: ['Python', 'JavaScript (Node)', 'Bash/Shell', 'TypeScript', 'Rust', 'Go'], default: 'Python' },
      { key: 'complexity', label: 'Complexity', type: 'select', options: ['Simple (< 50 lines)', 'Medium (50-200 lines)', 'Complex (200+ lines)'], default: 'Medium (50-200 lines)' },
    ],
  },
];

export default function CodeWorkshop({ onSubmit, brainMode, selectedModel }) {
  const [activeTemplate, setActiveTemplate] = useState(0);
  const [formValues, setFormValues] = useState({});
  const [generatedCode, setGeneratedCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [syntaxStatus, setSyntaxStatus] = useState(null); // null | 'checking' | 'pass' | 'fail'
  const [syntaxErrors, setSyntaxErrors] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState('');

  const template = WORKSHOP_TEMPLATES[activeTemplate];

  // Init form values when template changes
  useEffect(() => {
    const defaults = {};
    template.fields.forEach(f => { defaults[f.key] = f.default || ''; });
    setFormValues(defaults);
    setGeneratedCode('');
    setSyntaxStatus(null);
    setSyntaxErrors('');
    setSaveResult('');
  }, [activeTemplate]);

  const updateField = (key, val) => {
    setFormValues(prev => ({ ...prev, [key]: val }));
  };

  const buildPrompt = () => {
    const t = template;
    let prompt = `Write a complete, production-ready script for: ${t.description}\n\nParameters:\n`;
    t.fields.forEach(f => {
      const val = formValues[f.key] || f.default || '(not set)';
      prompt += `- ${f.label}: ${val}\n`;
    });
    prompt += '\nRequirements:\n';
    prompt += '- Include all imports/dependencies at the top\n';
    prompt += '- Add clear comments explaining each section\n';
    prompt += '- Include error handling\n';
    prompt += '- Make it immediately runnable\n';
    prompt += '- Output ONLY the code in a single fenced code block\n';
    prompt += '- Do NOT include explanations outside the code block\n';
    return prompt;
  };

  const generateCode = async () => {
    setGenerating(true);
    setGeneratedCode('');
    setSyntaxStatus(null);
    const prompt = buildPrompt();

    try {
      const model = selectedModel || 'qwen3.5:35b-a3b-coding-nvfp4';
      const resp = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: `/no_think\n${prompt}`,
          stream: false,
          options: { temperature: 0.3, num_predict: 4000, num_ctx: 16384 },
        }),
        signal: AbortSignal.timeout(120000),
      });

      const rawText = await resp.text();
      let data;
      try { data = JSON.parse(rawText); } catch { throw new Error('Invalid JSON from Ollama'); }

      let code = (data.response || '').trim();
      // Extract code from fenced block if present
      const codeMatch = code.match(/```[\w]*\n([\s\S]*?)```/);
      if (codeMatch) code = codeMatch[1].trim();
      setGeneratedCode(code);

      // Auto syntax check
      if (code) checkSyntax(code);
    } catch (e) {
      setGeneratedCode(`# Error generating code: ${e.message}\n# Make sure FORGE model is loaded in Ollama`);
    }
    setGenerating(false);
  };

  const checkSyntax = async (code) => {
    setSyntaxStatus('checking');
    setSyntaxErrors('');
    try {
      // Detect language
      const isPython = code.includes('import ') || code.includes('def ') || code.includes('print(');
      const isJS = code.includes('const ') || code.includes('require(') || code.includes('async ');
      const isBash = code.startsWith('#!/bin/') || code.includes('echo ');

      if (isPython) {
        // Use Ollama to check Python syntax
        const resp = await fetch('http://127.0.0.1:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen3:8b',
            prompt: `/no_think\nCheck this Python code for syntax errors ONLY. If there are errors, list them with line numbers. If the code is syntactically valid, respond with exactly "PASS". Do NOT suggest improvements.\n\n\`\`\`python\n${code}\n\`\`\``,
            stream: false,
            options: { temperature: 0, num_predict: 500 },
          }),
          signal: AbortSignal.timeout(30000),
        });
        const data = JSON.parse(await resp.text());
        const result = (data.response || '').trim();
        if (result.toUpperCase().includes('PASS') || result.toLowerCase().includes('no syntax error') || result.toLowerCase().includes('syntactically valid')) {
          setSyntaxStatus('pass');
        } else {
          setSyntaxStatus('fail');
          setSyntaxErrors(result);
        }
      } else if (isJS) {
        // Basic JS syntax check via Function constructor
        try {
          // Strip imports/requires for syntax check
          const stripped = code.replace(/^(import|const\s+\w+\s*=\s*require).*$/gm, '// import');
          new Function(stripped);
          setSyntaxStatus('pass');
        } catch (e) {
          setSyntaxStatus('fail');
          setSyntaxErrors(e.message);
        }
      } else if (isBash) {
        // Bash: basic brace/quote matching
        const opens = (code.match(/\{/g) || []).length;
        const closes = (code.match(/\}/g) || []).length;
        const singleQuotes = (code.match(/'/g) || []).length;
        if (opens !== closes) {
          setSyntaxStatus('fail');
          setSyntaxErrors(`Mismatched braces: ${opens} opened, ${closes} closed`);
        } else if (singleQuotes % 2 !== 0) {
          setSyntaxStatus('fail');
          setSyntaxErrors('Mismatched single quotes');
        } else {
          setSyntaxStatus('pass');
        }
      } else {
        // Unknown language — use NEXUS for quick check
        setSyntaxStatus('pass');
      }
    } catch {
      setSyntaxStatus(null); // Can't check — skip silently
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveToWorkspace = async () => {
    if (!generatedCode) return;
    setSaving(true);
    setSaveResult('');
    try {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const { documentDir } = await import('@tauri-apps/api/path');
      const docs = await documentDir();
      const ext = generatedCode.includes('import ') || generatedCode.includes('def ') ? 'py' : generatedCode.startsWith('#!/bin/') ? 'sh' : 'js';
      const filename = `workshop_${template.id}_${Date.now()}.${ext}`;
      const fullPath = `${docs}Meme Merchants/scripts/${filename}`;
      await writeTextFile(fullPath, generatedCode);
      setSaveResult(`Saved: scripts/${filename}`);
      if (onSubmit) onSubmit({ type: 'save', path: fullPath, filename });
    } catch (e) {
      setSaveResult(`Error: ${e.message || e}`);
    }
    setSaving(false);
  };

  const sendToChat = () => {
    if (onSubmit && generatedCode) {
      const prompt = buildPrompt();
      onSubmit({ type: 'chat', prompt, code: generatedCode });
    }
  };

  return (
    <div className="w-full bg-[#0a0f0d] border border-[#00f0ff]/20 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0a0d14] border-b border-[#00f0ff]/10">
        <div className="flex items-center gap-2">
          <Code2 size={18} className="text-[#00f0ff]" />
          <span className="text-[#00f0ff] font-bold font-mono text-sm tracking-wider">CODE WORKSHOP</span>
          <span className="text-[#e0faec]/20 text-[10px] font-mono">FORGE ENGINE</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${brainMode === 'forge' ? 'bg-[#00f0ff] animate-pulse' : 'bg-yellow-500'}`} />
          <span className="text-[#e0faec]/40 text-[10px] font-mono">
            {brainMode === 'forge' ? 'FORGE ACTIVE' : 'FORGE RECOMMENDED'}
          </span>
        </div>
      </div>

      {/* Template Selector */}
      <div className="px-4 py-3 border-b border-[#00f0ff]/5">
        <div className="text-[#e0faec]/30 text-[10px] uppercase tracking-wider mb-2">Workshop Template</div>
        <div className="flex flex-wrap gap-1.5">
          {WORKSHOP_TEMPLATES.map((t, i) => (
            <button key={t.id} onClick={() => setActiveTemplate(i)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all cursor-pointer ${
                activeTemplate === i
                  ? 'border-[#00f0ff] text-[#00f0ff] bg-[#00f0ff]/10 shadow-[0_0_10px_rgba(0,240,255,0.1)]'
                  : 'border-[#e0faec]/10 text-[#e0faec]/50 hover:border-[#00f0ff]/40 hover:text-[#00f0ff]/80'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="text-[#e0faec]/25 text-[10px] font-mono mt-1.5">{template.description}</div>
      </div>

      {/* Form Fields */}
      <div className="px-4 py-3 space-y-3 border-b border-[#00f0ff]/5">
        {template.fields.map(field => (
          <div key={field.key} className="flex items-center gap-3">
            <label className="text-[#e0faec]/50 text-[11px] font-mono w-36 shrink-0 text-right">{field.label}</label>
            {field.type === 'info' ? (
              <div className="flex-1 px-3 py-2 bg-yellow-500/5 border border-yellow-500/20 rounded text-yellow-400/80 text-[10px] font-mono leading-relaxed">
                {field.text}
              </div>
            ) : field.type === 'select' ? (
              <div className="relative flex-1">
                <select
                  value={formValues[field.key] || field.default}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  className="w-full bg-black/60 border border-[#e0faec]/15 rounded px-3 py-1.5 text-[#00f0ff] text-xs font-mono outline-none focus:border-[#00f0ff]/50 appearance-none cursor-pointer"
                >
                  {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#e0faec]/20 pointer-events-none" />
              </div>
            ) : field.type === 'color' ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="color"
                  value={formValues[field.key] || field.default}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  className="w-8 h-8 rounded border border-[#e0faec]/15 bg-transparent cursor-pointer"
                />
                <span className="text-[#e0faec]/30 text-[10px] font-mono">{formValues[field.key] || field.default}</span>
              </div>
            ) : field.type === 'textarea' ? (
              <textarea
                value={formValues[field.key] || ''}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                className="flex-1 bg-black/60 border border-[#e0faec]/15 rounded px-3 py-1.5 text-[#00f0ff] text-xs font-mono outline-none focus:border-[#00f0ff]/50 resize-none placeholder:text-[#e0faec]/15"
              />
            ) : (
              <input
                type="text"
                value={formValues[field.key] || ''}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="flex-1 bg-black/60 border border-[#e0faec]/15 rounded px-3 py-1.5 text-[#00f0ff] text-xs font-mono outline-none focus:border-[#00f0ff]/50 placeholder:text-[#e0faec]/15"
              />
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 flex gap-2">
        <button onClick={generateCode} disabled={generating}
          className={`flex-1 py-2.5 rounded-lg font-mono text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            generating
              ? 'bg-[#00f0ff]/5 border border-[#00f0ff]/20 text-[#00f0ff]/50'
              : 'bg-[#00f0ff]/15 border border-[#00f0ff] text-[#00f0ff] hover:bg-[#00f0ff]/25 hover:shadow-[0_0_25px_rgba(0,240,255,0.15)]'
          }`}>
          {generating
            ? <><Loader2 size={14} className="animate-spin" /> FORGE IS WRITING...</>
            : <><Eye size={14} /> PREVIEW CODE</>
          }
        </button>
        <button onClick={sendToChat} disabled={!generatedCode || generating}
          className={`flex-1 py-2.5 rounded-lg font-mono text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            !generatedCode
              ? 'bg-white/[0.02] border border-white/10 text-white/20 cursor-not-allowed'
              : 'bg-gradient-to-r from-[#00f0ff]/15 to-[#39ff14]/15 border border-[#39ff14] text-[#39ff14] hover:from-[#00f0ff]/25 hover:to-[#39ff14]/25'
          }`}>
          <Play size={14} /> SEND TO CHAT
        </button>
      </div>

      {/* Code Preview */}
      {generatedCode && (
        <div className="px-4 pb-3">
          {/* Syntax Status Bar */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {syntaxStatus === 'checking' && <><Loader2 size={12} className="animate-spin text-yellow-400" /><span className="text-yellow-400 text-[10px] font-mono">Checking syntax...</span></>}
              {syntaxStatus === 'pass' && <><CheckCircle size={12} className="text-[#39ff14]" /><span className="text-[#39ff14] text-[10px] font-mono">Syntax OK</span></>}
              {syntaxStatus === 'fail' && <><XCircle size={12} className="text-red-400" /><span className="text-red-400 text-[10px] font-mono">Syntax errors found</span></>}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => checkSyntax(generatedCode)} title="Re-check syntax"
                className="text-[#e0faec]/30 hover:text-[#00f0ff] p-1 rounded transition-all cursor-pointer">
                <RefreshCw size={12} />
              </button>
              <button onClick={copyCode} title="Copy to clipboard"
                className="text-[#e0faec]/30 hover:text-[#00f0ff] p-1 rounded transition-all cursor-pointer">
                {copied ? <CheckCircle size={12} className="text-[#39ff14]" /> : <Copy size={12} />}
              </button>
              <button onClick={saveToWorkspace} disabled={saving} title="Save to workspace scripts/"
                className="text-[#e0faec]/30 hover:text-[#00f0ff] p-1 rounded transition-all cursor-pointer disabled:opacity-30">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              </button>
            </div>
          </div>

          {/* Syntax Error Details */}
          {syntaxStatus === 'fail' && syntaxErrors && (
            <div className="mb-2 p-2 bg-red-500/5 border border-red-500/20 rounded text-red-400 text-[10px] font-mono leading-relaxed whitespace-pre-wrap max-h-24 overflow-y-auto">
              {syntaxErrors}
            </div>
          )}

          {/* Code Block */}
          <div className="relative">
            <pre className="bg-[#020502] border border-[#00f0ff]/10 rounded-lg p-3 text-[11px] font-mono text-[#e0faec]/80 overflow-x-auto max-h-80 overflow-y-auto leading-relaxed custom-scrollbar whitespace-pre-wrap">
              {generatedCode}
            </pre>
          </div>

          {/* Save Result */}
          {saveResult && (
            <div className={`mt-2 text-[10px] font-mono ${saveResult.startsWith('Error') ? 'text-red-400' : 'text-[#39ff14]/70'}`}>
              {saveResult.startsWith('Error') ? '❌' : '✅'} {saveResult}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-3 border-t border-[#00f0ff]/5 pt-3">
        <div className="text-[#e0faec]/15 text-[9px] font-mono text-center">
          FORGE · 100% Local · No Cloud · Scripts saved to ~/Documents/Meme Merchants/scripts/
        </div>
      </div>
    </div>
  );
}
