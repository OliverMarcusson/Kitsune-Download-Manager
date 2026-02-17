use anyhow::Result;
use clap::Parser;
use kitsune_cli::native_host_manifest::generate_native_host_manifest_json;
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(author, version, about = "Generate native host manifest JSON")]
struct Args {
    #[arg(long)]
    extension_id: String,

    #[arg(long)]
    executable_path: PathBuf,
}

fn main() -> Result<()> {
    let args = Args::parse();
    let manifest = generate_native_host_manifest_json(&args.extension_id, &args.executable_path)?;
    println!("{manifest}");
    Ok(())
}
