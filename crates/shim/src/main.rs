use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::{self, Read, Write};
use std::net::TcpStream;
use std::time::Duration;
use urlencoding::encode;

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "command")]
enum Command {
    AddDownload { url: String },
}

fn log(msg: &str) {
    let log_path = shim_base_dir().join("kitsune-shim.log");
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(file, "{}", msg);
    }
}

fn shim_base_dir() -> std::path::PathBuf {
    dirs::config_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("kitsune-dm")
}

fn ipc_port_path() -> std::path::PathBuf {
    shim_base_dir().join("ipc.port")
}

fn try_ipc_send(url: &str) -> bool {
    let port_str = match std::fs::read_to_string(ipc_port_path()) {
        Ok(s) => s,
        Err(_) => return false,
    };

    let port: u16 = match port_str.trim().parse() {
        Ok(p) => p,
        Err(_) => return false,
    };

    let addr = format!("127.0.0.1:{}", port);
    let addr = match addr.parse() {
        Ok(a) => a,
        Err(_) => return false,
    };

    match TcpStream::connect_timeout(&addr, Duration::from_secs(2)) {
        Ok(mut stream) => {
            let ok = stream.write_all(url.as_bytes()).is_ok();
            let _ = stream.shutdown(std::net::Shutdown::Both);
            ok
        }
        Err(_) => false,
    }
}

fn handle_message(body_str: &str) -> Result<()> {
    log(&format!("Received message: {}", body_str.trim()));

    match serde_json::from_str::<Command>(body_str) {
        Ok(Command::AddDownload { url }) => {
            if try_ipc_send(&url) {
                log("Sent URL via IPC to running GUI");
                return Ok(());
            }

            let encoded_url = encode(&url);
            let kitsune_url = format!("kitsune://download?url={}", encoded_url);
            log(&format!("IPC unavailable, opening URL: {}", kitsune_url));

            if let Err(e) = open::that(&kitsune_url) {
                log(&format!("Failed to open URL {}: {}", kitsune_url, e));
            }
        }
        Err(e) => {
            log(&format!("Error parsing command: {}", e));
        }
    }
    Ok(())
}

fn main() -> Result<()> {
    log("Kitsune shim started");

    let mut stdin = io::stdin();

    loop {
        let mut length_buf = [0u8; 4];
        if let Err(e) = stdin.read_exact(&mut length_buf) {
            if e.kind() == io::ErrorKind::UnexpectedEof {
                log("EOF reached on stdin");
            } else {
                log(&format!("Error reading length from stdin: {}", e));
            }
            break;
        }

        let length = u32::from_ne_bytes(length_buf) as usize;

        // Fallback for manual testing: if it looks like raw JSON
        if length_buf[0] == b'{' && length > 1_000_000 {
            let mut body_bytes = length_buf.to_vec();
            if let Err(e) = stdin.read_to_end(&mut body_bytes) {
                log(&format!("Error reading raw JSON: {}", e));
            } else {
                let body_str = String::from_utf8_lossy(&body_bytes);
                let _ = handle_message(&body_str);
            }
            break;
        }

        log(&format!("Message length: {}", length));

        if length == 0 {
            continue;
        }

        if length > 10 * 1024 * 1024 {
            log(&format!("Message too large: {}", length));
            break;
        }

        let mut body_buf = vec![0u8; length];
        if let Err(e) = stdin.read_exact(&mut body_buf) {
            log(&format!("Error reading body: {}", e));
            break;
        }

        let body_str = String::from_utf8(body_buf).context("Invalid UTF-8")?;
        let _ = handle_message(&body_str);
    }

    log("Kitsune shim exiting");
    Ok(())
}
