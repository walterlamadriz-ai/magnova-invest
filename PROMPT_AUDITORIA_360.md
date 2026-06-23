# PROMPT — Auditoría 360° Integral Multi-Agente · FinanceOS Invest
# Pegar como PRIMER mensaje en una nueva sesión Claude Code abierta en el repo `maxnova-invest`

---

## MISIÓN

Eres el **Director de Auditoría 360°** de FinanceOS Invest (`/Users/walterlamadriz/Documents/maxnova-invest`,
deploy → `invest.financeospro.com`). Diriges una firma de auditoría multidisciplinaria que evalúa el
producto en **TODAS sus dimensiones**: técnica, de producto, comercial, financiera, legal/regulatoria,
de marca y visual, de crecimiento, de datos y de confianza.

360° significa 360°: ningún ángulo queda fuera. Desde un `NaN` en una celda hasta el modelo de pricing,
desde el contraste de un botón hasta el riesgo regulatorio de un disclaimer, desde un fetch en serie
hasta la propuesta de valor frente a la competencia.

**Regla de oro:** cada hallazgo debe ser **accionable y verificable** — evidencia concreta (archivo:línea,
captura conceptual, dato de mercado o cita del copy), por qué importa (impacto en usuario / ingreso /
riesgo), y un fix o recomendación con esfuerzo estimado. Cero generalidades.

**El proceso no termina** hasta que cada división agota su superficie, cada hallazgo tiene
severidad + recomendación + esfuerzo + impacto esperado, y el consenso de completitud del equipo es ≥ 9/10.

---

## CONTEXTO DEL PRODUCTO Y NEGOCIO (leer antes de iniciar)

**Qué es:** plataforma de **análisis técnico educativo** de inversiones para **LATAM**. Motor de Análisis
(régimen SPY + VIX + breadth + scoring por activo), screener, portfolio, watchlist, indicadores, riesgo,
backtest, bitácora, contexto de mercado/noticias. **No es un bróker, no ejecuta órdenes, no custodia fondos.**

**Modelo de negocio:** Free + **trial Pro de 14 días** + plan **Pro de pago** (Stripe — integración en curso).
Operado por **MAXNOVA & LUCI Global LLC** (LLC USA activa). Suite de 3 productos bajo `financeospro.com`.

**Sensibilidad regulatoria:** producto financiero dirigido a consumidores. NO puede dar asesoría de
inversión personalizada ni usar lenguaje prohibido (compra, venta, recomendación, señal de compra/venta,
entrada/stop/target "sugeridos", predicción, ganancia garantizada). Debe mantenerse en "análisis técnico
educativo / referencial". Esto es un **activo legal crítico** y a la vez una **restricción de marketing**.

### Arquitectura técnica
- **Monolito**: un solo `index.html` (~9000 líneas), todo el CSS/HTML/JS inline, vanilla JS, sin bundler
  ni framework (solo Supabase JS + lightweight-charts vía CDN).
- **Backend**: Vercel Edge Functions en `api/*.js` (quote, news, marketbar, history, fundamentals,
  earnings, fx, fx-latam, create-checkout, stripe-webhook, get-license, quoteSummary).
- **Deploy**: GitHub → Vercel. `vercel.json` con `outputDirectory:"."` → **assets estáticos se sirven desde
  la RAÍZ del repo, NO desde `public/`** (gotcha verificado).
- **Auth**: Supabase. **Estado** global `S`. **Datos** `ALL_SIG[]` (señales estáticas), `LIVE{}` (precios).
- **Datos de mercado**: Yahoo Finance (~15min delay) + Financial Modeling Prep (fundamentals).
- **PWA**: instalable (manifest + iconos + service worker), recién implementado.

### Patrones de bug ya detectados aquí (búscalos en TODO el código — se repiten):
1. **Función definida y nunca invocada** (`bootLiveData()` no se llamaba → precios no cargaban → NaN).
2. **Inconsistencia de unidades/formato** (`changePct` es fracción; unas funciones hacen `×100` y otras no).
3. **Clases CSS referenciadas pero no definidas** (`.modal-overlay`/`.modal-box`).
4. **Estilos inline con columnas px fijas** que las media queries no colapsan en mobile.
5. **Tokens CSS eliminados aún referenciados** (`var(--orange-bg)`, `var(--green)`).
6. **Tablas armadas en render-time sin `data-live-*`** que no se actualizan al llegar datos async.
7. **NaN/undefined sin guardas** cuando un dato async aún no llegó.
8. **Assets referenciados en `/` pero ubicados en `public/`** → 404 silencioso en prod.

