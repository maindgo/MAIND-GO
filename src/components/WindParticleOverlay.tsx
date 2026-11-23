import {useMap} from '@vis.gl/react-google-maps';
import {useEffect, useRef} from 'react';
import {WindGridSample} from '../types/weather';

interface WindParticleOverlayProps {
  active: boolean;
  windGrid: WindGridSample[];
  opacity: number;
}

interface Particle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
}

function interpolateWind(
  lat: number,
  lng: number,
  samples: WindGridSample[]
): {u: number; v: number; speed: number} {
  if (samples.length === 0) {
    return {u: 1.2, v: 0.3, speed: 15};
  }
  let sumW = 0;
  let sumU = 0;
  let sumV = 0;
  let sumS = 0;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const dLat = lat - s.lat;
    let dLng = lng - s.lng;
    if (dLng > 180) dLng -= 360;
    if (dLng < -180) dLng += 360;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < 0.0001) {
      // Meteorological wind direction is where wind comes FROM; vector blows TO (deg + 180)
      const rad = ((s.directionDeg + 180) * Math.PI) / 180;
      return {
        u: Math.sin(rad) * s.speedKmh,
        v: -Math.cos(rad) * s.speedKmh,
        speed: s.speedKmh,
      };
    }
    const w = 1 / (distSq + 1.5);
    const rad = ((s.directionDeg + 180) * Math.PI) / 180;
    sumW += w;
    sumU += w * Math.sin(rad) * s.speedKmh;
    sumV += w * -Math.cos(rad) * s.speedKmh;
    sumS += w * s.speedKmh;
  }

  return {
    u: sumU / sumW,
    v: sumV / sumW,
    speed: sumS / sumW,
  };
}

export function WindParticleOverlay({active, windGrid, opacity}: WindParticleOverlayProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef<WindGridSample[]>(windGrid);
  const opacityRef = useRef<number>(opacity);

  useEffect(() => {
    gridRef.current = windGrid;
  }, [windGrid]);

  useEffect(() => {
    opacityRef.current = opacity;
  }, [opacity]);

  useEffect(() => {
    if (!map || !active) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let particles: Particle[] = [];
    let overlayProjection: google.maps.MapCanvasProjection | null = null;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvasRef.current = canvas;

    const mapDiv = map.getDiv();
    mapDiv.appendChild(canvas);

    class ProjectionBridge extends google.maps.OverlayView {
      onAdd() {}
      draw() {
        overlayProjection = this.getProjection();
      }
      onRemove() {
        overlayProjection = null;
      }
    }

    const bridge = new ProjectionBridge();
    bridge.setMap(map);

    const resizeCanvas = () => {
      const rect = mapDiv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      const count = Math.min(750, Math.max(220, Math.floor((rect.width * rect.height) / 1400)));
      particles = Array.from({length: count}, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        age: Math.floor(Math.random() * 70),
        maxAge: 55 + Math.floor(Math.random() * 50),
      }));
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(mapDiv);

    const clearOnMove = map.addListener('bounds_changed', () => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    const renderFrame = () => {
      const ctx = canvas.getContext('2d');
      const rect = mapDiv.getBoundingClientRect();
      if (!ctx || rect.width === 0 || rect.height === 0) {
        rafId = requestAnimationFrame(renderFrame);
        return;
      }

      if (prefersReducedMotion) {
        ctx.clearRect(0, 0, rect.width, rect.height);
        if (overlayProjection && gridRef.current.length > 0) {
          ctx.strokeStyle = `rgba(34, 211, 238, ${0.75 * opacityRef.current})`;
          ctx.lineWidth = 1.5;
          for (const sample of gridRef.current) {
            const pt = overlayProjection.fromLatLngToContainerPixel(
              new google.maps.LatLng(sample.lat, sample.lng)
            );
            if (!pt) continue;
            const rad = ((sample.directionDeg + 180) * Math.PI) / 180;
            const len = Math.min(28, 10 + sample.speedKmh * 0.35);
            const dx = Math.sin(rad) * len;
            const dy = -Math.cos(rad) * len;
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
            ctx.lineTo(pt.x + dx, pt.y + dy);
            ctx.stroke();
          }
        }
        return;
      }

      // Fade existing trails gently
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.globalCompositeOperation = 'source-over';

      const alpha = Math.max(0.15, Math.min(0.95, opacityRef.current));
      ctx.lineWidth = 1.35;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.age >= p.maxAge || p.x < 0 || p.x > rect.width || p.y < 0 || p.y > rect.height) {
          p.x = Math.random() * rect.width;
          p.y = Math.random() * rect.height;
          p.age = 0;
          continue;
        }

        let u = 1.6;
        let v = -0.5;
        let speed = 18;

        if (overlayProjection && gridRef.current.length > 0) {
          const latLng = overlayProjection.fromContainerPixelToLatLng(new google.maps.Point(p.x, p.y));
          if (latLng) {
            const w = interpolateWind(latLng.lat(), latLng.lng(), gridRef.current);
            u = w.u;
            v = w.v;
            speed = w.speed;
          }
        }

        const scale = 0.09;
        const nx = p.x + u * scale;
        const ny = p.y + v * scale;

        const speedRatio = Math.min(1, speed / 60);
        ctx.strokeStyle =
          speedRatio > 0.6
            ? `rgba(56, 189, 248, ${0.85 * alpha})`
            : speedRatio > 0.3
              ? `rgba(34, 211, 238, ${0.7 * alpha})`
              : `rgba(186, 230, 253, ${0.55 * alpha})`;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();

        p.x = nx;
        p.y = ny;
        p.age += 1;
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      google.maps.event.removeListener(clearOnMove);
      bridge.setMap(null);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      canvasRef.current = null;
    };
  }, [map, active]);

  return null;
}
