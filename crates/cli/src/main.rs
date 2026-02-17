use kitsune_core::{Downloader, DownloadSession, ChannelObserver};
mod native_messaging;
mod ui;

use clap::Parser;
use log::info;
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// URL of the file to download
    #[arg(required_unless_present = "native_mode")]
    url: Option<String>,

    /// Output file path (optional, defaults to filename from URL)
    #[arg(short = 'O', long)]
    output: Option<PathBuf>,

    /// User Agent to use for requests
    #[arg(long, default_value = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")]
    user_agent: String,

    /// Number of concurrent connections
    #[arg(short, long, default_value_t = 8)]
    connections: u8,

    /// Run as a Native Messaging Host
    #[arg(long)]
    native_mode: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    env_logger::init();

    if std::env::args().len() == 1 {
        use clap::CommandFactory;
        Args::command().print_help()?;
        return Ok(());
    }

    let args = Args::parse();

    if args.native_mode {
        return native_messaging::run().await;
    }

    let url = args.url.expect("URL is required");

    info!("Starting download for: {}", url);
    info!("Connections: {}", args.connections);

    let downloader = Downloader::new(&args.user_agent)?;
    let mut session;
    let session_file;

    if let Some(path) = args.output {
        session_file = PathBuf::from(format!("{}.kitsune", path.to_string_lossy()));
        if session_file.exists() {
            info!("Resuming download from session file: {:?}", session_file);
            session = DownloadSession::load(&session_file).await?;
        } else {
            session = downloader.init_download(&url, Some(path), args.connections).await?;
        }
    } else {
        // No explicit path, resolve via init_download
        session = downloader.init_download(&url, None, args.connections).await?;
        session_file = PathBuf::from(format!("{}.kitsune", session.output_path.to_string_lossy()));
        
        if session_file.exists() {
             info!("Resuming download from session file (resolved): {:?}", session_file);
             // TODO: Verify URL matches?
             session = DownloadSession::load(&session_file).await?;
        }
    }

    println!("File size: {} bytes", session.total_size.unwrap_or(0));
    println!("Saving to: {:?}", session.output_path);

    let multi_progress = indicatif::MultiProgress::new();
    let main_style = indicatif::ProgressStyle::with_template(&format!(
        "{{spinner:.green}} [{{elapsed_precise}}] [{{wide_bar:.cyan/blue}}] {{bytes}}/{{total_bytes}} ({{bytes_per_sec}}, {{eta}}) [Conn: {}]",
        args.connections
    )).unwrap()
    .progress_chars("#>-");

    let main_pb = multi_progress.add(indicatif::ProgressBar::new(session.total_size.unwrap_or(0)));
    main_pb.set_style(main_style);
    main_pb.set_position(session.parts.iter().map(|p| p.current_byte - p.start_byte).sum());

    let (tx, mut rx) = tokio::sync::mpsc::channel(100);
    let observer = Arc::new(ChannelObserver::new(tx));

    // Spawn downloader in a separate task
    let session_file_clone = session_file.clone();
    let download_handle = tokio::spawn(async move {
        downloader.run(&mut session, Some(observer), Some(session_file_clone), None).await
    });

    while let Some((_worker_id, bytes, active_workers)) = rx.recv().await {
        main_pb.inc(bytes);
        // Only update style if active workers changed? Or just update regularly. 
        // Setting style is cheap?
        main_pb.set_style(indicatif::ProgressStyle::with_template(&format!(
            "{{spinner:.green}} [{{elapsed_precise}}] [{{wide_bar:.cyan/blue}}] {{bytes}}/{{total_bytes}} ({{bytes_per_sec}}, {{eta}}) [Conn: {}]",
            active_workers
        )).unwrap()
        .progress_chars("#>-"));
    }

    download_handle.await??;
    main_pb.finish_with_message("Download completed");
    
    // Optional: remove session file on completion
    if session_file.exists() {
        let _ = tokio::fs::remove_file(session_file).await;
    }

    Ok(())
}
