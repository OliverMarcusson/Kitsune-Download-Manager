use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DownloadState {
    Pending,
    Downloading,
    Paused,
    Completed,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadPart {
    pub id: u8,
    pub start_byte: u64,
    pub end_byte: u64,
    pub current_byte: u64,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadSession {
    pub url: String,
    pub output_path: PathBuf,
    pub total_size: Option<u64>,
    pub state: DownloadState,
    pub parts: Vec<DownloadPart>,
    pub connections: u8,
}

impl DownloadSession {
    pub fn new(url: String, output_path: PathBuf, connections: u8) -> Self {
        Self {
            url,
            output_path,
            total_size: None,
            state: DownloadState::Pending,
            parts: Vec::new(),
            connections,
        }
    }

    pub async fn save(&self, path: &std::path::Path) -> anyhow::Result<()> {
        let json = serde_json::to_string_pretty(self)?;
        tokio::fs::write(path, json).await?;
        Ok(())
    }

    pub async fn load(path: &std::path::Path) -> anyhow::Result<Self> {
        let json = tokio::fs::read_to_string(path).await?;
        let session: Self = serde_json::from_str(&json)?;
        Ok(session)
    }
}
