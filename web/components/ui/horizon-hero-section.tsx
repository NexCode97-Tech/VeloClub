'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface Scene {
  id: string;
  title: string;
  subtitle: { line1: string; line2: string };
}

const SCENES: Scene[] = [
  {
    id: 'veloclub',
    title: 'VELOCLUB',
    subtitle: {
      line1: 'Plataforma para clubes deportivos',
      line2: 'del futuro',
    },
  },
  {
    id: 'gestion',
    title: 'GESTIÓN',
    subtitle: {
      line1: 'Miembros, asistencia y pagos',
      line2: 'en un solo lugar',
    },
  },
  {
    id: 'comunidad',
    title: 'COMUNIDAD',
    subtitle: {
      line1: 'Conecta tu club con sus deportistas',
      line2: 'en tiempo real',
    },
  },
];

interface ThreeRefs {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  composer: EffectComposer | null;
  stars: THREE.Points[];
  nebula: THREE.Mesh | null;
  mountains: THREE.Mesh[];
  locations: number[];
  animationId: number | null;
  targetCameraX: number;
  targetCameraY: number;
  targetCameraZ: number;
}

export const HorizonHeroSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const heroSubtitleRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef<HTMLDivElement>(null);

  const smoothCameraPos = useRef({ x: 0, y: 30, z: 300 });

  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const totalSections = SCENES.length;

  const threeRefs = useRef<ThreeRefs>({
    scene: null,
    camera: null,
    renderer: null,
    composer: null,
    stars: [],
    nebula: null,
    mountains: [],
    locations: [],
    animationId: null,
    targetCameraX: 0,
    targetCameraY: 30,
    targetCameraZ: 300,
  });

  // Three.js init
  useEffect(() => {
    const refs = threeRefs.current;
    if (!canvasRef.current) return;

    const createStarField = () => {
      const starCount = 5000;
      for (let i = 0; i < 3; i++) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);

        for (let j = 0; j < starCount; j++) {
          const radius = 200 + Math.random() * 800;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(Math.random() * 2 - 1);

          positions[j * 3]     = radius * Math.sin(phi) * Math.cos(theta);
          positions[j * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
          positions[j * 3 + 2] = radius * Math.cos(phi);

          // Paleta violeta — VeloClub
          const color = new THREE.Color();
          const choice = Math.random();
          if (choice < 0.65) {
            color.setHSL(0, 0, 0.85 + Math.random() * 0.15); // blancos
          } else if (choice < 0.88) {
            color.setHSL(0.75, 0.55, 0.75); // violeta claro
          } else {
            color.setHSL(0.78, 0.7, 0.65); // violeta intenso
          }

          colors[j * 3]     = color.r;
          colors[j * 3 + 1] = color.g;
          colors[j * 3 + 2] = color.b;
          sizes[j] = Math.random() * 2 + 0.5;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.ShaderMaterial({
          uniforms: {
            time:  { value: 0 },
            depth: { value: i },
          },
          vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            uniform float time;
            uniform float depth;
            void main() {
              vColor = color;
              vec3 pos = position;
              float angle = time * 0.05 * (1.0 - depth * 0.3);
              mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
              pos.xy = rot * pos.xy;
              vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
              gl_PointSize = size * (300.0 / -mvPosition.z);
              gl_Position = projectionMatrix * mvPosition;
            }
          `,
          fragmentShader: `
            varying vec3 vColor;
            void main() {
              float dist = length(gl_PointCoord - vec2(0.5));
              if (dist > 0.5) discard;
              float opacity = 1.0 - smoothstep(0.0, 0.5, dist);
              gl_FragColor = vec4(vColor, opacity);
            }
          `,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });

        const stars = new THREE.Points(geometry, material);
        refs.scene!.add(stars);
        refs.stars.push(stars);
      }
    };

    const createNebula = () => {
      const geometry = new THREE.PlaneGeometry(8000, 4000, 100, 100);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          time:    { value: 0 },
          color1:  { value: new THREE.Color(0x6D28D9) }, // violeta profundo
          color2:  { value: new THREE.Color(0xA855F7) }, // violeta claro
          opacity: { value: 0.32 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying float vElevation;
          uniform float time;
          void main() {
            vUv = uv;
            vec3 pos = position;
            float elevation = sin(pos.x * 0.01 + time) * cos(pos.y * 0.01 + time) * 20.0;
            pos.z += elevation;
            vElevation = elevation;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 color1;
          uniform vec3 color2;
          uniform float opacity;
          uniform float time;
          varying vec2 vUv;
          varying float vElevation;
          void main() {
            float mixFactor = sin(vUv.x * 10.0 + time) * cos(vUv.y * 10.0 + time);
            vec3 color = mix(color1, color2, mixFactor * 0.5 + 0.5);
            float alpha = opacity * (1.0 - length(vUv - 0.5) * 2.0);
            alpha *= 1.0 + vElevation * 0.01;
            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const nebula = new THREE.Mesh(geometry, material);
      nebula.position.z = -1050;
      refs.scene!.add(nebula);
      refs.nebula = nebula;
    };

    const createMountains = () => {
      const layers = [
        { distance: -50,  height: 60,  color: 0x1a0d2e, opacity: 1   },
        { distance: -100, height: 80,  color: 0x2a1846, opacity: 0.8 },
        { distance: -150, height: 100, color: 0x3d2861, opacity: 0.6 },
        { distance: -200, height: 120, color: 0x5a3b8c, opacity: 0.4 },
      ];

      layers.forEach((layer, index) => {
        const points: THREE.Vector2[] = [];
        const segments = 50;

        for (let i = 0; i <= segments; i++) {
          const x = (i / segments - 0.5) * 1000;
          const y =
            Math.sin(i * 0.1) * layer.height +
            Math.sin(i * 0.05) * layer.height * 0.5 +
            Math.random() * layer.height * 0.2 - 100;
          points.push(new THREE.Vector2(x, y));
        }
        points.push(new THREE.Vector2(5000, -300));
        points.push(new THREE.Vector2(-5000, -300));

        const shape = new THREE.Shape(points);
        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          side: THREE.DoubleSide,
        });

        const mountain = new THREE.Mesh(geometry, material);
        mountain.position.z = layer.distance;
        mountain.position.y = layer.distance;
        mountain.userData = { baseZ: layer.distance, index };
        refs.scene!.add(mountain);
        refs.mountains.push(mountain);
      });
    };

    const createAtmosphere = () => {
      const geometry = new THREE.SphereGeometry(600, 32, 32);
      const material = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 } },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          uniform float time;
          void main() {
            float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            vec3 atmosphere = vec3(0.48, 0.36, 0.91) * intensity;
            float pulse = sin(time * 2.0) * 0.1 + 0.9;
            atmosphere *= pulse;
            gl_FragColor = vec4(atmosphere, intensity * 0.25);
          }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
      });
      refs.scene!.add(new THREE.Mesh(geometry, material));
    };

    refs.scene = new THREE.Scene();
    refs.scene.fog = new THREE.FogExp2(0x000000, 0.00025);

    refs.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    refs.camera.position.z = 100;
    refs.camera.position.y = 20;

    refs.renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    refs.renderer.setSize(window.innerWidth, window.innerHeight);
    refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    refs.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    refs.renderer.toneMappingExposure = 0.5;

    refs.composer = new EffectComposer(refs.renderer);
    refs.composer.addPass(new RenderPass(refs.scene, refs.camera));
    refs.composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.9,
        0.4,
        0.85
      )
    );

    createStarField();
    createNebula();
    createMountains();
    createAtmosphere();

    refs.locations = refs.mountains.map(m => m.position.z);

    const animate = () => {
      refs.animationId = requestAnimationFrame(animate);
      const time = Date.now() * 0.001;

      refs.stars.forEach(field => {
        const mat = field.material as THREE.ShaderMaterial;
        if (mat.uniforms) mat.uniforms.time.value = time;
      });

      if (refs.nebula) {
        const mat = refs.nebula.material as THREE.ShaderMaterial;
        if (mat.uniforms) mat.uniforms.time.value = time * 0.5;
      }

      if (refs.camera) {
        const smoothing = 0.05;
        smoothCameraPos.current.x += (refs.targetCameraX - smoothCameraPos.current.x) * smoothing;
        smoothCameraPos.current.y += (refs.targetCameraY - smoothCameraPos.current.y) * smoothing;
        smoothCameraPos.current.z += (refs.targetCameraZ - smoothCameraPos.current.z) * smoothing;

        const floatX = Math.sin(time * 0.1) * 2;
        const floatY = Math.cos(time * 0.15) * 1;

        refs.camera.position.x = smoothCameraPos.current.x + floatX;
        refs.camera.position.y = smoothCameraPos.current.y + floatY;
        refs.camera.position.z = smoothCameraPos.current.z;
        refs.camera.lookAt(0, 10, -600);
      }

      refs.mountains.forEach((m, i) => {
        const parallax = 1 + i * 0.5;
        m.position.x = Math.sin(time * 0.1) * 2 * parallax;
        m.position.y = 50 + Math.cos(time * 0.15) * 1 * parallax;
      });

      if (refs.composer) refs.composer.render();
    };

    animate();
    setIsReady(true);

    const handleResize = () => {
      if (refs.camera && refs.renderer && refs.composer) {
        refs.camera.aspect = window.innerWidth / window.innerHeight;
        refs.camera.updateProjectionMatrix();
        refs.renderer.setSize(window.innerWidth, window.innerHeight);
        refs.composer.setSize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (refs.animationId) cancelAnimationFrame(refs.animationId);
      window.removeEventListener('resize', handleResize);

      refs.stars.forEach(field => {
        field.geometry.dispose();
        (field.material as THREE.Material).dispose();
      });
      refs.mountains.forEach(m => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      if (refs.nebula) {
        refs.nebula.geometry.dispose();
        (refs.nebula.material as THREE.Material).dispose();
      }
      if (refs.renderer) refs.renderer.dispose();
    };
  }, []);

  // Entrada animada
  useEffect(() => {
    if (!isReady) return;

    gsap.set([heroTitleRef.current, heroSubtitleRef.current, ctaRef.current, scrollProgressRef.current], {
      visibility: 'visible',
    });

    const tl = gsap.timeline();

    if (heroTitleRef.current) {
      const chars = heroTitleRef.current.querySelectorAll('.title-char');
      tl.from(chars, {
        y: 160,
        opacity: 0,
        duration: 1.2,
        stagger: 0.05,
        ease: 'power4.out',
      });
    }
    if (heroSubtitleRef.current) {
      const lines = heroSubtitleRef.current.querySelectorAll('.subtitle-line');
      tl.from(lines, {
        y: 40,
        opacity: 0,
        duration: 0.9,
        stagger: 0.15,
        ease: 'power3.out',
      }, '-=0.6');
    }
    if (ctaRef.current) {
      tl.from(ctaRef.current, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      }, '-=0.4');
    }
    if (scrollProgressRef.current) {
      tl.from(scrollProgressRef.current, {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: 'power2.out',
      }, '-=0.4');
    }

    return () => { tl.kill(); };
  }, [isReady]);

  // Scroll: solo activo mientras estamos en el bloque del hero
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const refs = threeRefs.current;

      const rect = containerRef.current.getBoundingClientRect();
      const containerHeight = containerRef.current.offsetHeight;
      const windowHeight = window.innerHeight;
      const scrolled = Math.max(0, -rect.top);
      const maxScroll = containerHeight - windowHeight;
      const progress = Math.min(1, Math.max(0, maxScroll > 0 ? scrolled / maxScroll : 0));

      setScrollProgress(progress);
      const totalProgress = progress * (totalSections - 1);
      const newSection = Math.min(totalSections - 1, Math.floor(totalProgress + 0.001));
      setCurrentSection(newSection);

      const sectionProgress = totalProgress - newSection;

      const cameraPositions = [
        { x: 0, y: 30, z: 300 },
        { x: 0, y: 40, z: -50 },
        { x: 0, y: 50, z: -500 },
      ];
      const currentPos = cameraPositions[newSection] || cameraPositions[0];
      const nextPos    = cameraPositions[newSection + 1] || currentPos;

      refs.targetCameraX = currentPos.x + (nextPos.x - currentPos.x) * sectionProgress;
      refs.targetCameraY = currentPos.y + (nextPos.y - currentPos.y) * sectionProgress;
      refs.targetCameraZ = currentPos.z + (nextPos.z - currentPos.z) * sectionProgress;

      refs.mountains.forEach((m, i) => {
        const speed = 1 + i * 0.9;
        const targetZ = m.userData.baseZ + scrolled * speed * 0.5;
        if (refs.nebula) refs.nebula.position.z = targetZ + progress * speed * 0.01 - 100;

        if (progress > 0.7) {
          m.position.z = 600000;
        } else {
          m.position.z = refs.locations[i];
        }
      });
      if (refs.nebula && refs.mountains[3]) refs.nebula.position.z = refs.mountains[3].position.z;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [totalSections]);

  const splitTitle = (text: string) =>
    text.split('').map((char, i) => (
      <span key={i} className="title-char inline-block" style={{ whiteSpace: 'pre' }}>
        {char === ' ' ? ' ' : char}
      </span>
    ));

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: `${100 * totalSections}vh` }}>
      <style jsx global>{`
        @keyframes hero-pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>

      {/* Canvas y contenido sticky — viajan junto al scroll */}
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

        {/* Contenedor de escenas */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-white px-5">
          {SCENES.map((scene, idx) => {
            const isActive = currentSection === idx;
            return (
              <div
                key={scene.id}
                className="absolute inset-0 flex flex-col items-center justify-center text-center transition-opacity duration-700 ease-out"
                style={{ opacity: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none' }}
              >
                <h1
                  ref={idx === 0 ? heroTitleRef : null}
                  className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold tracking-tight leading-none bg-clip-text text-transparent"
                  style={{
                    backgroundImage: 'linear-gradient(135deg, #F5F3FF 0%, #C4B5FD 45%, #A855F7 75%, #7C3AED 100%)',
                    visibility: idx === 0 ? 'hidden' : 'visible',
                  }}
                >
                  {idx === 0 ? splitTitle(scene.title) : scene.title}
                </h1>

                <div
                  ref={idx === 0 ? heroSubtitleRef : null}
                  className="mt-5 sm:mt-7 max-w-2xl"
                  style={{ visibility: idx === 0 ? 'hidden' : 'visible' }}
                >
                  <p className="subtitle-line text-base sm:text-lg md:text-xl text-violet-100/85 font-light leading-relaxed">
                    {scene.subtitle.line1}
                  </p>
                  <p className="subtitle-line text-base sm:text-lg md:text-xl text-violet-100/85 font-light leading-relaxed">
                    {scene.subtitle.line2}
                  </p>
                </div>

                {/* CTAs solo en la primera escena */}
                {idx === 0 && (
                  <div
                    ref={ctaRef}
                    className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center"
                    style={{ visibility: 'hidden' }}
                  >
                    <Link
                      href="/sign-in"
                      className="inline-flex items-center justify-center gap-2 px-8 py-4 text-white rounded-full font-semibold text-base sm:text-lg transition-all duration-300 hover:scale-105 shadow-lg shadow-violet-500/40 hover:shadow-xl hover:shadow-violet-500/50"
                      style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}
                    >
                      Entrar a VeloClub
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                    <a
                      href="#funcionalidades"
                      className="inline-flex items-center justify-center px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 text-white rounded-full font-semibold text-base sm:text-lg transition-all duration-300 hover:scale-105 backdrop-blur-sm"
                    >
                      Ver funcionalidades
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Indicador de scroll */}
        <div
          ref={scrollProgressRef}
          className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 sm:gap-4"
          style={{ visibility: 'hidden' }}
        >
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-violet-200/70 font-semibold">
            Scroll
          </span>
          <div className="w-24 sm:w-32 h-[2px] bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200 ease-out"
              style={{
                width: `${scrollProgress * 100}%`,
                background: 'linear-gradient(90deg, #A855F7, #E9D5FF)',
              }}
            />
          </div>
          <span className="text-[10px] sm:text-xs tabular-nums text-violet-200/70 font-semibold">
            {String(currentSection + 1).padStart(2, '0')} / {String(totalSections).padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default HorizonHeroSection;
