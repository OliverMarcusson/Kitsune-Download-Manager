use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};


#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "command")]
pub enum Command {
    Ping,
    AddDownload { url: String },
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Response {
    pub success: bool,
    pub message: String,
}

pub async fn run() -> Result<()> {
    // Debug logging to file since stdout is occupied by native messaging
    use std::fs::OpenOptions;
    use std::io::Write;
    
    let mut log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open("/tmp/kitsune-debug.log")
        .unwrap();

    writeln!(log_file, "Native host started").ok();

    loop {
        // Read the length (4 bytes, native endian)
        let mut length_bytes = [0u8; 4];
        if let Err(e) = io::stdin().read_exact(&mut length_bytes) {
            if e.kind() == io::ErrorKind::UnexpectedEof {
                writeln!(log_file, "Stdin closed, exiting").ok();
                break; // Stream closed
            }
            writeln!(log_file, "Error reading length: {}", e).ok();
            return Err(e).context("Failed to read message length");
        }

        let length = u32::from_ne_bytes(length_bytes) as usize;
        writeln!(log_file, "Received message length: {}", length).ok();

        // Read the message
        let mut buffer = vec![0u8; length];
        io::stdin().read_exact(&mut buffer).context("Failed to read message body")?;

        let message = String::from_utf8(buffer).context("Invalid UTF-8 message")?;
        writeln!(log_file, "Received message: {}", message).ok();
        
        // Process the command
        let response = match serde_json::from_str::<Command>(&message) {
            Ok(command) => handle_command(command, &mut log_file).await,
            Err(e) => Response {
                success: false,
                message: format!("Invalid JSON: {}", e),
            },
        };

        send_message(&response)?;
    }

    Ok(())
}

async fn handle_command(command: Command, log_file: &mut std::fs::File) -> Response {
    use std::io::Write;
    match command {
        Command::Ping => Response {
            success: true,
            message: "Pong".to_string(),
        },
        Command::AddDownload { url } => {
            writeln!(log_file, "Handling AddDownload for URL: {}", url).ok();
            
            // Since the native host runs in the background, we need to spawn a terminal 
            // to display the Kitsune-DM TUI.
            // We try `x-terminal-emulator` first (standard on many Linux distros),
            // falling back to `gnome-terminal`, `konsole`, or `xterm`.
            
            let exe = std::env::current_exe().unwrap();
            let exe_str = exe.to_string_lossy();
            writeln!(log_file, "Executable path: {}", exe_str).ok();
            
            // Construct the command to run in the terminal
            // We need to keep the window open after completion? 
            // Kitsune currently waits for user input? No, it exits.
            // Maybe we want `bash -c "kitsune-dm ...; read -p 'Press enter...'"` if it closes too fast.
            // For now, let's just run it.
            
            let cmd_args = vec![
                "-e".to_string(), 
                format!("{} \"{}\"", exe_str, url)
            ];

            // Try to spawn alacritty first as requested
            let term = std::process::Command::new("alacritty")
                .arg("-e")
                .arg(&exe)
                .arg(&url)
                .spawn()
                .or_else(|_| {
                    // Fallback to x-terminal-emulator
                    std::process::Command::new("x-terminal-emulator")
                        .args(&cmd_args)
                        .spawn()
                })
                .or_else(|_| {
                    // Fallback to gnome-terminal
                    writeln!(log_file, "x-terminal-emulator failed, trying gnome-terminal").ok();
                     std::process::Command::new("gnome-terminal")
                        .arg("--")
                        .arg(&exe)
                        .arg(&url)
                        .spawn()
                });

            match term {
                    Ok(_) => {
                        writeln!(log_file, "Terminal spawned successfully").ok();
                        Response {
                            success: true,
                            message: "Download started in terminal".to_string(),
                        }
                    },
                    Err(e) => {
                        writeln!(log_file, "Failed to spawn terminal: {}", e).ok();
                        Response {
                            success: false,
                            message: format!("Failed to launch terminal: {}. Install x-terminal-emulator.", e),
                        }
                    }
                }
        }
    }
}

fn send_message(response: &Response) -> Result<()> {
    let message = serde_json::to_string(response)?;
    let len = message.len() as u32;
    let len_bytes = len.to_ne_bytes();

    let mut stdout = io::stdout();
    stdout.write_all(&len_bytes)?;
    stdout.write_all(message.as_bytes())?;
    stdout.flush()?;

    Ok(())
}
