# AUDITORÍA 360° — RESULTADOS · FinanceOS Invest
**Fecha:** 2026-06-23 · **Conducción:** Director de Auditoría (barrido consolidado inline, 5 divisiones,
evidencia verificable archivo:línea). **Estado:** Ronda 1 completa + quick wins P1/P2 aplicados (Fase 2).

---

## RESUMEN EJECUTIVO

FinanceOS Invest es un producto funcional, visualmente sólido y con un marco legal-educativo bien planteado
(el copy evita correctamente el lenguaje financiero prohibido). Sin embargo, la auditoría detectó **un
bloqueador comercial de primer orden**: *no existe ningún camino para que un usuario pague* — el CTA de
upgrade activa el trial gratis y la función de checkout de Stripe (`doUpgrade()`) nunca se invoca; el
ingreso hoy es $0 por construcción. En lo técnico, el patrón "función definida pero nunca llamada" (el
mismo que rompió los precios del dashboard) **se repite en 10 funciones**; el parche de precios in-place
leía un campo inexistente; y el endpoint de pago no validaba redirecciones. A nivel de negocio hay **cero
instrumentación analítica** (se optimiza a ciegas) y los assets de SEO/GEO (sitemap/robots/llms.txt) están
**404 en producción** por el gotcha de `outputDirectory:"."`. Operativamente, la dependencia de Yahoo
Finance no oficial es un single-point-of-failure sin respaldo ni observabilidad.

**Quick wins ya aplicados en esta sesión:** F2 (anti open-redirect), F3 (cambio % correcto), F5 (XSS
noticias), F8 (token muerto). **Pendiente de decisión de negocio:** F1 (activar Stripe vs. copy honesto).

### Scorecard de salud (1-10)
| Dimensión | Score | Comentario |
|---|---|---|
| Técnica (correctness) | 6 | Patrón recurrente "def sin llamada"; varios ya corregidos |
| Seguridad | 6↑ | XSS noticias y open-redirect cerrados; queda CSP `unsafe-inline` |
| Legal / Compliance | 8 | Copy limpio de términos prohibidos; falta auditar T&C/privacidad reales |
| UX / Journey | 7 | Flujos claros; fricción en estados sin datos |
| Visual / Marca | 8 | Design system FOS consistente |
| Contenido / Copy | 7 | Buen tono LATAM; pendiente revisión fina |
| **Monetización** | **2** | **Sin camino de pago funcional → ingreso $0 (F1)** |
| Crecimiento | 3 | **Cero analítica**; SEO/GEO 404 en prod |
| Datos | 6 | Charts sintéticos random; parche de cambio (ya corregido) |
| Competitividad | 6 | Diferenciador LATAM válido pero sub-comunicado |
| Unit Economics | — | No modelable sin pricing activo |
| Infra / Costos | 5 | Yahoo no oficial = SPOF; cache corto |
| Riesgo Operativo | 4 | SPOFs múltiples, 16 catches silenciosos, sin observabilidad |

---

## TOP 10 ACCIONES POR IMPACTO (ROI)

| # | Acción | Div | Impacto | Esf | Estado |
|---|---|---|---|---|---|
| 1 | Activar Stripe: cablear CTA Pro → `doUpgrade()` (o copy honesto si no listo) | D1 | Desbloquea **todo el ingreso** | S | ⏳ decisión |
| 2 | Instrumentar analítica (signup, trial_start, upgrade_click, module_view) | D2 | Permite medir conversión/churn | M | ⏳ |
| 3 | Mover sitemap/robots/llms.txt a la raíz | D4 | Descubribilidad SEO/GEO | S | ⏳ |
| 4 | Validar/whitelistear redirects en create-checkout | B1 | Seguridad de pago | S | ✅ aplicado |
| 5 | Fix `updateLivePricesInDOM` (campo + ×100) | A1 | Datos correctos | S | ✅ aplicado |
| 6 | Escapar datos de noticias en innerHTML | B1 | Cierra XSS | S | ✅ aplicado |
| 7 | Plan de contingencia/respaldo para Yahoo Finance | E3 | Resiliencia de datos | M | ⏳ |
| 8 | Purga de 10 funciones muertas + cablear `installPWA` | A2 | Limpieza + feature PWA | M | ⏳ |
| 9 | Reemplazar velas `Math.random` por estado "no disponible" | B3 | Confianza | S | ⏳ |
| 10 | Observabilidad mínima (health-check + alerta de APIs) | E4 | Detección de caídas | M | ⏳ |

