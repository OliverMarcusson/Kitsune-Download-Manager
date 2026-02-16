use super::session::{DownloadSession, DownloadState};
use super::worker::Worker;
use anyhow::Result;
use reqwest::{Client, header};
use std::path::PathBuf;
use tokio::fs::OpenOptions;
use tokio::sync::mpsc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::time::timeout;
use std::time::{Duration, Instant};

#[derive(Clone)]
pub struct Downloader {
    client: Client,
}

impl Downloader {
    pub fn new(user_agent: &str) -> Result<Self> {
        let client = Client::builder()
            .user_agent(user_agent)
            .timeout(std::time::Duration::from_secs(30))
            .pool_max_idle_per_host(0)
            .build()?;
            
        Ok(Self {
            client,
        })
    }

    pub async fn init_download(&self, url: &str, output_path: Option<PathBuf>, connections: u8) -> Result<DownloadSession> {
        let response = self.client.head(url).send().await?;
        let headers = response.headers();

        let total_size = headers
            .get(header::CONTENT_LENGTH)
            .and_then(|val| val.to_str().ok())
            .and_then(|val| val.parse::<u64>().ok());
            // .context("Failed to get content length")?; // Don't fail yet, might be chunked or unknown

        let accept_ranges = headers
            .get(header::ACCEPT_RANGES)
            .and_then(|val| val.to_str().ok())
            .map(|val| val == "bytes")
            .unwrap_or(false);
        
        // Filename resolution priority:
        // 1. Explicit output path (if provided)
        // 2. Content-Disposition header
        // 3. URL path segment
        // 4. Default "download.bin"
        
        let final_path = if let Some(path) = output_path {
            path
        } else {
            let content_disposition = headers
                .get(header::CONTENT_DISPOSITION)
                .and_then(|val| val.to_str().ok());

            let filename_from_header = content_disposition
                .and_then(|cd| {
                    if let Some(idx) = cd.find("filename=") {
                        let remaining = &cd[idx + 9..];
                        let end_idx = remaining.find(';').unwrap_or(remaining.len());
                        let raw_name = &remaining[..end_idx];
                        Some(raw_name.trim_matches('"').to_string())
                    } else {
                        None
                    }
                });

            let filename = filename_from_header.unwrap_or_else(|| {
                url.split('/')
                    .last()
                    .map(|s| s.split('?').next().unwrap_or(s)) // Remove query params
                    .filter(|s| !s.is_empty())
                    .unwrap_or("download.bin")
                    .to_string()
            });

            crate::utils::fs::get_downloads_dir().join(filename)
        };

        let mut session = DownloadSession::new(url.to_string(), final_path, connections);
        session.total_size = total_size;

        if let Some(size) = total_size {
             if accept_ranges && connections > 1 {
                let part_size = size / connections as u64;
                let mut start_byte = 0;

                for i in 0..connections {
                    let end_byte = if i == connections - 1 {
                        size - 1
                    } else {
                        start_byte + part_size - 1
                    };

                    session.parts.push(super::session::DownloadPart {
                        id: i,
                        start_byte,
                        end_byte,
                        current_byte: start_byte,
                        completed: false,
                    });

                    start_byte = end_byte + 1;
                }
            } else {
                session.parts.push(super::session::DownloadPart {
                    id: 0,
                    start_byte: 0,
                    end_byte: size - 1,
                    current_byte: 0,
                    completed: false,
                });
                session.connections = 1;
            }
        } else {
            // Unknown size, fallback to single connection stream (not fully supported in this arch yet)
             session.parts.push(super::session::DownloadPart {
                id: 0,
                start_byte: 0,
                end_byte: 0, // Unknown
                current_byte: 0,
                completed: false,
            });
            session.connections = 1;
        }
        
        session.state = DownloadState::Downloading;

        Ok(session)
    }

