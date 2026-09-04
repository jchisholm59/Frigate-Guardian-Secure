import React from 'react';
import { SystemTelemetryData, CameraStream, AppTheme } from '../types';
import {
  Cpu,
  HardDrive,
  Flame,
  Activity,
  Server,
  Zap,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Database,
  Clock,
  Radio,
  Palette,
  Sparkles,
} from 'lucide-react';

interface SystemTelemetryProps {
  telemetry: SystemTelemetryData;
  cameras: CameraStream[];
  theme?: AppTheme;
  onSetTheme?: (theme: AppTheme) => void;
}

export const SystemTelemetry: React.FC<SystemTelemetryProps> = ({
  telemetry,
  cameras,
  theme = 'midnight',
  onSetTheme,
}) => {
  const recordingsPct = Math.round(
    (telemetry.storage.recordingsUsedGb / telemetry.storage.recordingsTotalGb) * 100
  );
  const clipsPct = Math.round(
    (telemetry.storage.clipsUsedGb / telemetry.storage.clipsTotalGb) * 100
  );
  const shmPct = Math.round(
    (telemetry.storage.shmUsedMb / telemetry.storage.shmTotalMb) * 100
  );

  return (
    <div className="space-y-6">
      {/* Status Badge Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200">
            <Activity className="w-5 h-5 text-slate-200" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-mono font-bold">
              System Diagnostics
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">System Health Telemetry</h2>
          </div>
        </div>

        {telemetry.isLive ? (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black text-emerald-400 tracking-widest uppercase">Live Engine Active</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-black text-amber-400 tracking-widest uppercase">Simulated Data Environment</span>
          </div>
        )}
      </div>

      {/* Top Telemetry Metric Banners */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Coral TPU Accelerator Metric */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] font-bold">
              <Zap className="w-3.5 h-3.5 text-slate-300" />
              <span>Coral EdgeTPU</span>
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider">
              ONLINE
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">
              {telemetry.coral.inferenceSpeedMs}
            </span>
            <span className="text-xs font-bold text-slate-400">ms inference</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between pt-2 border-t border-slate-800">
            <span>FPS: <strong className="text-white">{telemetry.coral.detectionFps}</strong></span>
            <span>Temp: <strong className="text-white">{telemetry.coral.temperatureC}°C</strong></span>
          </div>
        </div>

        {/* System CPU Load */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] font-bold">
              <Cpu className="w-3.5 h-3.5 text-slate-300" />
              <span>CPU Utilization</span>
            </span>
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">8 Cores</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">
              {telemetry.cpuPercent}
            </span>
            <span className="text-xs font-bold text-slate-400">% load</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full border border-slate-800 overflow-hidden">
            <div
              className="bg-white h-full rounded-full transition-all"
              style={{ width: `${telemetry.cpuPercent}%` }}
            />
          </div>
        </div>

        {/* System RAM */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] font-bold">
              <Activity className="w-3.5 h-3.5 text-slate-300" />
              <span>Memory (RAM)</span>
            </span>
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">16 GB</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">
              {telemetry.ramPercent}
            </span>
            <span className="text-xs font-bold text-slate-400">% allocated</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full border border-slate-800 overflow-hidden">
            <div
              className="bg-white h-full rounded-full transition-all"
              style={{ width: `${telemetry.ramPercent}%` }}
            />
          </div>
        </div>

        {/* System Uptime & Status */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] font-bold">
              <Server className="w-3.5 h-3.5 text-slate-300" />
              <span>Engine Status</span>
            </span>
            <div className="flex items-center gap-2">
              {telemetry.isLive && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
              <span className={`text-[9px] uppercase tracking-wider font-black ${telemetry.isLive ? 'text-emerald-400' : 'text-white'}`}>
                {telemetry.isLive ? 'LIVE' : 'STABLE'}
              </span>
            </div>
          </div>
          <div className="text-base font-black uppercase tracking-wider text-white truncate">
            {telemetry.version}
          </div>
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pt-2 border-t border-slate-800">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="truncate">{telemetry.uptimeFormatted}</span>
          </div>
        </div>
      </div>

      {/* Storage Disk Retention Breakdown */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-5 shadow-sm">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-slate-300" />
          <h3 className="text-xs uppercase tracking-[0.25em] font-black text-slate-400">
            Storage Volumes & Retention Allocation
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Recordings Disk */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white font-bold uppercase tracking-wider text-[11px]">Continuous Stream Storage</span>
              <span className="text-white font-black">{recordingsPct}%</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full border border-slate-800 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all"
                style={{ width: `${recordingsPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              <span>{telemetry.storage.recordingsUsedGb.toFixed(0)} GB used</span>
              <span>{telemetry.storage.recordingsTotalGb} GB cap</span>
            </div>
          </div>

          {/* Event Clips & Snapshots */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white font-bold uppercase tracking-wider text-[11px]">Event Clips & Snapshots</span>
              <span className="text-white font-black">{clipsPct}%</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full border border-slate-800 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all"
                style={{ width: `${clipsPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              <span>{telemetry.storage.clipsUsedGb.toFixed(0)} GB used</span>
              <span>{telemetry.storage.clipsTotalGb} GB cap</span>
            </div>
          </div>

          {/* Shared Memory Buffer /dev/shm */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white font-bold uppercase tracking-wider text-[11px]">IPC Shared Memory (/dev/shm)</span>
              <span className="text-white font-black">{shmPct}%</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full border border-slate-800 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all"
                style={{ width: `${shmPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              <span>{telemetry.storage.shmUsedMb} MB used</span>
              <span>{telemetry.storage.shmTotalMb} MB cap</span>
            </div>
          </div>
        </div>
      </div>

      {/* UI Theme & Display Mode */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Interface Theme & Styling</h3>
              <p className="text-xs text-slate-400">Select your preferred surveillance console colorway</p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono font-bold uppercase text-slate-300">
            Active: <strong className="text-white font-black">{theme === 'slate-grey' ? 'Slate Grey' : 'Midnight Obsidian'}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Midnight Obsidian Option */}
          <button
            id="theme-select-midnight"
            type="button"
            onClick={() => onSetTheme && onSetTheme('midnight')}
            className={`p-4 rounded-xl text-left border transition-all cursor-pointer group ${
              theme === 'midnight'
                ? 'bg-slate-950 border-white ring-1 ring-white/20 shadow-md'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-[#020617] border border-slate-700 inline-block shadow-inner" />
                Midnight Obsidian
              </span>
              {theme === 'midnight' ? (
                <span className="px-2 py-0.5 rounded-md bg-white text-slate-950 text-[9px] font-black uppercase tracking-wider">
                  Active
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold text-slate-500 group-hover:text-slate-300">
                  Select
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Deep space-black palette (<code className="font-mono text-[10px] text-slate-300">#020617</code>) designed for OLED screens, zero-glare night operations, and maximum contrast.
            </p>
          </button>

          {/* Slate Grey Option */}
          <button
            id="theme-select-slate-grey"
            type="button"
            onClick={() => onSetTheme && onSetTheme('slate-grey')}
            className={`p-4 rounded-xl text-left border transition-all cursor-pointer group ${
              theme === 'slate-grey'
                ? 'bg-[#1a2233] border-cyan-400 ring-1 ring-cyan-400/30 shadow-md'
                : 'bg-[#1a2233]/40 border-slate-800 hover:border-slate-700 hover:bg-[#1a2233]/70 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-[#394d68] border border-cyan-400/60 inline-block shadow-inner" />
                Slate Grey
              </span>
              {theme === 'slate-grey' ? (
                <span className="px-2 py-0.5 rounded-md bg-cyan-400 text-slate-950 text-[9px] font-black uppercase tracking-wider">
                  Active
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold text-slate-500 group-hover:text-slate-300">
                  Select
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Refined matte slate-grey industrial palette (<code className="font-mono text-[10px] text-cyan-200">#1a2233 / #253347</code>) with soothing cool undertones and balanced daylight readability.
            </p>
          </button>
        </div>
      </div>

      {/* Per-Camera Stream Diagnostics Table */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-slate-300" />
            <h3 className="text-xs uppercase tracking-[0.25em] font-black text-slate-400">
              Camera Process Health & Ingestion Telemetry
            </h3>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono font-bold">
            {cameras.length} Pipelines Synchronized
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                <th className="py-3 px-3">Camera</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Resolution</th>
                <th className="py-3 px-3">Ingest FPS</th>
                <th className="py-3 px-3">Bitrate</th>
                <th className="py-3 px-3">Detection</th>
                <th className="py-3 px-3">Recording</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {cameras.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-3 font-bold text-white text-sm">{c.name}</td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-white">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Ingesting
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400 font-mono">{c.resolution}</td>
                  <td className="py-3 px-3 font-mono">{c.fps} fps</td>
                  <td className="py-3 px-3 font-mono">{(c.bitrateKbps / 1000).toFixed(1)} Mb/s</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-wider font-black ${
                        c.detectEnabled
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'bg-slate-950 text-slate-500 border border-slate-800'
                      }`}
                    >
                      {c.detectEnabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-wider font-black ${
                        c.recordEnabled
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-slate-950 text-slate-500 border border-slate-800'
                      }`}
                    >
                      {c.recordEnabled ? 'Recording' : 'Off'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
