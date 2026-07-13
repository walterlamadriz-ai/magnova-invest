# Prompt — Interior App Redesign con Lovable MCP

> **Cuándo usar:** Al inicio de la próxima sesión dedicada al rediseño interior del app.
> **Cómo ejecutar:** Pegar este contenido como primer mensaje en la nueva sesión de Claude Code.

---

## CONTEXTO DEL PROYECTO

Tenemos **FinanceOS Invest** desplegado en `https://invest.financeospro.com`.

- **Repo local:** `/Users/walterlamadriz/Documents/maxnova-invest/index.html`
- **Arquitectura:** Monolito HTML/CSS/JS — todo en un solo archivo (~8500 líneas). Sin React, sin bundler. Vainilla JS puro. Deploy vía GitHub → Vercel.
- **Lovable workspace ID:** `dStFMu7iNb7EH6lTtRTY`
- **Lovable proyecto Welcome (referencia):** `7b86ba91-22b6-4311-a7ec-9275587f2228`

---

## PALETA DE COLORES (modo oscuro — la que usamos)

```
--bg:     #0f1117    (fondo principal)
--bg2:    #161b24    (fondo secundario)
--card:   #1a2030    (cards)
--grn:    #3dbe7a    (verde primario)
--grn-bg: #0f2218    (verde fondo)
--amber:  #f59e0b    (amber/warning)
--bright: #e2e8f0    (texto principal)
--text:   #9ca8bc    (texto secundario)
--text2:  #6b7a8f    (texto terciario)
--text3:  #475569    (texto muted)
--border: rgba(255,255,255,0.07)
```

**Fonts:** Inter (body) + JetBrains Mono (números, tickers, scores, badges, monospace)

---

## MÓDULOS EXISTENTES (19 en total)

| ID | Nombre | Plan | Descripción |
|---|---|---|---|
| `news` | Market News | Free | Noticias de mercado por ticker |
| `dash` | Dashboard | Free | Vista general + portfolio + top signals |
| `port` | Portfolio | Free | Posiciones, P&L, asset allocation |
| `watch` | Watchlist | Free | Lista de seguimiento de activos |
| `sig` | Señales | Free | Top 20 activos por DE Score |
| `pb` | Pullback Score | Free | Scoring por pullback quality (0–100) |
| `comp` | Comparador | Free | Comparación técnica entre 2 activos |
| `radar` | Radar sectorial | Free | Rotación sectorial 22-day vs SPY |
| `decision` | Motor de Análisis | **Pro** | Régimen SPY + VIX + sector breadth |
| `ind` | Indicadores | **Pro** | RSI, MACD, BB, fundamentals por activo |
| `risk` | Riesgo | **Pro** | Position sizing, ATR, R/R |
| `back` | Simulación | **Pro** | SMA crossover backtest, equity curve |
| `screener` | Screener | **Pro** | Filtro técnico 50+ activos |
| `divs` | Dividendos | Free | Próximos dividendos + earnings |
| `rebal` | Rebalanceo | Free | Ajustes técnicos referenciales |
| `alert` | Alertas | Free | Alertas por precio o score |
| `bitacora` | Bitácora | Free | Diario de seguimiento técnico |
| `settings` | Configuración | Free | Cuenta, plan, preferencias |

---

## NAVEGACIÓN ACTUAL

La navegación usa `S.page` (variable global) + función `render()` que hace switch/case sobre el ID del módulo.

- **Nav desktop:** Barra lateral izquierda fija (`#sidebar`) con iconos + texto
- **Nav mobile:** Bottom bar con 5–6 iconos
- **Nav items:** news, dash, port, watch, sig, decision, settings
- **Pro badge:** Los módulos Pro muestran `🔒` en la nav y un paywall al intentar acceder sin suscripción

---

## ESTRUCTURA CSS RELEVANTE

Clases clave del shell actual:
```css
#sidebar       /* nav lateral izquierda, 200px width en desktop */
#sidebar-mini  /* nav lateral colapsada, 56px width */
#topbar        /* topbar en mobile */
#main          /* área de contenido principal */
.page-wrap     /* wrapper interno de cada módulo */
.card          /* card genérica */
.tbl           /* tabla estándar */
.btn, .btn-big /* botones */
.inp           /* inputs */
```