    pub async fn run(
        &self,
        session: &mut DownloadSession,
        ui_tx: Option<mpsc::Sender<(u8, u64, usize)>>,
        session_file: Option<PathBuf>,
    ) -> Result<()> {
        // Pre-allocate file only if starting from scratch or if file doesn't exist
        if !session.output_path.exists() {
            let file = OpenOptions::new()
                .write(true)
                .create(true)
                .open(&session.output_path)
                .await?;
            
            if let Some(size) = session.total_size {
                file.set_len(size).await?;
            }
        }
        session.state = DownloadState::Downloading;

        let (tx, mut rx) = mpsc::channel::<(u8, u64, u8)>(100);
        let mut handles = vec![];
        let mut worker_controls: HashMap<u8, Arc<AtomicU64>> = HashMap::new();

        // Spawn initial workers
        for part in &session.parts {
            if !part.completed {
                let atomic_end = Arc::new(AtomicU64::new(part.end_byte));
                worker_controls.insert(part.id, atomic_end.clone());

                let worker = Worker::new(
                    part.id,
                    session.url.clone(),
                    (part.current_byte, part.end_byte),
                    session.output_path.clone(),
                    self.client.clone(),
                    tx.clone(),
                    Some(atomic_end),
                );
                handles.push(tokio::spawn(async move { worker.run().await }));
            }
        }

        // Keep tx alive for work-stealing
        let worker_tx = tx.clone();
        drop(tx);

        let mut last_save = std::time::Instant::now();
        let mut last_ui_update = Instant::now();
        let mut pending_bytes: u64 = 0;
        let mut next_worker_id = session.parts.iter().map(|p| p.id).max().unwrap_or(0) + 1;
        
        loop {
            // Check for completion
            let all_done = session.parts.iter().all(|p| p.completed);
            if all_done {
                break;
            }

            // Receive with timeout
            match timeout(Duration::from_secs(1), rx.recv()).await {
                Ok(Some((worker_id, bytes, status))) => {
                    if status == 2 {
                        log::error!("Worker {} reported failure", worker_id);
                        return Err(anyhow::anyhow!("Worker {} reported failure", worker_id));
                    }
                    // Update session
                    if let Some(part) = session.parts.iter_mut().find(|p| p.id == worker_id) {
                        if status == 1 {
                            // Worker completed
                            part.completed = true;
                        } else {
                            // Progress update
                            part.current_byte += bytes;
                            
                            if part.current_byte > part.end_byte {
                               part.completed = true;
                            }
                        }
                    }

                    // Accumulate bytes for throttled UI updates
                    pending_bytes += bytes;

                    // Forward to UI only if 50ms elapsed or worker completed
                    if let Some(ui_sender) = &ui_tx {
                        if status == 1 || last_ui_update.elapsed() >= Duration::from_millis(50) {
                            let active_count = session.parts.iter().filter(|p| !p.completed).count();
                            // Use pending_bytes
                            let _ = ui_sender.send((worker_id, pending_bytes, active_count)).await;
                            pending_bytes = 0;
                            last_ui_update = Instant::now();
                        }
                    }
                    
                    // Work-stealing: if this worker just completed, help the slowest worker
                    if status == 1 {
                        // Find slowest worker (most bytes remaining)
                        let mut slowest: Option<(u8, u64, u64)> = None; // (id, remaining, current)
                        
                        for part in &session.parts {
                            if !part.completed {
                                let remaining = part.end_byte.saturating_sub(part.current_byte);
                                // Only steal if remaining is > 5MB
                                if remaining > 5 * 1024 * 1024 {
                                    if let Some((_, max_rem, _)) = slowest {
                                        if remaining > max_rem {
                                            slowest = Some((part.id, remaining, part.current_byte));
                                        }
                                    } else {
                                        slowest = Some((part.id, remaining, part.current_byte));
                                    }
                                }
                            }
                        }
                        
                        if let Some((slow_id, _, slow_current)) = slowest {
                            // Steal the back half
                            if let Some(part_idx) = session.parts.iter().position(|p| p.id == slow_id) {
                                let part = &mut session.parts[part_idx];
                                let old_end = part.end_byte;
                                let current = part.current_byte.max(slow_current); // Use latest position
                                let split_point = current + (old_end - current) / 2;
                                
                                // Update the slow worker's end
                                part.end_byte = split_point;
                                if let Some(atomic) = worker_controls.get(&slow_id) {
                                    atomic.store(split_point, Ordering::Relaxed);
                                }
                                
                                // Create new part for this helper worker
                                let new_part_start = split_point + 1;
                                let new_part_end = old_end;
                                let new_id = next_worker_id;
                                next_worker_id += 1;
                                
                                let new_part = super::session::DownloadPart {
                                    id: new_id,
                                    start_byte: new_part_start,
                                    end_byte: new_part_end,
                                    current_byte: new_part_start,
                                    completed: false,
                                };
                                
                                let atomic_end_new = Arc::new(AtomicU64::new(new_part_end));
                                worker_controls.insert(new_id, atomic_end_new.clone());
                                
                                let worker = Worker::new(
                                    new_id,
                                    session.url.clone(),
                                    (new_part_start, new_part_end),
                                    session.output_path.clone(),
                                    self.client.clone(),
                                    worker_tx.clone(), // Reuse the main sender
                                    Some(atomic_end_new),
                                );
                                
                                handles.push(tokio::spawn(async move { worker.run().await }));
                                session.parts.push(new_part);
                                
                                log::info!("Worker {} done, stealing from {} ({}-{})", 
                                    worker_id, slow_id, new_part_start, new_part_end);
                            }
                        }
                    }
                }
                Ok(None) => break,
                Err(_) => {}
            }
            
            // Periodically save
            if let Some(path) = &session_file {
                 if last_save.elapsed().as_secs() >= 1 {
                     let _ = session.save(path).await;
                     last_save = std::time::Instant::now();
                 }
            }
        }

        // Flush any remaining accumulated bytes to UI
        if pending_bytes > 0 {
            if let Some(ui_sender) = &ui_tx {
                let active_count = session.parts.iter().filter(|p| !p.completed).count();
                let _ = ui_sender.send((0, pending_bytes, active_count)).await;
            }
        }

        session.state = DownloadState::Completed;
        if let Some(path) = &session_file {
             let _ = session.save(path).await;
        }

        drop(rx);

        // Wait for all workers
        for handle in handles {
            let _ = handle.await;
        }

        Ok(())
    }
}
