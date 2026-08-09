import { Download } from "../hooks/useDownloads";
import { CheckCircle, XCircle, Download as DownloadIcon, Zap, Clock, Layers, Play, Pause, Folder, Trash2, X } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return "—";
  if (seconds < 1) return "< 1s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

interface DownloadCardProps {
  download: Download;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
  onDismiss: (id: string) => void;
  onOpenFolder: (path: string) => void;
}

export function DownloadCard({ download, onPause, onResume, onRemove, onDismiss, onOpenFolder }: DownloadCardProps) {
  const { filename, url, totalSize, downloadedBytes, speed, eta, status, connections, error, path } = download;
  const progress = totalSize > 0 ? Math.min((downloadedBytes / totalSize) * 100, 100) : 0;

  const statusIcon = {
    downloading: <DownloadIcon className="w-4 h-4 text-blue-400 animate-pulse" />,
    completed: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    error: <XCircle className="w-4 h-4 text-red-400" />,
    paused: <Pause className="w-4 h-4 text-zinc-400" />,
  }[status];

  const statusColor = {
    downloading: "text-blue-400",
    completed: "text-emerald-400",
    error: "text-red-400",
    paused: "text-zinc-400",
  }[status];

  const progressBarColor = {
    downloading: "bg-blue-500",
    completed: "bg-emerald-500",
    error: "bg-red-500",
    paused: "bg-zinc-500",
  }[status];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {statusIcon}
            <span className="font-semibold text-white truncate">{filename}</span>
          </div>
          <p className="text-xs text-zinc-500 truncate">{url}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-xs font-medium px-2 py-1 rounded-full bg-zinc-800 ${statusColor}`}>
            {status === "downloading" ? "Downloading" : status === "completed" ? "Done" : status === "paused" ? "Paused" : "Error"}
          </span>
          
          {status === "downloading" && (
            <button
              onClick={() => onPause(download.id)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-blue-950/30 transition-colors"
              title="Pause download"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          {(status === "paused" || status === "error") && (
            <button
              onClick={() => onResume(download.id)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-950/30 transition-colors"
              title="Resume download"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          {status === "completed" && (
            <button
              onClick={() => onOpenFolder(path)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-blue-950/30 transition-colors"
              title="Open folder"
            >
              <Folder className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          <button
            onClick={() => onRemove(download.id)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
            title="Remove from list and delete files"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onDismiss(download.id)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Remove from list"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-zinc-400">
          <span>{formatBytes(downloadedBytes)} / {totalSize > 0 ? formatBytes(totalSize) : "?"}</span>
          <span>{progress.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${progressBarColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {status === "downloading" && (
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            {formatSpeed(speed)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            ETA {formatEta(eta)}
          </span>
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-500" />
            {connections} conn
          </span>
        </div>
      )}

      {status === "error" && error && (
        <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
}
