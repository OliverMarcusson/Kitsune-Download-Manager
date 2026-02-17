import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { Plus } from "lucide-react";
import { AddDownloadModal } from "./components/AddDownloadModal";
import { DownloadCard } from "./components/DownloadCard";
import { ToastContainer, ToastMessage } from "./components/Toast";
import { useDownloads } from "./hooks/useDownloads";

function extractUrlFromDeepLink(raw: string): string {
  const trimmed = raw.trim().replace(/^"|"$/g, "");
  return trimmed;
}

function App() {
  const [showModal, setShowModal] = useState(false);
  const [pendingUrl, setPendingUrl] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { 
    downloads, 
    addDownload, 
    pauseDownload, 
    resumeDownload, 
    removeDownload, 
    dismissDownload, 
    openFolder 
  } = useDownloads();

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const unlisten = listen<string>("deep-link-received", (event) => {
      const url = extractUrlFromDeepLink(event.payload);
      setPendingUrl(url);
      setShowModal(true);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  useEffect(() => {
    const unlisten = listen<{ download_id: string; error: string }>("download-error", (event) => {
      const { error } = event.payload;
      setToasts(prev => [...prev, { id: `${Date.now()}`, message: `Download failed: ${error}` }]);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleStarted = (
    id: string,
    url: string,
    filename: string,
    path: string,
    totalSize: number,
    connections: number
  ) => {
    addDownload({ id, url, filename, path, totalSize, connections });
  };

  const activeCount = downloads.filter(d => d.status === "downloading").length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center">
            <img src="/logo.png" alt="Kitsune Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-none">Kitsune</h1>
            <p className="text-xs text-zinc-500 leading-none mt-0.5">Download Manager</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <span className="text-xs text-blue-400 bg-blue-950/50 border border-blue-900/50 px-2.5 py-1 rounded-full">
              {activeCount} active
            </span>
          )}
          <button
            onClick={() => { setPendingUrl(""); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Download
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        {downloads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-64 text-center">
            <div className="w-16 h-16 mb-4 flex items-center justify-center">
              <img src="/logo.png" alt="Kitsune Logo" className="w-full h-full object-contain opacity-20 grayscale" />
            </div>
            <p className="text-zinc-400 font-medium">No downloads yet</p>
            <p className="text-zinc-600 text-sm mt-1">Click "Add Download" or use the browser extension</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {downloads.map(dl => (
              <DownloadCard 
                key={dl.id} 
                download={dl}
                onPause={pauseDownload}
                onResume={resumeDownload}
                onRemove={removeDownload}
                onDismiss={dismissDownload}
                onOpenFolder={openFolder}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <AddDownloadModal
          initialUrl={pendingUrl}
          onClose={() => { setShowModal(false); setPendingUrl(""); }}
          onStarted={handleStarted}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
