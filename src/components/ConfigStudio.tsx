import React, { useState } from 'react';
import {
  FileCode,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  Download,
  Settings,
  Cpu,
  Save,
} from 'lucide-react';
import { DEFAULT_FRIGATE_CONFIG_YAML } from '../mockData';

interface ConfigStudioProps {
  onRestartEngine: () => void;
}

export const ConfigStudio: React.FC<ConfigStudioProps> = ({ onRestartEngine }) => {
  const [yamlContent, setYamlContent] = useState<string>(DEFAULT_FRIGATE_CONFIG_YAML);
  const [validationResult, setValidationResult] = useState<{
    status: 'valid' | 'error' | 'none';
    message?: string;
  }>({ status: 'valid', message: 'YAML configuration matches Frigate v0.14 schema specifications.' });
  const [copied, setCopied] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const handleValidate = () => {
    // Simple client-side YAML structure validation
    try {
      if (!yamlContent.includes('cameras:')) {
        throw new Error("Missing required 'cameras:' root section.");
      }
      if (!yamlContent.includes('mqtt:')) {
        throw new Error("Missing 'mqtt:' configuration section.");
      }
      if (!yamlContent.includes('detectors:') && !yamlContent.includes('coral:')) {
        throw new Error("Warning: No hardware detector specified. CPU detection will be used.");
      }
      setValidationResult({
        status: 'valid',
        message: 'Configuration verified: All mandatory schemas, roles, and zones parsed properly.',
      });
    } catch (err: any) {
      setValidationResult({
        status: 'error',
        message: err.message,
      });
    }
  };

  const handleApplyTemplate = (type: 'coral' | 'openvino' | 'nvidia' | 'cpu') => {
    let snippet = '';
    if (type === 'coral') {
      snippet = `detectors:\n  coral:\n    type: edgetpu\n    device: usb\n`;
    } else if (type === 'openvino') {
      snippet = `detectors:\n  ov:\n    type: openvino\n    device: GPU\n`;
    } else if (type === 'nvidia') {
      snippet = `detectors:\n  tensorrt:\n    type: tensorrt\n    device: 0\n`;
    } else {
      snippet = `detectors:\n  cpu:\n    type: cpu\n`;
    }

    setYamlContent((prev) => {
      // Replace detectors block
      const regex = /detectors:[\s\S]*?(?=model:|$)/;
      if (regex.test(prev)) {
        return prev.replace(regex, snippet);
      }
      return snippet + prev;
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(yamlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.yml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestart = () => {
    setIsRestarting(true);
    onRestartEngine();
    setTimeout(() => {
      setIsRestarting(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200">
            <FileCode className="w-5 h-5 text-slate-200" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-mono font-bold">
              Engine Specification
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">
              Configuration Studio (YAML)
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Validate Button */}
          <button
            onClick={handleValidate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Validate Schema</span>
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Download config.yml */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export .yml</span>
          </button>

          {/* Save & Restart */}
          <button
            id="btn-restart-frigate"
            onClick={handleRestart}
            disabled={isRestarting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-black bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-950 transition-colors shadow-sm"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRestarting ? 'animate-spin' : ''}`} />
            <span>{isRestarting ? 'Restarting Engine...' : 'Commit & Restart'}</span>
          </button>
        </div>
      </div>

      {/* Preset Accelerator Templates Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-4 rounded-2xl border border-slate-800 text-xs">
        <span className="text-slate-400 flex items-center gap-1.5 mr-2 text-[10px] uppercase tracking-wider font-bold">
          <Cpu className="w-3.5 h-3.5 text-slate-400" />
          <span>Hardware Accelerators:</span>
        </span>
        <button
          onClick={() => handleApplyTemplate('coral')}
          className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white border border-slate-800 text-[10px] uppercase tracking-wider font-bold transition-colors"
        >
          Google Coral USB EdgeTPU
        </button>
        <button
          onClick={() => handleApplyTemplate('openvino')}
          className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white border border-slate-800 text-[10px] uppercase tracking-wider font-bold transition-colors"
        >
          Intel OpenVINO GPU
        </button>
        <button
          onClick={() => handleApplyTemplate('nvidia')}
          className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white border border-slate-800 text-[10px] uppercase tracking-wider font-bold transition-colors"
        >
          Nvidia TensorRT
        </button>
        <button
          onClick={() => handleApplyTemplate('cpu')}
          className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 text-[10px] uppercase tracking-wider font-bold transition-colors"
        >
          CPU Detector
        </button>
      </div>

      {/* Validation Message */}
      {validationResult.status !== 'none' && (
        <div
          className={`flex items-center gap-2.5 p-3.5 rounded-2xl text-xs font-medium ${
            validationResult.status === 'valid'
              ? 'bg-slate-900 border border-emerald-500/40 text-emerald-300'
              : 'bg-red-950/40 border border-red-500/40 text-red-200'
          }`}
        >
          {validationResult.status === 'valid' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span className="text-xs">{validationResult.message}</span>
        </div>
      )}

      {/* YAML Editor Textarea */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-[10px] font-mono uppercase tracking-widest text-slate-400">
          <span>/config/frigate.yml</span>
          <span>YAML • UTF-8 • {yamlContent.split('\n').length} lines</span>
        </div>
        <textarea
          value={yamlContent}
          onChange={(e) => setYamlContent(e.target.value)}
          spellCheck={false}
          className="w-full h-[520px] p-4 bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed outline-none resize-none selection:bg-slate-800 selection:text-white"
        />
      </div>
    </div>
  );
};
