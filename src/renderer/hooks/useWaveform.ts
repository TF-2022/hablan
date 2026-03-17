import { useEffect, useRef } from "react";

export function useWaveform(stream: MediaStream | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.82;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    const dpr = window.devicePixelRatio || 1;

    // Smooth bar values for organic feel
    const barCount = 40;
    const smoothBars = new Float32Array(barCount).fill(0);

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width * dpr, height * dpr);

      const barWidth = 3;
      const totalBarsWidth = barCount * barWidth;
      const gap = (width - totalBarsWidth) / (barCount - 1);

      for (let i = 0; i < barCount; i++) {
        // Sample frequency data with emphasis on voice range (100Hz-4kHz)
        const freqIndex = Math.floor((i / barCount) * bufferLength * 0.6 + bufferLength * 0.05);
        const rawValue = dataArray[freqIndex] / 255;

        // Smooth with lerp
        smoothBars[i] += (rawValue - smoothBars[i]) * 0.25;
        const value = smoothBars[i];

        const maxH = height * 0.85;
        const minH = 2;
        const barH = Math.max(minH, value * maxH);

        const x = i * (barWidth + gap);
        const y = centerY - barH / 2;

        // Opacity: center bars brighter, edge bars dimmer
        const distFromCenter = Math.abs(i - barCount / 2) / (barCount / 2);
        const baseAlpha = 0.35 + (1 - distFromCenter) * 0.3;
        const alpha = baseAlpha + value * 0.35;

        // Color: subtle warm white → red tint when loud
        const r = 255;
        const g = Math.round(255 - value * 80);
        const b = Math.round(255 - value * 100);

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 1.5);
        ctx.fill();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      audioCtx.close();
    };
  }, [stream]);

  return canvasRef;
}
