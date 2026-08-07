'use client';

import * as React from 'react';
import { createNoise3D } from 'simplex-noise';
import { cn } from '@/lib/utils';

interface VortexBackgroundProps {
  className?: string;
  /** Partículas en escritorio. En pantallas angostas se usa la mitad. */
  particleCount?: number;
  /** Tono base en grados HSL. 265 es el morado de la marca. */
  baseHue?: number;
  rangeHue?: number;
  baseSpeed?: number;
  rangeSpeed?: number;
  opacity?: number;
}

const PROPS_POR_PARTICULA = 9;
const VIDA_BASE = 50;
const VIDA_RANGO = 150;
const RADIO_BASE = 1;
const RADIO_RANGO = 2;
const PASOS_RUIDO = 3;
const X_OFF = 0.00125;
const Y_OFF = 0.00125;
const Z_OFF = 0.0005;
const TAU = 2 * Math.PI;

// El canvas se dibuja a resolución de pantalla, pero por encima de 1.5 el costo
// por fotograma crece más rápido de lo que se nota la diferencia. En un celular
// de gama media eso es la diferencia entre ir fluido y calentar el equipo.
const DPR_MAX = 1.5;

const azar = (n: number) => n * Math.random();
const azarCentrado = (n: number) => n - azar(2 * n);
const entrarSalir = (t: number, m: number) => {
  const hm = 0.5 * m;
  return Math.abs(((t + hm) % m) - hm) / hm;
};
const interpolar = (a: number, b: number, f: number) => (1 - f) * a + f * b;

/**
 * Corriente de partículas guiada por ruido simplex, pensada para ir detrás del
 * contenido de un hero. No recibe hijos: es solo fondo.
 *
 * Queda quieta si el sistema pide menos animación, y se detiene sola cuando la
 * pestaña pasa a segundo plano o el hero sale de pantalla, para no gastar
 * batería dibujando algo que nadie está viendo.
 */
export function VortexBackground({
  className,
  particleCount = 260,
  baseHue = 265,
  rangeHue = 60,
  baseSpeed = 0.0,
  rangeSpeed = 1.2,
  opacity = 0.55,
}: VortexBackgroundProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const contenedorRef = React.useRef<HTMLDivElement>(null);
  const [activo, setActivo] = React.useState(false);

  // El hero mide el LCP. Arrancar el canvas en el primer fotograma compite con
  // la imagen de fondo por el hilo principal, así que se espera a que el
  // navegador esté desocupado.
  React.useEffect(() => {
    const menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (menosMovimiento.matches) return;

    type ConIdle = { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const w = window as Window & ConIdle;
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => setActivo(true), { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setActivo(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (!activo) return;
    const canvas = canvasRef.current;
    const contenedor = contenedorRef.current;
    if (!canvas || !contenedor) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const noise3D = createNoise3D();
    const angosta = window.innerWidth < 768;
    const total = angosta ? Math.round(particleCount / 2) : particleCount;
    const largo = total * PROPS_POR_PARTICULA;

    let props = new Float32Array(largo);
    let tick = 0;
    let ancho = 0;
    let alto = 0;
    let centroY = 0;
    let frame = 0;
    let visible = true;
    let enPantalla = true;

    function iniciarParticula(i: number) {
      props[i]     = azar(ancho);
      props[i + 1] = centroY + azarCentrado(alto * 0.5);
      props[i + 2] = 0;
      props[i + 3] = 0;
      props[i + 4] = 0;
      props[i + 5] = VIDA_BASE + azar(VIDA_RANGO);
      props[i + 6] = baseSpeed + azar(rangeSpeed);
      props[i + 7] = RADIO_BASE + azar(RADIO_RANGO);
      props[i + 8] = baseHue + azar(rangeHue);
    }

    function iniciarTodas() {
      tick = 0;
      props = new Float32Array(largo);
      for (let i = 0; i < largo; i += PROPS_POR_PARTICULA) iniciarParticula(i);
    }

    // El canvas se mide contra el contenedor, no contra la ventana: el hero no
    // siempre ocupa la pantalla completa y con innerWidth quedaba desalineado.
    function redimensionar() {
      if (!canvas || !contenedor) return;
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
      const caja = contenedor.getBoundingClientRect();
      ancho = Math.max(1, Math.floor(caja.width));
      alto = Math.max(1, Math.floor(caja.height));
      centroY = 0.5 * alto;
      canvas.width = Math.floor(ancho * dpr);
      canvas.height = Math.floor(alto * dpr);
      canvas.style.width = `${ancho}px`;
      canvas.style.height = `${alto}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function fueraDeLimites(x: number, y: number) {
      return x > ancho || x < 0 || y > alto || y < 0;
    }

    function actualizar(i: number) {
      if (!ctx) return;
      const x = props[i];
      const y = props[i + 1];
      const n = noise3D(x * X_OFF, y * Y_OFF, tick * Z_OFF) * PASOS_RUIDO * TAU;
      const vx = interpolar(props[i + 2], Math.cos(n), 0.5);
      const vy = interpolar(props[i + 3], Math.sin(n), 0.5);
      let vida = props[i + 4];
      const ttl = props[i + 5];
      const velocidad = props[i + 6];
      const x2 = x + vx * velocidad;
      const y2 = y + vy * velocidad;

      ctx.lineWidth = props[i + 7];
      ctx.strokeStyle = `hsla(${props[i + 8]},95%,68%,${entrarSalir(vida, ttl)})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      vida++;
      props[i] = x2;
      props[i + 1] = y2;
      props[i + 2] = vx;
      props[i + 3] = vy;
      props[i + 4] = vida;

      if (fueraDeLimites(x2, y2) || vida > ttl) iniciarParticula(i);
    }

    function dibujar() {
      if (!canvas || !ctx) return;
      tick++;
      // Se limpia en transparente, no con un color: así el fondo del hero que
      // está debajo sigue viéndose y esto queda como una capa más.
      ctx.clearRect(0, 0, ancho, alto);

      ctx.save();
      ctx.lineCap = 'round';
      // Las partículas se suman entre sí donde se cruzan, que es de donde sale
      // el brillo. El original repintaba el canvas encima dos veces con
      // desenfoque; con una sola pasada aditiva el resultado es casi el mismo
      // y cuesta bastante menos por fotograma.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < largo; i += PROPS_POR_PARTICULA) actualizar(i);
      ctx.restore();

      frame = window.requestAnimationFrame(dibujar);
    }

    function arrancar() {
      if (frame || !visible || !enPantalla) return;
      frame = window.requestAnimationFrame(dibujar);
    }
    function parar() {
      if (!frame) return;
      window.cancelAnimationFrame(frame);
      frame = 0;
    }

    redimensionar();
    iniciarTodas();
    arrancar();

    const observadorTamano = new ResizeObserver(() => {
      redimensionar();
      iniciarTodas();
    });
    observadorTamano.observe(contenedor);

    const observadorVista = new IntersectionObserver(([e]) => {
      enPantalla = e.isIntersecting;
      if (enPantalla) arrancar(); else parar();
    });
    observadorVista.observe(contenedor);

    function alCambiarVisibilidad() {
      visible = document.visibilityState === 'visible';
      if (visible) arrancar(); else parar();
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad);

    return () => {
      parar();
      observadorTamano.disconnect();
      observadorVista.disconnect();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [activo, particleCount, baseHue, rangeHue, baseSpeed, rangeSpeed]);

  return (
    <div
      ref={contenedorRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full transition-opacity duration-1000"
        style={{ opacity: activo ? opacity : 0 }}
      />
    </div>
  );
}