---

## QUÉ NO SE PUEDE TOCAR (restricciones de seguridad vigentes)

- ❌ Supabase auth: `sb`, `sbLoadUserData()`, `onAuthStateChange`, `showConsentGate()`, `CONSENT_GATE_ENABLED`
- ❌ `/api/` endpoints (solo read-only)
- ❌ Stripe, Vercel env vars, DNS
- ❌ Instalar dependencias externas
- ❌ Cambiar precios ni PLANS
- ❌ Lógica de `deScoreTicker()`, `deGetRegime()`, `deGetVIX()`, cálculos financieros
- ❌ Eliminar módulos, reescribir todo index.html desde cero, dividir en archivos
- ❌ Crear archivos .bak, borrar archivos completos
- ❌ Lenguaje financiero prohibido (señal compra/venta, entrada, stop sugerido, target, garantizado, etc.)

---

## TAREA PARA ESTA SESIÓN

### Objetivo
Usar **Lovable MCP** para diseñar visualmente el interior del app (post-login), y luego traducir el diseño aprobado al monolito.

### Fase A — Shell + Navegación
Crear un proyecto Lovable que represente el shell/nav del app con:

1. **Sidebar desktop** rediseñado:
   - Logo FinanceOS Invest arriba izquierda
   - Nav items con iconos SVG limpios (no emoji)
   - Módulos Free vs Pro diferenciados visualmente (badge verde vs lock)
   - Active state claro
   - Footer del sidebar: avatar/email del usuario + plan badge

2. **Topbar** con:
   - Régimen SPY en tiempo real (pill verde/rojo/amber)
   - VIX badge
   - Botón upgrade (solo en plan Free)

3. **Main content area** con grid sistema claro

4. **Mobile bottom nav** rediseñado (5 ítems principales)

### Fase B — Dashboard principal
Dentro del mismo proyecto Lovable, rediseñar el Dashboard (`dash`):

1. Portfolio summary card (P&L total, % cambio)
2. Top signals table (5 activos, DE Score, precio, cambio %)
3. Market context widget (SPY regime + VIX en formato compacto)
4. Quick actions (ir a screener, rebalanceo, bitácora)

### Fase C — Motor de Análisis (módulo estrella)
Rediseñar visualmente el Decision Engine (`decision`):

1. Régimen card con mini chart SPY
2. VIX card con semáforo visual
3. Sector rotation table
4. Market breadth gauge

---

## CÓMO EJECUTAR CON MCP

```
1. Usar mcp__f132d7d4-ad22-411c-89e5-9ef1ed77de2a__create_project
   - workspace_id: dStFMu7iNb7EH6lTtRTY
   - Describir la Fase A completa con colores, fonts y estructura exacta

2. Usar mcp__f132d7d4-ad22-411c-89e5-9ef1ed77de2a__get_project
   - Verificar screenshot del resultado

3. Iterar con mcp__f132d7d4-ad22-411c-89e5-9ef1ed77de2a__send_message
   - Refinar hasta aprobación de Walter

4. Una vez aprobado:
   - Leer archivos con mcp__f132d7d4-ad22-411c-89e5-9ef1ed77de2a__read_file
   - Traducir CSS y HTML al monolito (index.html)
   - Commit + push → Vercel deploy automático
```

---

## REFERENCIA DEL WELCOME SCREEN IMPLEMENTADO

El commit `c4f931d` (2026-06-19) implementó el nuevo welcome. Las clases `.wv3-*` son el modelo
de cómo deben ser las nuevas clases del interior — misma convención de naming.

---

## NOTAS IMPORTANTES

- El monolito tiene modo claro y oscuro. Todos los cambios deben respetar ambos temas via CSS variables.
- Cada módulo renderiza su contenido dentro de `document.getElementById('main').innerHTML = ...`
- El sidebar usa `S.page` para saber qué item está activo — cualquier nav activa `S.page = 'id'` y llama `render()`
- Los módulos Pro verifican `planOf().tier === 'pro'` antes de mostrar contenido
