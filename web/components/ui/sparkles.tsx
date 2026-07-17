'use client';

import { useId } from 'react';
import Particles, { ParticlesProvider, useParticlesProvider } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { Engine, ISourceOptions } from '@tsparticles/engine';

interface SparklesProps {
  className?: string;
  size?: number;
  minSize?: number | null;
  density?: number;
  speed?: number;
  minSpeed?: number | null;
  opacity?: number;
  opacitySpeed?: number;
  minOpacity?: number | null;
  color?: string;
  background?: string;
  options?: Partial<ISourceOptions>;
}

async function initEngine(engine: Engine) {
  await loadSlim(engine);
}

// Fondo de partículas sutil (efecto "sparkles") usado en la sección de
// confianza del landing. @tsparticles/react v4 inicializa el motor vía
// ParticlesProvider/useParticlesProvider en vez del antiguo initParticlesEngine.
function SparklesInner(props: SparklesProps) {
  const {
    className,
    size = 1,
    minSize = null,
    density = 800,
    speed = 1,
    minSpeed = null,
    opacity = 1,
    opacitySpeed = 3,
    minOpacity = null,
    color = '#FFFFFF',
    background = 'transparent',
    options = {},
  } = props;

  const { loaded } = useParticlesProvider();
  const id = useId();

  if (!loaded) return null;

  const defaultOptions: ISourceOptions = {
    background: { color: { value: background } },
    fullScreen: { enable: false, zIndex: 1 },
    fpsLimit: 120,
    particles: {
      color: { value: color },
      move: {
        enable: true,
        direction: 'none',
        speed: { min: minSpeed || speed / 10, max: speed },
        straight: false,
      },
      number: { value: density },
      opacity: {
        value: { min: minOpacity || opacity / 10, max: opacity },
        animation: { enable: true, sync: false, speed: opacitySpeed },
      },
      size: { value: { min: minSize || size / 2.5, max: size } },
    },
    detectRetina: true,
  };

  return <Particles id={id} options={{ ...defaultOptions, ...options }} className={className} />;
}

export function Sparkles(props: SparklesProps) {
  return (
    <ParticlesProvider init={initEngine}>
      <SparklesInner {...props} />
    </ParticlesProvider>
  );
}
