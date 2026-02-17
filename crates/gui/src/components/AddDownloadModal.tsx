import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { X, FolderOpen, Loader2, Download } from "lucide-react";

interface DownloadMetadata {
  filename: string;
  size: number;
  url: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

interface AddDownloadModalProps {
  initialUrl?: string;
  onClose: () => void;
  onStarted: (id: string, url: string, filename: string, path: string, totalSize: number, connections: number) => void;
}

export function AddDownloadModal({ initialUrl = "", onClose, onStarted }: AddDownloadModalProps) {
  const [url, setUrl] = useState(initialUrl);
  const [filename, setFilename] = useState("");
  const [savePath, setSavePath] = useState("");
  const [connections, setConnections] = useState(8);
  const [metadata, setMetadata] = useState<DownloadMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    invoke<string>("get_downloads_dir").then(dir => {
      setSavePath(dir);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialUrl) {
      fetchMetadata(initialUrl);
    }
  }, [initialUrl]);

  const fetchMetadata = async (targetUrl: string) => {
    if (!targetUrl) return;
    setLoading(true);
    setError("");
    try {
      const meta = await invoke<DownloadMetadata>("get_metadata", { url: targetUrl });
      setMetadata(meta);
      setFilename(meta.filename);
      const dir = await invoke<string>("get_downloads_dir");
      setSavePath(`${dir}/${meta.filename}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleBrowse = async () => {
    const selected = await openDialog({ directory: true, title: "Choose save location" });
    if (selected && typeof selected === "string") {
      setSavePath(`${selected}/${filename}`);
    }
  };

  const handleStart = async () => {
    if (!url || !savePath || !metadata) return;
    setStarting(true);
    setError("");

    const downloadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    onStarted(downloadId, url, filename, savePath, metadata.size, connections);
    onClose();

    try {
      await invoke("start_download", {
        downloadId,
        url,
        path: savePath,
        connections,
      });
    } catch (e) {
      console.error("start_download failed:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">New Download</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors rounded-lg p-1 hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchMetadata(url)}
                placeholder="https://example.com/file.zip"
                className="flex-1 px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={() => fetchMetadata(url)}
                disabled={loading || !url}
                className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
              </button>
            </div>
          </div>

          {metadata && (
            <>
              <div className="flex items-center gap-3 px-3 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-sm text-zinc-300">{formatBytes(metadata.size)}</span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-300">Filename</label>
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-300">Save to</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={savePath}
                    onChange={(e) => setSavePath(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    onClick={handleBrowse}
                    className="px-3 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
                    title="Browse"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-300">Connections</label>
                <div className="flex gap-2">
                  {[1, 2, 4, 8, 16].map(n => (
                    <button
                      key={n}
                      onClick={() => setConnections(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        connections === n
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="px-3 py-2.5 bg-red-950/40 border border-red-900/50 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={!metadata || !savePath || starting}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {starting ? "Starting..." : "Start Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
