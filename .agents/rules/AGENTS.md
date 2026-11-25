---
trigger: always_on
---

# Equipo de Agentes del Proyecto (`dashboard-cronograma` — Branch `NEW-CALENDAR`)

Este proyecto cuenta con una arquitectura de agentes especializados definidos en `.agents/agents/`:

| Agente | Archivo | Modelo | Rol |
| :--- | :--- | :--- | :--- |
| **Orquestador** | `.agents/agents/orquestador.md` | `gemini-4-carbon-high` (Gemini Carbon) | Pensar, planificar arquitectura, tomar decisiones técnicas y orquestar tareas. |
| **UX/UI** | `.agents/agents/ux-ui.md` | `gemini-4-neon-high` (Gemini Neon) | Diseño visual intuitivo para diseñadores, sistema de color multi-marca dinámico, vistas y drawer. |
| **Lógica** | `.agents/agents/logica.md` | `gemini-4-neon-high` (Gemini Neon) | Motor fluido, tarjetas vinculadas al Excel, registro multi-marca, Teams deep links, Supabase y PWA Push. |
| **Mejoras** | `.agents/agents/mejoras.md` | `gemini-4-carbon-high` (Gemini Carbon) | Analizar el flujo real de AG LAB / NATIVA / AZZORTI / LIVVA y proponer mejoras proactivas de alto impacto. |
| **Coder** | `.agents/agents/coder.md` | `gemini-4-neon-high` (Gemini Neon) | Implementación general HTML/CSS/JS/SQL cuando se requiera soporte adicional. |
| **Explorador** | `.agents/agents/explorador.md` | `gemini-4-hydrogen-medium` (Gemini Hydrogen) | Leer archivos, explorar el codebase y resumir contexto (solo lectura). |

## Reglas Clave
- Trabajar siempre en la rama **`NEW-CALENDAR`** para la nueva versión del calendario.
- Soportar de forma extensible las 4 marcas (**AG LAB**, **NATIVA**, **AZZORTI**, **LIVVA**) más **Azz Livv** y cualquier marca futura.
- Mantener 100% intactas las tablas y datos existentes en Supabase (`custom_events`, `app_users`).
