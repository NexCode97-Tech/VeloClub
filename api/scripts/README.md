# Scripts de diagnóstico y reparación

Herramientas de consola para responder preguntas sobre producción y reparar
casos puntuales. **Se guardan solo las que responden una pregunta que vuelve** —
un script de un solo uso envejece mal y termina confundiendo a quien lo
encuentra, así que se borra cuando cumplió.

Casi todos son de **solo lectura**. Los que escriben lo dicen abajo y exigen
`--confirmar` para hacerlo: sin esa bandera muestran qué harían y no tocan nada.

## Conectarse a producción

```bash
# Base de datos (la URL interna de Railway no se alcanza desde local)
export DATABASE_URL="$(railway variables --service Postgres --kv | grep '^DATABASE_PUBLIC_URL=' | cut -d= -f2-)"
npx tsx scripts/<script>.ts

# Los que usan Mercado Pago o Clerk necesitan las llaves del servicio
railway run --service VeloClub -- npx tsx scripts/<script>.ts
```

## Pagos

| Script | La pregunta que responde |
|---|---|
| `pagos-mercadopago.ts` | ¿Qué le pasó a los pagos de este club? Detalle crudo de Mercado Pago: banco de PSE, tarjeta, motivo del rechazo. |
| `medios-de-pago.ts` | ¿Qué medios y qué bancos tenemos habilitados hoy? |
| `suscripciones-fantasma.mjs` | ¿Qué clubes tienen suscripción sin haber pagado nunca? |
| `estado-trials.mjs` | ¿A quién se le vence la prueba? |
| `revisar-club-trial-y-plan.ts` | ¿En qué va el plan de un club? |
| `promo-saldos.ts` | ¿Cuánto falta por registrar de los clubes de la promoción? Su primer trimestre se acordó en $180.000 y se pagó partido entre la plataforma y Bre-B; lo de Bre-B nunca entró al sistema. |

Los rechazos de pago ya no necesitan script: quedan en la bitácora y se ven en
el panel de superadmin. `pagos-mercadopago.ts` es la segunda opinión, para el
detalle que Mercado Pago guarda y nosotros no.

## Cuentas y permisos

| Script | La pregunta que responde |
|---|---|
| `roles-desalineados.ts` | ¿A quién no reconoce el sistema con el rol que le dio su club? |
| `cuenta-clerk.ts` | ¿Qué sabe Clerk de esta persona? Correo verificado, cuenta bloqueada, id muerto. |
| `revincular-miembro.ts` | **Escribe.** Repara a quien salió de `roles-desalineados`. |
| `auditar-emails-clerk.ts` | ¿Hay correos duplicados o sin verificar? |
| `revincular-usuarios-sin-club.mjs` | **Escribe.** Cuentas que quedaron sin club. |

Orden de uso cuando alguien "no puede entrar":
`roles-desalineados.ts <nombre>` → `cuenta-clerk.ts <correo>` → `revincular-miembro.ts`.

## Clubes y datos

| Script | La pregunta que responde |
|---|---|
| `verificar-clubes.ts` | ¿Qué clubes existen y en qué estado están? |
| `buscar-club.ts` | ¿Existe este club? |
| `rastro-clubes.ts` | ¿Qué pasó con un club que ya no aparece? |
| `consulta-sedes.ts` | ¿Qué sedes hay y quién está en cada una? |
| `fks-location.ts` | ¿Qué se lleva la base al borrar una sede? |
| `auditoria.ts` | La bitácora: quién cambió qué y cuándo. |
| `listar-publicaciones.ts` | ¿Qué se publicó en la comunidad? |
| `revisar-autores-sin-nombre.ts` | ¿Hay publicaciones sin autor legible? |
| `reparar-autores-sin-nombre.ts` | **Escribe.** Les pone el nombre. |
| `dar-dias-de-prueba.ts` | **Escribe.** Extiende la prueba de un club. |
| `promo-dos-meses.mjs` | **Escribe.** Aplicó la promoción de lanzamiento a los clubes que ya existían. |
