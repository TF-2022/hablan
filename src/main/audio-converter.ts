import { spawn } from "node:child_process";
import { getFfmpegPath } from "./bin-resolver";

/**
 * Convert WebM to WAV 16kHz mono PCM + remove silence (VAD).
 * Silence removal speeds up whisper by 40-60% on audio with pauses.
 */
export function convertToWav(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(getFfmpegPath(), [
      "-i", inputPath,
      "-af", [
        // Remove leading and trailing silence
        "silenceremove=start_periods=1:start_duration=0.1:start_threshold=-35dB",
        // Remove silence in the middle (long pauses)
        "silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-35dB",
      ].join(","),
      "-ar", "16000",   // 16kHz sample rate (whisper requirement)
      "-ac", "1",        // Mono
      "-c:a", "pcm_s16le", // 16-bit PCM
      "-y",              // Overwrite
      outputPath,
    ]);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-200)}`));
      }
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`ffmpeg error: ${err.message}`));
    });
  });
}
