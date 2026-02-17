use anyhow::{bail, Context, Result};
use serde::Serialize;
use std::path::Path;

pub const NATIVE_HOST_NAME: &str = "com.kitsune.dm";
pub const NATIVE_HOST_DESCRIPTION: &str = "Kitsune Download Manager Native Host";

#[derive(Serialize)]
struct NativeHostManifest {
    name: String,
    description: String,
    path: String,
    r#type: String,
    allowed_origins: Vec<String>,
}

pub fn generate_native_host_manifest_json(
    extension_id: &str,
    executable_path: &Path,
) -> Result<String> {
    validate_extension_id(extension_id)?;

    if !executable_path.is_absolute() {
        bail!(
            "native host executable path must be absolute: {}",
            executable_path.display()
        );
    }

    let executable_path = executable_path
        .to_str()
        .context("native host executable path must be valid UTF-8")?
        .to_owned();

    let manifest = NativeHostManifest {
        name: NATIVE_HOST_NAME.to_owned(),
        description: NATIVE_HOST_DESCRIPTION.to_owned(),
        path: executable_path,
        r#type: "stdio".to_owned(),
        allowed_origins: vec![extension_origin(extension_id)?],
    };

    Ok(serde_json::to_string_pretty(&manifest)?)
}

pub fn validate_extension_id(extension_id: &str) -> Result<()> {
    if extension_id.len() != 32 {
        bail!("extension ID must be exactly 32 chars in [a-p]");
    }

    if !extension_id
        .bytes()
        .all(|byte| (b'a'..=b'p').contains(&byte))
    {
        bail!("extension ID must be exactly 32 chars in [a-p]");
    }

    Ok(())
}

pub fn extension_origin(extension_id: &str) -> Result<String> {
    validate_extension_id(extension_id)?;
    Ok(format!("chrome-extension://{extension_id}/"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::path::Path;

    const VALID_ID: &str = "abcdefghijklmnopabcdefghijklmnop";

    #[test]
    fn generates_expected_manifest_json() {
        let json =
            generate_native_host_manifest_json(VALID_ID, Path::new("/opt/kitsune/kitsune-shim"))
                .expect("manifest should be generated");
        let parsed: Value = serde_json::from_str(&json).expect("manifest should be valid json");

        assert_eq!(parsed["name"], NATIVE_HOST_NAME);
        assert_eq!(parsed["description"], NATIVE_HOST_DESCRIPTION);
        assert_eq!(parsed["path"], "/opt/kitsune/kitsune-shim");
        assert_eq!(parsed["type"], "stdio");
        assert_eq!(
            parsed["allowed_origins"].as_array().map(|a| a.len()),
            Some(1)
        );
        assert_eq!(
            parsed["allowed_origins"][0],
            format!("chrome-extension://{VALID_ID}/")
        );
        assert!(
            parsed["allowed_origins"][0]
                .as_str()
                .is_some_and(|origin| !origin.contains('*')),
            "allowed origin must not use wildcards"
        );
    }

    #[test]
    fn rejects_invalid_extension_id() {
        let err = generate_native_host_manifest_json(
            "invalid-id",
            Path::new("/opt/kitsune/kitsune-shim"),
        )
        .expect_err("invalid extension ID must fail");

        assert!(err
            .to_string()
            .contains("extension ID must be exactly 32 chars in [a-p]"));
    }

    #[test]
    fn rejects_extension_id_outside_chromium_alphabet() {
        let err = extension_origin("abcdefghijklmnopabcdefghijklmnqq")
            .expect_err("extension ID outside [a-p] must fail");

        assert!(err
            .to_string()
            .contains("extension ID must be exactly 32 chars in [a-p]"));
    }

    #[test]
    fn rejects_uppercase_extension_id() {
        let err = validate_extension_id("Abcdefghijklmnopabcdefghijklmnop")
            .expect_err("uppercase chars must fail");

        assert!(err
            .to_string()
            .contains("extension ID must be exactly 32 chars in [a-p]"));
    }

    #[test]
    fn rejects_origin_string_instead_of_extension_id() {
        let err = extension_origin("chrome-extension://abcdefghijklmnopabcdefghijklmnop/")
            .expect_err("origin string should be rejected when extension ID is expected");

        assert!(err
            .to_string()
            .contains("extension ID must be exactly 32 chars in [a-p]"));
    }

    #[test]
    fn extension_origin_has_required_trailing_slash() {
        let origin = extension_origin(VALID_ID).expect("valid ID should build origin");

        assert_eq!(origin, format!("chrome-extension://{VALID_ID}/"));
        assert!(origin.ends_with('/'));
    }

    #[test]
    fn validates_extension_id_exact_ap32_format() {
        validate_extension_id(VALID_ID).expect("[a-p]{32} should be accepted");
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn linux_manifest_output_keeps_absolute_target_path() {
        let linux_path = "/usr/lib/kitsune-dm/installer/bin/kitsune-shim";
        let json = generate_native_host_manifest_json(VALID_ID, Path::new(linux_path))
            .expect("linux absolute path should work");
        let parsed: Value = serde_json::from_str(&json).expect("manifest should be valid json");

        assert_eq!(parsed["path"], linux_path);
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn windows_manifest_output_keeps_absolute_target_path() {
        let windows_path = r"C:\Program Files\Kitsune\kitsune-shim.exe";
        let json = generate_native_host_manifest_json(VALID_ID, Path::new(windows_path))
            .expect("windows absolute path should work");
        let parsed: Value = serde_json::from_str(&json).expect("manifest should be valid json");

        assert_eq!(parsed["path"], windows_path);
    }

    #[test]
    fn rejects_relative_executable_path() {
        let err =
            generate_native_host_manifest_json(VALID_ID, Path::new("target/release/kitsune-shim"))
                .expect_err("relative path must fail");

        assert!(err.to_string().contains("must be absolute"));
    }
}