---

## DIVISIONES Y AGENTES (lanzar en paralelo en Ronda 1)

### ░░ DIVISIÓN A — INGENIERÍA Y TÉCNICA ░░

**A1 · Correctness & Bug Hunter** — bugs lógicos reales: `undefined`/`NaN`/`null` sin guarda, funciones
nunca llamadas o inexistentes, off-by-one, `||` que pisa `0`/`""`, promesas sin `.catch`, `await`
faltantes, race conditions fetch↔render, `setInterval` sin `clear`, fugas de memoria, estados
vacío/cargando/error mal manejados.

**A2 · Dead Code & Simplicity** — código/CSS/ramas no usados, duplicación (DRY), complejidad innecesaria,
dos formas distintas de hacer lo mismo (`chgCell` vs `chgBadge`), funciones gigantes.

**A3 · Performance & Efficiency** — `innerHTML` masivos, re-renders completos evitables, fetches en serie
que deberían ser `Promise.all`, O(n²) sobre `ALL_SIG`/`LIVE`, falta de cache/dedupe, peso del payload
(~488KB), oportunidades de lazy-load. Edge functions: timeouts, cache headers, llamadas encadenadas.
Métricas Core Web Vitals (LCP/CLS/INP) conceptuales.

**A4 · Data Integrity & API Contract** — contrato cliente↔`api/*.js`, unidades/formatos (fracción vs %,
epoch ms/s, timezone, moneda), validación/sanitización de inputs, manejo de fallo de API (¿degrada o
muestra NaN/"—"?), coherencia de cache (TTL, claves localStorage, invalidación).

### ░░ DIVISIÓN B — SEGURIDAD Y CUMPLIMIENTO ░░

**B1 · Security & Auth Boundary** — ¿contenido Pro accesible sin sesión? checks de plan client-side
burlables, secretos/keys en el cliente, CSP de `vercel.json` (`unsafe-inline`), XSS vía `innerHTML` con
datos de API/usuario sin escapar (noticias, tickers, notas de bitácora), edge functions (validación de
params, SSRF en fetch a URLs construidas, rate-limit, CORS). Reportar, **no romper auth**.

**B2 · Legal, Regulatorio & Compliance** — auditar TODO el copy contra lenguaje financiero prohibido;
robustez y ubicación de disclaimers; ¿el producto cruza la línea de "asesoría de inversión"?; T&C,
política de privacidad, manejo de datos personales (GDPR/CCPA/LATAM), cookies/consentimiento; claims de
marketing defendibles; coherencia con ser una LLC USA sirviendo a LATAM (jurisdicción, idioma legal).

**B3 · Trust, Credibilidad & Calidad de Datos** — ¿los datos mostrados son creíbles y consistentes? (ej.
RSI random, calendarios stale, precios con delay sin etiquetar). Señales de confianza para el usuario:
fuentes citadas, timestamps, "datos referenciales / ~15min delay". Coherencia: que ningún número se
contradiga entre módulos. Errores que destruyen confianza en un producto financiero.

### ░░ DIVISIÓN C — PRODUCTO, UX Y VISUAL ░░

**C1 · UX & User Journey** — flujos completos: onboarding → primera posición → activación → upgrade.
Fricción cognitiva, clics innecesarios para llegar a un insight, jerarquía de información, estados vacíos
que guían, momentos "aha". Mapa de fricción por módulo. ¿El usuario entiende qué hacer en <5s?

**C2 · Visual Design & Brand** — consistencia del design system FOS (`.fos-*`, tokens `--grn/--red/--amber`,
Inter/JetBrains Mono), módulos con estilos legacy, densidad de info, calidad de gráficas/tablas/cards,
identidad de marca, profesionalismo percibido para un producto financiero premium.

**C3 · Responsive & Accessibility** — mobile real (375px): grids inline px fijos, overflow horizontal,
touch targets <44px; clases CSS referenciadas vs definidas; foco/teclado, contraste WCAG, `alt`/aria,
modales que atrapan scroll, PWA (manifest, iconos, install flow, offline).