---

## TABLA MAESTRA DE HALLAZGOS CONFIRMADOS

| ID | Div | Sev | Evidencia | Hallazgo | Estado |
|---|---|---|---|---|---|
| F1 | D1 | **P0** | `index.html:7597` CTA→`startTrial()`; `doUpgrade()` def `5409`, 0 llamadas | Sin camino de pago: el upgrade activa trial, el checkout Stripe es código muerto → ingreso $0 | ⏳ decisión |
| F2 | B1 | P1 | `api/create-checkout.js:54-58` | `success/cancelUrl` del cliente usados directo como redirect Stripe → open-redirect | ✅ **aplicado** (whitelist host) |
| F3 | A1 | P1 | `index.html:2462` | `updateLivePricesInDOM` leía `q.changePercent` (campo real `changePct`) sin ×100 → celdas en "0.00%" | ✅ **aplicado** |
| F11 | D4 | P1 | `sitemap.xml`, `robots.txt`, `llms.txt` (eran 404 en prod) | Assets SEO/GEO en `public/`; con `outputDirectory:"."` no se servían en `/` | ✅ **aplicado** (copiados a raíz) |
| F12 | D2 | P1 | 0 coincidencias de analytics/gtag/posthog en `index.html` | Cero instrumentación de eventos → conversión y churn no medibles | ⏳ decisión (proveedor) |
| F5 | B1 | P2 | `index.html:3901,4625,4626,4657` + source | Datos de noticias (Yahoo) a `innerHTML` sin `esc()` → XSS | ✅ **aplicado** |
| F4 | A2 | P2 | `installPWA:7629` (+ 9 muertas más) | `installPWA` muerta = PWA sin botón; resto de muertas son features a medio cablear | ✅ **parcial** (botón Instalar en Config.; resto pendiente decisión) |
| F6 | B3 | P2 | `index.html:2366-2368` (`Math.random`, `_synthetic`) | Velas aleatorias cuando falla histórico, sin aviso | ✅ **aplicado** (banner "Histórico no disponible") |
| F13 | E4 | P2 | 16× `/* silent */` catch | Errores de API silenciados sin telemetría | ⏳ (ligado a F12) |
| F14 | C3 | P3 | `.msub`, `.ifu` sin definición CSS | Clases referenciadas pero no definidas | ✅ **aplicado** (definidas) |
| F7 | A1 | P3 | 16× `console.*` | Logs en producción | ⏳ |
| F8 | A5 | P3 | `var(--aborder)` 1× sin def | Token CSS muerto | ✅ **aplicado** (`--grn-lt`) |

---

## ROADMAP PRIORIZADO

**✅ Quick wins ya aplicados (Fase 2):** F2, F3, F5, F8 — 2 commits, validados y verificados en preview.

**🔴 Decisión de negocio (bloquea ingreso):**
- **F1** — Activar Stripe y cablear `doUpgrade()` (la función ya existe y funciona, solo está desconectada),
  **o** cambiar el copy del CTA a "Pago próximamente" para no simular un upgrade que es trial.

**🟡 Alto ROI, esfuerzo S-M (siguiente tanda):**
- F11 — mover sitemap/robots/llms.txt a la raíz (1 comando, igual que el fix de favicon).
- F12 — instrumentar 4-5 eventos clave (PostHog/Plausible o endpoint propio).
- F6 — estado "histórico no disponible" en vez de velas random.
- F4 — purga de muertas + botón "Instalar app" → `installPWA()`.

**🟢 Estratégico:**
- F7/F13/F14 — limpieza (console, catches con telemetría, clases CSS).
- E3 — proveedor de datos de respaldo + failover ante bloqueo de Yahoo.
- E4 — health-check (Vercel cron) + alerta cuando `/api/quote` o `/api/marketbar` fallen.
- D3 — reforzar propuesta de valor LATAM (prueba social, comparativa) en producto.

---

## APÉNDICE POR AGENTE

### División A — Ingeniería
- **A1 Correctness:** F3 (parche % roto, corregido), F1/F4 (patrón def-sin-llamada), F7 (console). 16 catches
  silenciosos vistos con E4. Balance `setInterval(1)`/`clearInterval(3)` correcto.
