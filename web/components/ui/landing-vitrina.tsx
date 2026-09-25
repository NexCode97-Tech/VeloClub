'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Las dos pantallas de la app, asomándose en el home.
 *
 * No son capturas: están dibujadas en HTML. Pesan unos pocos kB en vez de
 * varios cientos, se ven nítidas a cualquier tamaño y se actualizan cambiando
 * texto en vez de volver a capturar, recortar y anonimizar a mano. Y los datos
 * son inventados a propósito: una captura real lleva cédulas, teléfonos,
 * correos y EPS de personas de verdad, varias de ellas menores de edad, y esta
 * página es pública.
 *
 * Es una copia del prototipo aprobado, no una versión equivalente. Los íconos
 * van incrustados en vez de importados de `custom-icons` por eso mismo: esto es
 * un dibujo de la app y no la app, así que se queda con el aspecto que tenía el
 * día que se aprobó y no cambia solo cuando alguien retoca un ícono adentro.
 *
 * Todo el CSS va prefijado por `.vt-zona`, que es el envoltorio. Trae
 * selectores de elemento (`h2`, `svg`) que sin ese prefijo le pegarían al resto
 * de la landing.
 */
export default function LandingVitrina() {
  const [activa, setActiva] = useState<'izq' | 'der'>('izq');
  const caja = useRef<HTMLDivElement>(null);

  /* Las pantallas están dibujadas a 1440 y hay que encogerlas a lo que mida la
     ventana, que cambia con el ancho de la página. Una escala escrita a mano
     solo cuadra al ancho para el que se calculó, así que se mide y se divide.

     Va por `ref` y no por estado: es un número que solo lee el CSS, y pasarlo
     por React volvería a dibujar las dos pantallas en cada píxel de arrastre. */
  useEffect(() => {
    const vitrina = caja.current;
    if (!vitrina) return;
    const primera = vitrina.querySelector<HTMLElement>('.ventana');
    if (!primera) return;

    const escalar = () => {
      const ancho = primera.clientWidth;
      if (ancho > 0) vitrina.style.setProperty('--esc', String(ancho / 1440));
    };
    escalar();

    const ro = new ResizeObserver(escalar);
    ro.observe(vitrina);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="vt-zona">
      <style>{`
/* Esta página muestra un bloque de la landing, que es clara siempre. Va con
     los colores literales de producción y no con tokens de tema. */
  .vt-zona{
    --tinta:#1A1028; --mudo:#8E87A8; --morado:#381DA0; --linea:rgba(26,16,40,0.08);
    --gris:#F4F3F8; --menta:#06D6A0; --ambar:#FFB703;
  }
  .vt-zona,.vt-zona *{box-sizing:border-box}
  .vt-zona .vt-zona{color:var(--tinta);line-height:1.6;-webkit-font-smoothing:antialiased}
  .vt-zona .marco{max-width:1200px;margin:0 auto;padding:0 22px}

  /* ── El bloque, como iría en el home ───────────────────── */
  .vt-zona .bloque{padding:72px 0 46px;overflow:hidden}
  /* El encabezado va alineado con la pantalla de la izquierda, no centrado.
     Comparte el ancho de la vitrina y su mismo 3% de aire, así que el titular
     arranca justo donde arranca Miembros. Centrado quedaba flotando sobre una
     composición que está claramente anclada a la izquierda. */
  .vt-zona .presenta{width:min(1156px,100% - 44px);margin:0 auto;padding:0 3%}
  .vt-zona .rotulo{font-size:13px;font-weight:600;color:var(--mudo);margin:0 0 12px}
  .vt-zona h2{font-size:clamp(1.75rem,3.4vw,2.375rem);font-weight:600;letter-spacing:-.03em;
    margin:0;line-height:1.15;max-width:19ch;text-wrap:balance}

  /* Un rótulo por pantalla, cada uno sobre la suya. El reparto es el mismo
     40 / 60 de abajo, por eso el segundo cae exacto donde empieza Finanzas. */
  .vt-zona .letreros{display:grid;grid-template-columns:40% 60%;gap:24px;margin-top:40px}
  .vt-zona .letrero h3{margin:0 0 10px;font-size:16.5px;font-weight:600;letter-spacing:-.02em;
    color:var(--tinta);transition:color .4s cubic-bezier(.22,.61,.36,1)}
  .vt-zona .letrero p{margin:0;font-size:14.5px;line-height:1.6;color:var(--mudo);
    max-width:31ch;transition:color .4s cubic-bezier(.22,.61,.36,1)}

  /* El que no manda se apaga. Es la única pista de que los dos textos y las
     dos pantallas son pares, y de que esto se puede tocar: sin ella el relevo
     parece un adorno que pasa solo. El texto también activa, así que el que
     lee el rótulo ya está mirando la pantalla que le toca. */
  .vt-zona .letrero{cursor:default}
  .vt-zona .letrero.apagado h3{color:#9A93B0}
  .vt-zona .letrero.apagado p{color:#ADA7BE}

  /* ── La vitrina ──────────────────────────────────

     Mide 1156, que es lo que le queda al marco de la landing: 1200 menos los
     22 de aire de cada lado. El alto va en \`aspect-ratio\` y no en px para que
     al encogerse la página la caja siga siendo la misma caja.

     El reparto es 40 / 20 / 40: cada pantalla ocupa 60% y las dos se pisan en
     el 20% del medio. Todo en porcentaje, así que el solape no se descuadra a
     ningún ancho. */
  .vt-zona .vitrina{position:relative;margin:52px auto 0;
    width:min(1156px,100% - 44px);
    aspect-ratio:1156/470;border-radius:24px;overflow:hidden;
    background:#F4F3F8}

  /* El filo del marco va en una capa aparte y por encima de todo.

     Como \`box-shadow: inset\` se pinta en el fondo de la caja, cualquier hijo se
     le monta, y las dos pantallas están pegadas justo al borde de abajo: ahí la
     línea desaparecía y el marco parecía abierto por el costado inferior. En
     una capa propia con \`z-index\` alto el filo se cierra completo, y con
     \`pointer-events:none\` no le roba el cursor al relevo. */
  .vt-zona .vitrina::after{content:'';position:absolute;inset:0;border-radius:inherit;
    box-shadow:inset 0 0 0 1px rgba(26,16,40,.07);
    pointer-events:none;z-index:5}

  /* La ranura pone el sitio y no se mueve. Lo que se mueve es la ventana de
     adentro, así el relevo nunca recalcula posiciones. */
  /* El marco respira 3% por cada lado: las pantallas no lo tocan. Sobre ese
     94% útil se aplica el reparto, así que cada una queda en 56,4% de la
     vitrina y el solape en 18,8%, que sigue siendo un tercio de la ventana. */
  .vt-zona .ranura{position:absolute;bottom:0;width:56.4%;height:85.1%;z-index:1}
  .vt-zona .r-izq{left:3%}
  .vt-zona .r-der{left:40.6%}
  .vt-zona .ranura.activa{z-index:2}

  /* La ventana lleva borde arriba y a los lados, nunca abajo, y el radio solo
     en las dos esquinas de arriba: está pegada al borde de la vitrina y una
     esquina redonda abajo abriría un hueco de gris donde no hay nada.

     \`position:relative\` es obligatorio. Sin él el lienzo de adentro, que es
     absoluto, se cuelga de la ranura en vez de la ventana, el \`overflow\` deja
     de recortarlo y las esquinas salen cuadradas. */
  .vt-zona .ventana{position:relative;width:100%;height:100%;overflow:hidden;
    background:#fff;border-radius:16px 16px 0 0;
    border:1px solid rgba(0,0,0,.075);border-bottom:0;
    transform:translateY(12px);transform-origin:50% 100%;
    -webkit-mask-size:200% 100%;mask-size:200% 100%;
    -webkit-mask-repeat:repeat;mask-repeat:repeat;
    transition:transform .5s cubic-bezier(.22,.61,.36,1),
               -webkit-mask-position .5s cubic-bezier(.22,.61,.36,1),
               mask-position .5s cubic-bezier(.22,.61,.36,1)}

  /* La que recibe el cursor sube esos 12px y se queda arriba; la que suelta el
     turno los baja. No hay brinco: el desnivel es el estado, no un rebote. Y
     crece un 1%, con el origen en el borde de abajo para que al crecer no se
     despegue de él. */
  .vt-zona .ranura.activa .ventana{transform:translateY(0) scale(1.01)}

  /* El barrido del costado tapado.

     Es una máscara del doble de ancho que la ventana, y lo que se anima es
     \`mask-position\`. Ese es el truco: \`mask-image\` no transiciona y
     \`mask-position\` sí, así que correr la máscara saca el degradado del cuadro
     y el costado se descubre de un lado al otro en vez de aparecer de golpe.

     El degradado va en 75% → 83,333% de la máscara, y cada ventana se corre
     medio ancho de máscara entre sus dos estados. Los dos números y los cuatro
     desplazamientos salen de la misma cuenta y no se tocan por separado: sobre
     la ventana, el corte cae en su tercio de afuera, que es exactamente lo que
     le tapa la otra.

     Se mueven en sentidos opuestos, y ahí está el detalle que es fácil
     equivocar: la de la izquierda se descubre hacia su derecha y la de la
     derecha hacia su izquierda, o sea las dos hacia adentro, hacia donde se
     pisan. Invertir un signo manda el barrido hacia afuera y el movimiento se
     lee al revés, como si la pantalla se escondiera en vez de asomarse. */
  .vt-zona .r-izq .ventana{
    -webkit-mask-image:linear-gradient(to right,#000 75%,transparent 83.333%);
    mask-image:linear-gradient(to right,#000 75%,transparent 83.333%);
    -webkit-mask-position:-100% 0;mask-position:-100% 0}
  .vt-zona .r-izq.activa .ventana{-webkit-mask-position:-150% 0;mask-position:-150% 0}
  .vt-zona .r-der .ventana{
    -webkit-mask-image:linear-gradient(to left,#000 75%,transparent 83.333%);
    mask-image:linear-gradient(to left,#000 75%,transparent 83.333%);
    -webkit-mask-position:0% 0;mask-position:0% 0}
  .vt-zona .r-der.activa .ventana{-webkit-mask-position:50% 0;mask-position:50% 0}

  /* Las dos pantallas entran completas, con su sidebar. La escala del lienzo
     la fija el guion de abajo contra el ancho real de la ventana, porque una
     escala escrita a mano solo cuadra al ancho para el que se calculó. */
  .vt-zona .lienzo{width:1440px;transform-origin:0 0;position:absolute;inset:0;
    transform:scale(var(--esc,.48))}

  @media (prefers-reduced-motion:reduce){
    .vt-zona .ventana{transition:none}
  }

  /* En móvil solo cabe una, y es la de la izquierda. Dos pantallas apiladas en
     390px quedan ilegibles las dos, y el relevo por cursor no existe en algo
     que se toca. */
  @media (max-width:760px){
    .vt-zona .vitrina{aspect-ratio:760/420}
    .vt-zona .r-der{display:none}
    .vt-zona .letreros{grid-template-columns:1fr}
    .vt-zona .letrero[data-panel="der"]{display:none}
    .vt-zona .r-izq{left:3%;width:94%}
    .vt-zona .r-izq .ventana{-webkit-mask-image:none;mask-image:none;
      transform:translateY(0)}
  }

  /* ── La app ────────────────────────────────────────────── */
  .vt-zona .app{display:flex;min-height:1100px;background:#F7F7FB;font-size:14px}
  .vt-zona .lado{width:240px;flex:none;background:#fff;border-right:1px solid rgba(0,0,0,.07);
    padding:0 12px;display:flex;flex-direction:column}
  .vt-zona .lado .cabeza{display:flex;align-items:center;gap:10px;height:58px;
    border-bottom:1px solid rgba(0,0,0,.06);margin:0 -12px 10px;padding:0 14px}
  .vt-zona .vc{width:30px;height:30px;border-radius:8px;flex:none;display:block;object-fit:contain}
  .vt-zona .yo-av{width:32px;height:32px;border-radius:99px;flex:none;display:flex;
    align-items:center;justify-content:center;background:rgba(56,29,160,.10);
    color:var(--morado);font-size:12px;font-weight:600}
  .vt-zona .lado a{display:flex;align-items:center;gap:12px;height:44px;padding:0 12px;
    border-radius:12px;color:#5B5470;font-size:14px;font-weight:500}
  .vt-zona .lado a.on{background:rgba(56,29,160,.07);color:var(--morado);font-weight:600}
  .vt-zona .lado .yo{margin-top:auto;display:flex;align-items:center;gap:10px;height:64px;
    border-top:1px solid rgba(0,0,0,.06);margin-left:-12px;margin-right:-12px;padding:0 14px}
  .vt-zona .lado .yo .quien{font-size:13px;font-weight:600;line-height:1.2}
  .vt-zona .lado .yo .quien span{display:block;font-size:11px;color:var(--ambar);font-weight:600}

  /* El selector de deporte. Va arriba de todo y separado de la navegación por
     una línea, porque no es una sección más: es el contexto en el que se ve
     todo lo demás. Cambiar de deporte no lleva a otra pantalla, cambia lo que
     muestran todas.

     El emblema es la inicial sobre un color y no un dibujo del deporte: no
     existe un ícono decente para cada disciplina, y una plataforma que dice
     servir para cualquier deporte no puede depender de tener el dibujo listo
     antes de aceptar uno nuevo. */
  .vt-zona .deporte{display:flex;align-items:center;gap:10px;height:44px;padding:0 10px;
    margin:2px 0 10px;border-radius:12px;border:1px solid var(--linea);
    background:#fff;font-size:14px;font-weight:600;letter-spacing:-.01em}
  .vt-zona .deporte .emblema{width:26px;height:26px;border-radius:8px;
    background:linear-gradient(135deg,#0042B3,#490080);
    color:#fff;display:flex;align-items:center;justify-content:center;
    font-size:12.5px;font-weight:700;flex:none}
  .vt-zona .deporte .emblema svg{width:17px;height:17px}
  .vt-zona .deporte .flechas{margin-left:auto;width:15px;height:15px;color:#8E87A8}
  .vt-zona .lado .navega{border-top:1px solid rgba(0,0,0,.06);margin:0 -12px;padding:10px 12px 0}

  .vt-zona .centro{flex:1;min-width:0;display:flex;flex-direction:column}
  /* La cabecera y el aire del cuerpo son los del panel: 58 de alto con el
     título en 22 y 16 de aire lateral. Las dos pantallas se ven una al lado
     de la otra, así que una cabecera más alta que la otra se nota de una. */
  .vt-zona .barra{height:58px;display:flex;align-items:center;padding:0 20px;
    font-size:22px;font-weight:600;letter-spacing:-.02em;
    border-bottom:1px solid rgba(0,0,0,.07)}
  .vt-zona .cuerpo{padding:24px 16px 0;display:flex;flex-direction:column;gap:16px}

  .vt-zona .cifras{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
  .vt-zona .cifra{background:#fff;border:1px solid var(--linea);border-radius:16px;
    padding:18px;text-align:center}
  .vt-zona .cifra.viva{background:rgba(56,29,160,.06);border-color:rgba(56,29,160,.18)}
  .vt-zona .cifra b{display:block;font-size:30px;font-weight:700;letter-spacing:-.03em;
    font-variant-numeric:tabular-nums;line-height:1.1}
  .vt-zona .cifra.viva b{color:var(--morado)}
  .vt-zona .cifra span{font-size:13px;color:var(--mudo)}
  .vt-zona .cifra.viva span{color:var(--morado);font-weight:600}

  .vt-zona .herramientas{display:flex;gap:12px;align-items:center}
  .vt-zona .buscador{flex:1;height:48px;background:#fff;border:1px solid var(--linea);
    border-radius:99px;display:flex;align-items:center;gap:10px;padding:0 18px;
    color:var(--mudo);font-size:14px}
  .vt-zona .chip{height:48px;padding:0 18px;border-radius:99px;background:#fff;
    border:1px solid var(--linea);display:flex;align-items:center;
    font-size:14px;font-weight:500;color:#5B5470}
  .vt-zona .chip.morado{background:var(--morado);color:#fff;border:0;font-weight:600}

  .vt-zona .fichas{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  .vt-zona .ficha{background:#fff;border:1px solid var(--linea);border-radius:16px;overflow:hidden}
  .vt-zona .cab{padding:20px;position:relative;overflow:hidden}
  .vt-zona .cab .halo{position:absolute;inset:0;opacity:.10;
    background-image:radial-gradient(circle at 80% 20%,rgba(255,255,255,.6) 0%,transparent 60%)}
  .vt-zona .cab.est{background:#381DA0}
  .vt-zona .cab.adm{background:linear-gradient(135deg,#FFB703,#FB8500)}
  .vt-zona .cab.ent{background:linear-gradient(135deg,#06D6A0,#0CB68D)}
  .vt-zona .cab .fila{position:relative;display:flex;align-items:center;gap:12px}
  .vt-zona .av{width:48px;height:48px;border-radius:99px;flex:none;display:flex;
    align-items:center;justify-content:center;font-size:16px;font-weight:600;
    background:rgba(255,255,255,.22);color:#fff}
  .vt-zona .cab .nombre{color:#fff;font-weight:600;font-size:15px;line-height:1.3}
  .vt-zona .pastillas{display:flex;gap:6px;margin-top:5px}
  .vt-zona .pastillas span{font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px;
    background:rgba(255,255,255,.22);color:#fff}
  .vt-zona .datos{padding:16px 20px;display:flex;flex-direction:column;gap:12px}
  .vt-zona .dato{display:flex;align-items:center;gap:12px;font-size:13.5px;color:#4A4060}
  .vt-zona .dato i{width:26px;height:26px;border-radius:8px;background:rgba(56,29,160,.07);flex:none}
  .vt-zona .dato i.verde{background:rgba(6,214,160,.12)}
  .vt-zona .sede{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;
    color:var(--morado);background:rgba(56,29,160,.07);border-radius:99px;
    padding:5px 10px;align-self:flex-start}
  .vt-zona .acciones{display:flex;gap:8px;padding:0 20px 20px}
  .vt-zona .acciones .editar{flex:1;height:44px;border-radius:99px;background:var(--morado);
    color:#fff;font-size:14px;font-weight:600;display:flex;align-items:center;
    justify-content:center}
  .vt-zona .acciones .redondo{width:44px;height:44px;border-radius:99px;
    background:rgba(56,29,160,.07);flex:none}
  .vt-zona .acciones .redondo.rojo{background:rgba(239,71,111,.10)}


  /* ── Finanzas, como está hoy en la plataforma ──────────── */
  /* Las medidas salen del componente: cabecera de 58 con el título en 22,
     cuerpo con 16 de aire lateral y 16 entre bloques, tarjeta de 384. */

  .vt-zona .fin-fila1{display:flex;align-items:center;gap:12px}
  .vt-zona .tabs{flex:1;display:flex;gap:4px;background:#F1EFF7;border-radius:12px;padding:4px}
  .vt-zona .tabs span{flex:1;text-align:center;padding:10px 0;border-radius:8px;
    font-size:13px;font-weight:600;color:#8E87A8}
  .vt-zona .tabs span.on{background:#fff;color:#1A1028;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .vt-zona .fin-fila1 .sep{width:1px;height:24px;background:var(--linea);flex:none}
  .vt-zona .fin-filtros{display:flex;gap:8px;align-items:center}
  .vt-zona .pil{height:36px;display:flex;align-items:center;gap:6px;padding:0 12px;
    border-radius:12px;background:#fff;font-size:12.5px;font-weight:600;flex:none}
  .vt-zona .pil svg{width:14px;height:14px;flex:none}
  .vt-zona .pil.sede{min-width:132px;justify-content:space-between;font-size:13px;
    border:1.5px solid var(--morado);color:var(--morado)}
  .vt-zona .pil.mes{border:1.5px solid rgba(56,29,160,.18);color:var(--morado)}
  .vt-zona .pil.mes .cal{width:16px;height:16px}
  .vt-zona .pil.tarifa{font-size:12px;background:rgba(6,214,160,.08);color:var(--menta);
    border:1.5px dashed rgba(6,214,160,.25)}
  .vt-zona .pil.cobros{font-size:12px;background:rgba(56,29,160,.08);color:var(--morado);
    border:1.5px dashed rgba(56,29,160,.25)}

  .vt-zona .fin-fila2{display:flex;gap:16px;align-items:stretch}

  /* La tarjeta del recaudo, con su degradado y sus tres discos. */
  .vt-zona .tarjeta{width:384px;flex:none;position:relative;overflow:hidden;color:#fff;
    aspect-ratio:1.586/1;border-radius:20px;
    background:linear-gradient(135deg,#2B2D8E 0%,#4361EE 45%,#7209B7 100%);
    box-shadow:0 8px 32px rgba(67,97,238,.35),0 2px 8px rgba(0,0,0,.18)}
  .vt-zona .tarjeta .disco{position:absolute;border-radius:50%}
  .vt-zona .tarjeta .d1{width:220px;height:220px;background:rgba(255,255,255,.06);top:-60px;right:-60px}
  .vt-zona .tarjeta .d2{width:160px;height:160px;background:rgba(255,255,255,.04);bottom:-50px;left:-40px}
  .vt-zona .tarjeta .d3{width:80px;height:80px;background:rgba(255,255,255,.07);top:30%;right:20%}
  .vt-zona .tarjeta .dentro{position:relative;height:100%;display:flex;flex-direction:column;
    justify-content:space-between;padding:20px}
  .vt-zona .tarjeta .arriba{display:flex;align-items:center;justify-content:space-between}
  .vt-zona .tarjeta .club{margin:0;font-size:11px;font-weight:600;letter-spacing:.15em;
    text-transform:uppercase;opacity:.9}
  .vt-zona .tarjeta .chip-emv{width:32px;height:24px;border-radius:4px;opacity:.8;
    background:linear-gradient(135deg,#FFD166,#F4A623);box-shadow:0 1px 3px rgba(0,0,0,.3)}
  .vt-zona .tarjeta .rot{display:flex;align-items:center;gap:8px;margin-bottom:4px}
  .vt-zona .tarjeta .rot p{margin:0;font-size:10px;font-weight:600;letter-spacing:.1em;
    text-transform:uppercase;opacity:.6}
  .vt-zona .tarjeta .ojo{width:24px;height:24px;border-radius:6px;display:flex;
    align-items:center;justify-content:center;opacity:.6}
  .vt-zona .tarjeta .ojo svg{width:14px;height:14px}
  .vt-zona .tarjeta .monto{margin:0;font-size:32px;font-weight:600;line-height:1;
    letter-spacing:-.02em;text-shadow:0 2px 8px rgba(0,0,0,.2);
    font-variant-numeric:tabular-nums}
  .vt-zona .tarjeta .falta{margin:4px 0 0;font-size:11px;opacity:.75}
  .vt-zona .tarjeta .falta b{color:#FFD166;font-weight:400}
  .vt-zona .tarjeta .abajo{display:flex;align-items:flex-end;justify-content:space-between}
  .vt-zona .tarjeta .plan{margin:0 0 2px;font-size:8px;opacity:.5;text-transform:uppercase;
    letter-spacing:.1em}
  .vt-zona .tarjeta .vence{margin:0;font-size:12px;font-weight:600;opacity:.9}
  .vt-zona .tarjeta .vc-logo{width:44px;height:44px;object-fit:contain;
    mix-blend-mode:multiply;opacity:.92}

  /* Los tres estados son filtros, no rótulos: el encendido se pinta con su
     color y los otros dos quedan en blanco. Acá va Pagados encendido. */
  .vt-zona .estados{flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  .vt-zona .estado{border-radius:16px;padding:10px 12px;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:4px;border:2px solid transparent;
    background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .vt-zona .estado.on{border-color:var(--menta);background:rgba(6,214,160,.10);
    box-shadow:0 0 0 1px rgba(6,214,160,.13)}
  .vt-zona .estado b{display:block;font-size:48px;font-weight:600;line-height:1;
    font-variant-numeric:tabular-nums}
  .vt-zona .estado .cual{font-size:13px;font-weight:600;color:#8E87A8;margin-top:2px}
  .vt-zona .estado .vs{display:inline-flex;align-items:center;gap:4px;margin-top:4px}
  .vt-zona .estado .vs .pct{display:inline-flex;align-items:center;gap:2px;border-radius:99px;
    padding:2px 6px;font-size:10.5px;font-weight:600;line-height:1;
    font-variant-numeric:tabular-nums}
  .vt-zona .estado .vs .pct svg{width:10px;height:10px}
  .vt-zona .estado .vs .contra{font-size:10.5px;font-weight:500;color:#8E87A8;line-height:1}

  .vt-zona .fin-buscar{height:40px;border-radius:12px;background:#fff;
    border:1px solid var(--linea);display:flex;align-items:center;gap:10px;
    padding:0 12px;font-size:13px;color:var(--mudo)}
  .vt-zona .fin-buscar svg{width:16px;height:16px;color:#8E87A8}

  .vt-zona .fin-fichas{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  .vt-zona .fic{background:#fff;border-radius:16px;overflow:hidden;
    border:1px solid rgba(120,80,200,.09);box-shadow:0 2px 12px rgba(56,29,160,.05)}
  .vt-zona .fic .cabe{padding:16px 16px 12px;display:flex;align-items:center;gap:12px;
    position:relative;border-bottom:1px solid rgba(120,80,200,.07)}
  .vt-zona .fic .ini{width:48px;height:48px;border-radius:50%;flex:none;display:flex;
    align-items:center;justify-content:center;color:#fff;font-size:15px;font-weight:600}
  .vt-zona .fic .quien{flex:1;min-width:0}
  .vt-zona .fic .quien p{margin:0;font-size:13px;font-weight:600;color:#1A1028;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .vt-zona .fic .quien span{font-size:10px;font-weight:500;color:#8E87A8}
  .vt-zona .fic .tuerca{position:absolute;top:12px;right:12px;width:28px;height:28px;
    border-radius:8px;background:rgba(142,135,168,.08);display:flex;
    align-items:center;justify-content:center;color:#8E87A8}
  .vt-zona .fic .tuerca svg{width:14px;height:14px}
  .vt-zona .fic .linea{padding:10px 16px;display:flex;align-items:center;
    justify-content:space-between;gap:8px;border-bottom:1px solid rgba(120,80,200,.06)}
  .vt-zona .chip-est{display:inline-flex;align-items:center;gap:4px;font-size:10px;
    font-weight:600;padding:4px 8px;border-radius:99px;white-space:nowrap}
  .vt-zona .chip-est svg{width:10px;height:10px}
  .vt-zona .accion{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;
    border-radius:8px;font-size:10px;font-weight:600;flex:none}
  .vt-zona .accion .aro{width:12px;height:12px;border-radius:99px;flex:none}
  .vt-zona .accion svg{width:12px;height:12px}
  .vt-zona .fic .iconos{padding:10px 12px;display:flex;align-items:center;gap:4px}
  .vt-zona .fic .iconos div{width:28px;height:28px;border-radius:8px;display:flex;
    align-items:center;justify-content:center}
  .vt-zona .fic .iconos div svg{width:14px;height:14px}

  /* Los íconos son los de Lucide, los mismos de la app. El tamaño lo pone cada
     contexto; el color lo heredan de su texto con currentColor, así no hay que
     repetirlo en ninguna parte. */
  .vt-zona svg{display:block;flex:none}
  .vt-zona .lado a svg{width:18px;height:18px;color:#8E87A8}
  .vt-zona .lado a.on svg{color:var(--morado)}
  .vt-zona .lado .cabeza .acc{width:20px;height:20px;color:#8E87A8;margin-left:auto}
  .vt-zona .lado .cabeza .acc + .acc{margin-left:6px}
  .vt-zona .lado .cabeza .acc svg{width:20px;height:20px}
  .vt-zona .buscador svg{width:18px;height:18px;color:#8E87A8}
  .vt-zona .chip{gap:8px}
  .vt-zona .chip svg{width:17px;height:17px;color:#8E87A8}
  .vt-zona .chip.morado svg{color:#fff}
  .vt-zona .dato i{display:flex;align-items:center;justify-content:center;color:var(--morado)}
  .vt-zona .dato i.verde{color:var(--menta)}
  .vt-zona .dato i svg{width:14px;height:14px}
  .vt-zona .sede svg{width:12px;height:12px}
  .vt-zona .acciones .editar svg{width:16px;height:16px}
  .vt-zona .acciones .editar{gap:8px}
  .vt-zona .acciones .redondo{display:flex;align-items:center;justify-content:center;color:var(--morado)}
  .vt-zona .acciones .redondo svg{width:17px;height:17px}
  .vt-zona .acciones .redondo.rojo{color:#EF476F}

  /* ── Las notas de abajo ────────────────────────────────── */
  .vt-zona .notas{padding:8px 0 70px}
  .vt-zona .notas h3{font-size:13px;font-weight:600;color:var(--mudo);margin:0 0 14px}
  .vt-zona .notas ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px}
  .vt-zona .notas li{font-size:13.5px;color:var(--mudo);line-height:1.75;padding-left:17px;
    position:relative;max-width:78ch}
  .vt-zona .notas li::before{content:'';position:absolute;left:0;top:11px;width:5px;height:5px;
    border-radius:99px;background:var(--morado)}
  .vt-zona .notas b{color:var(--tinta);font-weight:600}
      `}</style>

      <section className="bloque">
        <div className="presenta">
          <p className="rotulo">Así se ve por dentro</p>
          <h2>Quién está y quién debe, sin abrir un cuaderno</h2>

          <div className="letreros">
            <div
              className={`letrero${activa === 'izq' ? '' : ' apagado'}`}
              onMouseEnter={() => setActiva('izq')}
            >
              <h3>Miembros</h3>
              <p>Cada deportista con su ficha completa, su sede y su acudiente. Se
                 busca por el nombre y sale todo.</p>
            </div>
            <div
              className={`letrero${activa === 'der' ? '' : ' apagado'}`}
              onMouseEnter={() => setActiva('der')}
            >
              <h3>Finanzas</h3>
              <p>Quién pagó y quién no, mes a mes. El recordatorio sale por WhatsApp
                 sin que nadie lo escriba.</p>
            </div>
          </div>
        </div>

        <div className="vitrina" ref={caja}>
          <div
            className={`ranura r-izq${activa === 'izq' ? ' activa' : ''}`}
            onMouseEnter={() => setActiva('izq')}
          ><div className="ventana">
            <div className="lienzo">
              <div className="app">
                <aside className="lado">
                  <div className="cabeza">
                    <img className="vc" src="/logo-vc.png" alt="" />
                    <span className="acc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span><span className="acc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg></span>
                  </div>
                  <div className="deporte">
                    <span className="emblema"><svg viewBox="0 0 24 25" fill="none" aria-hidden="true"><g clipRule="evenodd" fill="currentColor" fillRule="evenodd"><path d="m7.06464 3.12143c1.53317-.49995 3.07266-.69769 3.99046-.54219.3301.05594.5831.3239.6201.65667.0755.67959.3259 1.92836.7917 3.19501.4726 1.28511 1.1259 2.4743 1.9451 3.15119.3702.30585.9727.57339 1.7704.82939.5413.1738 1.1138.3254 1.7055.4821.2752.0729.5546.1469.8369.2247.8563.236 1.7359.5069 2.4352.8778.6858.3638 1.3711.9158 1.5364 1.7941.1604.8522-.0409 1.6825-.5932 2.2996-.5488.6131-1.3723.9373-2.3144.9373h-14.84343c-.04268 0-.08508.0001-.1272.0001-1.02676.0013-1.88566.0023-2.68098-.7466-.34825-.3279-.58313-.6513-.71668-1.0449-.11577-.3411-.13756-.6964-.15688-1.0113-.00096-.0156-.00191-.0311-.00286-.0464-.09865-1.5889.50207-2.9427.91384-3.675.59648-1.0608.57774-2.6236.28554-4.05186-.04773-.23334.0182-.47549.17765-.65242 1.17854-1.3077 2.87523-2.17133 4.42684-2.67729zm-3.06147 3.42071c.24996 1.46631.27589 3.2787-.52108 4.69606-.34677.6166-.79722 1.6707-.7242 2.8468.02364.3808.03857.5376.08307.6687.03244.0956.09662.2203.32454.4349.32439.3054.57279.3385 1.77987.3385h14.84343c.601 0 .9849-.2011 1.1967-.4377.2081-.2325.3206-.5764.2368-1.0218-.0372-.1977-.2127-.4534-.7652-.7464-.539-.2859-1.275-.5209-2.1309-.7568-.2494-.0688-.5104-.138-.7762-.2084-.6109-.1618-1.2471-.3304-1.8261-.5163-.8264-.2652-1.6634-.6022-2.2673-1.1012-1.129-.93284-1.8959-2.42588-2.3975-3.78986-.3928-1.06799-.6479-2.12688-.7844-2.92106-.66606.01154-1.65872.1657-2.74503.51994-1.29319.4217-2.59595 1.08801-3.5265 1.99462z"/><path d="m13.1708 8.44174c.1853.37048.0351.82098-.3354 1.00623l-1 .5c-.3705.18523-.821.03507-1.0062-.33541-.1853-.37049-.0351-.82099.3354-1.00623l1-.5c.3705-.18525.821-.03508 1.0062.33541z"/><path d="m12.2115 6.03997c.131.39296-.0814.8177-.4743.94869l-1.5.5c-.39298.13098-.81772-.08139-.9487-.47434-.13099-.39296.08138-.8177.47434-.94869l1.49996-.5c.393-.13098.8177.08139.9487.47434z"/><path d="m4.00001 18.0271c-.69036 0-1.25.5597-1.25 1.25 0 .6904.55964 1.25 1.25 1.25s1.25-.5596 1.25-1.25c0-.6903-.55964-1.25-1.25-1.25zm-2.75 1.25c0-1.5187 1.23122-2.75 2.75-2.75s2.75 1.2313 2.75 2.75c0 1.5188-1.23122 2.75-2.75 2.75s-2.75-1.2312-2.75-2.75z"/><path d="m12 18.0271c-.6903 0-1.25.5597-1.25 1.25 0 .6904.5597 1.25 1.25 1.25.6904 0 1.25-.5596 1.25-1.25 0-.6903-.5596-1.25-1.25-1.25zm-2.74999 1.25c0-1.5187 1.23119-2.75 2.74999-2.75s2.75 1.2313 2.75 2.75c0 1.5188-1.2312 2.75-2.75 2.75s-2.74999-1.2312-2.74999-2.75z"/><path d="m20 18.0271c-.6903 0-1.25.5597-1.25 1.25 0 .6904.5597 1.25 1.25 1.25.6904 0 1.25-.5596 1.25-1.25 0-.6903-.5596-1.25-1.25-1.25zm-2.75 1.25c0-1.5187 1.2312-2.75 2.75-2.75s2.75 1.2313 2.75 2.75c0 1.5188-1.2312 2.75-2.75 2.75s-2.75-1.2312-2.75-2.75z"/><path d="m5.25001 16.2771c0-2.3351-1.09899-4.3294-2.66652-5.3762l.83304-1.24746c2.01928 1.34846 3.33348 3.83116 3.33348 6.62366z"/><path d="m5.25001 19.2771c0-.4142.33579-.75.75-.75h3.99999c.4142 0 .75.3358.75.75 0 .4143-.3358.75-.75.75h-3.99999c-.41421 0-.75-.3357-.75-.75zm7.99999 0c0-.4142.3358-.75.75-.75h4c.4142 0 .75.3358.75.75 0 .4143-.3358.75-.75.75h-4c-.4142 0-.75-.3357-.75-.75z"/></g></svg></span>
                    <span className="cual">Patinaje</span>
                    <svg className="flechas" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                  </div>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21.797,5.579L14.797,.855c-1.699-1.146-3.895-1.146-5.594,0L2.204,5.579c-1.38,.93-2.204,2.479-2.204,4.145v9.276c0,2.757,2.243,5,5,5h14c2.757,0,5-2.243,5-5V9.724c0-1.665-.824-3.215-2.203-4.145Zm-5.797,10.421c0,1.103-.897,2-2,2h-4c-1.103,0-2-.897-2-2v-4c0-1.103,.897-2,2-2h4c1.103,0,2,.897,2,2v4Zm-2-4l.002,4h-4.002v-4h4Z"/></svg>Inicio</a>
                  <a className="on"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m7.5 13a4.5 4.5 0 1 1 4.5-4.5 4.505 4.505 0 0 1 -4.5 4.5zm7.5 7a5.006 5.006 0 0 0 -5-5h-5a5.006 5.006 0 0 0 -5 5v4h15zm2.5-11a4.5 4.5 0 1 1 4.5-4.5 4.505 4.505 0 0 1 -4.5 4.5zm1.5 2h-5a4.793 4.793 0 0 0 -.524.053 6.514 6.514 0 0 1 -1.576 2.216 7.008 7.008 0 0 1 5.1 6.731h7v-4a5.006 5.006 0 0 0 -5-5z"/></svg>Miembros</a>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12,.042a9.992,9.992,0,0,0-9.981,9.98c0,2.57,1.99,6.592,5.915,11.954a5.034,5.034,0,0,0,8.132,0c3.925-5.362,5.915-9.384,5.915-11.954A9.992,9.992,0,0,0,12,.042ZM12,14a4,4,0,1,1,4-4A4,4,0,0,1,12,14Z"/></svg>Sedes</a>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m18 12c-3.314 0-6 2.686-6 6s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6zm3.683 5.712-2.703 2.614c-.452.446-1.052.671-1.653.671s-1.203-.225-1.663-.674l-1.354-1.332c-.395-.387-.4-1.02-.014-1.414.386-.395 1.019-.401 1.414-.014l1.354 1.331c.144.142.38.139.522-.002l2.713-2.624c.397-.381 1.031-.37 1.414.029.382.398.369 1.031-.029 1.414zm-12.683-9.712c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5zm1.5 1c.433 0 .82.186 1.094.479-.518.903-1.48 1.521-2.594 1.521s-2.076-.617-2.594-1.52c.274-.293.661-.48 1.094-.48zm2.5-9h-8c-2.757 0-5 2.243-5 5v14c0 2.757 2.243 5 5 5h7.721c-1.665-1.466-2.721-3.607-2.721-6h-5c-.552 0-1-.447-1-1s.448-1 1-1h5.262c.889-3.449 4.011-6 7.738-6v-5c0-2.757-2.243-5-5-5zm-4 13c-2.761 0-5-2.239-5-5s2.239-5 5-5 5 2.239 5 5-2.239 5-5 5z"/></svg>Asistencia</a>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13.053,5.079c.971-.909,2.344-2.36,2.894-3.744,.255-.641-.257-1.335-.947-1.335h-6c-.69,0-1.202,.693-.947,1.335,.55,1.384,1.923,2.835,2.894,3.744C5.569,5.878,1,12.618,1,18c0,3.309,2.691,6,6,6h10c3.309,0,6-2.691,6-6,0-5.382-4.569-12.122-9.947-12.921Zm-2.409,8.682l3.042,.507c1.341,.223,2.315,1.373,2.315,2.733,0,1.654-1.346,3-3,3v1c0,.552-.448,1-1,1s-1-.448-1-1v-1h-.268c-1.068,0-2.063-.574-2.598-1.499-.276-.478-.113-1.089,.365-1.366,.476-.277,1.089-.114,1.366,.365,.178,.308,.511,.5,.867,.5h2.268c.551,0,1-.449,1-1,0-.378-.271-.698-.644-.76l-3.042-.507c-1.341-.223-2.315-1.373-2.315-2.733,0-1.654,1.346-3,3-3v-1c0-.552,.448-1,1-1s1,.448,1,1v1h.268c1.067,0,2.063,.575,2.598,1.5,.276,.478,.113,1.089-.365,1.366-.477,.277-1.089,.114-1.366-.365-.179-.309-.511-.5-.867-.5h-2.268c-.551,0-1,.449-1,1,0,.378,.271,.698,.644,.76Z"/></svg>Finanzas</a>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M15.091,15.997c6.571-.033,8.909-3.513,8.909-6.497,0-1.677-1.188-3.08-2.765-3.419,.136-.386,.254-.741,.333-1.01,.353-1.193,.125-2.453-.626-3.458-.766-1.024-1.937-1.612-3.214-1.612H6.271c-1.277,0-2.449,.588-3.215,1.612-.751,1.005-.979,2.266-.626,3.458,.08,.269,.197,.624,.334,1.011-1.577,.339-2.764,1.742-2.764,3.419,0,2.984,2.339,6.464,8.909,6.497,.056,.302,.091,.61,.091,.924v3.079c0,1.826-1.536,1.992-2,2h-1c-.553,0-1,.447-1,1s.447,1,1,1h12c.553,0,1-.447,1-1s-.447-1-1-1h-.992c-.472-.008-2.008-.174-2.008-2v-3.08c0-.313,.035-.621,.091-.923Zm5.361-8.007c.017,0,.031,.01,.048,.01,.827,0,1.5,.673,1.5,1.5,0,2.034-1.609,4.197-6.036,4.47,.221-.299,.474-.576,.762-.821,1.739-1.478,2.933-3.453,3.726-5.159ZM2,9.5c0-.827,.673-1.5,1.5-1.5,.017,0,.031-.009,.047-.01,.794,1.706,1.988,3.681,3.727,5.159,.288,.245,.541,.521,.762,.821-4.427-.273-6.036-2.436-6.036-4.47Zm7.792,.263c-.264-.182-.375-.518-.27-.822l.519-1.606-1.366-1c-.327-.24-.398-.699-.158-1.026,.138-.188,.358-.3,.591-.3h1.681l.511-1.593c.129-.387,.547-.595,.934-.466,.22,.073,.393,.246,.466,.466l.51,1.593h1.681c.405,0,.734,.328,.734,.734,0,.235-.112,.455-.301,.593l-1.366,1,.519,1.606c.124,.386-.088,.8-.475,.925-.224,.072-.469,.032-.659-.107l-1.343-.988-1.344,.987c-.256,.191-.606,.192-.864,.004Z"/></svg>Rendimiento</a>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m0,19c0,2.757,2.243,5,5,5h14c2.757,0,5-2.243,5-5v-9H0v9Zm3-4c0-1.103.897-2,2-2h2c1.103,0,2,.897,2,2v2c0,1.103-.897,2-2,2h-2c-1.103,0-2-.897-2-2v-2Zm4.001,2h-2.001v-2h2v2ZM24,7v1H0v-1C0,4.243,2.243,2,5,2h1v-1c0-.552.448-1,1-1s1,.448,1,1v1h8v-1c0-.552.448-1,1-1s1,.448,1,1v1h1c2.757,0,5,2.243,5,5Z"/></svg>Calendario</a>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19,0H5C2.24,0,0,2.24,0,5v14c0,2.76,2.24,5,5,5h14c2.76,0,5-2.24,5-5V5c0-2.76-2.24-5-5-5ZM7,18c0,.55-.45,1-1,1s-1-.45-1-1v-6c0-.55,.45-1,1-1s1,.45,1,1v6Zm4,0c0,.55-.45,1-1,1s-1-.45-1-1V9c0-.55,.45-1,1-1s1,.45,1,1v9Zm4,0c0,.55-.45,1-1,1s-1-.45-1-1V6c0-.55,.45-1,1-1s1,.45,1,1v12Zm4,0c0,.55-.45,1-1,1s-1-.45-1-1v-3c0-.55,.45-1,1-1s1,.45,1,1v3Z"/></svg>Analíticas</a>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m15.462,12.398c0,1.054-1.313,2.764-3.428,4.461-.041.033-.103.032-.144,0-2.115-1.698-3.428-3.408-3.428-4.462,0-.813.561-1.476,1.25-1.476.57,0,1.25.187,1.25,1.077,0,.553.448,1,1,1s1-.447,1-1c0-.891.68-1.077,1.25-1.077.689,0,1.25.662,1.25,1.476Zm8.538-2.675v9.276c0,2.757-2.243,5-5,5H5c-2.757,0-5-2.243-5-5v-9.276c0-1.665.824-3.214,2.204-4.145L9.203.855c1.699-1.146,3.895-1.146,5.594,0l5.203,3.511v-2.367c0-.553.447-1,1-1s1,.447,1,1v3.735c1.252.941,2,2.41,2,3.989Zm-6.538,2.675c0-1.916-1.458-3.476-3.25-3.476-.906,0-1.684.284-2.25.775-.567-.491-1.344-.775-2.25-.775-1.792,0-3.25,1.56-3.25,3.476,0,2.205,2.271,4.491,4.177,6.021.383.308.853.461,1.323.461s.94-.153,1.324-.462c1.905-1.529,4.177-3.815,4.177-6.021Z"/></svg>Club</a>
                  <div className="yo">
                    <div className="yo-av">LG</div>
                    <div className="quien">Laura Gómez<span>Admin</span></div>
                  </div>
                </aside>
                <div className="centro">
                  <div className="barra">Miembros</div>
                  <div className="cuerpo">
                    <div className="cifras">
                      <div className="cifra viva"><b>42</b><span>Total</span></div>
                      <div className="cifra"><b>39</b><span>Deportistas</span></div>
                      <div className="cifra"><b>1</b><span>Entrenadores</span></div>
                      <div className="cifra"><b>2</b><span>Admins</span></div>
                    </div>
                    <div className="herramientas">
                      <div className="buscador"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>Buscar por nombre o email…</div>
                      <div className="chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>Filtros</div>
                      <div className="chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>Importar</div>
                      <div className="chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>PDF</div>
                      <div className="chip morado"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5v14"/></svg>Nuevo miembro</div>
                    </div>
                    <div className="fichas">
                      <article className="ficha">
                        <div className="cab est"><div className="halo"></div>
                          <div className="fila"><div className="av">AP</div>
                            <div><div className="nombre">Andrés Pineda</div>
                              <div className="pastillas"><span>Deportista</span><span>CLUB</span></div></div></div>
                        </div>
                        <div className="datos">
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></i>TI · 106 977 136</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92"/></svg></i>+57 (312) 884-0117</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></i>andres@correo.com</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></i>14 de mar de 2011</div>
                          <div className="dato"><i className="verde"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></i>Salud Total</div>
                          <span className="sede"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>Coliseo del Norte</span>
                        </div>
                        <div className="acciones"><div className="editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>Editar</div>
                          <div className="redondo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/></svg></div><div className="redondo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" x2="10" y1="15" y2="9"/><line x1="14" x2="14" y1="15" y2="9"/></svg></div>
                          <div className="redondo rojo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></div></div>
                      </article>
                      <article className="ficha">
                        <div className="cab est"><div className="halo"></div>
                          <div className="fila"><div className="av">VS</div>
                            <div><div className="nombre">Valentina Soto</div>
                              <div className="pastillas"><span>Deportista</span><span>CLUB</span></div></div></div>
                        </div>
                        <div className="datos">
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></i>TI · 104 552 908</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92"/></svg></i>+57 (300) 771-9043</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></i>valentina@correo.com</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></i>2 de feb de 2010</div>
                          <div className="dato"><i className="verde"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></i>SaludMía</div>
                          <span className="sede"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>Sede Sur</span>
                        </div>
                        <div className="acciones"><div className="editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>Editar</div>
                          <div className="redondo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/></svg></div><div className="redondo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" x2="10" y1="15" y2="9"/><line x1="14" x2="14" y1="15" y2="9"/></svg></div>
                          <div className="redondo rojo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></div></div>
                      </article>
                      <article className="ficha">
                        <div className="cab ent"><div className="halo"></div>
                          <div className="fila"><div className="av">DM</div>
                            <div><div className="nombre">Daniel Mejía</div>
                              <div className="pastillas"><span>Entrenador</span></div></div></div>
                        </div>
                        <div className="datos">
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></i>CC · 100 238 323</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92"/></svg></i>+57 (316) 403-4292</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></i>daniel@correo.com</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></i>19 de may de 1995</div>
                          <div className="dato"><i className="verde"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></i>SaludMía</div>
                          <span className="sede"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>Coliseo del Norte</span>
                        </div>
                        <div className="acciones"><div className="editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>Editar</div>
                          <div className="redondo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/></svg></div><div className="redondo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" x2="10" y1="15" y2="9"/><line x1="14" x2="14" y1="15" y2="9"/></svg></div>
                          <div className="redondo rojo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></div></div>
                      </article>
      <article className="ficha">
                        <div className="cab est"><div className="halo"></div>
                          <div className="fila"><div className="av">MC</div>
                            <div><div className="nombre">Mariana Cortés</div>
                              <div className="pastillas"><span>Deportista</span><span>CLUB</span></div></div></div>
                        </div>
                        <div className="datos">
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></i>TI · 109 443 201</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92"/></svg></i>+57 (318) 552-7710</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></i>mariana@correo.com</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></i>8 de jul de 2012</div>
                          <div className="dato"><i className="verde"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></i>Nueva EPS</div>
                          <span className="sede"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>Sede Sur</span>
                        </div>
                        <div className="acciones"><div className="editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>Editar</div>
                          <div className="redondo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/></svg></div><div className="redondo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" x2="10" y1="15" y2="9"/><line x1="14" x2="14" y1="15" y2="9"/></svg></div>
                          <div className="redondo rojo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></div></div>
                      </article>
      <article className="ficha">
                        <div className="cab est"><div className="halo"></div>
                          <div className="fila"><div className="av">TR</div>
                            <div><div className="nombre">Tomás Rivera</div>
                              <div className="pastillas"><span>Deportista</span><span>CLUB</span></div></div></div>
                        </div>
                        <div className="datos">
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></i>TI · 107 812 455</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92"/></svg></i>+57 (301) 236-8894</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></i>tomas@correo.com</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></i>23 de oct de 2011</div>
                          <div className="dato"><i className="verde"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></i>Salud Total</div>
                          <span className="sede"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>Coliseo del Norte</span>
                        </div>
                        <div className="acciones"><div className="editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>Editar</div>
                          <div className="redondo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/></svg></div><div className="redondo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" x2="10" y1="15" y2="9"/><line x1="14" x2="14" y1="15" y2="9"/></svg></div>
                          <div className="redondo rojo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></div></div>
                      </article>
      <article className="ficha">
                        <div className="cab adm"><div className="halo"></div>
                          <div className="fila"><div className="av">CO</div>
                            <div><div className="nombre">Camila Ordóñez</div>
                              <div className="pastillas"><span>Admin</span><span>CLUB</span></div></div></div>
                        </div>
                        <div className="datos">
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></i>CC · 100 914 776</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92"/></svg></i>+57 (320) 447-1029</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></i>camila@correo.com</div>
                          <div className="dato"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></i>4 de abr de 1990</div>
                          <div className="dato"><i className="verde"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></i>SaludMía</div>
                          <span className="sede"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>Sede Sur</span>
                        </div>
                        <div className="acciones"><div className="editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>Editar</div>
                          <div className="redondo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/></svg></div><div className="redondo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" x2="10" y1="15" y2="9"/><line x1="14" x2="14" y1="15" y2="9"/></svg></div>
                          <div className="redondo rojo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></div></div>
                      </article>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div></div>

          {/* La de la derecha: Finanzas. Se sale por el borde de la vitrina. */}
          <div
            className={`ranura r-der${activa === 'der' ? ' activa' : ''}`}
            onMouseEnter={() => setActiva('der')}
          ><div className="ventana">
            <div className="lienzo">
              <div className="app">
                <aside className="lado">
                  <div className="cabeza">
                    <img className="vc" src="/logo-vc.png" alt="" />
                    <span className="acc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span><span className="acc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg></span>
                  </div>
                  <div className="deporte">
                    <span className="emblema"><svg viewBox="0 0 24 25" fill="none" aria-hidden="true"><g clipRule="evenodd" fill="currentColor" fillRule="evenodd"><path d="m7.06464 3.12143c1.53317-.49995 3.07266-.69769 3.99046-.54219.3301.05594.5831.3239.6201.65667.0755.67959.3259 1.92836.7917 3.19501.4726 1.28511 1.1259 2.4743 1.9451 3.15119.3702.30585.9727.57339 1.7704.82939.5413.1738 1.1138.3254 1.7055.4821.2752.0729.5546.1469.8369.2247.8563.236 1.7359.5069 2.4352.8778.6858.3638 1.3711.9158 1.5364 1.7941.1604.8522-.0409 1.6825-.5932 2.2996-.5488.6131-1.3723.9373-2.3144.9373h-14.84343c-.04268 0-.08508.0001-.1272.0001-1.02676.0013-1.88566.0023-2.68098-.7466-.34825-.3279-.58313-.6513-.71668-1.0449-.11577-.3411-.13756-.6964-.15688-1.0113-.00096-.0156-.00191-.0311-.00286-.0464-.09865-1.5889.50207-2.9427.91384-3.675.59648-1.0608.57774-2.6236.28554-4.05186-.04773-.23334.0182-.47549.17765-.65242 1.17854-1.3077 2.87523-2.17133 4.42684-2.67729zm-3.06147 3.42071c.24996 1.46631.27589 3.2787-.52108 4.69606-.34677.6166-.79722 1.6707-.7242 2.8468.02364.3808.03857.5376.08307.6687.03244.0956.09662.2203.32454.4349.32439.3054.57279.3385 1.77987.3385h14.84343c.601 0 .9849-.2011 1.1967-.4377.2081-.2325.3206-.5764.2368-1.0218-.0372-.1977-.2127-.4534-.7652-.7464-.539-.2859-1.275-.5209-2.1309-.7568-.2494-.0688-.5104-.138-.7762-.2084-.6109-.1618-1.2471-.3304-1.8261-.5163-.8264-.2652-1.6634-.6022-2.2673-1.1012-1.129-.93284-1.8959-2.42588-2.3975-3.78986-.3928-1.06799-.6479-2.12688-.7844-2.92106-.66606.01154-1.65872.1657-2.74503.51994-1.29319.4217-2.59595 1.08801-3.5265 1.99462z"/><path d="m13.1708 8.44174c.1853.37048.0351.82098-.3354 1.00623l-1 .5c-.3705.18523-.821.03507-1.0062-.33541-.1853-.37049-.0351-.82099.3354-1.00623l1-.5c.3705-.18525.821-.03508 1.0062.33541z"/><path d="m12.2115 6.03997c.131.39296-.0814.8177-.4743.94869l-1.5.5c-.39298.13098-.81772-.08139-.9487-.47434-.13099-.39296.08138-.8177.47434-.94869l1.49996-.5c.393-.13098.8177.08139.9487.47434z"/><path d="m4.00001 18.0271c-.69036 0-1.25.5597-1.25 1.25 0 .6904.55964 1.25 1.25 1.25s1.25-.5596 1.25-1.25c0-.6903-.55964-1.25-1.25-1.25zm-2.75 1.25c0-1.5187 1.23122-2.75 2.75-2.75s2.75 1.2313 2.75 2.75c0 1.5188-1.23122 2.75-2.75 2.75s-2.75-1.2312-2.75-2.75z"/><path d="m12 18.0271c-.6903 0-1.25.5597-1.25 1.25 0 .6904.5597 1.25 1.25 1.25.6904 0 1.25-.5596 1.25-1.25 0-.6903-.5596-1.25-1.25-1.25zm-2.74999 1.25c0-1.5187 1.23119-2.75 2.74999-2.75s2.75 1.2313 2.75 2.75c0 1.5188-1.2312 2.75-2.75 2.75s-2.74999-1.2312-2.74999-2.75z"/><path d="m20 18.0271c-.6903 0-1.25.5597-1.25 1.25 0 .6904.5597 1.25 1.25 1.25.6904 0 1.25-.5596 1.25-1.25 0-.6903-.5596-1.25-1.25-1.25zm-2.75 1.25c0-1.5187 1.2312-2.75 2.75-2.75s2.75 1.2313 2.75 2.75c0 1.5188-1.2312 2.75-2.75 2.75s-2.75-1.2312-2.75-2.75z"/><path d="m5.25001 16.2771c0-2.3351-1.09899-4.3294-2.66652-5.3762l.83304-1.24746c2.01928 1.34846 3.33348 3.83116 3.33348 6.62366z"/><path d="m5.25001 19.2771c0-.4142.33579-.75.75-.75h3.99999c.4142 0 .75.3358.75.75 0 .4143-.3358.75-.75.75h-3.99999c-.41421 0-.75-.3357-.75-.75zm7.99999 0c0-.4142.3358-.75.75-.75h4c.4142 0 .75.3358.75.75 0 .4143-.3358.75-.75.75h-4c-.4142 0-.75-.3357-.75-.75z"/></g></svg></span>
                    <span className="cual">Patinaje</span>
                    <svg className="flechas" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                  </div>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21.797,5.579L14.797,.855c-1.699-1.146-3.895-1.146-5.594,0L2.204,5.579c-1.38,.93-2.204,2.479-2.204,4.145v9.276c0,2.757,2.243,5,5,5h14c2.757,0,5-2.243,5-5V9.724c0-1.665-.824-3.215-2.203-4.145Zm-5.797,10.421c0,1.103-.897,2-2,2h-4c-1.103,0-2-.897-2-2v-4c0-1.103,.897-2,2-2h4c1.103,0,2,.897,2,2v4Zm-2-4l.002,4h-4.002v-4h4Z"/></svg>Inicio</a>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m7.5 13a4.5 4.5 0 1 1 4.5-4.5 4.505 4.505 0 0 1 -4.5 4.5zm7.5 7a5.006 5.006 0 0 0 -5-5h-5a5.006 5.006 0 0 0 -5 5v4h15zm2.5-11a4.5 4.5 0 1 1 4.5-4.5 4.505 4.505 0 0 1 -4.5 4.5zm1.5 2h-5a4.793 4.793 0 0 0 -.524.053 6.514 6.514 0 0 1 -1.576 2.216 7.008 7.008 0 0 1 5.1 6.731h7v-4a5.006 5.006 0 0 0 -5-5z"/></svg>Miembros</a>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12,.042a9.992,9.992,0,0,0-9.981,9.98c0,2.57,1.99,6.592,5.915,11.954a5.034,5.034,0,0,0,8.132,0c3.925-5.362,5.915-9.384,5.915-11.954A9.992,9.992,0,0,0,12,.042ZM12,14a4,4,0,1,1,4-4A4,4,0,0,1,12,14Z"/></svg>Sedes</a>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m18 12c-3.314 0-6 2.686-6 6s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6zm3.683 5.712-2.703 2.614c-.452.446-1.052.671-1.653.671s-1.203-.225-1.663-.674l-1.354-1.332c-.395-.387-.4-1.02-.014-1.414.386-.395 1.019-.401 1.414-.014l1.354 1.331c.144.142.38.139.522-.002l2.713-2.624c.397-.381 1.031-.37 1.414.029.382.398.369 1.031-.029 1.414zm-12.683-9.712c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5zm1.5 1c.433 0 .82.186 1.094.479-.518.903-1.48 1.521-2.594 1.521s-2.076-.617-2.594-1.52c.274-.293.661-.48 1.094-.48zm2.5-9h-8c-2.757 0-5 2.243-5 5v14c0 2.757 2.243 5 5 5h7.721c-1.665-1.466-2.721-3.607-2.721-6h-5c-.552 0-1-.447-1-1s.448-1 1-1h5.262c.889-3.449 4.011-6 7.738-6v-5c0-2.757-2.243-5-5-5zm-4 13c-2.761 0-5-2.239-5-5s2.239-5 5-5 5 2.239 5 5-2.239 5-5 5z"/></svg>Asistencia</a>
                  <a className="on"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13.053,5.079c.971-.909,2.344-2.36,2.894-3.744,.255-.641-.257-1.335-.947-1.335h-6c-.69,0-1.202,.693-.947,1.335,.55,1.384,1.923,2.835,2.894,3.744C5.569,5.878,1,12.618,1,18c0,3.309,2.691,6,6,6h10c3.309,0,6-2.691,6-6,0-5.382-4.569-12.122-9.947-12.921Zm-2.409,8.682l3.042,.507c1.341,.223,2.315,1.373,2.315,2.733,0,1.654-1.346,3-3,3v1c0,.552-.448,1-1,1s-1-.448-1-1v-1h-.268c-1.068,0-2.063-.574-2.598-1.499-.276-.478-.113-1.089,.365-1.366,.476-.277,1.089-.114,1.366,.365,.178,.308,.511,.5,.867,.5h2.268c.551,0,1-.449,1-1,0-.378-.271-.698-.644-.76l-3.042-.507c-1.341-.223-2.315-1.373-2.315-2.733,0-1.654,1.346-3,3-3v-1c0-.552,.448-1,1-1s1,.448,1,1v1h.268c1.067,0,2.063,.575,2.598,1.5,.276,.478,.113,1.089-.365,1.366-.477,.277-1.089,.114-1.366-.365-.179-.309-.511-.5-.867-.5h-2.268c-.551,0-1,.449-1,1,0,.378,.271,.698,.644,.76Z"/></svg>Finanzas</a>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M15.091,15.997c6.571-.033,8.909-3.513,8.909-6.497,0-1.677-1.188-3.08-2.765-3.419,.136-.386,.254-.741,.333-1.01,.353-1.193,.125-2.453-.626-3.458-.766-1.024-1.937-1.612-3.214-1.612H6.271c-1.277,0-2.449,.588-3.215,1.612-.751,1.005-.979,2.266-.626,3.458,.08,.269,.197,.624,.334,1.011-1.577,.339-2.764,1.742-2.764,3.419,0,2.984,2.339,6.464,8.909,6.497,.056,.302,.091,.61,.091,.924v3.079c0,1.826-1.536,1.992-2,2h-1c-.553,0-1,.447-1,1s.447,1,1,1h12c.553,0,1-.447,1-1s-.447-1-1-1h-.992c-.472-.008-2.008-.174-2.008-2v-3.08c0-.313,.035-.621,.091-.923Zm5.361-8.007c.017,0,.031,.01,.048,.01,.827,0,1.5,.673,1.5,1.5,0,2.034-1.609,4.197-6.036,4.47,.221-.299,.474-.576,.762-.821,1.739-1.478,2.933-3.453,3.726-5.159ZM2,9.5c0-.827,.673-1.5,1.5-1.5,.017,0,.031-.009,.047-.01,.794,1.706,1.988,3.681,3.727,5.159,.288,.245,.541,.521,.762,.821-4.427-.273-6.036-2.436-6.036-4.47Zm7.792,.263c-.264-.182-.375-.518-.27-.822l.519-1.606-1.366-1c-.327-.24-.398-.699-.158-1.026,.138-.188,.358-.3,.591-.3h1.681l.511-1.593c.129-.387,.547-.595,.934-.466,.22,.073,.393,.246,.466,.466l.51,1.593h1.681c.405,0,.734,.328,.734,.734,0,.235-.112,.455-.301,.593l-1.366,1,.519,1.606c.124,.386-.088,.8-.475,.925-.224,.072-.469,.032-.659-.107l-1.343-.988-1.344,.987c-.256,.191-.606,.192-.864,.004Z"/></svg>Rendimiento</a>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m0,19c0,2.757,2.243,5,5,5h14c2.757,0,5-2.243,5-5v-9H0v9Zm3-4c0-1.103.897-2,2-2h2c1.103,0,2,.897,2,2v2c0,1.103-.897,2-2,2h-2c-1.103,0-2-.897-2-2v-2Zm4.001,2h-2.001v-2h2v2ZM24,7v1H0v-1C0,4.243,2.243,2,5,2h1v-1c0-.552.448-1,1-1s1,.448,1,1v1h8v-1c0-.552.448-1,1-1s1,.448,1,1v1h1c2.757,0,5,2.243,5,5Z"/></svg>Calendario</a>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19,0H5C2.24,0,0,2.24,0,5v14c0,2.76,2.24,5,5,5h14c2.76,0,5-2.24,5-5V5c0-2.76-2.24-5-5-5ZM7,18c0,.55-.45,1-1,1s-1-.45-1-1v-6c0-.55,.45-1,1-1s1,.45,1,1v6Zm4,0c0,.55-.45,1-1,1s-1-.45-1-1V9c0-.55,.45-1,1-1s1,.45,1,1v9Zm4,0c0,.55-.45,1-1,1s-1-.45-1-1V6c0-.55,.45-1,1-1s1,.45,1,1v12Zm4,0c0,.55-.45,1-1,1s-1-.45-1-1v-3c0-.55,.45-1,1-1s1,.45,1,1v3Z"/></svg>Analíticas</a>
                  <a><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m15.462,12.398c0,1.054-1.313,2.764-3.428,4.461-.041.033-.103.032-.144,0-2.115-1.698-3.428-3.408-3.428-4.462,0-.813.561-1.476,1.25-1.476.57,0,1.25.187,1.25,1.077,0,.553.448,1,1,1s1-.447,1-1c0-.891.68-1.077,1.25-1.077.689,0,1.25.662,1.25,1.476Zm8.538-2.675v9.276c0,2.757-2.243,5-5,5H5c-2.757,0-5-2.243-5-5v-9.276c0-1.665.824-3.214,2.204-4.145L9.203.855c1.699-1.146,3.895-1.146,5.594,0l5.203,3.511v-2.367c0-.553.447-1,1-1s1,.447,1,1v3.735c1.252.941,2,2.41,2,3.989Zm-6.538,2.675c0-1.916-1.458-3.476-3.25-3.476-.906,0-1.684.284-2.25.775-.567-.491-1.344-.775-2.25-.775-1.792,0-3.25,1.56-3.25,3.476,0,2.205,2.271,4.491,4.177,6.021.383.308.853.461,1.323.461s.94-.153,1.324-.462c1.905-1.529,4.177-3.815,4.177-6.021Z"/></svg>Club</a>
                  <div className="yo">
                    <div className="yo-av">LG</div>
                    <div className="quien">Laura Gómez<span>Admin</span></div>
                  </div>
                </aside>
                <div className="centro">
                  <div className="barra">Finanzas</div>
                  <div className="cuerpo">

                    <div className="fin-fila1">
                      <div className="tabs"><span className="on">Mensualidades</span><span>Flujo de caja</span></div>
                      <div className="sep"></div>
                      <div className="fin-filtros">
                        <div className="pil sede">Todas las sedes<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></div>
                        <div className="pil mes"><svg className="cal" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m0,19c0,2.757,2.243,5,5,5h14c2.757,0,5-2.243,5-5v-9H0v9Zm3-4c0-1.103.897-2,2-2h2c1.103,0,2,.897,2,2v2c0,1.103-.897,2-2,2h-2c-1.103,0-2-.897-2-2v-2Zm4.001,2h-2.001v-2h2v2ZM24,7v1H0v-1C0,4.243,2.243,2,5,2h1v-1c0-.552.448-1,1-1s1,.448,1,1v1h8v-1c0-.552.448-1,1-1s1,.448,1,1v1h1c2.757,0,5,2.243,5,5Z"/></svg> Septiembre 2026<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></div>
                        <div className="pil tarifa"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21,6H5c-.859,0-1.672-.372-2.235-.999,.55-.614,1.349-1.001,2.235-1.001H23c1.308-.006,1.307-1.995,0-2H5C2.239,2,0,4.239,0,7v10c0,2.761,2.239,5,5,5H21c1.657,0,3-1.343,3-3V9c0-1.657-1.343-3-3-3Zm-1,9c-1.308-.006-1.308-1.994,0-2,1.308,.006,1.308,1.994,0,2Z"/></svg>Tarifa general</div>
                        <div className="pil cobros"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M11.24,24a2.262,2.262,0,0,1-.948-.212,2.18,2.18,0,0,1-1.2-2.622L10.653,16H6.975A3,3,0,0,1,4.1,12.131l3.024-10A2.983,2.983,0,0,1,10,0h3.693a2.6,2.6,0,0,1,2.433,3.511L14.443,8H17a3,3,0,0,1,2.483,4.684l-6.4,10.3A2.2,2.2,0,0,1,11.24,24Z"/></svg>Generar cobros</div>
                      </div>
                    </div>

                    <div className="fin-fila2">
                      <div className="tarjeta">
                        <div className="disco d1"></div><div className="disco d2"></div><div className="disco d3"></div>
                        <div className="dentro">
                          <div className="arriba">
                            <p className="club">Club Deportivo Aurora</p>
                            <div className="chip-emv"></div>
                          </div>
                          <div>
                            <div className="rot">
                              <p>Cobrado Septiembre 2026</p>
                              <span className="ojo"><svg viewBox="0 0 512.19 512.19" fill="currentColor" stroke="none"><g> <circle cx="256.095" cy="256.095" r="85.333"/> <path d="M496.543,201.034C463.455,147.146,388.191,56.735,256.095,56.735S48.735,147.146,15.647,201.034 c-20.862,33.743-20.862,76.379,0,110.123c33.088,53.888,108.352,144.299,240.448,144.299s207.36-90.411,240.448-144.299 C517.405,277.413,517.405,234.777,496.543,201.034z M256.095,384.095c-70.692,0-128-57.308-128-128s57.308-128,128-128 s128,57.308,128,128C384.024,326.758,326.758,384.024,256.095,384.095z"/> </g></svg></span>
                            </div>
                            <p className="monto">$ 3.410.000</p>
                            <p className="falta"><b>$ 880.000</b> pendiente</p>
                          </div>
                          <div className="abajo">
                            <div>
                              <p className="plan">Plan Trimestral</p>
                              <p className="vence">Vence 12 dic 2026</p>
                            </div>
                            <img className="vc-logo" src="/logo-vc.png" alt="" />
                          </div>
                        </div>
                      </div>

                      <div className="estados">
                        <div className="estado on">
                          <b style={{ color: '#06D6A0' }}>31</b>
                          <div className="cual" style={{ color: '#06D6A0' }}>Pagados</div>
                          <span className="vs">
                            <span className="pct" style={{ background: 'rgba(6,214,160,.12)', color: '#05A77E' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>12%</span>
                            <span className="contra">vs 24 de agosto</span>
                          </span>
                        </div>
                        <div className="estado">
                          <b style={{ color: '#FFB703' }}>8</b>
                          <div className="cual">Pendiente</div>
                          <span className="vs">
                            <span className="pct" style={{ background: 'rgba(6,214,160,.12)', color: '#05A77E' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>18%</span>
                            <span className="contra">vs 24 de agosto</span>
                          </span>
                        </div>
                        <div className="estado">
                          <b style={{ color: '#8E87A8' }}>3</b>
                          <div className="cual">Sin cobro</div>
                        </div>
                      </div>
                    </div>

                    <div className="fin-buscar"><svg viewBox="-2 -2 28 28" fill="currentColor" stroke="none"><g transform="translate(24,0) scale(-1,1)"> <path d="M14,0C6.665-.189,1.6,8.253,5.139,14.618L.879,18.879a3,3,0,0,0,4.242,4.242l4.261-4.26C15.748,22.4,24.189,17.336,24,10A10.011,10.011,0,0,0,14,0Zm0,17C4.749,16.7,4.751,3.294,14,3a1,1,0,0,1,0,2c-6.607.21-6.607,9.791,0,10a5.006,5.006,0,0,0,5-5,1,1,0,0,1,2,0A7.009,7.009,0,0,1,14,17Z"/> </g></svg>Buscar deportista...</div>

                    <div className="fin-fichas">
                      <article className="fic">
                        <div className="cabe">
                          <div className="ini" style={{ background: '#06D6A0', boxShadow: '0 3px 10px #06D6A040' }}>AP</div>
                          <div className="quien"><p>Andrés Pineda</p><span>Cobro el día 5</span></div>
                          <div className="tuerca"><svg viewBox="-43 -43 598 598" fill="currentColor" stroke="none"><path d="M34.283,384c17.646,30.626,56.779,41.148,87.405,23.502c0.021-0.012,0.041-0.024,0.062-0.036l9.493-5.483c17.92,15.332,38.518,27.222,60.757,35.072V448c0,35.346,28.654,64,64,64s64-28.654,64-64v-10.944c22.242-7.863,42.841-19.767,60.757-35.115l9.536,5.504c30.633,17.673,69.794,7.167,87.467-23.467c17.673-30.633,7.167-69.794-23.467-87.467l0,0l-9.472-5.461c4.264-23.201,4.264-46.985,0-70.187l9.472-5.461c30.633-17.673,41.14-56.833,23.467-87.467c-17.673-30.633-56.833-41.14-87.467-23.467l-9.493,5.483C362.862,94.638,342.25,82.77,320,74.944V64c0-35.346-28.654-64-64-64s-64,28.654-64,64v10.944c-22.242,7.863-42.841,19.767-60.757,35.115l-9.536-5.525C91.073,86.86,51.913,97.367,34.24,128s-7.167,69.794,23.467,87.467l0,0l9.472,5.461c-4.264,23.201-4.264,46.985,0,70.187l-9.472,5.461C27.158,314.296,16.686,353.38,34.283,384zM256,170.667c47.128,0,85.333,38.205,85.333,85.333S303.128,341.333,256,341.333S170.667,303.128,170.667,256S208.872,170.667,256,170.667z"/></svg></div>
                        </div>
                        <div className="linea"><span className="chip-est" style={{ background: 'rgba(6,214,160,.12)', color: '#06D6A0' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Pagado · $ 110.000</span><span className="accion" style={{ background: 'rgba(6,214,160,.15)', color: '#06D6A0' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Pagado</span></div>
                        <div className="iconos"><div style={{ background: '#F1EEF6', color: '#8E87A8' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m14,7.015V.474c.913.346,1.753.879,2.465,1.59l3.484,3.486c.712.711,1.245,1.551,1.591,2.464h-6.54c-.552,0-1-.449-1-1Zm7.976,3h-6.976c-1.654,0-3-1.346-3-3V.038c-.161-.011-.322-.024-.485-.024h-4.515C4.243.015,2,2.258,2,5.015v14c0,2.757,2.243,5,5,5h10c2.757,0,5-2.243,5-5v-8.515c0-.163-.013-.324-.024-.485Zm-6.269,8.506l-1.613,1.614c-.577.577-1.336.866-2.094.866s-1.517-.289-2.094-.866l-1.613-1.614c-.391-.391-.391-1.024,0-1.414.391-.391,1.023-.391,1.414,0l1.293,1.293v-4.398c0-.552.447-1,1-1s1,.448,1,1v4.398l1.293-1.293c.391-.391,1.023-.391,1.414,0,.391.39.391,1.023,0,1.414Z"/></svg></div><div style={{ background: 'rgba(6,214,160,.10)', color: '#0E7C57' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8,0A5.006,5.006,0,0,0,3,5V23a1,1,0,0,0,1.564.825L6.67,22.386l2.106,1.439a1,1,0,0,0,1.13,0l2.1-1.439,2.1,1.439a1,1,0,0,0,1.131,0l2.1-1.438,2.1,1.437A1,1,0,0,0,21,23V5a5.006,5.006,0,0,0-5-5Zm6,14H8a1,1,0,0,1,0-2h6a1,1,0,0,1,0,2Zm3-5a1,1,0,0,1-1,1H8A1,1,0,0,1,8,8h8A1,1,0,0,1,17,9Z"/></svg></div><div style={{ background: '#FBECEC', color: '#EF476F' }}><svg viewBox="0 0 512 512" fill="currentColor" stroke="none"><path d="M448,85.333h-66.133C371.66,35.703,328.002,0.064,277.333,0h-42.667c-50.669,0.064-94.327,35.703-104.533,85.333H64 c-11.782,0-21.333,9.551-21.333,21.333S52.218,128,64,128h21.333v277.333C85.404,464.214,133.119,511.93,192,512h128 c58.881-0.07,106.596-47.786,106.667-106.667V128H448c11.782,0,21.333-9.551,21.333-21.333S459.782,85.333,448,85.333z M234.667,362.667c0,11.782-9.551,21.333-21.333,21.333C201.551,384,192,374.449,192,362.667v-128 c0-11.782,9.551-21.333,21.333-21.333c11.782,0,21.333,9.551,21.333,21.333V362.667z M320,362.667 c0,11.782-9.551,21.333-21.333,21.333c-11.782,0-21.333-9.551-21.333-21.333v-128c0-11.782,9.551-21.333,21.333-21.333 c11.782,0,21.333,9.551,21.333,21.333V362.667z M174.315,85.333c9.074-25.551,33.238-42.634,60.352-42.667h42.667 c27.114,0.033,51.278,17.116,60.352,42.667H174.315z"/></svg></div></div>
                      </article>
                      <article className="fic">
                        <div className="cabe">
                          <div className="ini" style={{ background: '#06D6A0', boxShadow: '0 3px 10px #06D6A040' }}>VS</div>
                          <div className="quien"><p>Valentina Soto</p><span>Cobro el día 5</span></div>
                          <div className="tuerca"><svg viewBox="-43 -43 598 598" fill="currentColor" stroke="none"><path d="M34.283,384c17.646,30.626,56.779,41.148,87.405,23.502c0.021-0.012,0.041-0.024,0.062-0.036l9.493-5.483c17.92,15.332,38.518,27.222,60.757,35.072V448c0,35.346,28.654,64,64,64s64-28.654,64-64v-10.944c22.242-7.863,42.841-19.767,60.757-35.115l9.536,5.504c30.633,17.673,69.794,7.167,87.467-23.467c17.673-30.633,7.167-69.794-23.467-87.467l0,0l-9.472-5.461c4.264-23.201,4.264-46.985,0-70.187l9.472-5.461c30.633-17.673,41.14-56.833,23.467-87.467c-17.673-30.633-56.833-41.14-87.467-23.467l-9.493,5.483C362.862,94.638,342.25,82.77,320,74.944V64c0-35.346-28.654-64-64-64s-64,28.654-64,64v10.944c-22.242,7.863-42.841,19.767-60.757,35.115l-9.536-5.525C91.073,86.86,51.913,97.367,34.24,128s-7.167,69.794,23.467,87.467l0,0l9.472,5.461c-4.264,23.201-4.264,46.985,0,70.187l-9.472,5.461C27.158,314.296,16.686,353.38,34.283,384zM256,170.667c47.128,0,85.333,38.205,85.333,85.333S303.128,341.333,256,341.333S170.667,303.128,170.667,256S208.872,170.667,256,170.667z"/></svg></div>
                        </div>
                        <div className="linea"><span className="chip-est" style={{ background: 'rgba(6,214,160,.12)', color: '#06D6A0' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Pagado · $ 110.000</span><span className="accion" style={{ background: 'rgba(6,214,160,.15)', color: '#06D6A0' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Pagado</span></div>
                        <div className="iconos"><div style={{ background: '#F1EEF6', color: '#8E87A8' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m14,7.015V.474c.913.346,1.753.879,2.465,1.59l3.484,3.486c.712.711,1.245,1.551,1.591,2.464h-6.54c-.552,0-1-.449-1-1Zm7.976,3h-6.976c-1.654,0-3-1.346-3-3V.038c-.161-.011-.322-.024-.485-.024h-4.515C4.243.015,2,2.258,2,5.015v14c0,2.757,2.243,5,5,5h10c2.757,0,5-2.243,5-5v-8.515c0-.163-.013-.324-.024-.485Zm-6.269,8.506l-1.613,1.614c-.577.577-1.336.866-2.094.866s-1.517-.289-2.094-.866l-1.613-1.614c-.391-.391-.391-1.024,0-1.414.391-.391,1.023-.391,1.414,0l1.293,1.293v-4.398c0-.552.447-1,1-1s1,.448,1,1v4.398l1.293-1.293c.391-.391,1.023-.391,1.414,0,.391.39.391,1.023,0,1.414Z"/></svg></div><div style={{ background: 'rgba(6,214,160,.10)', color: '#0E7C57' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8,0A5.006,5.006,0,0,0,3,5V23a1,1,0,0,0,1.564.825L6.67,22.386l2.106,1.439a1,1,0,0,0,1.13,0l2.1-1.439,2.1,1.439a1,1,0,0,0,1.131,0l2.1-1.438,2.1,1.437A1,1,0,0,0,21,23V5a5.006,5.006,0,0,0-5-5Zm6,14H8a1,1,0,0,1,0-2h6a1,1,0,0,1,0,2Zm3-5a1,1,0,0,1-1,1H8A1,1,0,0,1,8,8h8A1,1,0,0,1,17,9Z"/></svg></div><div style={{ background: '#FBECEC', color: '#EF476F' }}><svg viewBox="0 0 512 512" fill="currentColor" stroke="none"><path d="M448,85.333h-66.133C371.66,35.703,328.002,0.064,277.333,0h-42.667c-50.669,0.064-94.327,35.703-104.533,85.333H64 c-11.782,0-21.333,9.551-21.333,21.333S52.218,128,64,128h21.333v277.333C85.404,464.214,133.119,511.93,192,512h128 c58.881-0.07,106.596-47.786,106.667-106.667V128H448c11.782,0,21.333-9.551,21.333-21.333S459.782,85.333,448,85.333z M234.667,362.667c0,11.782-9.551,21.333-21.333,21.333C201.551,384,192,374.449,192,362.667v-128 c0-11.782,9.551-21.333,21.333-21.333c11.782,0,21.333,9.551,21.333,21.333V362.667z M320,362.667 c0,11.782-9.551,21.333-21.333,21.333c-11.782,0-21.333-9.551-21.333-21.333v-128c0-11.782,9.551-21.333,21.333-21.333 c11.782,0,21.333,9.551,21.333,21.333V362.667z M174.315,85.333c9.074-25.551,33.238-42.634,60.352-42.667h42.667 c27.114,0.033,51.278,17.116,60.352,42.667H174.315z"/></svg></div></div>
                      </article>
                      <article className="fic">
                        <div className="cabe">
                          <div className="ini" style={{ background: '#FFB703', boxShadow: '0 3px 10px #FFB70340' }}>MC</div>
                          <div className="quien"><p>Mariana Cortés</p><span>Cobro el día 10</span></div>
                          <div className="tuerca"><svg viewBox="-43 -43 598 598" fill="currentColor" stroke="none"><path d="M34.283,384c17.646,30.626,56.779,41.148,87.405,23.502c0.021-0.012,0.041-0.024,0.062-0.036l9.493-5.483c17.92,15.332,38.518,27.222,60.757,35.072V448c0,35.346,28.654,64,64,64s64-28.654,64-64v-10.944c22.242-7.863,42.841-19.767,60.757-35.115l9.536,5.504c30.633,17.673,69.794,7.167,87.467-23.467c17.673-30.633,7.167-69.794-23.467-87.467l0,0l-9.472-5.461c4.264-23.201,4.264-46.985,0-70.187l9.472-5.461c30.633-17.673,41.14-56.833,23.467-87.467c-17.673-30.633-56.833-41.14-87.467-23.467l-9.493,5.483C362.862,94.638,342.25,82.77,320,74.944V64c0-35.346-28.654-64-64-64s-64,28.654-64,64v10.944c-22.242,7.863-42.841,19.767-60.757,35.115l-9.536-5.525C91.073,86.86,51.913,97.367,34.24,128s-7.167,69.794,23.467,87.467l0,0l9.472,5.461c-4.264,23.201-4.264,46.985,0,70.187l-9.472,5.461C27.158,314.296,16.686,353.38,34.283,384zM256,170.667c47.128,0,85.333,38.205,85.333,85.333S303.128,341.333,256,341.333S170.667,303.128,170.667,256S208.872,170.667,256,170.667z"/></svg></div>
                        </div>
                        <div className="linea"><span className="chip-est" style={{ background: 'rgba(255,183,3,.12)', color: '#FFB703' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Pendiente · $ 110.000</span><span className="accion" style={{ background: 'rgba(6,214,160,.15)', color: '#06D6A0' }}><span className="aro" style={{ border: '1.5px solid #06D6A0' }}></span>Pagado</span></div>
                        <div className="iconos"><div style={{ background: 'rgba(37,211,102,.12)', color: '#25D366' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m12.836.029c-3.465-.233-6.874,1.036-9.327,3.492C1.057,5.976-.211,9.378.029,12.854c.441,6.354,6.053,11.146,13.054,11.146h5.917c2.757,0,5-2.243,5-5v-6.66C24,5.862,19.097.454,12.836.029Zm-4.336,7.971c.828,0,1.5.672,1.5,1.5s-.672,1.5-1.5,1.5-1.5-.672-1.5-1.5.672-1.5,1.5-1.5Zm8.204,7.21c-.074.073-1.84,1.79-4.704,1.79s-4.63-1.716-4.704-1.79c-.392-.389-.396-1.021-.007-1.414.39-.392,1.021-.396,1.415-.007.046.045,1.28,1.21,3.296,1.21s3.25-1.166,3.302-1.215c.396-.382,1.028-.374,1.411.02.384.393.381,1.02-.009,1.406Zm-1.204-4.21c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5.672,1.5,1.5-.672,1.5-1.5,1.5Z"/></svg></div><div style={{ background: '#F1EEF6', color: '#8E87A8' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m14,7.015V.474c.913.346,1.753.879,2.465,1.59l3.484,3.486c.712.711,1.245,1.551,1.591,2.464h-6.54c-.552,0-1-.449-1-1Zm7.976,3h-6.976c-1.654,0-3-1.346-3-3V.038c-.161-.011-.322-.024-.485-.024h-4.515C4.243.015,2,2.258,2,5.015v14c0,2.757,2.243,5,5,5h10c2.757,0,5-2.243,5-5v-8.515c0-.163-.013-.324-.024-.485Zm-6.269,8.506l-1.613,1.614c-.577.577-1.336.866-2.094.866s-1.517-.289-2.094-.866l-1.613-1.614c-.391-.391-.391-1.024,0-1.414.391-.391,1.023-.391,1.414,0l1.293,1.293v-4.398c0-.552.447-1,1-1s1,.448,1,1v4.398l1.293-1.293c.391-.391,1.023-.391,1.414,0,.391.39.391,1.023,0,1.414Z"/></svg></div><div style={{ background: '#F1EEF6', color: '#8E87A8' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8,0A5.006,5.006,0,0,0,3,5V23a1,1,0,0,0,1.564.825L6.67,22.386l2.106,1.439a1,1,0,0,0,1.13,0l2.1-1.439,2.1,1.439a1,1,0,0,0,1.131,0l2.1-1.438,2.1,1.437A1,1,0,0,0,21,23V5a5.006,5.006,0,0,0-5-5Zm6,14H8a1,1,0,0,1,0-2h6a1,1,0,0,1,0,2Zm3-5a1,1,0,0,1-1,1H8A1,1,0,0,1,8,8h8A1,1,0,0,1,17,9Z"/></svg></div><div style={{ background: '#FBECEC', color: '#EF476F' }}><svg viewBox="0 0 512 512" fill="currentColor" stroke="none"><path d="M448,85.333h-66.133C371.66,35.703,328.002,0.064,277.333,0h-42.667c-50.669,0.064-94.327,35.703-104.533,85.333H64 c-11.782,0-21.333,9.551-21.333,21.333S52.218,128,64,128h21.333v277.333C85.404,464.214,133.119,511.93,192,512h128 c58.881-0.07,106.596-47.786,106.667-106.667V128H448c11.782,0,21.333-9.551,21.333-21.333S459.782,85.333,448,85.333z M234.667,362.667c0,11.782-9.551,21.333-21.333,21.333C201.551,384,192,374.449,192,362.667v-128 c0-11.782,9.551-21.333,21.333-21.333c11.782,0,21.333,9.551,21.333,21.333V362.667z M320,362.667 c0,11.782-9.551,21.333-21.333,21.333c-11.782,0-21.333-9.551-21.333-21.333v-128c0-11.782,9.551-21.333,21.333-21.333 c11.782,0,21.333,9.551,21.333,21.333V362.667z M174.315,85.333c9.074-25.551,33.238-42.634,60.352-42.667h42.667 c27.114,0.033,51.278,17.116,60.352,42.667H174.315z"/></svg></div></div>
                      </article>
                      <article className="fic">
                        <div className="cabe">
                          <div className="ini" style={{ background: '#06D6A0', boxShadow: '0 3px 10px #06D6A040' }}>TR</div>
                          <div className="quien"><p>Tomás Rivera</p><span>Cobro el día 5</span></div>
                          <div className="tuerca"><svg viewBox="-43 -43 598 598" fill="currentColor" stroke="none"><path d="M34.283,384c17.646,30.626,56.779,41.148,87.405,23.502c0.021-0.012,0.041-0.024,0.062-0.036l9.493-5.483c17.92,15.332,38.518,27.222,60.757,35.072V448c0,35.346,28.654,64,64,64s64-28.654,64-64v-10.944c22.242-7.863,42.841-19.767,60.757-35.115l9.536,5.504c30.633,17.673,69.794,7.167,87.467-23.467c17.673-30.633,7.167-69.794-23.467-87.467l0,0l-9.472-5.461c4.264-23.201,4.264-46.985,0-70.187l9.472-5.461c30.633-17.673,41.14-56.833,23.467-87.467c-17.673-30.633-56.833-41.14-87.467-23.467l-9.493,5.483C362.862,94.638,342.25,82.77,320,74.944V64c0-35.346-28.654-64-64-64s-64,28.654-64,64v10.944c-22.242,7.863-42.841,19.767-60.757,35.115l-9.536-5.525C91.073,86.86,51.913,97.367,34.24,128s-7.167,69.794,23.467,87.467l0,0l9.472,5.461c-4.264,23.201-4.264,46.985,0,70.187l-9.472,5.461C27.158,314.296,16.686,353.38,34.283,384zM256,170.667c47.128,0,85.333,38.205,85.333,85.333S303.128,341.333,256,341.333S170.667,303.128,170.667,256S208.872,170.667,256,170.667z"/></svg></div>
                        </div>
                        <div className="linea"><span className="chip-est" style={{ background: 'rgba(6,214,160,.12)', color: '#06D6A0' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Pagado · $ 110.000</span><span className="accion" style={{ background: 'rgba(6,214,160,.15)', color: '#06D6A0' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Pagado</span></div>
                        <div className="iconos"><div style={{ background: '#F1EEF6', color: '#8E87A8' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m14,7.015V.474c.913.346,1.753.879,2.465,1.59l3.484,3.486c.712.711,1.245,1.551,1.591,2.464h-6.54c-.552,0-1-.449-1-1Zm7.976,3h-6.976c-1.654,0-3-1.346-3-3V.038c-.161-.011-.322-.024-.485-.024h-4.515C4.243.015,2,2.258,2,5.015v14c0,2.757,2.243,5,5,5h10c2.757,0,5-2.243,5-5v-8.515c0-.163-.013-.324-.024-.485Zm-6.269,8.506l-1.613,1.614c-.577.577-1.336.866-2.094.866s-1.517-.289-2.094-.866l-1.613-1.614c-.391-.391-.391-1.024,0-1.414.391-.391,1.023-.391,1.414,0l1.293,1.293v-4.398c0-.552.447-1,1-1s1,.448,1,1v4.398l1.293-1.293c.391-.391,1.023-.391,1.414,0,.391.39.391,1.023,0,1.414Z"/></svg></div><div style={{ background: 'rgba(6,214,160,.10)', color: '#0E7C57' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8,0A5.006,5.006,0,0,0,3,5V23a1,1,0,0,0,1.564.825L6.67,22.386l2.106,1.439a1,1,0,0,0,1.13,0l2.1-1.439,2.1,1.439a1,1,0,0,0,1.131,0l2.1-1.438,2.1,1.437A1,1,0,0,0,21,23V5a5.006,5.006,0,0,0-5-5Zm6,14H8a1,1,0,0,1,0-2h6a1,1,0,0,1,0,2Zm3-5a1,1,0,0,1-1,1H8A1,1,0,0,1,8,8h8A1,1,0,0,1,17,9Z"/></svg></div><div style={{ background: '#FBECEC', color: '#EF476F' }}><svg viewBox="0 0 512 512" fill="currentColor" stroke="none"><path d="M448,85.333h-66.133C371.66,35.703,328.002,0.064,277.333,0h-42.667c-50.669,0.064-94.327,35.703-104.533,85.333H64 c-11.782,0-21.333,9.551-21.333,21.333S52.218,128,64,128h21.333v277.333C85.404,464.214,133.119,511.93,192,512h128 c58.881-0.07,106.596-47.786,106.667-106.667V128H448c11.782,0,21.333-9.551,21.333-21.333S459.782,85.333,448,85.333z M234.667,362.667c0,11.782-9.551,21.333-21.333,21.333C201.551,384,192,374.449,192,362.667v-128 c0-11.782,9.551-21.333,21.333-21.333c11.782,0,21.333,9.551,21.333,21.333V362.667z M320,362.667 c0,11.782-9.551,21.333-21.333,21.333c-11.782,0-21.333-9.551-21.333-21.333v-128c0-11.782,9.551-21.333,21.333-21.333 c11.782,0,21.333,9.551,21.333,21.333V362.667z M174.315,85.333c9.074-25.551,33.238-42.634,60.352-42.667h42.667 c27.114,0.033,51.278,17.116,60.352,42.667H174.315z"/></svg></div></div>
                      </article>
                      <article className="fic">
                        <div className="cabe">
                          <div className="ini" style={{ background: '#FFB703', boxShadow: '0 3px 10px #FFB70340' }}>CO</div>
                          <div className="quien"><p>Camila Ordóñez</p><span>Cobro el día 10</span></div>
                          <div className="tuerca"><svg viewBox="-43 -43 598 598" fill="currentColor" stroke="none"><path d="M34.283,384c17.646,30.626,56.779,41.148,87.405,23.502c0.021-0.012,0.041-0.024,0.062-0.036l9.493-5.483c17.92,15.332,38.518,27.222,60.757,35.072V448c0,35.346,28.654,64,64,64s64-28.654,64-64v-10.944c22.242-7.863,42.841-19.767,60.757-35.115l9.536,5.504c30.633,17.673,69.794,7.167,87.467-23.467c17.673-30.633,7.167-69.794-23.467-87.467l0,0l-9.472-5.461c4.264-23.201,4.264-46.985,0-70.187l9.472-5.461c30.633-17.673,41.14-56.833,23.467-87.467c-17.673-30.633-56.833-41.14-87.467-23.467l-9.493,5.483C362.862,94.638,342.25,82.77,320,74.944V64c0-35.346-28.654-64-64-64s-64,28.654-64,64v10.944c-22.242,7.863-42.841,19.767-60.757,35.115l-9.536-5.525C91.073,86.86,51.913,97.367,34.24,128s-7.167,69.794,23.467,87.467l0,0l9.472,5.461c-4.264,23.201-4.264,46.985,0,70.187l-9.472,5.461C27.158,314.296,16.686,353.38,34.283,384zM256,170.667c47.128,0,85.333,38.205,85.333,85.333S303.128,341.333,256,341.333S170.667,303.128,170.667,256S208.872,170.667,256,170.667z"/></svg></div>
                        </div>
                        <div className="linea"><span className="chip-est" style={{ background: 'rgba(255,183,3,.12)', color: '#FFB703' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Pendiente · $ 110.000</span><span className="accion" style={{ background: 'rgba(6,214,160,.15)', color: '#06D6A0' }}><span className="aro" style={{ border: '1.5px solid #06D6A0' }}></span>Pagado</span></div>
                        <div className="iconos"><div style={{ background: 'rgba(37,211,102,.12)', color: '#25D366' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m12.836.029c-3.465-.233-6.874,1.036-9.327,3.492C1.057,5.976-.211,9.378.029,12.854c.441,6.354,6.053,11.146,13.054,11.146h5.917c2.757,0,5-2.243,5-5v-6.66C24,5.862,19.097.454,12.836.029Zm-4.336,7.971c.828,0,1.5.672,1.5,1.5s-.672,1.5-1.5,1.5-1.5-.672-1.5-1.5.672-1.5,1.5-1.5Zm8.204,7.21c-.074.073-1.84,1.79-4.704,1.79s-4.63-1.716-4.704-1.79c-.392-.389-.396-1.021-.007-1.414.39-.392,1.021-.396,1.415-.007.046.045,1.28,1.21,3.296,1.21s3.25-1.166,3.302-1.215c.396-.382,1.028-.374,1.411.02.384.393.381,1.02-.009,1.406Zm-1.204-4.21c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5.672,1.5,1.5-.672,1.5-1.5,1.5Z"/></svg></div><div style={{ background: '#F1EEF6', color: '#8E87A8' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m14,7.015V.474c.913.346,1.753.879,2.465,1.59l3.484,3.486c.712.711,1.245,1.551,1.591,2.464h-6.54c-.552,0-1-.449-1-1Zm7.976,3h-6.976c-1.654,0-3-1.346-3-3V.038c-.161-.011-.322-.024-.485-.024h-4.515C4.243.015,2,2.258,2,5.015v14c0,2.757,2.243,5,5,5h10c2.757,0,5-2.243,5-5v-8.515c0-.163-.013-.324-.024-.485Zm-6.269,8.506l-1.613,1.614c-.577.577-1.336.866-2.094.866s-1.517-.289-2.094-.866l-1.613-1.614c-.391-.391-.391-1.024,0-1.414.391-.391,1.023-.391,1.414,0l1.293,1.293v-4.398c0-.552.447-1,1-1s1,.448,1,1v4.398l1.293-1.293c.391-.391,1.023-.391,1.414,0,.391.39.391,1.023,0,1.414Z"/></svg></div><div style={{ background: '#F1EEF6', color: '#8E87A8' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8,0A5.006,5.006,0,0,0,3,5V23a1,1,0,0,0,1.564.825L6.67,22.386l2.106,1.439a1,1,0,0,0,1.13,0l2.1-1.439,2.1,1.439a1,1,0,0,0,1.131,0l2.1-1.438,2.1,1.437A1,1,0,0,0,21,23V5a5.006,5.006,0,0,0-5-5Zm6,14H8a1,1,0,0,1,0-2h6a1,1,0,0,1,0,2Zm3-5a1,1,0,0,1-1,1H8A1,1,0,0,1,8,8h8A1,1,0,0,1,17,9Z"/></svg></div><div style={{ background: '#FBECEC', color: '#EF476F' }}><svg viewBox="0 0 512 512" fill="currentColor" stroke="none"><path d="M448,85.333h-66.133C371.66,35.703,328.002,0.064,277.333,0h-42.667c-50.669,0.064-94.327,35.703-104.533,85.333H64 c-11.782,0-21.333,9.551-21.333,21.333S52.218,128,64,128h21.333v277.333C85.404,464.214,133.119,511.93,192,512h128 c58.881-0.07,106.596-47.786,106.667-106.667V128H448c11.782,0,21.333-9.551,21.333-21.333S459.782,85.333,448,85.333z M234.667,362.667c0,11.782-9.551,21.333-21.333,21.333C201.551,384,192,374.449,192,362.667v-128 c0-11.782,9.551-21.333,21.333-21.333c11.782,0,21.333,9.551,21.333,21.333V362.667z M320,362.667 c0,11.782-9.551,21.333-21.333,21.333c-11.782,0-21.333-9.551-21.333-21.333v-128c0-11.782,9.551-21.333,21.333-21.333 c11.782,0,21.333,9.551,21.333,21.333V362.667z M174.315,85.333c9.074-25.551,33.238-42.634,60.352-42.667h42.667 c27.114,0.033,51.278,17.116,60.352,42.667H174.315z"/></svg></div></div>
                      </article>
                      <article className="fic">
                        <div className="cabe">
                          <div className="ini" style={{ background: '#06D6A0', boxShadow: '0 3px 10px #06D6A040' }}>JR</div>
                          <div className="quien"><p>Juan Esteban Ruiz</p><span>Cobro el día 5</span></div>
                          <div className="tuerca"><svg viewBox="-43 -43 598 598" fill="currentColor" stroke="none"><path d="M34.283,384c17.646,30.626,56.779,41.148,87.405,23.502c0.021-0.012,0.041-0.024,0.062-0.036l9.493-5.483c17.92,15.332,38.518,27.222,60.757,35.072V448c0,35.346,28.654,64,64,64s64-28.654,64-64v-10.944c22.242-7.863,42.841-19.767,60.757-35.115l9.536,5.504c30.633,17.673,69.794,7.167,87.467-23.467c17.673-30.633,7.167-69.794-23.467-87.467l0,0l-9.472-5.461c4.264-23.201,4.264-46.985,0-70.187l9.472-5.461c30.633-17.673,41.14-56.833,23.467-87.467c-17.673-30.633-56.833-41.14-87.467-23.467l-9.493,5.483C362.862,94.638,342.25,82.77,320,74.944V64c0-35.346-28.654-64-64-64s-64,28.654-64,64v10.944c-22.242,7.863-42.841,19.767-60.757,35.115l-9.536-5.525C91.073,86.86,51.913,97.367,34.24,128s-7.167,69.794,23.467,87.467l0,0l9.472,5.461c-4.264,23.201-4.264,46.985,0,70.187l-9.472,5.461C27.158,314.296,16.686,353.38,34.283,384zM256,170.667c47.128,0,85.333,38.205,85.333,85.333S303.128,341.333,256,341.333S170.667,303.128,170.667,256S208.872,170.667,256,170.667z"/></svg></div>
                        </div>
                        <div className="linea"><span className="chip-est" style={{ background: 'rgba(6,214,160,.12)', color: '#06D6A0' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Pagado · $ 110.000</span><span className="accion" style={{ background: 'rgba(6,214,160,.15)', color: '#06D6A0' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Pagado</span></div>
                        <div className="iconos"><div style={{ background: '#F1EEF6', color: '#8E87A8' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m14,7.015V.474c.913.346,1.753.879,2.465,1.59l3.484,3.486c.712.711,1.245,1.551,1.591,2.464h-6.54c-.552,0-1-.449-1-1Zm7.976,3h-6.976c-1.654,0-3-1.346-3-3V.038c-.161-.011-.322-.024-.485-.024h-4.515C4.243.015,2,2.258,2,5.015v14c0,2.757,2.243,5,5,5h10c2.757,0,5-2.243,5-5v-8.515c0-.163-.013-.324-.024-.485Zm-6.269,8.506l-1.613,1.614c-.577.577-1.336.866-2.094.866s-1.517-.289-2.094-.866l-1.613-1.614c-.391-.391-.391-1.024,0-1.414.391-.391,1.023-.391,1.414,0l1.293,1.293v-4.398c0-.552.447-1,1-1s1,.448,1,1v4.398l1.293-1.293c.391-.391,1.023-.391,1.414,0,.391.39.391,1.023,0,1.414Z"/></svg></div><div style={{ background: 'rgba(6,214,160,.10)', color: '#0E7C57' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8,0A5.006,5.006,0,0,0,3,5V23a1,1,0,0,0,1.564.825L6.67,22.386l2.106,1.439a1,1,0,0,0,1.13,0l2.1-1.439,2.1,1.439a1,1,0,0,0,1.131,0l2.1-1.438,2.1,1.437A1,1,0,0,0,21,23V5a5.006,5.006,0,0,0-5-5Zm6,14H8a1,1,0,0,1,0-2h6a1,1,0,0,1,0,2Zm3-5a1,1,0,0,1-1,1H8A1,1,0,0,1,8,8h8A1,1,0,0,1,17,9Z"/></svg></div><div style={{ background: '#FBECEC', color: '#EF476F' }}><svg viewBox="0 0 512 512" fill="currentColor" stroke="none"><path d="M448,85.333h-66.133C371.66,35.703,328.002,0.064,277.333,0h-42.667c-50.669,0.064-94.327,35.703-104.533,85.333H64 c-11.782,0-21.333,9.551-21.333,21.333S52.218,128,64,128h21.333v277.333C85.404,464.214,133.119,511.93,192,512h128 c58.881-0.07,106.596-47.786,106.667-106.667V128H448c11.782,0,21.333-9.551,21.333-21.333S459.782,85.333,448,85.333z M234.667,362.667c0,11.782-9.551,21.333-21.333,21.333C201.551,384,192,374.449,192,362.667v-128 c0-11.782,9.551-21.333,21.333-21.333c11.782,0,21.333,9.551,21.333,21.333V362.667z M320,362.667 c0,11.782-9.551,21.333-21.333,21.333c-11.782,0-21.333-9.551-21.333-21.333v-128c0-11.782,9.551-21.333,21.333-21.333 c11.782,0,21.333,9.551,21.333,21.333V362.667z M174.315,85.333c9.074-25.551,33.238-42.634,60.352-42.667h42.667 c27.114,0.033,51.278,17.116,60.352,42.667H174.315z"/></svg></div></div>
                      </article>
                      <article className="fic">
                        <div className="cabe">
                          <div className="ini" style={{ background: '#06D6A0', boxShadow: '0 3px 10px #06D6A040' }}>LP</div>
                          <div className="quien"><p>Laura Peña</p><span>Cobro el día 5</span></div>
                          <div className="tuerca"><svg viewBox="-43 -43 598 598" fill="currentColor" stroke="none"><path d="M34.283,384c17.646,30.626,56.779,41.148,87.405,23.502c0.021-0.012,0.041-0.024,0.062-0.036l9.493-5.483c17.92,15.332,38.518,27.222,60.757,35.072V448c0,35.346,28.654,64,64,64s64-28.654,64-64v-10.944c22.242-7.863,42.841-19.767,60.757-35.115l9.536,5.504c30.633,17.673,69.794,7.167,87.467-23.467c17.673-30.633,7.167-69.794-23.467-87.467l0,0l-9.472-5.461c4.264-23.201,4.264-46.985,0-70.187l9.472-5.461c30.633-17.673,41.14-56.833,23.467-87.467c-17.673-30.633-56.833-41.14-87.467-23.467l-9.493,5.483C362.862,94.638,342.25,82.77,320,74.944V64c0-35.346-28.654-64-64-64s-64,28.654-64,64v10.944c-22.242,7.863-42.841,19.767-60.757,35.115l-9.536-5.525C91.073,86.86,51.913,97.367,34.24,128s-7.167,69.794,23.467,87.467l0,0l9.472,5.461c-4.264,23.201-4.264,46.985,0,70.187l-9.472,5.461C27.158,314.296,16.686,353.38,34.283,384zM256,170.667c47.128,0,85.333,38.205,85.333,85.333S303.128,341.333,256,341.333S170.667,303.128,170.667,256S208.872,170.667,256,170.667z"/></svg></div>
                        </div>
                        <div className="linea"><span className="chip-est" style={{ background: 'rgba(6,214,160,.12)', color: '#06D6A0' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Pagado · $ 110.000</span><span className="accion" style={{ background: 'rgba(6,214,160,.15)', color: '#06D6A0' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Pagado</span></div>
                        <div className="iconos"><div style={{ background: '#F1EEF6', color: '#8E87A8' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m14,7.015V.474c.913.346,1.753.879,2.465,1.59l3.484,3.486c.712.711,1.245,1.551,1.591,2.464h-6.54c-.552,0-1-.449-1-1Zm7.976,3h-6.976c-1.654,0-3-1.346-3-3V.038c-.161-.011-.322-.024-.485-.024h-4.515C4.243.015,2,2.258,2,5.015v14c0,2.757,2.243,5,5,5h10c2.757,0,5-2.243,5-5v-8.515c0-.163-.013-.324-.024-.485Zm-6.269,8.506l-1.613,1.614c-.577.577-1.336.866-2.094.866s-1.517-.289-2.094-.866l-1.613-1.614c-.391-.391-.391-1.024,0-1.414.391-.391,1.023-.391,1.414,0l1.293,1.293v-4.398c0-.552.447-1,1-1s1,.448,1,1v4.398l1.293-1.293c.391-.391,1.023-.391,1.414,0,.391.39.391,1.023,0,1.414Z"/></svg></div><div style={{ background: 'rgba(6,214,160,.10)', color: '#0E7C57' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8,0A5.006,5.006,0,0,0,3,5V23a1,1,0,0,0,1.564.825L6.67,22.386l2.106,1.439a1,1,0,0,0,1.13,0l2.1-1.439,2.1,1.439a1,1,0,0,0,1.131,0l2.1-1.438,2.1,1.437A1,1,0,0,0,21,23V5a5.006,5.006,0,0,0-5-5Zm6,14H8a1,1,0,0,1,0-2h6a1,1,0,0,1,0,2Zm3-5a1,1,0,0,1-1,1H8A1,1,0,0,1,8,8h8A1,1,0,0,1,17,9Z"/></svg></div><div style={{ background: '#FBECEC', color: '#EF476F' }}><svg viewBox="0 0 512 512" fill="currentColor" stroke="none"><path d="M448,85.333h-66.133C371.66,35.703,328.002,0.064,277.333,0h-42.667c-50.669,0.064-94.327,35.703-104.533,85.333H64 c-11.782,0-21.333,9.551-21.333,21.333S52.218,128,64,128h21.333v277.333C85.404,464.214,133.119,511.93,192,512h128 c58.881-0.07,106.596-47.786,106.667-106.667V128H448c11.782,0,21.333-9.551,21.333-21.333S459.782,85.333,448,85.333z M234.667,362.667c0,11.782-9.551,21.333-21.333,21.333C201.551,384,192,374.449,192,362.667v-128 c0-11.782,9.551-21.333,21.333-21.333c11.782,0,21.333,9.551,21.333,21.333V362.667z M320,362.667 c0,11.782-9.551,21.333-21.333,21.333c-11.782,0-21.333-9.551-21.333-21.333v-128c0-11.782,9.551-21.333,21.333-21.333 c11.782,0,21.333,9.551,21.333,21.333V362.667z M174.315,85.333c9.074-25.551,33.238-42.634,60.352-42.667h42.667 c27.114,0.033,51.278,17.116,60.352,42.667H174.315z"/></svg></div></div>
                      </article>
                      <article className="fic">
                        <div className="cabe">
                          <div className="ini" style={{ background: '#FFB703', boxShadow: '0 3px 10px #FFB70340' }}>SG</div>
                          <div className="quien"><p>Sofía Guerrero</p><span>Cobro el día 10</span></div>
                          <div className="tuerca"><svg viewBox="-43 -43 598 598" fill="currentColor" stroke="none"><path d="M34.283,384c17.646,30.626,56.779,41.148,87.405,23.502c0.021-0.012,0.041-0.024,0.062-0.036l9.493-5.483c17.92,15.332,38.518,27.222,60.757,35.072V448c0,35.346,28.654,64,64,64s64-28.654,64-64v-10.944c22.242-7.863,42.841-19.767,60.757-35.115l9.536,5.504c30.633,17.673,69.794,7.167,87.467-23.467c17.673-30.633,7.167-69.794-23.467-87.467l0,0l-9.472-5.461c4.264-23.201,4.264-46.985,0-70.187l9.472-5.461c30.633-17.673,41.14-56.833,23.467-87.467c-17.673-30.633-56.833-41.14-87.467-23.467l-9.493,5.483C362.862,94.638,342.25,82.77,320,74.944V64c0-35.346-28.654-64-64-64s-64,28.654-64,64v10.944c-22.242,7.863-42.841,19.767-60.757,35.115l-9.536-5.525C91.073,86.86,51.913,97.367,34.24,128s-7.167,69.794,23.467,87.467l0,0l9.472,5.461c-4.264,23.201-4.264,46.985,0,70.187l-9.472,5.461C27.158,314.296,16.686,353.38,34.283,384zM256,170.667c47.128,0,85.333,38.205,85.333,85.333S303.128,341.333,256,341.333S170.667,303.128,170.667,256S208.872,170.667,256,170.667z"/></svg></div>
                        </div>
                        <div className="linea"><span className="chip-est" style={{ background: 'rgba(255,183,3,.12)', color: '#FFB703' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Pendiente · $ 110.000</span><span className="accion" style={{ background: 'rgba(6,214,160,.15)', color: '#06D6A0' }}><span className="aro" style={{ border: '1.5px solid #06D6A0' }}></span>Pagado</span></div>
                        <div className="iconos"><div style={{ background: 'rgba(37,211,102,.12)', color: '#25D366' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m12.836.029c-3.465-.233-6.874,1.036-9.327,3.492C1.057,5.976-.211,9.378.029,12.854c.441,6.354,6.053,11.146,13.054,11.146h5.917c2.757,0,5-2.243,5-5v-6.66C24,5.862,19.097.454,12.836.029Zm-4.336,7.971c.828,0,1.5.672,1.5,1.5s-.672,1.5-1.5,1.5-1.5-.672-1.5-1.5.672-1.5,1.5-1.5Zm8.204,7.21c-.074.073-1.84,1.79-4.704,1.79s-4.63-1.716-4.704-1.79c-.392-.389-.396-1.021-.007-1.414.39-.392,1.021-.396,1.415-.007.046.045,1.28,1.21,3.296,1.21s3.25-1.166,3.302-1.215c.396-.382,1.028-.374,1.411.02.384.393.381,1.02-.009,1.406Zm-1.204-4.21c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5.672,1.5,1.5-.672,1.5-1.5,1.5Z"/></svg></div><div style={{ background: '#F1EEF6', color: '#8E87A8' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m14,7.015V.474c.913.346,1.753.879,2.465,1.59l3.484,3.486c.712.711,1.245,1.551,1.591,2.464h-6.54c-.552,0-1-.449-1-1Zm7.976,3h-6.976c-1.654,0-3-1.346-3-3V.038c-.161-.011-.322-.024-.485-.024h-4.515C4.243.015,2,2.258,2,5.015v14c0,2.757,2.243,5,5,5h10c2.757,0,5-2.243,5-5v-8.515c0-.163-.013-.324-.024-.485Zm-6.269,8.506l-1.613,1.614c-.577.577-1.336.866-2.094.866s-1.517-.289-2.094-.866l-1.613-1.614c-.391-.391-.391-1.024,0-1.414.391-.391,1.023-.391,1.414,0l1.293,1.293v-4.398c0-.552.447-1,1-1s1,.448,1,1v4.398l1.293-1.293c.391-.391,1.023-.391,1.414,0,.391.39.391,1.023,0,1.414Z"/></svg></div><div style={{ background: '#F1EEF6', color: '#8E87A8' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8,0A5.006,5.006,0,0,0,3,5V23a1,1,0,0,0,1.564.825L6.67,22.386l2.106,1.439a1,1,0,0,0,1.13,0l2.1-1.439,2.1,1.439a1,1,0,0,0,1.131,0l2.1-1.438,2.1,1.437A1,1,0,0,0,21,23V5a5.006,5.006,0,0,0-5-5Zm6,14H8a1,1,0,0,1,0-2h6a1,1,0,0,1,0,2Zm3-5a1,1,0,0,1-1,1H8A1,1,0,0,1,8,8h8A1,1,0,0,1,17,9Z"/></svg></div><div style={{ background: '#FBECEC', color: '#EF476F' }}><svg viewBox="0 0 512 512" fill="currentColor" stroke="none"><path d="M448,85.333h-66.133C371.66,35.703,328.002,0.064,277.333,0h-42.667c-50.669,0.064-94.327,35.703-104.533,85.333H64 c-11.782,0-21.333,9.551-21.333,21.333S52.218,128,64,128h21.333v277.333C85.404,464.214,133.119,511.93,192,512h128 c58.881-0.07,106.596-47.786,106.667-106.667V128H448c11.782,0,21.333-9.551,21.333-21.333S459.782,85.333,448,85.333z M234.667,362.667c0,11.782-9.551,21.333-21.333,21.333C201.551,384,192,374.449,192,362.667v-128 c0-11.782,9.551-21.333,21.333-21.333c11.782,0,21.333,9.551,21.333,21.333V362.667z M320,362.667 c0,11.782-9.551,21.333-21.333,21.333c-11.782,0-21.333-9.551-21.333-21.333v-128c0-11.782,9.551-21.333,21.333-21.333 c11.782,0,21.333,9.551,21.333,21.333V362.667z M174.315,85.333c9.074-25.551,33.238-42.634,60.352-42.667h42.667 c27.114,0.033,51.278,17.116,60.352,42.667H174.315z"/></svg></div></div>
                      </article>
                      <article className="fic">
                        <div className="cabe">
                          <div className="ini" style={{ background: '#06D6A0', boxShadow: '0 3px 10px #06D6A040' }}>DV</div>
                          <div className="quien"><p>Daniel Vargas</p><span>Cobro el día 5</span></div>
                          <div className="tuerca"><svg viewBox="-43 -43 598 598" fill="currentColor" stroke="none"><path d="M34.283,384c17.646,30.626,56.779,41.148,87.405,23.502c0.021-0.012,0.041-0.024,0.062-0.036l9.493-5.483c17.92,15.332,38.518,27.222,60.757,35.072V448c0,35.346,28.654,64,64,64s64-28.654,64-64v-10.944c22.242-7.863,42.841-19.767,60.757-35.115l9.536,5.504c30.633,17.673,69.794,7.167,87.467-23.467c17.673-30.633,7.167-69.794-23.467-87.467l0,0l-9.472-5.461c4.264-23.201,4.264-46.985,0-70.187l9.472-5.461c30.633-17.673,41.14-56.833,23.467-87.467c-17.673-30.633-56.833-41.14-87.467-23.467l-9.493,5.483C362.862,94.638,342.25,82.77,320,74.944V64c0-35.346-28.654-64-64-64s-64,28.654-64,64v10.944c-22.242,7.863-42.841,19.767-60.757,35.115l-9.536-5.525C91.073,86.86,51.913,97.367,34.24,128s-7.167,69.794,23.467,87.467l0,0l9.472,5.461c-4.264,23.201-4.264,46.985,0,70.187l-9.472,5.461C27.158,314.296,16.686,353.38,34.283,384zM256,170.667c47.128,0,85.333,38.205,85.333,85.333S303.128,341.333,256,341.333S170.667,303.128,170.667,256S208.872,170.667,256,170.667z"/></svg></div>
                        </div>
                        <div className="linea"><span className="chip-est" style={{ background: 'rgba(6,214,160,.12)', color: '#06D6A0' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Pagado · $ 110.000</span><span className="accion" style={{ background: 'rgba(6,214,160,.15)', color: '#06D6A0' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Pagado</span></div>
                        <div className="iconos"><div style={{ background: '#F1EEF6', color: '#8E87A8' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m14,7.015V.474c.913.346,1.753.879,2.465,1.59l3.484,3.486c.712.711,1.245,1.551,1.591,2.464h-6.54c-.552,0-1-.449-1-1Zm7.976,3h-6.976c-1.654,0-3-1.346-3-3V.038c-.161-.011-.322-.024-.485-.024h-4.515C4.243.015,2,2.258,2,5.015v14c0,2.757,2.243,5,5,5h10c2.757,0,5-2.243,5-5v-8.515c0-.163-.013-.324-.024-.485Zm-6.269,8.506l-1.613,1.614c-.577.577-1.336.866-2.094.866s-1.517-.289-2.094-.866l-1.613-1.614c-.391-.391-.391-1.024,0-1.414.391-.391,1.023-.391,1.414,0l1.293,1.293v-4.398c0-.552.447-1,1-1s1,.448,1,1v4.398l1.293-1.293c.391-.391,1.023-.391,1.414,0,.391.39.391,1.023,0,1.414Z"/></svg></div><div style={{ background: 'rgba(6,214,160,.10)', color: '#0E7C57' }}><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8,0A5.006,5.006,0,0,0,3,5V23a1,1,0,0,0,1.564.825L6.67,22.386l2.106,1.439a1,1,0,0,0,1.13,0l2.1-1.439,2.1,1.439a1,1,0,0,0,1.131,0l2.1-1.438,2.1,1.437A1,1,0,0,0,21,23V5a5.006,5.006,0,0,0-5-5Zm6,14H8a1,1,0,0,1,0-2h6a1,1,0,0,1,0,2Zm3-5a1,1,0,0,1-1,1H8A1,1,0,0,1,8,8h8A1,1,0,0,1,17,9Z"/></svg></div><div style={{ background: '#FBECEC', color: '#EF476F' }}><svg viewBox="0 0 512 512" fill="currentColor" stroke="none"><path d="M448,85.333h-66.133C371.66,35.703,328.002,0.064,277.333,0h-42.667c-50.669,0.064-94.327,35.703-104.533,85.333H64 c-11.782,0-21.333,9.551-21.333,21.333S52.218,128,64,128h21.333v277.333C85.404,464.214,133.119,511.93,192,512h128 c58.881-0.07,106.596-47.786,106.667-106.667V128H448c11.782,0,21.333-9.551,21.333-21.333S459.782,85.333,448,85.333z M234.667,362.667c0,11.782-9.551,21.333-21.333,21.333C201.551,384,192,374.449,192,362.667v-128 c0-11.782,9.551-21.333,21.333-21.333c11.782,0,21.333,9.551,21.333,21.333V362.667z M320,362.667 c0,11.782-9.551,21.333-21.333,21.333c-11.782,0-21.333-9.551-21.333-21.333v-128c0-11.782,9.551-21.333,21.333-21.333 c11.782,0,21.333,9.551,21.333,21.333V362.667z M174.315,85.333c9.074-25.551,33.238-42.634,60.352-42.667h42.667 c27.114,0.033,51.278,17.116,60.352,42.667H174.315z"/></svg></div></div>
                      </article>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div></div>
        </div>
      </section>
    </div>
  );
}
