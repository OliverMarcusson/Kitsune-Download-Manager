use serde::{Deserialize, Serialize};
use tauri::{Emitter, Listener, Manager, WindowEvent};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use kitsune_core::downloader::DownloadObserver;

struct AppState {
    cancel_flags: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

#[derive(Serialize, Clone)]
struct ProgressPayload {
    download_id: String,
    bytes_downloaded: u64,
    active_workers: usize,
}

struct TauriProgressObserver {
    app_handle: tauri::AppHandle,
    download_id: String,
}

impl DownloadObserver for TauriProgressObserver {
    fn on_progress(&self, _worker_id: u8, bytes_downloaded: u64, active_workers: usize) {
        let _ = self.app_handle.emit("download-progress", ProgressPayload {
            download_id: self.download_id.clone(),
            bytes_downloaded,
            active_workers,
        });
    }
}

#[derive(Serialize, Clone)]
struct CompletedPayload {
    download_id: String,
    url: String,
}

#[derive(Serialize, Clone)]
struct ErrorPayload {
    download_id: String,
    error: String,
}

#[derive(Serialize)]
pub struct DownloadMetadata {
    pub filename: String,
    pub size: u64,
    pub url: String,
}

fn log_to_file(msg: &str) {
    use std::io::Write;
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open("/tmp/kitsune-gui.log")
    {
        let _ = writeln!(file, "{}", msg);
    }
}

fn ipc_port_path() -> std::path::PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("kitsune-dm")
        .join("ipc.port")
}

fn remove_ipc_port_file() {
    let path = ipc_port_path();
    if path.exists() {
        let _ = std::fs::remove_file(&path);
        log_to_file("Removed IPC port file");
    }
}

fn extract_url_from_args(args: &[String]) -> Option<String> {
    log_to_file(&format!("Extracting from args: {:?}", args));
    for arg in args {
        // Strip quotes that might be added by the shell or desktop environment
        let clean_arg = arg.trim_matches(|c| c == '"' || c == '\'');
        if clean_arg.starts_with("kitsune://") {
            if let Some(encoded) = clean_arg.split("url=").nth(1) {
                let encoded = encoded.split('&').next().unwrap_or(encoded);
                return urlencoding::decode(encoded).ok().map(|s| s.into_owned());
            }
        }
    }
    None
}

#[tauri::command]
async fn get_metadata(url: String) -> Result<DownloadMetadata, String> {
    let downloader = kitsune_core::Downloader::new("Kitsune-DM/1.0")
        .map_err(|e| e.to_string())?;
    let (filename, size, _) = downloader.get_remote_metadata(&url)
        .await
        .map_err(|e| e.to_string())?;
    Ok(DownloadMetadata { filename, size: size.unwrap_or(0), url })
}

#[tauri::command]
async fn start_download(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    download_id: String,
    url: String,
    path: String,
    connections: u8,
) -> Result<(), String> {
    let downloader = kitsune_core::Downloader::new("Kitsune-DM/1.0")
        .map_err(|e| e.to_string())?;
    let output_path = std::path::PathBuf::from(&path);
    // Session file is side-by-side with the output file
    let session_file = std::path::PathBuf::from(format!("{}.kitsune", path));

    let mut session = if session_file.exists() {
        kitsune_core::DownloadSession::load(&session_file)
            .await
            .map_err(|e| e.to_string())?
    } else {
        downloader.init_download(&url, Some(output_path), connections)
            .await
            .map_err(|e| e.to_string())?
    };

    let observer = Arc::new(TauriProgressObserver {
        app_handle: app_handle.clone(),
        download_id: download_id.clone(),
    });

    let cancel_flag = Arc::new(AtomicBool::new(false));
    if let Ok(mut flags) = state.cancel_flags.lock() {
        flags.insert(download_id.clone(), cancel_flag.clone());
    }

    let download_id_clone = download_id.clone();
    let app_handle_clone = app_handle.clone();
    let session_file_clone = session_file.clone();

    tokio::spawn(async move {
        // Pass the session_file so the core saves progress
        let result = downloader.run(&mut session, Some(observer), Some(session_file_clone.clone()), Some(cancel_flag)).await;
        
        let app_state = app_handle_clone.state::<AppState>();
        if let Ok(mut flags) = app_state.cancel_flags.lock() {
            flags.remove(&download_id_clone);
        }

        if let Err(e) = result {
            let error_msg = e.to_string();
            if error_msg == "cancelled" {
                let _ = app_handle_clone.emit("download-paused", ProgressPayload {
                    download_id: download_id_clone,
                    bytes_downloaded: 0, // No delta to report
                    active_workers: 0,
                });
            } else {
                let _ = app_handle_clone.emit("download-error", ErrorPayload {
                    download_id: download_id_clone,
                    error: error_msg,
                });
            }
        } else {
            let _ = app_handle_clone.emit("download-completed", CompletedPayload {
                download_id: download_id_clone,
                url: session.url,
            });
            // Clean up session file on success
            if session_file_clone.exists() {
                let _ = std::fs::remove_file(session_file_clone);
            }
        }
    });
    Ok(())
}