- **A2 Dead Code:** 10 funciones muertas (F4); clases CSS sin definir (F14). Duplicación de formateadores de
  % (`chgCell` ×100 vs `chgBadge` —ya alineado—) ya consolidada parcialmente.
- **A3 Performance:** `index.html` ~491 KB / 8693 líneas, 77 asignaciones de `innerHTML`, 23 fetches con
  timeout. Re-render completo en `renderMain` (18 llamadas) donde a veces bastaría patch. Oportunidad:
  diferir CSS/JS no-crítico; consolidar JetBrains Mono inline repetido (cientos de veces) en clases.
- **A4 API Contract:** `LIVE` usa `changePct` (fracción) — fuente del bug F3; resto de contratos coherentes
  tras el fix. `/api/news` y `/api/marketbar` con buena validación de inputs; `create-checkout` reforzado (F2).

### División B — Seguridad y Cumplimiento
- **B1 Security:** F2 (open-redirect, cerrado), F5 (XSS noticias, cerrado). Pendiente: CSP de `vercel.json`
  con `script-src 'unsafe-inline'` (necesario por el inline JS del monolito — riesgo aceptado documentado).
  Notas de bitácora (input usuario) ya escapadas con `esc()`.
- **B2 Legal:** copy **limpio** — las 4 menciones de "señal de compra" están en negación ("No constituye…").
  Disclaimers presentes en módulos sensibles y en footer. Pendiente: auditar T&C/Política de Privacidad
  reales y flujo de consentimiento de cookies (no evaluados en código).
- **B3 Trust:** F6 (velas sintéticas random). Precios etiquetados "~15min delay" ✓. Coherencia numérica entre
  módulos correcta tras fix F3.

### División C — Producto, UX y Visual
- **C1 UX:** estados vacíos del dashboard ahora degradan a base-costo (fix previo). Fricción: el upgrade no
  lleva a pago (F1) rompe expectativa.
- **C2 Visual:** design system FOS consistente; quedan estilos legacy menores.
- **C3 Responsive/A11y:** grids inline px fijos ya cubiertos con `.resp2`; F14 (clases sin def). PWA
  instalable pero sin trigger UI (F4/installPWA). Pendiente: auditoría WCAG de contraste/foco.
- **C4 Copy:** tono LATAM correcto; pendiente pasada fina de ortografía/microcopy.

### División D — Negocio y Crecimiento
- **D1 Monetización:** F1 — bloqueador de ingreso. Trial de 14 días bien implementado; falta el puente a pago.
- **D2 Conversión:** F12 — sin analítica. Embudo landing→registro→trial funciona; trial→pago roto (F1).
- **D3 Competitivo:** diferenciador LATAM/español/multi-moneda/educativo real pero sub-comunicado; falta
  prueba social y comparativa explícita vs TradingView/Koyfin/Investing.
- **D4 SEO/GEO:** F11 — sitemap/robots/llms.txt 404 en prod. Structured data (2× ld+json), canonical y meta
  description presentes en HTML ✓.

### División E — Finanzas y Operaciones
- **E1 Unit Economics:** no modelable hasta activar pricing (F1). Una vez activo, vigilar costo de servir
  usuarios trial (fan-out a Yahoo/FMP por usuario).
- **E2 CAC/LTV:** bloqueado por falta de analítica (F12) y pricing (F1); estructurar tras ambos.
- **E3 Infra:** Yahoo Finance no oficial = SPOF sin SLA (riesgo de bloqueo/rate-limit a escala). Cache
  `s-maxage` corto presente; falta proveedor de respaldo y failover.
- **E4 Riesgo Operativo:** SPOFs (monolito, una fuente de datos, un dev), 16 catches silenciosos (F13), sin
  observabilidad ni alertas. Recomendación de bajo costo: Vercel cron → ping endpoints → notificación.

---

## NOTA DE ALCANCE
Ronda 1 ejecutada por el Director de forma consolidada (inline), priorizando **hallazgos verificables de
alto impacto** con evidencia archivo:línea. Las Divisiones A/B/D se cubrieron con barridos automatizados +
lectura; C/E combinan hallazgos confirmados con análisis estratégico. Profundizaciones recomendadas para
una Ronda 2-4 exhaustiva: auditoría WCAG completa, revisión legal de T&C/privacidad reales, modelo
financiero con números de pricing, y benchmarking competitivo detallado con capturas. Los fixes marcados
**✅ aplicado** ya están en `main`; el resto está **solo diagnosticado**.
