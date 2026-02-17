import { useState, useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export type DownloadStatus = "downloading" | "completed" | "error" | "paused";

export interface Download {
  id: string;
  url: string;
  filename: string;
  path: string;
  totalSize: number;
  downloadedBytes: number;
  speed: number;
  eta: number;
  status: DownloadStatus;
  connections: number;
  error?: string;
  startedAt: number;
}

interface ProgressEvent {
  download_id: string;
  bytes_downloaded: number;
  active_workers: number;
}

interface CompletedEvent {
  download_id: string;
  url: string;
}

interface ErrorEvent {
  download_id: string;
  error: string;
}

interface PersistedDownload {
  id: string;
  url: string;
  filename: string;
  path: string;
  total_size: number;
  downloaded_bytes: number;
  status: string;
  connections: number;
  started_at: number;
}

function toPersistedDownload(d: Download): PersistedDownload {
  return {
    id: d.id,
    url: d.url,
    filename: d.filename,
    path: d.path,
    total_size: d.totalSize,
    downloaded_bytes: d.downloadedBytes,
    status: d.status,
    connections: d.connections,
    started_at: d.startedAt,
  };
}

function fromPersistedDownload(p: PersistedDownload): Download {
  return {
    id: p.id,
    url: p.url,
    filename: p.filename,
    path: p.path,
    totalSize: p.total_size,
    downloadedBytes: p.downloaded_bytes,
    speed: 0,
    eta: 0,
    status: p.status === "downloading" ? "paused" : (p.status as DownloadStatus),
    connections: p.connections,
    startedAt: p.started_at,
  };
}

export function useDownloads() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const speedWindowRef = useRef<Map<string, { time: number; bytes: number }[]>>(new Map());
  const initializedRef = useRef(false);

  const addDownload = useCallback((
    download: Omit<Download, "downloadedBytes" | "speed" | "eta" | "status" | "startedAt">
  ) => {
    const newDownload: Download = {
      ...download,
      downloadedBytes: 0,
      speed: 0,
      eta: 0,
      status: "downloading",
      startedAt: Date.now(),
    };
    setDownloads(prev => [...prev, newDownload]);
    speedWindowRef.current.set(download.id, []);
    return newDownload.id;
  }, []);

  const pauseDownload = useCallback((id: string) => {
    invoke("cancel_download", { downloadId: id });
    setDownloads(prev => prev.map(d => d.id === id ? { ...d, status: "paused", speed: 0, eta: 0 } : d));
  }, []);

  const resumeDownload = useCallback((id: string) => {
    const target = downloads.find(d => d.id === id);
    if (!target) return;

    setDownloads(prev => prev.map(d => d.id === id ? { ...d, status: "downloading" } : d));
    invoke("start_download", {
      appHandle: undefined, // Tauri handles this
      state: undefined,     // Tauri handles this
      downloadId: target.id,
      url: target.url,
      path: target.path,
      connections: target.connections
    });
  }, [downloads]);

  const removeDownload = useCallback(async (id: string) => {
    const target = downloads.find(d => d.id === id);
    if (!target) return;

    if (target.status === "downloading") {
      invoke("cancel_download", { downloadId: id });
    }

    // Delete session file
    invoke("delete_file", { path: `${target.path}.kitsune` });
    // Delete actual file (optional, but requested as "Remove the download when its done or paused/stopped")
    // If it's done, maybe we don't want to delete the file? 
    // Usually "Remove" in DMs means remove from list and optionally delete files.
    // The prompt says "removing the download when its done or paused/stopped".
    // I'll delete the partial/completed file too for "Remove".
    invoke("delete_file", { path: target.path });

    setDownloads(prev => prev.filter(d => d.id !== id));
  }, [downloads]);

  const dismissDownload = useCallback((id: string) => {
    const target = downloads.find(d => d.id === id);
    if (!target) return;

    if (target.status === "downloading") {
      invoke("cancel_download", { downloadId: id });
    }

    setDownloads(prev => prev.filter(d => d.id !== id));
  }, [downloads]);

  const openFolder = useCallback((path: string) => {
    invoke("show_in_folder", { path });
  }, []);

  useEffect(() => {
    invoke<PersistedDownload[]>("load_state").then(persisted => {
      if (persisted.length > 0) {
        setDownloads(persisted.map(fromPersistedDownload));
      }
      initializedRef.current = true;
    }).catch(() => { initializedRef.current = true; });
  }, []);

  useEffect(() => {
    if (!initializedRef.current) return;
    const persisted = downloads.map(toPersistedDownload);
    invoke("save_state", { downloads: persisted }).catch(() => {});
  }, [downloads]);

  useEffect(() => {
    const unlistenProgress = listen<ProgressEvent>("download-progress", (event) => {
      const { download_id, bytes_downloaded, active_workers } = event.payload;
      const now = Date.now();

      setDownloads(prev => {
        const target = prev.find(d => d.id === download_id);
        if (!target) return prev;

        const win = speedWindowRef.current.get(download_id) ?? [];
        win.push({ time: now, bytes: bytes_downloaded });
        const cutoff = now - 2000;
        const trimmed = win.filter(e => e.time >= cutoff);
        speedWindowRef.current.set(download_id, trimmed);

        const windowBytes = trimmed.reduce((sum, e) => sum + e.bytes, 0);
        const windowMs = trimmed.length > 1
          ? trimmed[trimmed.length - 1].time - trimmed[0].time
          : 1000;
        const speed = windowMs > 0 ? (windowBytes / windowMs) * 1000 : 0;

        const newDownloaded = target.totalSize > 0 
          ? Math.min(target.downloadedBytes + bytes_downloaded, target.totalSize)
          : target.downloadedBytes + bytes_downloaded;
        const remaining = target.totalSize > 0 ? target.totalSize - newDownloaded : 0;
        const eta = speed > 0 && remaining > 0 ? remaining / speed : 0;

        return prev.map(d =>
          d.id === download_id
            ? { ...d, downloadedBytes: newDownloaded, speed, eta, connections: active_workers }
            : d
        );
      });
    });

    const unlistenCompleted = listen<CompletedEvent>("download-completed", (event) => {
      const { download_id } = event.payload;
      setDownloads(prev =>
        prev.map(d =>
          d.id === download_id
            ? { ...d, status: "completed" as DownloadStatus, speed: 0, eta: 0 }
            : d
        )
      );
    });

    const unlistenError = listen<ErrorEvent>("download-error", (event) => {
      const { download_id, error } = event.payload;
      setDownloads(prev =>
        prev.map(d =>
          d.id === download_id
            ? { ...d, status: "error" as DownloadStatus, error }
            : d
        )
      );
    });

    const unlistenPaused = listen<ProgressEvent>("download-paused", (event) => {
      const { download_id } = event.payload;
      setDownloads(prev =>
        prev.map(d =>
          d.id === download_id
            ? { ...d, status: "paused" as DownloadStatus, speed: 0, eta: 0 }
            : d
        )
      );
    });

    return () => {
      unlistenProgress.then(fn => fn());
      unlistenCompleted.then(fn => fn());
      unlistenError.then(fn => fn());
      unlistenPaused.then(fn => fn());
    };
  }, []);

  return { 
    downloads, 
    addDownload, 
    pauseDownload, 
    resumeDownload, 
    removeDownload, 
    dismissDownload, 
    openFolder 
  };
}
