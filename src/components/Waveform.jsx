import { useEffect, useRef } from "react";

export default function Waveform({ active, height = 84 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const audioCtxRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    let analyser, dataArray, source;
    let cancelled = false;

    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = audioCtx;
        source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        draw();
      } catch {
        // mic permission denied or unavailable — waveform just stays idle, no crash
      }
    }

    function draw() {
      const canvas = canvasRef.current;
      if (!canvas || !analyser) return;
      const ctx = canvas.getContext("2d");
      const w = canvas.width, h = canvas.height;
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, w, h);
      const bars = 48;
      const step = Math.floor(dataArray.length / bars);
      const barW = w / bars;
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--signal").trim() || "#4FD8E8";

      for (let i = 0; i < bars; i++) {
        const v = dataArray[i * step] / 255;
        const barH = Math.max(3, v * h);
        const x = i * barW;
        const y = (h - barH) / 2;
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.35 + v * 0.65;
        ctx.fillRect(x + barW * 0.2, y, barW * 0.6, barH);
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    }

    setup();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, [active]);

  return <canvas ref={canvasRef} width={480} height={height} className={`waveform ${active ? "waveform-active" : ""}`} />;
}
