import { useEffect, useRef } from "react";

const COLOURS = ["#E2B13C", "#7CC4A6", "#1F7A5C", "#D3EEEA", "#D9534F", "#F4FAF9", "#5C7A86"];

/**
 * Full-screen confetti burst. Each change of `fire` launches a new burst from two cannons and a
 * shower from the top; pieces include little fish to keep the ocean theme. Draws nothing when the
 * person prefers reduced motion.
 */
export function Confetti({ fire }: { fire: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (cv.width = window.innerWidth * dpr), H = (cv.height = window.innerHeight * dpr);
    const x = cv.getContext("2d")!;
    type Bit = { x: number; y: number; vx: number; vy: number; r: number; vr: number; s: number; c: string; k: number; life: number };
    const bits: Bit[] = [];
    const add = (px: number, py: number, angle: number, spread: number, speed: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = angle + (Math.random() - .5) * spread, v = speed * (.55 + Math.random() * .7);
        bits.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, vr: (Math.random() - .5) * .3,
          s: (6 + Math.random() * 8) * dpr, c: COLOURS[i % COLOURS.length], k: Math.random() < .12 ? 2 : Math.random() < .5 ? 1 : 0, life: 0 });
      }
    };
    add(0, H * .85, -Math.PI / 3.2, .9, 26 * dpr, 140);
    add(W, H * .85, -Math.PI + Math.PI / 3.2, .9, 26 * dpr, 140);
    for (let i = 0; i < 90; i++) add(Math.random() * W, -20 * dpr, Math.PI / 2, .6, 4 * dpr, 1);
    let raf = 0, last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(2, (t - last) / 16.7); last = t;
      x.clearRect(0, 0, W, H);
      let alive = 0;
      for (const b of bits) {
        b.life += dt; b.vy += .35 * dpr * dt; b.vx *= Math.pow(.985, dt); b.vy *= Math.pow(.99, dt);
        b.x += b.vx * dt + Math.sin(b.life * .1 + b.r) * .6 * dpr; b.y += b.vy * dt; b.r += b.vr * dt;
        if (b.y > H + 40 || b.life > 420) continue;
        alive++;
        x.save(); x.translate(b.x, b.y); x.rotate(b.r); x.fillStyle = b.c; x.globalAlpha = Math.min(1, (420 - b.life) / 60);
        if (b.k === 0) x.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        else if (b.k === 1) { x.beginPath(); x.arc(0, 0, b.s / 3, 0, 7); x.fill(); }
        else { // a tiny fish
          x.beginPath(); x.ellipse(0, 0, b.s * .6, b.s * .32, 0, 0, 7); x.fill();
          x.beginPath(); x.moveTo(-b.s * .5, 0); x.lineTo(-b.s * .95, -b.s * .3); x.lineTo(-b.s * .95, b.s * .3); x.fill();
        }
        x.restore();
      }
      if (alive) raf = requestAnimationFrame(step); else x.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 h-full w-full" />;
}
