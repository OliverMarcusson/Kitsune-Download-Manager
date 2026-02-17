use anyhow::Result;
use reqwest::header::RANGE;
use reqwest::Client;
use std::path::PathBuf;
use tokio::fs::OpenOptions;
use tokio::io::{AsyncSeekExt, AsyncWriteExt, SeekFrom};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc;

pub struct Worker {
    pub id: u8,
    url: String,
    range: (u64, u64),
    output_path: PathBuf,
    client: Client,
    progress_tx: mpsc::Sender<(u8, u64, u8)>, // (worker_id, bytes_written, status: 0=progress 1=complete 2=error)
    end_byte_atomic: Option<Arc<AtomicU64>>,
}

impl Worker {
    pub fn new(
        id: u8,
        url: String,
        range: (u64, u64),
        output_path: PathBuf,
        client: Client,
        progress_tx: mpsc::Sender<(u8, u64, u8)>,
        end_byte_atomic: Option<Arc<AtomicU64>>,
    ) -> Self {
        Self {
            id,
            url,
            range,
            output_path,
            client,
            progress_tx,
            end_byte_atomic,
        }
    }

    pub async fn run(self) -> Result<()> {
        let tx = self.progress_tx.clone();
        let id = self.id;
        
        // Use a wrapper to catch errors and report them
        match self.do_run().await {
            Ok(_) => Ok(()),
            Err(e) => {
                log::error!("Worker {} encountered a fatal error: {}", id, e);
                // Report error status (2) so main loop knows to abort
                let _ = tx.send((id, 0, 2)).await;
                Err(e)
            }
        }
    }

    async fn do_run(self) -> Result<()> {
        let mut current_pos = self.range.0;
        
        let mut retries = 0;
        let max_retries = 5;
        let mut backoff = std::time::Duration::from_secs(1);

        loop {
            if current_pos > self.range.1 {
                let _ = self.progress_tx.send((self.id, 0, 1)).await;
                return Ok(());
            }

            if retries >= max_retries {
                return Err(anyhow::anyhow!("Worker {} failed after {} retries", self.id, retries));
            }

            let range_header = format!("bytes={}-{}", current_pos, self.range.1);

            let response_result = self.client
                .get(&self.url)
                .header(RANGE, range_header.clone())
                .send()
                .await;

            match response_result {
                Ok(response) => {
                    let status = response.status();
                    if status.is_success() {
                        let mut run_response = response;
                        let mut file = OpenOptions::new()
                            .write(true)
                            .create(false) 
                            .open(&self.output_path)
                            .await?;
                
                        file.seek(SeekFrom::Start(current_pos)).await?;
                
                        let mut stream_error: Option<anyhow::Error> = None;
                        
                        loop {
                            match run_response.chunk().await {
                                Ok(Some(chunk)) => {
                                    let len = chunk.len() as u64;
                                    
                                    if let Some(atomic_end) = &self.end_byte_atomic {
                                        let actual_end = atomic_end.load(Ordering::Relaxed);
                                        if current_pos >= actual_end {
                                            break; // Done (split or completed range)
                                        }
                                    }
                                
                                    if let Err(e) = file.write_all(&chunk).await {
                                        stream_error = Some(e.into());
                                        break;
                                    }
                                    
                                    current_pos += len;
                                    
                                    if self.progress_tx.send((self.id, len, 0)).await.is_err() {
                                        return Ok(()); // Receiver dropped
                                    }
                                }
                                Ok(None) => break, // EOF, success
                                Err(e) => {
                                    stream_error = Some(e.into());
                                    break;
                                }
                            }
                        }
                        
                        if let Some(e) = stream_error {
                            log::warn!("Worker {} stream error: {}. Retrying...", self.id, e);
                        } else {
                            // Success!
                            let _ = self.progress_tx.send((self.id, 0, 1)).await;
                            return Ok(());
                        }
                    } else if status == reqwest::StatusCode::TOO_MANY_REQUESTS || status == reqwest::StatusCode::SERVICE_UNAVAILABLE {
                        log::warn!("Worker {} received {}. Retrying...", self.id, status);
                    } else {
                        response.error_for_status()?;
                    }
                },
                Err(e) => {
                    log::warn!("Worker {} connection failed: {}. Retrying...", self.id, e);
                },
            }

            log::info!("Worker {} sleeping for {:?} before retry {}", self.id, backoff, retries + 1);
            tokio::time::sleep(backoff).await;
            retries += 1;
            backoff *= 2;
        }
    }
}
