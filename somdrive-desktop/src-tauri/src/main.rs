#![cfg_with_tauri]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandEvent, Child};

// Global thread-safe state to hold the active child process for conversion
// This allows graceful cancellation on Windows
static ACTIVE_CHILD: Lazy<Mutex<Option<Child>>> = Lazy::new(|| Mutex::new(None));
// Store output file path to delete on cancel
static ACTIVE_OUTPUT_PATH: Lazy<Mutex<Option<PathBuf>>> = Lazy::new(|| Mutex::new(None));

#[derive(Serialize, Deserialize, Debug)]
struct VideoMetadata {
    filename: String,
    size: u64,
    duration: f64,
    format: String,
    codec: String,
    frequency: u32,
    channels: u32,
}

#[derive(Serialize, Clone)]
struct ProgressPayload {
    percentage: f64,
    speed: String,
    total_size: u64,
}

#[derive(Serialize, Clone)]
struct DonePayload {
    size: u64,
}

/// Runs ffprobe on the selected video file to extract detailed format/stream metadata
#[tauri::command]
async fn probe_video(app_handle: AppHandle, video_path: String) -> Result<String, String> {
    let video_file = Path::new(&video_path);
    if !video_file.exists() {
        return Err("O arquivo de vídeo selecionado não existe.".to_string());
    }

    let sidecar_command = app_handle.shell().sidecar("bin/ffprobe")
        .or_else(|_| app_handle.shell().sidecar("ffprobe"))
        .map_err(|e| format!("Falha ao resolver o sidecar do ffprobe: {}", e))?;
    
    // Command: ffprobe -v error -show_entries format=duration,format_name,size -show_entries stream=index,codec_type,codec_name,sample_rate,channels,bit_rate -of json <arquivo>
    let output = sidecar_command
        .args(&[
            "-v", "error",
            "-show_entries", "format=duration,format_name,size",
            "-show_entries", "stream=index,codec_type,codec_name,sample_rate,channels,bit_rate",
            "-of", "json",
            &video_path
        ])
        .output()
        .await
        .map_err(|e| format!("Falha ao executar o probe: {}. Verifique se os sidecars estão corretos!", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Erro ao ler metadados do vídeo: {}", stderr));
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    
    // Parse json to pull important fields and structure clean Metadata structure
    let json: serde_json::Value = serde_json::from_str(&stdout_str)
        .map_err(|e| format!("Erro ao analisar dados JSON do probe: {}", e))?;

    let filename = video_file.file_name()
        .map(|f| f.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Video".to_string());

    let size = json["format"]["size"].as_str()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);

    let duration = json["format"]["duration"].as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let format_name = json["format"]["format_name"].as_str()
        .unwrap_or("Desconhecido")
        .to_string();

    // Look for first audio stream inside the list
    let mut audio_codec = "Nenhum".to_string();
    let mut frequency = 0u32;
    let mut channels = 0u32;

    if let Some(streams) = json["streams"].as_array() {
        for stream in streams {
            if stream["codec_type"].as_str() == Some("audio") {
                audio_codec = stream["codec_name"].as_str().unwrap_or("AAC").to_string();
                frequency = stream["sample_rate"].as_str()
                    .and_then(|s| s.parse::<u32>().ok())
                    .unwrap_or(0);
                channels = stream["channels"].as_u64().unwrap_or(2) as u32;
                break; // Found primary audio track
            }
        }
    }

    if audio_codec == "Nenhum" {
        return Err("Este vídeo não contém nenhuma faixa de áudio ativa para extração!".to_string());
    }

    let result_meta = VideoMetadata {
        filename,
        size,
        duration,
        format: format_name,
        codec: audio_codec,
        frequency,
        channels,
    };

    serde_json::to_string(&result_meta)
        .map_err(|e| format!("Erro ao serializar metadados: {}", e))
}

/// Spawns custom native FFmpeg process to decode audio track from video file
#[tauri::command]
async fn convert_video(
    app_handle: AppHandle,
    video_path: String,
    output_dir: String,
    format: String,
    bitrate: String,
    sample_rate: String,
) -> Result<(), String> {
    // 1. Path validaton
    let video_filepath = Path::new(&video_path);
    if !video_filepath.exists() {
        return Err("Arquivo de vídeo original não encontrado.".to_string());
    }

    let out_dir_path = Path::new(&output_dir);
    if !out_dir_path.exists() {
        return Err("A pasta de destino selecionada não existe no computador.".to_string());
    }

    // Determine output file name
    let stem = video_filepath.file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "audio_extraido".to_string());
    
    let extension = if format == "wav" { "wav" } else { "mp3" };
    let output_filename = format!("{}.{}", stem, extension);
    let output_filepath = out_dir_path.join(output_filename);

    // Write path to global mutex so we can easily delete the incomplete file on Cancel
    {
        let mut path_guard = ACTIVE_OUTPUT_PATH.lock().unwrap();
        *path_guard = Some(output_filepath.clone());
    }

    // 3. Setup Safe arguments based on controlled settings (Anti-Command-Injection)
    let mut args: Vec<String> = vec![
        "-y".to_string(), // Overwrite file
        "-i".to_string(), video_path.clone(), // Input
        "-map".to_string(), "0:a:0".to_string(), // Select first audio stream
        "-vn".to_string(), // Disable video encoding
    ];

    if format == "wav" {
        // Safe sample rate validation (44100 or 48000)
        let rate_val = if sample_rate == "48000" { "48000" } else { "44100" };
        args.push("-c:a".to_string());
        args.push("pcm_s16le".to_string()); // Uncompressed 16-bit PCM WAV
        args.push("-ar".to_string());
        args.push(rate_val.to_string());
    } else {
        // Safe bitrate validation (96, 112, 128, 192, 320)
        let bit_val = match bitrate.as_str() {
            "96" => "96k",
            "112" => "112k",
            "128" => "128k",
            "192" => "192k",
            "320" => "320k",
            _ => "192k", // default fallback
        };
        args.push("-c:a".to_string());
        args.push("libmp3lame".to_string());
        args.push("-b:a".to_string());
        args.push(bit_val.to_string());
        args.push("-ar".to_string());
        args.push("44100".to_string());
    }

    // Progress report over standard pipe
    args.push("-progress".to_string());
    args.push("pipe:1".to_string());
    args.push("-nostats".to_string());
    
    // Output path
    args.push(output_filepath.to_string_lossy().into_owned());

    // 4. Fetch Video Duration first to calculate progress percent
    // This requires executing a quick probe beforehand to know what duration is
    let probe_meta_str = probe_video(app_handle.clone(), video_path.clone()).await?;
    let probe_meta: VideoMetadata = serde_json::from_str(&probe_meta_str).unwrap();
    let total_duration_ms = (probe_meta.duration * 1000.0) as i64;

    // 5. Spawn the child process using official Tauri sidecar API
    let sidecar_command = app_handle.shell().sidecar("bin/ffmpeg")
        .or_else(|_| app_handle.shell().sidecar("ffmpeg"))
        .map_err(|e| format!("Falha ao resolver o sidecar do ffmpeg: {}", e))?
        .args(&args);

    let (mut rx, child) = sidecar_command.spawn()
        .map_err(|e| format!("Falha ao iniciar processo do FFmpeg: {}", e))?;

    // Store in global Mutex so cancellation can call kill() anytime
    {
        let mut child_guard = ACTIVE_CHILD.lock().unwrap();
        *child_guard = Some(child);
    }

    // 6. Spawn tokio task to handle progress events asynchronously
    let app_clone = app_handle.clone();
    let output_filepath_clone = output_filepath.clone();
    
    tokio::spawn(async move {
        let mut current_speed = "1.0x".to_string();
        let mut total_size = 0u64;
        let mut success = false;

        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(data) => {
                    let text = String::from_utf8_lossy(&data);
                    for line in text.lines() {
                        let trimmed = line.trim();
                        if trimmed.starts_with("out_time_ms=") {
                            if let Some(val_str) = trimmed.split('=').nth(1) {
                                if let Ok(out_time_ms) = val_str.parse::<i64>() {
                                    if total_duration_ms > 0 {
                                        let percentage = (out_time_ms as f64 / total_duration_ms as f64) * 100.0;
                                        let percentage_clamped = percentage.min(100.0).max(0.0);
                                        
                                        // Emit conversion-progress event
                                        let _ = app_clone.emit("conversion-progress", ProgressPayload {
                                            percentage: percentage_clamped,
                                            speed: current_speed.clone(),
                                            total_size,
                                        });
                                    }
                                }
                            }
                        } else if trimmed.starts_with("speed=") {
                            if let Some(val_str) = trimmed.split('=').nth(1) {
                                current_speed = val_str.to_string();
                            }
                        } else if trimmed.starts_with("total_size=") {
                            if let Some(val_str) = trimmed.split('=').nth(1) {
                                total_size = val_str.parse::<u64>().unwrap_or(total_size);
                            }
                        } else if trimmed == "progress=end" {
                            // Ensure progress completes at 100%
                            let _ = app_clone.emit("conversion-progress", ProgressPayload {
                                percentage: 100.0,
                                speed: current_speed.clone(),
                                total_size,
                            });
                        }
                    }
                }
                CommandEvent::Terminated(payload) => {
                    success = payload.code == Some(0);
                    break;
                }
                CommandEvent::Error(err) => {
                    let _ = app_clone.emit("conversion-error", format!("Erro no FFmpeg: {}", err));
                    break;
                }
                _ => {}
            }
        }

        // Clean up ACTIVE_CHILD
        {
            let mut child_guard = ACTIVE_CHILD.lock().unwrap();
            *child_guard = None;
        }

        if success {
            // Clear active output path from global state
            let mut path_guard = ACTIVE_OUTPUT_PATH.lock().unwrap();
            let _ = path_guard.take();

            // Query final size of the output file
            let final_size = fs::metadata(&output_filepath_clone).map(|m| m.len()).unwrap_or(0);

            let _ = app_clone.emit("conversion-done", DonePayload { size: final_size });
        } else {
            // Deleted corrupted output if failed but wasn't killed by a user Cancel
            // Check if still marked active output path (if cancel called, this would be None already)
            let mut path_guard = ACTIVE_OUTPUT_PATH.lock().unwrap();
            if path_guard.is_some() {
                let _ = path_guard.take();
                if output_filepath_clone.exists() {
                    let _ = fs::remove_file(&output_filepath_clone);
                }
                let _ = app_clone.emit("conversion-error", "O processador FFmpeg encerrou com erro.");
            }
        }
    });

    Ok(())
}

/// Cancels the running conversion and removes the incomplete output file
#[tauri::command]
async fn cancel_conversion() -> Result<(), String> {
    // 1. Terminate the child process
    {
        let mut child_guard = ACTIVE_CHILD.lock().unwrap();
        if let Some(child) = child_guard.take() {
            let _ = child.kill();
        }
    }

    // 2. Remove the incomplete audio file from the disk
    {
        let mut path_guard = ACTIVE_OUTPUT_PATH.lock().unwrap();
        if let Some(path) = path_guard.take() {
            if path.exists() {
                let _ = fs::remove_file(&path);
            }
        }
    }

    Ok(())
}

/// Opens the output folder in Windows File Explorer
#[tauri::command]
async fn open_folder(path: String) -> Result<(), String> {
    let folder_path = Path::new(&path);
    if !folder_path.exists() {
        return Err("A pasta de destino não existe mais.".to_string());
    }

    // Open natively
    open::that(folder_path)
        .map_err(|e| format!("Falha ao abrir pasta no Explorador de Arquivos: {}", e))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            probe_video,
            convert_video,
            cancel_conversion,
            open_folder
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao inicializar aplicativo tauri");
}
