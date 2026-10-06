import { useEffect, useRef } from 'react';

/**
 * Hero visual: an engraved guilloché rosette (the pattern printed on paper stock
 * certificates) re-imagined as an on-chain market core. A ring of blocks confirms
 * in sequence, nodes link the rosette to the chain, and ticker symbols orbit.
 * Canvas-based, DPR-capped, pauses offscreen, renders a single frame under reduced motion.
 */
const TICKERS = ['NVDA', 'AAPL', 'TSLA', 'AMZN', 'MSFT', 'GOOGL', 'META', 'AMD', 'SPY', 'QQQ'];

export function MarketCore({ reduced }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, raf = 0, visible = true, t0 = performance.now();
    let colors = readColors();

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      const light = document.documentElement.dataset.theme === 'light';
      return {
        gold: light ? '154,110,40' : '226,181,74',
        bright: light ? '120,84,24' : '251,231,168',
        text: cs.getPropertyValue('--text-dim').trim() || '#A49C8A',
        up: cs.getPropertyValue('--up').trim(),
        down: cs.getPropertyValue('--down').trim(),
        light,
      };
    }

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const rosette = (cx, cy, R, amp, lobes, phase, alpha, lw) => {
      ctx.beginPath();
      const steps = 360;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const r = R + amp * Math.sin(lobes * a + phase) + amp * 0.35 * Math.sin((lobes * 2 + 1) * a - phase * 1.7);
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = `rgba(${colors.gold},${alpha})`;
      ctx.lineWidth = lw;
      ctx.stroke();
    };

    const draw = (now) => {
      const t = reduced ? 8 : (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const S = (Math.min(w, h) / 2) * 0.9;

      // Engraved rosette: many phase-shifted lines create the moiré guilloché.
      for (let k = 0; k < 22; k++) {
        const ph = k * 0.14 + t * 0.05;
        rosette(cx, cy, S * 0.46, S * 0.09, 9, ph, 0.07 + (k % 4 === 0 ? 0.08 : 0), 0.8);
      }
      for (let k = 0; k < 10; k++) rosette(cx, cy, S * 0.25, S * 0.05, 6, -k * 0.3 - t * 0.08, 0.1, 0.7);

      // Block ring: blocks confirm in sequence around the core.
      const N = 28, ringR = S * 0.78, active = Math.floor(t * 2.2) % N;
      ctx.lineWidth = 1;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2 + t * 0.02;
        const x = cx + ringR * Math.cos(a), y = cy + ringR * Math.sin(a);
        const age = (active - i + N) % N;
        const lit = Math.max(0, 1 - age / 6);
        // chain link between blocks
        const a2 = ((i + 1) / N) * Math.PI * 2 - Math.PI / 2 + t * 0.02;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(cx + ringR * Math.cos(a2), cy + ringR * Math.sin(a2));
        ctx.strokeStyle = `rgba(${colors.gold},${0.14 + lit * 0.35})`;
        ctx.stroke();
        ctx.save();
        ctx.translate(x, y); ctx.rotate(a + Math.PI / 4);
        const s = 5 + lit * 2;
        ctx.fillStyle = `rgba(${lit > 0.05 ? colors.bright : colors.gold},${0.25 + lit * 0.75})`;
        if (lit > 0.6 && !colors.light) { ctx.shadowColor = `rgba(${colors.gold},.9)`; ctx.shadowBlur = 14; }
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
        // spoke from every 4th block into the rosette (oracle feeds)
        if (i % 4 === 0) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(cx + S * 0.55 * Math.cos(a), cy + S * 0.55 * Math.sin(a));
          ctx.strokeStyle = `rgba(${colors.gold},${0.08 + lit * 0.4})`;
          ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);
        }
      }

      // Central candlestick strip
      const candles = 11, cw = S * 0.035, gap = S * 0.03;
      const totalW = candles * cw + (candles - 1) * gap;
      for (let i = 0; i < candles; i++) {
        const base = Math.sin(i * 0.9 + 1) * 0.5 + i * 0.12;
        const wob = reduced ? 0 : Math.sin(t * 0.8 + i) * 0.08;
        const o = base, c = base + (Math.sin(i * 2.1) > -0.2 ? 0.35 : -0.3) + wob;
        const up = c >= o;
        const x = cx - totalW / 2 + i * (cw + gap);
        const yO = cy + S * 0.1 - o * S * 0.12, yC = cy + S * 0.1 - c * S * 0.12;
        ctx.strokeStyle = `rgba(${colors.gold},.55)`;
        ctx.beginPath(); ctx.moveTo(x + cw / 2, Math.min(yO, yC) - S * 0.03); ctx.lineTo(x + cw / 2, Math.max(yO, yC) + S * 0.03); ctx.stroke();
        ctx.fillStyle = up ? `rgba(${colors.bright},.9)` : `rgba(${colors.gold},.35)`;
        ctx.fillRect(x, Math.min(yO, yC), cw, Math.max(2, Math.abs(yC - yO)));
      }

      // Orbiting tickers
      ctx.font = `500 ${Math.max(10, S * 0.042)}px 'IBM Plex Sans', system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      TICKERS.forEach((sym, i) => {
        const a = (i / TICKERS.length) * Math.PI * 2 + t * 0.045 * (i % 2 ? 1 : -1);
        const r = S * (i % 2 ? 0.92 : 0.64);
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a) * 0.96;
        ctx.fillStyle = colors.text;
        ctx.globalAlpha = 0.55 + 0.45 * Math.max(0, Math.sin(a + t * 0.3));
        ctx.fillText(sym, x, y);
        ctx.globalAlpha = 1;
      });

      if (!reduced && visible) raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(() => { resize(); if (reduced) draw(performance.now()); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !reduced) raf = requestAnimationFrame(draw);
    });
    io.observe(canvas);
    const mo = new MutationObserver(() => { colors = readColors(); if (reduced) draw(performance.now()); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && visible && !reduced) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVis);
    draw(performance.now());

    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); mo.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, [reduced]);

  return <canvas ref={canvasRef} className="market-core" role="img" aria-label="Animated illustration of tokenized stocks settling on a ring of blockchain blocks" />;
}
