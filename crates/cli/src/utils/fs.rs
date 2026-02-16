use std::path::PathBuf;

pub fn get_downloads_dir() -> PathBuf {
    // Try to get HOME from environment
    if let Ok(home) = std::env::var("HOME") {
        let downloads = PathBuf::from(home).join("Downloads");
        if downloads.exists() && downloads.is_dir() {
            return downloads;
        }
    }
    
    // Fallback to current directory if Downloads doesn't exist or on other OS
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}
