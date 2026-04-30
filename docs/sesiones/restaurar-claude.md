# Guía de Restauración de Claude Code — VeloClub

Después de formatear el PC, sigue estos pasos en orden para dejar Claude Code
exactamente como estaba.

---

## 1. Instalar Claude Code

Descargar e instalar desde: https://claude.ai/download (versión desktop/CLI)

---

## 2. Skills (Plugins) instalados

Instalar en Claude Code → Settings → Plugins (o con `/install`):

| Plugin | Fuente | Descripción |
|--------|--------|-------------|
| `vercel-plugin` | `vercel` | Integración completa con Vercel (deploy, env vars, logs) |
| `superpowers` | `claude-plugins-official` | Skills avanzados: brainstorming, TDD, debugging, planes |
| `code-simplifier` | `claude-plugins-official` | Simplifica y refactoriza código |
| `frontend-design` | `claude-plugins-official` | Diseño de interfaces frontend |
| `context7` | `claude-plugins-official` | Documentación actualizada de librerías |
| `playwright` | `claude-plugins-official` | Automatización de navegador para testing |

**Cómo instalar:** En Claude Code, ejecutar:
```
/install vercel-plugin
/install superpowers
/install code-simplifier
/install frontend-design
/install context7
/install playwright
```

---

## 3. MCPs (Model Context Protocol) conectados

Estos MCPs estaban activos en las sesiones de VeloClub:

### 3.1 Railway (backend deploy)
- **Fuente:** Marketplace de Claude Code
- **Para qué:** Gestionar deploys, logs y variables del backend en Railway
- **Cómo instalar:** Claude Code → Settings → MCPs → buscar "Railway"

### 3.2 Vercel (frontend deploy)
- **Fuente:** Integrado con el plugin `vercel-plugin`
- **Para qué:** Deploys, env vars, logs del frontend en Vercel
- **Se instala automáticamente** con el plugin de Vercel

### 3.3 Neon (base de datos)
- **Fuente:** Marketplace de Claude Code
- **Para qué:** Gestionar base de datos PostgreSQL directamente desde Claude
- **Cómo instalar:** Claude Code → Settings → MCPs → buscar "Neon"

### 3.4 Claude.ai integrations (conectados vía claude.ai)
Estos se reconectan iniciando sesión en claude.ai:
- **Gmail** — lectura y gestión de correos
- **Google Calendar** — gestión de calendario
- **Google Drive** — acceso a archivos
- **Canva** — diseño gráfico
- **Notion** — notas y documentación
- **ClickUp** — gestión de tareas

### 3.5 Playwright (automatización de navegador)
- **Fuente:** Plugin `playwright@claude-plugins-official`
- **Se instala automáticamente** con el plugin de Playwright

---

## 4. Restaurar memoria del proyecto

Después de instalar todo, abrir Claude Code en la carpeta del proyecto y decir:

> **"Lee el archivo docs/sesiones/memoria-claude.md y restaura tu memoria del proyecto"**

Claude reconstruirá automáticamente el contexto del proyecto.

---

## 5. Verificar configuración

Después de instalar, verificar que funciona:
1. Abrir Claude Code en `VeloClub/`
2. Decir: `"¿Qué plugins y MCPs tienes activos?"`
3. Confirmar que aparecen Vercel, Railway, Neon y los skills

---

## 6. Lo que NO necesitas reinstalar

- ✅ Código del proyecto → está en GitHub
- ✅ Variables de entorno → están en Vercel y Render (no en tu PC)
- ✅ Base de datos → está en Render/Neon (no en tu PC)
- ✅ Claves de Clerk → están en Vercel Marketplace
- ✅ `.claude/settings.local.json` → está en el repo de GitHub

---

## 7. Primer paso al retomar el proyecto

La sesión quedó interrumpida en la **migración de Prisma**. Al retomar decir:

> **"Lee memoria-claude.md, tengo el proyecto restaurado, continuemos con la migración de Prisma y las secciones pendientes"**
