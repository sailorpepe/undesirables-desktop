use std::path::PathBuf;
use std::sync::Mutex;
use std::process::Child;
use tauri::Manager;

// HIGH-4: Native Process Handle Tracking
struct ProcessState {
    mcp: Mutex<Option<Child>>,
    acestep: Mutex<Option<Child>>,
}

/// Resolve the MCP server directory dynamically.
/// In dev mode: uses the workspace peer directory.
/// In production: uses the sidecar binary's parent directory.
fn resolve_mcp_dir() -> PathBuf {
    // Check if we're running from a Tauri bundle (production)
    if let Ok(exe_path) = std::env::current_exe() {
        let exe_dir = exe_path.parent().unwrap_or_else(|| std::path::Path::new("."));
        let bundled_server = exe_dir.join("server-aarch64-apple-darwin");
        if bundled_server.exists() {
            return exe_dir.to_path_buf();
        }
        // On macOS .app bundles, binaries are in Contents/MacOS/
        let macos_sidecar = exe_dir.join("../Resources/server-aarch64-apple-darwin");
        if macos_sidecar.exists() {
            return exe_dir.join("../Resources").canonicalize().unwrap_or_else(|_| exe_dir.to_path_buf());
        }
    }
    // Dev mode fallback: resolve relative to $HOME
    if let Some(home) = std::env::var_os("HOME") {
        let dev_path = PathBuf::from(home).join("Documents/Meme Merchants/undesirables-mcp-server");
        if dev_path.exists() {
            return dev_path;
        }
    }
    // Ultimate fallback: current working directory
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

#[tauri::command]
async fn check_ollama_status() -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;

    // SECURITY (HIGH-2): Validate Ollama Version >= 0.1.47 (CVE-2024-45436 Zip Slip mitigation)
    if let Ok(version_check) = client.get("http://127.0.0.1:11434/api/version").send().await {
        if let Ok(version_data) = version_check.json::<serde_json::Value>().await {
            if let Some(version_str) = version_data.get("version").and_then(|v| v.as_str()) {
                let clean_ver = version_str.trim_start_matches('v');
                let parts: Vec<&str> = clean_ver.split('.').collect();
                if parts.len() >= 3 {
                    if let (Ok(major), Ok(minor), Ok(patch)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>(), parts[2].parse::<u32>()) {
                        if major == 0 && minor == 1 && patch < 47 {
                            // Version < 0.1.47 is unpatched
                            return Err(format!("Security Block: Ollama version {} is vulnerable to CVE-2024-45436 path traversal. Please update.", version_str));
                        }
                    }
                }
            }
        }
    }

    match client
        .get("http://127.0.0.1:11434/api/tags")
        .send()
        .await
    {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
async fn check_ffmpeg_status() -> Result<bool, String> {
    match std::process::Command::new("ffmpeg")
        .arg("-version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
    {
        Ok(status) => Ok(status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
fn get_platform_info() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY,
    }))
}

#[tauri::command]
async fn install_dependency(tool: String) -> Result<String, String> {
    use std::process::Command;
    // SECURITY: Strict whitelist — only 'ollama' and 'ffmpeg' are valid.
    // The tool param is matched, NEVER interpolated into a shell string.
    let os = std::env::consts::OS;
    let (program, args): (&str, Vec<&str>) = match (tool.as_str(), os) {
        ("ollama", "macos") | ("ollama", _) => ("brew", vec!["install", "ollama"]),
        ("ffmpeg", "macos") | ("ffmpeg", _) => ("brew", vec!["install", "ffmpeg"]),
        _ => return Err(format!("Security: '{}' is not an installable dependency.", tool)),
    };

    let output = Command::new(program)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to run install command: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
async fn pull_ollama_model(model_name: String) -> Result<String, String> {
    use std::process::{Command, Stdio};
    // SECURITY: Validate model name (CVE-2024-45436 Path Traversal Mitigation)
    // Audit Phase 5: Block directory traversal sequences (..) and slashes.
    if model_name.contains("..") || model_name.contains('/') || model_name.contains('\\') || model_name.matches(':').count() > 1 {
        return Err(format!("Security: Invalid model name (path traversal blocked) '{}'", model_name));
    }
    if !model_name.chars().all(|c| c.is_alphanumeric() || c == ':' || c == '.' || c == '-' || c == '_') {
        return Err(format!("Security: Invalid characters in model name '{}'", model_name));
    }
    let mut command = Command::new("ollama");
    command.arg("pull")
        .arg(&model_name)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
        
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    
    command.spawn().map_err(|e| format!("Failed to spawn ollama pull: {}", e))?;
    Ok(format!("Pull started in background for {}", model_name))
}

#[tauri::command]
async fn setup_python_env() -> Result<String, String> {
    use std::process::Command;
    let mcp_dir = resolve_mcp_dir();
    // SECURITY (CRIT-1): Direct Command invocations — no shell interpolation.
    // Step 1: Create venv if it doesn't exist
    let venv_dir = mcp_dir.join(".venv");
    if !venv_dir.exists() {
        let venv_out = Command::new("python3")
            .args(&["-m", "venv", ".venv"])
            .current_dir(&mcp_dir)
            .output()
            .map_err(|e| format!("Failed to create venv: {}", e))?;
        if !venv_out.status.success() {
            return Err(String::from_utf8_lossy(&venv_out.stderr).to_string());
        }
    }

    // Step 2: Install deps if not provisioned
    let provisioned = venv_dir.join(".provisioned");
    if !provisioned.exists() {
        let pip = venv_dir.join("bin/pip");
        let pip_out = Command::new(pip.to_string_lossy().as_ref())
            .args(&["install", "-r", "requirements.txt"])
            .current_dir(&mcp_dir)
            .output()
            .map_err(|e| format!("Failed to install deps: {}", e))?;
        if !pip_out.status.success() {
            return Err(String::from_utf8_lossy(&pip_out.stderr).to_string());
        }
        std::fs::File::create(&provisioned)
            .map_err(|e| format!("Failed to mark provisioned: {}", e))?;
        Ok("Dependencies installed successfully.".to_string())
    } else {
        Ok("Virtual environment already provisioned.".to_string())
    }
}

#[tauri::command]
async fn restart_mcp_server(app: tauri::AppHandle, _server_name: String) -> Result<bool, String> {
    let mcp_dir = resolve_mcp_dir();

    // HIGH-4: Kill previous instance gracefully via Rust process handles

    if let Some(state) = app.try_state::<ProcessState>() {
        let mut process_guard = state.mcp.lock().unwrap();
        if let Some(mut child) = process_guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    // 2. Wait 1 second to clear socket bounds (Port 8000)
    tokio::time::sleep(std::time::Duration::from_secs(1)).await;

    // SECURITY (CRIT-1): Direct Command invocation — no bash -c shell interpolation.
    let venv_python = mcp_dir.join(".venv/bin/python");
    let server_script = mcp_dir.join("boot_server.py");
    let log_file = std::fs::File::create(mcp_dir.join("mcp_engine.log"))
        .map_err(|e| format!("Failed to create log file: {}", e))?;
    let err_file = log_file.try_clone()
        .map_err(|e| format!("Failed to clone log handle: {}", e))?;

    let mut command = std::process::Command::new(venv_python.to_string_lossy().as_ref());
    command.arg(server_script.to_string_lossy().as_ref())
        .current_dir(&mcp_dir)
        .stdout(std::process::Stdio::from(log_file))
        .stderr(std::process::Stdio::from(err_file));

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }

    let child = command.spawn().map_err(|e| format!("Failed to spawn native backend: {}", e))?;

    // HIGH-4: Track via native Tauri state, no flat file
    if let Some(state) = app.try_state::<ProcessState>() {
        let mut process_guard = state.mcp.lock().unwrap();
        *process_guard = Some(child);
    }

    Ok(true)
}

// ============================================================
// ACE-Step Music Engine Lifecycle (Phase 15)
// ============================================================

/// Resolve the ACE-Step installation directory.
fn resolve_acestep_dir() -> PathBuf {
    if let Some(home) = std::env::var_os("HOME") {
        let ace_path = PathBuf::from(home).join("Documents/Meme Merchants/ACE-Step");
        if ace_path.exists() {
            return ace_path;
        }
    }
    PathBuf::from(".")
}

#[tauri::command]
async fn start_acestep_server(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let ace_dir = resolve_acestep_dir();
    let venv_python = ace_dir.join("venv/bin/python");

    if !ace_dir.exists() {
        return Err("ACE-Step not found. Expected at ~/Documents/Meme Merchants/ACE-Step/".to_string());
    }
    if !venv_python.exists() {
        return Err("ACE-Step venv not found. Run: cd ACE-Step && python3 -m venv venv && source venv/bin/activate && pip install -e .".to_string());
    }

    // RAM check — ACE-Step needs ~8GB
    let ram_info = get_system_ram().await.unwrap_or_default();
    if let Some(avail) = ram_info.get("available_gb").and_then(|v| v.as_f64()) {
        if avail < 4.0 {
            return Err(format!(
                "Insufficient RAM: {:.1}GB available, ACE-Step needs ~8GB. Close other apps first.",
                avail
            ));
        }
    }

    // Check if already running via State
    if let Some(state) = app.try_state::<ProcessState>() {
        let guard = state.acestep.lock().unwrap();
        if guard.is_some() {
            return Ok(serde_json::json!({
                "status": "already_running",
                "port": 7865
            }));
        }
    }

    // Start the server
    let log_file = std::fs::File::create(ace_dir.join("acestep_engine.log"))
        .map_err(|e| format!("Failed to create log: {}", e))?;
    let err_file = log_file.try_clone()
        .map_err(|e| format!("Failed to clone log: {}", e))?;

    // Use the acestep CLI entry point from the venv
    let acestep_bin = ace_dir.join("venv/bin/acestep");
    let child = if acestep_bin.exists() {
        let mut command = std::process::Command::new(acestep_bin.to_string_lossy().as_ref());
        command.args(&["--bf16", "false", "--port", "7865"])
            .current_dir(&ace_dir)
            .stdout(std::process::Stdio::from(log_file))
            .stderr(std::process::Stdio::from(err_file));
            
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
        
        command.spawn().map_err(|e| format!("Failed to start ACE-Step: {}", e))?
    } else {
        let mut command = std::process::Command::new(venv_python.to_string_lossy().as_ref());
        command.args(&["-m", "acestep", "--bf16", "false", "--port", "7865"])
            .current_dir(&ace_dir)
            .stdout(std::process::Stdio::from(log_file))
            .stderr(std::process::Stdio::from(err_file));
            
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
        
        command.spawn().map_err(|e| format!("Failed to start ACE-Step: {}", e))?
    };

    let pid = child.id();
    if let Some(state) = app.try_state::<ProcessState>() {
        let mut guard = state.acestep.lock().unwrap();
        *guard = Some(child);
    }

    // Health-check loop: wait up to 60s for the model to load
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;

    for attempt in 0..30 {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        match client.get("http://127.0.0.1:7865/").send().await {
            Ok(resp) if resp.status().is_success() => {
                return Ok(serde_json::json!({
                    "status": "ready",
                    "port": 7865,
                    "pid": pid,
                    "startup_seconds": (attempt + 1) * 2
                }));
            }
            _ => continue,
        }
    }

    Ok(serde_json::json!({
        "status": "started_but_not_ready",
        "port": 7865,
        "pid": pid,
        "note": "Server started but did not respond within 60s. The model may still be loading."
    }))
}

#[tauri::command]
async fn stop_acestep_server(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    if let Some(state) = app.try_state::<ProcessState>() {
        let mut process_guard = state.acestep.lock().unwrap();
        if let Some(mut child) = process_guard.take() {
            let pid = child.id();
            let _ = child.kill();
            let _ = child.wait();
            return Ok(serde_json::json!({"status": "stopped", "pid": pid}));
        }
    }
    
    Ok(serde_json::json!({"status": "not_running"}))
}

#[tauri::command]
async fn get_system_ram() -> Result<serde_json::Value, String> {
    // macOS: use sysctl for total RAM and vm_stat for available
    let total_output = std::process::Command::new("sysctl")
        .args(&["-n", "hw.memsize"])
        .output()
        .map_err(|e| format!("Failed to read RAM: {}", e))?;

    let total_bytes: u64 = String::from_utf8_lossy(&total_output.stdout)
        .trim()
        .parse()
        .unwrap_or(0);
    let total_gb = total_bytes as f64 / (1024.0 * 1024.0 * 1024.0);

    // Get available memory from vm_stat
    let vm_output = std::process::Command::new("vm_stat")
        .output()
        .map_err(|e| format!("Failed to read vm_stat: {}", e))?;

    let vm_str = String::from_utf8_lossy(&vm_output.stdout);
    let page_size: u64 = 16384; // macOS ARM64 uses 16K pages

    let mut free_pages: u64 = 0;
    let mut inactive_pages: u64 = 0;
    let mut purgeable_pages: u64 = 0;

    for line in vm_str.lines() {
        if line.contains("Pages free:") {
            free_pages = line.split(':').last().unwrap_or("0").trim().trim_end_matches('.').parse().unwrap_or(0);
        } else if line.contains("Pages inactive:") {
            inactive_pages = line.split(':').last().unwrap_or("0").trim().trim_end_matches('.').parse().unwrap_or(0);
        } else if line.contains("Pages purgeable:") {
            purgeable_pages = line.split(':').last().unwrap_or("0").trim().trim_end_matches('.').parse().unwrap_or(0);
        }
    }

    let available_bytes = (free_pages + inactive_pages + purgeable_pages) * page_size;
    let available_gb = available_bytes as f64 / (1024.0 * 1024.0 * 1024.0);

    Ok(serde_json::json!({
        "total_gb": (total_gb * 10.0).round() / 10.0,
        "available_gb": (available_gb * 10.0).round() / 10.0,
        "acestep_safe": available_gb >= 4.0,
        "ollama_running": available_gb >= 2.0
    }))
}

#[tauri::command]
async fn execute_mcp_tool(app_handle: tauri::AppHandle, _server_name: String, tool_name: String, args: serde_json::Value) -> Result<serde_json::Value, String> {
    use std::process::{Command, Stdio};
    use std::io::Write;
    use tauri_plugin_store::StoreExt;
    
    // SECURITY: Validate tool_name explicitly against the whitelist instead of trusting IPC
    let allowed_tools = vec![
        "create_banner", "produce_video", "viral_clip_extractor",
        "video_production_beat_sync", "grade_tcg_card", "generate_meme",
        "remove_background", "invoke_council", "soul_speak", "soul_listen",
        "index_soul_workspace", "get_rag_context", "search_soul_memory",
        "run_security_audit", "scan_media_file", "search_ebay_market",
        "detect_emotion",
        "generate_3d_object", "image_to_3d", "self_reflect",
        "get_voice_preset", "web_search", "upsert_memory_node",
        "create_memory_relation", "query_memory_graph", "get_memory_subgraph",
        "market_depth_analysis", "monte_carlo_simulation",
        "generate_music", "analyze_beats", "memory_save", "memory_recall",
        "soul_rap", "query_ollama", "get_skill", "list_skills"
    ];

    if !allowed_tools.contains(&tool_name.as_str()) {
        return Err(format!("Security: Tool execution for '{}' is unauthorized.", tool_name));
    }
    let mcp_dir = resolve_mcp_dir();
    
    // Check both common venv directory names (.venv/ first — has compiled Nuitka modules)
    let venv_python = {
        let p1 = mcp_dir.join(".venv/bin/python");
        let p2 = mcp_dir.join("venv/bin/python");
        if p1.exists() { p1 } else if p2.exists() { p2 } else { std::path::PathBuf::from("python3") }
    };

    // FAST PATH: 3D generation bypasses heavy server.py import chain
    let (script_path, payload) = if tool_name == "image_to_3d" || tool_name == "generate_3d_object" {
        let script = mcp_dir.join("boot_3d.py");
        
        let mut resolved_path = "";
        if let Some(p) = args.get("image_path").and_then(|v| v.as_str()) { resolved_path = p; }
        else if let Some(p) = args.get("image_url").and_then(|v| v.as_str()) { resolved_path = p; }
        else if let Some(p) = args.get("path").and_then(|v| v.as_str()) { resolved_path = p; }
        else if let Some(p) = args.get("prompt").and_then(|v| v.as_str()) { 
            // If they called generate_3d_object and dumped the path into the prompt string
            if p.contains("/") || p.contains(".png") || p.contains(".jpg") { resolved_path = p; }
        }

        let p = serde_json::json!({
            "image_path": resolved_path,
            "prompt": args.get("prompt").and_then(|v| v.as_str()).unwrap_or(""),
            "steps": args.get("steps").and_then(|v| v.as_i64()).unwrap_or(4),
        }).to_string();
        (script, p)
    } else {
        let script = mcp_dir.join("execute_tool.py");
        let p = serde_json::json!({
            "tool_name": tool_name,
            "args": args
        }).to_string();
        (script, p)
    };

    let mut command = Command::new(venv_python.to_string_lossy().as_ref());
    
    // Phase 5 Deep Think Fix: Purge LLM Trust in Rust backend.
    // Fetch eBay Oracle secrets strictly via local filesystem tauri_plugin_store
    // completely isolating them from the LLM's payload.
    if let Ok(store) = app_handle.store("credentials.json") {
        if let Some(val) = store.get("undesirables_ebay_app_id") {
            if let Some(app_id) = val.as_str() { command.env("EBAY_APP_ID", app_id); }
        }
        if let Some(val) = store.get("undesirables_ebay_client_secret") {
            if let Some(client_secret) = val.as_str() { command.env("EBAY_CLIENT_SECRET", client_secret); }
        }
    }

    command.arg(script_path.to_string_lossy().as_ref())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
        
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    
    let mut child = command.spawn().map_err(|e| format!("Failed to spawn Python executor: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(payload.as_bytes()).map_err(|e| e.to_string())?;
    }

    let output = child.wait_with_output().map_err(|e| e.to_string())?;
    let output_str = String::from_utf8_lossy(&output.stdout);
    let err_str = String::from_utf8_lossy(&output.stderr);
    
    // Only surface stderr when the process FAILED and stdout is empty.
    // pymatting's C-level Cholesky solver dumps PERFORMANCE WARNINGs to stderr
    // via the OS pipe — these must NEVER pollute the MCP IPC payload.
    if !output.status.success() && output_str.trim().is_empty() {
        return Err(format!("Python execution failed: {}", err_str));
    }

    match serde_json::from_str::<serde_json::Value>(&output_str) {
        Ok(json) => Ok(json),
        Err(_) => Ok(serde_json::json!({
            "result": output_str.trim().to_string()
        }))
    }
}

#[tauri::command]
fn get_enclave_key() -> Result<String, String> {
    use keyring::Entry;
    use rand::RngCore;

    let entry = Entry::new("com.undesirables.desktop.secure_enclave", "master_key")
        .map_err(|e| format!("Failed to initialize keyring: {}", e))?;

    match entry.get_password() {
        Ok(pwd) => Ok(pwd),
        Err(keyring::Error::NoEntry) => {
            let mut key = [0u8; 32];
            rand::thread_rng().fill_bytes(&mut key);
            let hex_key: String = key.iter().map(|b| format!("{:02x}", b)).collect();
            entry.set_password(&hex_key)
                 .map_err(|e| format!("Failed to store key in native keychain: {}", e))?;
            Ok(hex_key)
        }
        Err(e) => Err(format!("Keychain read error: {}", e)),
    }
}

#[tauri::command]
async fn fetch_tcg_data(path: String) -> Result<serde_json::Value, String> {
    let url = format!("https://tcgcsv.com/tcgplayer/{}", path);
    // SECURITY: Use a standard browser User-Agent to bypass restrictive Cloudflare WAF bot-challenge filters securely.
    let client = reqwest::Client::builder()
       .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
       .build().map_err(|e| format!("Client error: {}", e))?;
    
    let response = client.get(&url).send().await.map_err(|e| format!("Proxy fetch error: {}", e))?;
    if !response.status().is_success() {
        return Err(format!("Bad HTTP status: {}", response.status()));
    }
    response.json::<serde_json::Value>().await.map_err(|e| format!("JSON parse error: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Catch wry drag-drop panics (macOS pasteboard URL extraction fails on some file types)
    // Without this, dropping a PNG crashes the entire app due to unwrap() in wry 0.54.x
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let payload = info.to_string();
        if payload.contains("drag_drop") || payload.contains("pasteboard") || payload.contains("URL-flavored") {
            eprintln!("[WARN] Caught wry drag-drop panic (non-fatal): {}", payload);
            return; // Swallow — don't abort
        }
        default_hook(info); // All other panics behave normally
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            check_ollama_status,
            check_ffmpeg_status,
            get_platform_info,
            install_dependency,
            pull_ollama_model,
            setup_python_env,
            restart_mcp_server,
            execute_mcp_tool,
            start_acestep_server,
            stop_acestep_server,
            get_system_ram,
            get_enclave_key,
            fetch_tcg_data
        ])
        .setup(|app| {
            // SECURITY (MED-5): Enable structured logging in ALL builds for incident forensics
            let log_level = if cfg!(debug_assertions) {
                log::LevelFilter::Info
            } else {
                log::LevelFilter::Warn
            };
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log_level)
                    .build(),
            )?;
            
            use tauri::Manager;
            let salt_path = app.path().app_local_data_dir().unwrap().join("salt.txt");
            app.handle().plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;
            
            app.manage(ProcessState {
                mcp: std::sync::Mutex::new(None),
                acestep: std::sync::Mutex::new(None)
            });
            
            Ok(())
        })
        .on_window_event(|_window, event| match event {
            tauri::WindowEvent::Destroyed => {
                let app_handle = _window.app_handle().clone();
                if let Some(state) = app_handle.try_state::<ProcessState>() {
                    if let Ok(mut process_guard) = state.mcp.lock() {
                        if let Some(mut child) = process_guard.take() {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                    if let Ok(mut process_guard) = state.acestep.lock() {
                        if let Some(mut child) = process_guard.take() {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