#[tauri::command]
fn cancel_download(state: tauri::State<'_, AppState>, download_id: String) {
    if let Ok(flags) = state.cancel_flags.lock() {
        if let Some(flag) = flags.get(&download_id) {
            flag.store(true, Ordering::Relaxed);
        }
    }
}

#[tauri::command]
fn show_in_folder(path: String) {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .unwrap();
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(parent) = std::path::Path::new(&path).parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .unwrap();
        }
    }
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    if std::path::Path::new(&path).exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_downloads_dir() -> String {
    // 1. Try XDG download dir — but only if it differs from home
    let home = dirs::home_dir();
    if let Some(dir) = dirs::download_dir() {
        if home.as_ref() != Some(&dir) {
            return dir.to_string_lossy().to_string();
        }
    }
    // 2. ~/Downloads if it exists
    if let Some(ref h) = home {
        let downloads = h.join("Downloads");
        if downloads.exists() {
            return downloads.to_string_lossy().to_string();
        }
    }
    // 3. Fall back to home
    home.unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .to_string_lossy()
        .to_string()
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PersistedDownload {
    pub id: String,
    pub url: String,
    pub filename: String,
    pub path: String,
    pub total_size: u64,
    pub downloaded_bytes: u64,
    pub status: String,
    pub connections: u8,
    pub started_at: u64,
}

fn state_file_path() -> std::path::PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("kitsune-dm")
        .join("state.json")
}

#[tauri::command]
fn save_state(downloads: Vec<PersistedDownload>) -> Result<(), String> {
    let path = state_file_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&downloads).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_state() -> Vec<PersistedDownload> {
    let path = state_file_path();
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState { cancel_flags: Mutex::new(HashMap::new()) })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            log_to_file(&format!("Single instance triggered with args: {:?}", args));
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
            if let Some(url) = extract_url_from_args(&args) {
                log_to_file(&format!("Emitting deep-link-received from single-instance: {}", url));
                if let Err(e) = app.emit("deep-link-received", url) {
                    log_to_file(&format!("Failed to emit deep-link-received: {}", e));
                }
            } else {
                log_to_file("No URL found in args from single-instance event");
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }

            let handle = app.handle().clone();
            app.listen("deep-link://payload", move |event| {
                let raw = event.payload();
                log_to_file(&format!("Received deep-link://payload: {}", raw));
                // tauri-plugin-deep-link sends Vec<String> as JSON
                if let Ok(urls) = serde_json::from_str::<Vec<String>>(raw) {
                    for link in urls {
                        if let Some(url) = extract_url_from_args(&[link]) {
                             log_to_file(&format!("Emitting deep-link-received from payload listener: {}", url));
                             let _ = handle.emit("deep-link-received", url);
                        }
                    }
                }
            });

            let tray = tauri::tray::TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Kitsune Download Manager")
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        ..
                    } = event {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            let menu = tauri::menu::MenuBuilder::new(app)
                .item(&tauri::menu::MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?)
                .separator()
                .item(&tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?)
                .build()?;
            tray.set_menu(Some(menu))?;

            let handle2 = app.handle().clone();
            tray.on_menu_event(move |_tray, event| {
                match event.id().as_ref() {
                    "show" => {
                        if let Some(w) = handle2.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => { handle2.exit(0); }
                    _ => {}
                }
            });

            let startup_args: Vec<String> = std::env::args().collect();
            if let Some(url) = extract_url_from_args(&startup_args) {
                let handle3 = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    let _ = handle3.emit("deep-link-received", url);
                });
            }

            // IPC listener: allows the shim to send URLs directly to the running GUI
            // via a localhost TCP socket, bypassing xdg-open and the single-instance plugin.
            let ipc_listener = std::net::TcpListener::bind("127.0.0.1:0")
                .expect("Failed to bind IPC listener");
            ipc_listener.set_nonblocking(true).expect("Failed to set non-blocking");
            let port = ipc_listener.local_addr().unwrap().port();

            let port_path = ipc_port_path();
            if let Some(parent) = port_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let _ = std::fs::write(&port_path, port.to_string());
            log_to_file(&format!("IPC listener bound on 127.0.0.1:{}", port));

            let handle_ipc = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let listener = tokio::net::TcpListener::from_std(ipc_listener)
                    .expect("Failed to create async TcpListener");
                loop {
                    match listener.accept().await {
                        Ok((mut stream, _)) => {
                            let handle = handle_ipc.clone();
                            tokio::spawn(async move {
                                use tokio::io::AsyncReadExt;
                                let mut buf = String::new();
                                if stream.read_to_string(&mut buf).await.is_ok() {
                                    let url = buf.trim().to_string();
                                    if !url.is_empty() {
                                        log_to_file(&format!("IPC received URL: {}", url));
                                        if let Some(w) = handle.get_webview_window("main") {
                                            let _ = w.show();
                                            let _ = w.set_focus();
                                        }
                                        let _ = handle.emit("deep-link-received", url);
                                    }
                                }
                            });
                        }
                        Err(e) => {
                            log_to_file(&format!("IPC accept error: {}", e));
                        }
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_metadata,
            start_download,
            get_downloads_dir,
            save_state,
            load_state,
            cancel_download,
            show_in_folder,
            delete_file
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if let tauri::RunEvent::Exit = event {
                remove_ipc_port_file();
            }
        });
}