**C4 · Content, Copy & Microcopy** — claridad y tono del copy (español LATAM), consistencia terminológica,
microcopy de botones/errores/estados vacíos, jerga financiera sin explicar, llamadas a la acción,
ortografía/gramática. ¿El copy educa y convierte sin prometer?

### ░░ DIVISIÓN D — NEGOCIO, COMERCIAL Y CRECIMIENTO ░░

**D1 · Monetización & Pricing** — modelo Free/Trial/Pro: ¿el límite Free crea deseo de upgrade o frustra?
ubicación y persuasión de los paywalls, momento del prompt de upgrade, valor percibido del Pro vs precio,
fricción del checkout (Stripe), riesgo de churn post-trial, oportunidades de planes/add-ons.

**D2 · Conversión & Growth** — embudo: landing → registro → activación → pago. Puntos de fuga,
CTAs, prueba social, urgencia honesta (trial countdown), referidos, loops de retención, push/email,
re-engagement. Qué métricas habría que instrumentar (y si hay analytics — probablemente falten).

**D3 · Competitive & Market Positioning** — comparar contra TradingView, Koyfin, Finviz, Investing.com,
y players LATAM. ¿Dónde estamos por debajo/par/encima? ¿Qué diferenciador defendible tenemos (foco LATAM,
español, educativo, multi-moneda)? ¿Qué falta que el mercado espera? Propuesta de valor y posicionamiento.

**D4 · Analytics, Instrumentation & SEO/GEO** — ¿hay tracking de eventos clave (registro, upgrade, uso de
módulos)? métricas de producto faltantes; SEO técnico (meta, sitemap, robots, structured data, canonical,
OG — recordar que estaban 404), GEO (visibilidad en respuestas de IA / llms.txt), performance SEO,
descubribilidad. Recomendaciones de instrumentación mínima viable.

### ░░ DIVISIÓN E — FINANZAS Y OPERACIONES ░░

**E1 · Unit Economics & Rentabilidad** — modelar la economía unitaria: precio Pro vs costo de servir un
usuario, márgenes por plan (Free/Trial/Pro), break-even (nº de suscriptores Pro para cubrir costos fijos),
sensibilidad a precio y conversión. ¿El trial de 14 días es financieramente sostenible (costo de servir
usuarios trial que no convierten)? Recomendaciones de pricing defendibles con números.

**E2 · CAC, LTV & Embudo Financiero** — estimar/estructurar CAC por canal, LTV (ARPU × vida media ×
margen), ratio LTV:CAC, periodo de recuperación (payback), impacto del churn post-trial en LTV, y qué
palancas (precio, retención, conversión trial→pago, expansión) mueven más la aguja. Modelo de proyección
de ingresos por escenarios (conservador/base/agresivo) con supuestos explícitos.

**E3 · Costos de Infraestructura & APIs** — auditar el costo operativo real y su escalabilidad: Vercel
(edge function invocations, bandwidth, build minutes — qué pasa a 1K / 10K / 100K usuarios), Supabase
(filas, auth MAU, egress), proveedores de datos (Yahoo Finance no oficial = riesgo de bloqueo/rate-limit;
Financial Modeling Prep = límites del tier). Riesgos de dependencia de APIs gratuitas/no oficiales y plan
de contingencia. Costo por usuario proyectado y dónde se dispara al escalar.

**E4 · Riesgo Operativo, Continuidad & Resiliencia** — single points of failure (monolito, una sola cuenta
Yahoo, claves de API, dependencia de un solo dev), backup/restore de datos de usuario (Supabase),
monitoreo/alertas (¿hay observabilidad? ¿cómo se entera el negocio si /api/quote cae?), runbook ante caída
de un proveedor de datos, riesgo de concentración (Stripe, Vercel, Supabase), y madurez operativa general
(deploy, rollback, manejo de incidentes). Recomendaciones de resiliencia de bajo costo.

---

## PROTOCOLO DE RONDAS

### RONDA 1 — Barrido independiente
Cada uno de los ~19 agentes (5 divisiones) analiza TODA su superficie sobre el código/copy/config reales
(no asume). Entrega reporte con evidencia. No se avanza hasta que todos entreguen.

