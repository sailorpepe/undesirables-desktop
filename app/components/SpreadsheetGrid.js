import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Expand, Shrink, Download, Settings, FileUp } from 'lucide-react';
import Papa from 'papaparse';

export default function SpreadsheetGrid({ defaultData = [] }) {
  const [data, setData] = useState(defaultData);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, colName }
  const [editingHeader, setEditingHeader] = useState(null); // colName
  const [dragActive, setDragActive] = useState(false);
  const [title, setTitle] = useState('📊 Interactive Data Matrix');
  const [editingTitle, setEditingTitle] = useState(false);

  useEffect(() => {
    setData(defaultData);
  }, [defaultData]);

  // Derive columns dynamically from the entire dataset to prevent schema blindness if rows differ
  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    const keySet = new Set();
    data.forEach(row => {
      Object.keys(row).forEach(k => { if (!k.startsWith('_')) keySet.add(k); });
    });
    return Array.from(keySet);
  }, [data]);

  // Handle local mathematical column sorting
  const handleSort = (key) => {
    // Prevent sorting if clicking while editing a header
    if (editingHeader === key) return;

    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });

    const sortedData = [...data].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setData(sortedData);
  };

  const updateCell = (rowIndex, colName, value) => {
    const newData = [...data];
    newData[rowIndex] = { ...newData[rowIndex], [colName]: value };
    setData(newData);
  };

  const updateHeader = (oldColName, newColName) => {
    if (!newColName.trim() || newColName === oldColName) {
      setEditingHeader(null);
      return;
    }
    
    // SECURITY (§6): Mitigate Component Prototype Pollution
    // Object.create(null) rows eliminate prototype chain entirely.
    // This expanded set covers Unicode escape sequences and downstream JSON serialization risks.
    const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype',
      'toString', 'valueOf', 'hasOwnProperty', '__defineGetter__', '__defineSetter__']);
    if (FORBIDDEN_KEYS.has(newColName)) {
      console.warn(`[SECURITY] Blocked prototype pollution attempt via column rename: '${newColName}'`);
      setEditingHeader(null);
      return;
    }
    
    // Rename keys across all rows
    const newData = data.map(row => {
      const newRow = { ...row };
      newRow[newColName] = newRow[oldColName];
      delete newRow[oldColName];
      return newRow;
    });
    setData(newData);
    setEditingHeader(null);
  };

  // §5 SECURITY: Sanitize cell value against CSV formula injection (OWASP + Red-Team §5)
  // Full-width Unicode normalization + universal tab prefix prevents ALL DDE execution
  // regardless of locale, encoding, or spreadsheet engine parsing differentials.
  const sanitizeCSVCell = (value) => {
    let str = String(value || '');
    // Normalize full-width ASCII variants (U+FF01–U+FF5E) to standard ASCII.
    // Excel normalizes these back to active formula triggers on import.
    str = str.replace(/[\uFF01-\uFF5E]/g, ch =>
      String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    );
    // Catch leading whitespace/newlines masking trigger characters.
    // Added `|` (pipe) — DDE uses `=cmd|'/c calc'!A0` syntax.
    // Expanded with \x0B (\v) to catch Vertical Tab payloads explicitly.
    const FORMULA_TRIGGERS = /^[\s\n\r\v\x0B]*[=+\-@|]/;
    if (FORMULA_TRIGGERS.test(str)) {
      // Tab prefix (0x09) is universally effective across Excel, Numbers, LibreOffice.
      // Unlike apostrophe, tab forces text-mode without visual artifacts.
      return '\t' + str;
    }
    return str;
  };

  // Convert array state to raw text and trigger DOM download for Microsoft Excel / Apple Numbers
  const handleExportCSV = () => {
    if (!data || data.length === 0) return;
    const headerRow = columns.join(',');
    const rows = data.map(item => columns.map(col => `"${sanitizeCSVCell(item[col]).replace(/"/g, '""')}"`).join(','));
    const csvString = [headerRow, ...rows].join('\n');
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `undesirables_ai_export_${new Date().getTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV Drag and Drop Merging Logic
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
         Papa.parse(file, {
           header: true,
           skipEmptyLines: true,
           complete: (results) => {
             // Assign a new source tint color map for visual provenance
             const sourceKey = `import_${new Date().getTime()}`;
             // Sanitize imported cells — strip formula triggers on ingestion
             const importedRows = results.data.map(r => {
               const clean = Object.assign(Object.create(null), { _source: sourceKey });
               for (const [k, v] of Object.entries(r)) {
                 clean[k] = sanitizeCSVCell(v);
               }
               return clean;
             });
             
             // Append to existing data (native array merge)
             setData(prev => [...prev, ...importedRows]);
           }
         });
      }
    }
  };

  // Assign background tints based on _source property for Merging Provenance visualization
  const getRowStyle = (item) => {
    if (item._source === 'list_a') return 'bg-emerald-900/10 hover:bg-emerald-900/30';
    if (item._source === 'list_b') return 'bg-blue-900/10 hover:bg-blue-900/30';
    if (item._source && item._source.startsWith('import_')) return 'bg-purple-900/20 hover:bg-purple-900/40 border-l border-purple-500';
    return 'bg-[#0a140d] hover:bg-neon-primary/10';
  };

  if (!data || data.length === 0) return null;

  const content = (
    <div 
        className={`flex flex-col border border-neon-primary/30 rounded-lg overflow-hidden bg-neon-bg shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all relative ${isExpanded ? 'h-[80vh] w-full z-50 mt-4' : 'h-80 mt-2'}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
    >
      {/* Drag Overlay indicating auto-merge intercept */}
      {dragActive && (
        <div className="absolute inset-0 z-50 bg-neon-primary/20 backdrop-blur-sm flex flex-col items-center justify-center border-2 border-dashed border-neon-primary pointer-events-none">
          <FileUp size={48} className="text-neon-primary animate-bounce mb-4" />
          <h3 className="text-neon-primary font-mono text-xl font-bold tracking-widest bg-black/50 px-4 py-2 rounded">DROP CSV TO AUTO-MERGE</h3>
        </div>
      )}

      {/* Table Top Controls */}
      <div className="flex items-center justify-between p-2 lg:p-3 border-b border-neon-primary/20 bg-[#051108]">
        <div className="flex items-center gap-2">
          {editingTitle ? (
            <input
              autoFocus
              defaultValue={title}
              onBlur={(e) => { setTitle(e.target.value.trim() || title); setEditingTitle(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setTitle(e.target.value.trim() || title); setEditingTitle(false); } }}
              className="bg-black text-neon-primary px-2 py-0.5 outline-none border border-neon-primary text-[10px] md:text-xs font-mono font-bold tracking-widest uppercase min-w-[200px]"
            />
          ) : (
            <span 
              onDoubleClick={() => setEditingTitle(true)}
              className="text-[10px] md:text-xs text-neon-primary font-mono tracking-widest uppercase font-bold cursor-text hover:text-white transition-colors"
              title="Double-click to edit Tracking Matrix title"
            >
              {title} ({data.length} Rows)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => document.getElementById('csv-file-upload').click()}
            className="text-[10px] flex items-center gap-1 bg-transparent hover:bg-purple-900/40 border border-purple-500/30 hover:border-purple-500 hover:text-white text-purple-400 px-2 py-1 rounded transition-colors uppercase cursor-pointer"
          >
            <FileUp size={12} /> IMPORT CSV
          </button>
          <input 
            type="file" 
            id="csv-file-upload" 
            accept=".csv" 
            className="hidden" 
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                Papa.parse(file, {
                  header: true, skipEmptyLines: true,
                  complete: (results) => {
                    const sourceKey = `import_${new Date().getTime()}`;
                    const importedRows = results.data.map(r => {
                    const clean = Object.assign(Object.create(null), { _source: sourceKey });
                      for (const [k, v] of Object.entries(r)) {
                        clean[k] = sanitizeCSVCell(v);
                      }
                      return clean;
                    });
                    setData(prev => [...prev, ...importedRows]);
                  }
                });
              }
            }}
          />
          <button 
            onClick={handleExportCSV}
            className="text-[10px] flex items-center gap-1 bg-transparent border border-blue-500/30 hover:border-blue-500 hover:bg-blue-900/40 text-blue-400 hover:text-white px-2 py-1 rounded transition-colors uppercase cursor-pointer"
          >
            <Download size={12} /> EXPORT
          </button>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] flex items-center gap-1 bg-transparent border border-neon-primary/30 hover:bg-neon-primary/10 text-neon-primary px-2 py-1 rounded transition-colors cursor-pointer"
          >
            {isExpanded ? <Shrink size={12} /> : <Expand size={12} />}
          </button>
        </div>
      </div>

      {/* Grid Canvas */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead className="sticky top-0 bg-[#051108] z-10 shadow-[0_5px_15px_rgba(0,0,0,0.5)] border-b-2 border-neon-primary/30">
            <tr>
              {columns.map(col => (
                <th 
                  key={col} 
                  className="p-2 lg:p-3 border-r border-neon-primary/10 text-neon-primary/90 uppercase whitespace-nowrap group hover:bg-neon-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-2 justify-between">
                    {editingHeader === col ? (
                      <input
                        autoFocus
                        defaultValue={col}
                        onBlur={(e) => updateHeader(col, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') updateHeader(col, e.target.value); }}
                        className="bg-black text-white px-1 py-0.5 w-full border border-neon-primary/50 outline-none text-[10px] font-mono"
                      />
                    ) : (
                      <span 
                        className="cursor-pointer hover:text-white flex-1"
                        onClick={(e) => {
                          // If double clicked or holding modifier, rename column
                          if (e.detail === 2) {
                            setEditingHeader(col);
                          } else {
                            handleSort(col);
                          }
                        }}
                        title="Click to sort, Double-click to rename column"
                      >
                        {col}
                      </span>
                    )}
                    {sortConfig.key === col && (
                      <span className="text-[10px] text-neon-primary/50">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className={`border-b border-white/5 transition-colors group ${getRowStyle(row)}`}>
                {columns.map(col => {
                  const isEditing = editingCell?.rowIndex === idx && editingCell?.colName === col;
                  return (
                    <td 
                      key={col} 
                      className={`p-2 lg:p-3 text-white/90 whitespace-nowrap border-r border-white/5 truncate max-w-[200px] cursor-text hover:bg-neon-primary/10 transition-colors ${isEditing ? 'p-0' : ''}`}
                      onClick={() => !isEditing && setEditingCell({ rowIndex: idx, colName: col })}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          defaultValue={row[col]}
                          onBlur={(e) => {
                            updateCell(idx, col, e.target.value);
                            setEditingCell(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateCell(idx, col, e.target.value);
                              setEditingCell(null);
                            }
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-full h-full bg-black/80 text-white px-2 lg:px-3 py-2 outline-none border border-neon-primary font-mono text-xs focus:ring-1 focus:ring-neon-primary"
                        />
                      ) : (
                        row[col]
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return content;
}