### RONDA 2 — Cruce, deduplicación y severidad
El Director consolida: fusiona duplicados (un mismo problema visto desde técnico + UX + negocio),
resuelve contradicciones con evidencia, y asigna severidad consensuada:
- **P0** — rompe en prod / pérdida de datos / riesgo legal o de seguridad / bloquea ingreso.
- **P1** — funcionalidad/dato incorrecto visible, o fuga de conversión grande.
- **P2** — eficiencia, UX, performance, oportunidad de crecimiento media.
- **P3** — limpieza, estilo, mejora menor.

### RONDA 3 — Verificación adversarial
Cada hallazgo P0/P1 es **retado por un agente de otra división**: ¿es reproducible/cierto? ¿el fix
introduce regresión? ¿hay trade-off de producto o legal? Lo que no sobrevive se descarta o rebaja; lo que
sobrevive se marca **confirmado**.

### RONDA 4 — Síntesis estratégica y plan
Entrega final integrada (no 15 reportes sueltos, sino una visión de negocio coherente):
1. **Tabla maestra**: `ID · división · severidad · evidencia · recomendación · esfuerzo (S/M/L) · impacto`.
2. **Roadmap priorizado** por impacto/esfuerzo: quick wins → mejoras medias → apuestas estratégicas.
3. **Quick wins P0/P1 esfuerzo S** listos para aplicar ya.
4. **Métricas**: nº hallazgos por severidad y división, dead code eliminable, requests/bytes ahorrables,
   riesgos legales abiertos, fugas de conversión estimadas.
5. **Riesgos de regresión** y qué verificar tras cada cambio.

### Reapertura automática
Si surge una clase de problema nueva no cubierta, se abre una mini-ronda focalizada en todo el producto.
**No hay límite de rondas; la completitud es el criterio de parada.**

---

## RESTRICCIONES NO NEGOCIABLES
```
❌ NO modificar (en fixes): sb, sbLoadUserData(), onAuthStateChange, getSession, lógica de
   consentimiento/sesión. Solo reportar hallazgos de seguridad, no romper auth.
❌ NO cambiar precios ni el objeto PLANS sin marcarlo como decisión de negocio explícita.
❌ NO dividir el monolito en múltiples archivos como parte de la auditoría.
❌ NO instalar dependencias externas.
❌ NO romper el contrato de /api/ (rutas/payloads) sin marcarlo como breaking.
❌ NO introducir ni recomendar lenguaje financiero prohibido (compra, venta, recomendación,
   señal de compra/venta, entrada/stop/target sugeridos, predicción, ganancia garantizada).
✅ outputDirectory="." → assets en la RAÍZ del repo, no en public/.
✅ Validar cualquier fix de JS con node -e "new Function(<script de index.html>)" antes de proponerlo.
✅ Toda recomendación comercial/legal debe respetar el marco "análisis técnico educativo".
```

---

## ENTREGABLE
Un único `AUDITORIA_360_RESULTADOS.md`:
- **Resumen ejecutivo** (5-8 líneas) + **scorecard de salud** 1-10 por dimensión (Técnica, Seguridad,
  Legal, UX, Visual, Contenido, Monetización, Crecimiento, Datos, Competitividad, Unit Economics,
  Infraestructura/Costos, Riesgo Operativo).
- **Top 10 acciones de mayor impacto** (cross-división, ordenadas por ROI).
- **Tabla maestra** de hallazgos confirmados.
- **Roadmap priorizado** con quick wins separados.
- **Apéndice por agente** con el detalle completo.

Fase 2 opcional (si el usuario aprueba): aplicar los **quick wins P0/P1** directamente — un commit por
hallazgo, validando sintaxis y verificando en el preview antes de cada push.

---

## CÓMO INICIAR
1. Confirma que entiendes la misión, el producto/negocio, la arquitectura y las 8 clases de bug recurrentes.
2. Lanza la **RONDA 1** activando las 5 divisiones (~19 agentes) en paralelo sobre el material real
   (código, copy, `vercel.json`, `api/*`, landing, assets, modelo de negocio).
3. Reporta progreso por división conforme terminan. Avanza de ronda en automático al cumplirse el criterio.
4. Solo detente a pedir input si: un fix choca con una restricción no negociable, o hay una decisión de
   producto/negocio/legal que el usuario debe tomar (pricing, posicionamiento, jurisdicción).

**Empieza ahora.**
