# PROMPT — Ejecución de Auditoría Visual · FinanceOS Invest
# Nueva sesión · Ejecutar fases en orden · Verificar después de cada una

---

## CONTEXTO DE ESTA SESIÓN

Venimos de una auditoría multi-agente completa de los 19 módulos de FinanceOS Invest.
El plan de ejecución ya fue aprobado. Esta sesión ejecuta los cambios en el orden definido.

**Archivo a modificar:** `/Users/walterlamadriz/Documents/maxnova-invest/index.html`
**Deploy:** git commit + git push → GitHub → Vercel → `invest.financeospro.com`
**Regla de oro:** Verificar que el monolito no tiene errores de JS después de CADA fase antes de continuar.

---

## RESTRICCIONES NO NEGOCIABLES (leer antes de tocar el código)

```
❌ NO tocar: sb, sbLoadUserData(), onAuthStateChange, showConsentGate(), CONSENT_GATE_ENABLED
❌ NO tocar: /api/ endpoints (no cambiar rutas ni payloads)
❌ NO cambiar precios ni objeto PLANS
❌ NO dividir el monolito en múltiples archivos
❌ NO instalar dependencias externas
❌ NO usar lenguaje financiero prohibido: compra, venta, recomendación, señal de compra/venta,
   entrada sugerida, stop sugerido, target de salida, predicción, ganancia garantizada
❌ NO tocar funciones: deScoreTicker(), deGetRegime(), deGetVIX(), deGetBreadth()
```

---

## SISTEMA DE DISEÑO CANÓNICO (usar en todos los cambios)

### Tokens correctos
```css
--bg:     #0f1117   /* fondo principal */
--bg2:    #161b24   /* sidebar + topbar */
--card:   #1a2030   /* cards */
--card2:  #1e2636   /* hover / elementos secundarios */
--grn:    #3dbe7a   /* verde primario */
--grn-bg: #0f2218   /* verde fondo */
--amber:  #f59e0b   /* neutral/warning */
--red:    #f87171   /* negativo */
--bright: #e2e8f0   /* texto principal */
--text:   #9ca8bc   /* texto secundario */
--text2:  #6b7a8f   /* texto terciario */
--text3:  #475569   /* texto muted */
--border: rgba(255,255,255,0.07)
```

### NUNCA usar estos tokens legacy (reemplazar donde aparezcan)
```
var(--green)   → var(--grn)
var(--orange)  → var(--amber)
var(--white)   → var(--bright)
'Share Tech Mono' → 'JetBrains Mono'
```

### Clases primitivas del sistema
```
.fos-card          — card container, border-radius:12px
.fos-section-label — JetBrains Mono, 9px, 600, 1.5px spacing, uppercase, var(--text3)
.fos-table         — tabla con hover states
.fos-score         — circle 30px para scores
.fos-score--g/a/r  — verde ≥70 / amber ≥50 / rojo <50
.fos-pill          — badge redondeado
.fos-pill--grn/amb/red
.fos-pro-badge     — badge PRO verde 8px
.dash-kpi-card     — KPI cards del dashboard
```

### Patrón de header (NUNCA usar .ph + h1 en módulos nuevos)
El título del módulo vive en el topbar. Los módulos NO generan su propio header.
Referencia: ver cómo renderDash() usa `.dash-wrap` directamente sin ningún `.ph`.

---

## FASE A — FIXES CRÍTICOS DE CREDIBILIDAD
### "Antes de tocar cualquier cosa, estos 4 fixes son obligatorios"

---

### A1. Eliminar RSI aleatorio en `renderInd()` — línea ~4722

**Problema:** `var rsiE=Math.floor(45+Math.random()*30);` genera un RSI distinto en cada render.
Un usuario Pro que nota que el RSI cambia al recargar pierde confianza en todo el producto.

**Fix exacto:**
```javascript
// ANTES:
var rsiE=Math.floor(45+Math.random()*30);
var sma20E=(lp*0.975).toFixed(2);

// DESPUÉS:
var rsiE='—';
var sma20E='—';
```

Y en la celda de la tabla que colorea el RSI:
```javascript
// ANTES:
'<td style="color:'+(rsiE>70?"var(--red)":rsiE<30?"var(--green)":"var(--orange)")+'">'+rsiE+'</td>'+
'<td style="color:'+(lp>parseFloat(sma20E)?"var(--green)":"var(--red)")+'">$'+sma20E+' '+(lp>parseFloat(sma20E)?"↑":"↓")+'</td>'+

// DESPUÉS:
'<td style="color:var(--text3);font-family:\'JetBrains Mono\',monospace">'+rsiE+'</td>'+
'<td style="color:var(--text3);font-family:\'JetBrains Mono\',monospace">'+sma20E+'</td>'+
```

Cambiar el header de columna de "RSI est." → "RSI" y "SMA20 est." → "SMA20".
Agregar nota debajo de la tabla:
```javascript
'<div style="margin-top:8px;font-size:10px;color:var(--text3);font-family:\'JetBrains Mono\',monospace">'+
'💡 Indicadores reales disponibles en el gráfico — click en cualquier ticker para abrir el análisis completo.'+
'</div>'
```

---

### A2. Eliminar placeholder "próximamente" en `renderBack()` — línea ~4869

**Problema:** Texto "vs SPY próximamente" visible en producción como feature no implementada.

**Fix:** Buscar en `renderBack()` cualquier texto que contenga "próximamente" o "coming soon" y eliminarlo. Si hay un widget o card de comparación vs SPY no implementada, eliminar esa sección completa.

---

### A3. Ocultar calendario hardcodeado en `renderNews()` — línea ~4665

**Problema:** El calendario económico dice "Semana 5-9 Mayo 2026" y estamos en junio 2026+.

**Fix exacto:** Localizar la constante `CAL_DATA` (array de eventos del calendario). Agregar una función que valide si los datos son actuales:
```javascript
function isCalDataFresh(){
  // CAL_DATA tiene fechas como "Lun 5" — si no hay una constante de fecha absoluta,
  // simplemente ocultar el widget del calendario económico en el sidebar de news
  return false; // mientras no haya integración con API de calendario real
}
```

En `renderNews()`, envolver el bloque del Calendario Económico con un condicional:
```javascript
// Reemplazar el bloque completo del widget calendario por:
(isCalDataFresh() ? '...' : '')
// Esto oculta el calendario hasta que haya datos reales
```

Alternativamente si CAL_DATA tiene fecha embebida, verificar si es anterior a hoy y ocultar si es stale.

---

### A4. Agregar banner de limitación en `renderAlert()` — línea ~5099

**Problema:** El usuario configura alertas que solo se activan si el tab está abierto, sin saberlo.

**Fix:** Agregar al inicio del HTML que genera `renderAlert()`, después del header:
```javascript
'<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">'+
'<span style="font-size:16px;flex-shrink:0">⚠️</span>'+
'<div style="font-size:11px;color:var(--amber);line-height:1.6">'+
'<b>Las alertas solo se activan mientras esta pestaña está abierta en tu navegador.</b> '+
'Si cierras la app, las alertas no se dispararán. Para alertas permanentes, configura niveles de precio en tu broker.'+
'</div></div>'
```

---

### VERIFICACIÓN FASE A
Después de estos 4 cambios: `git add index.html && git commit -m "fix: credibilidad A1-A4 — RSI random, placeholder back, calendario stale, alert disclaimer"`. Luego revisar en browser que:
- El módulo Indicadores muestra "—" en RSI y SMA20 con nota informativa
- El módulo Simulación no tiene textos "próximamente"
- El módulo Noticias no muestra el calendario desactualizado
- El módulo Alertas muestra el banner de advertencia

---

## FASE B — CONSOLIDACIONES DE NAVEGACIÓN
### "Reduce de 19 a 13 módulos en el nav"

---

### B1. Eliminar módulo `comp` (Comparador)

**Pasos:**
1. En `renderSidebar()`: eliminar el item de navegación del Comparador del array PAGES o de la lista de items del sidebar
2. En `renderMain()` (o el switch de páginas): eliminar el `case 'comp':` que llama a `renderComp()`
3. La función `renderComp()` puede dejarse en el código comentada o eliminarse
4. Si algún botón en otro módulo apunta a `setPage('comp')`: redirigir a `setPage('screener')`

---

### B2. Absorber `sig` (Señales) en `screener` (Screener)

**Objetivo:** El usuario que navega a "Señales" va al Screener en tab "Señales".

**Pasos:**

**En el sidebar/nav:** Cambiar el item "Señales" para que llame `setPage('screener')` con un parámetro de tab, O simplemente apuntar `setPage('sig')` a `setPage('screener')`:
```javascript
// En setPage(), agregar al inicio:
function setPage(p){
  if(p==='sig'){p='screener';S.screenerTab='signals';} // redirect
  // ... resto del código
}
```

**En `renderScreener()`:** Agregar sistema de tabs al inicio:
```javascript
// Agregar variable de tab activo en S (state):
// S.screenerTab = 'signals' | 'custom'   (default: 'signals')

// Al inicio del HTML de renderScreener(), agregar:
'<div style="display:flex;gap:0;margin-bottom:16px;border-bottom:1px solid var(--border)">'+
'<button onclick="S.screenerTab=\'signals\';renderMain()" style="padding:8px 18px;background:transparent;border:none;border-bottom:2px solid '+(S.screenerTab!=='custom'?'var(--grn)':'transparent')+';color:'+(S.screenerTab!=='custom'?'var(--grn)':'var(--text3)')+';font-size:11px;font-weight:600;cursor:pointer;font-family:\'JetBrains Mono\',monospace">Señales</button>'+
'<button onclick="S.screenerTab=\'custom\';renderMain()" style="padding:8px 18px;background:transparent;border:none;border-bottom:2px solid '+(S.screenerTab==='custom'?'var(--grn)':'transparent')+';color:'+(S.screenerTab==='custom'?'var(--grn)':'var(--text3)')+';font-size:11px;font-weight:600;cursor:pointer;font-family:\'JetBrains Mono\',monospace">Personalizado</button>'+
'</div>'
```

**Tab "Señales":** Si `S.screenerTab !== 'custom'`, renderizar el contenido actual de `renderSig()` dentro de `renderScreener()`:
- Los filtros BUY/HOLD/SELL se muestran
- La tabla de ALL_SIG se muestra
- Sin el header `.ph` (el topbar ya muestra "Screener")

**Tab "Personalizado":** El screener actual, sin cambios.

**Agregar al state S** (busca la inicialización de S y agregar): `screenerTab:'signals'`

---

### B3. Mover `rebal` (Rebalanceo) a un modal dentro de Portfolio

**Pasos:**

1. En `renderSidebar()`: Eliminar el item "Rebalanceo" de la lista de navegación SEGUIMIENTO
2. En `renderPort()`: Agregar botón "↺ Sugerir Rebalanceo" a la fila de botones de acción:
```javascript
'<button class="btn" onclick="openModal(\'rebal\')">↺ Sugerir Rebalanceo</button>'
```
3. En `renderModal()` (o la función que maneja modales): Agregar case `'rebal'` que renderiza el contenido actual de `renderRebal()` dentro del modal overlay existente
4. En `renderMain()`: Eliminar `case 'rebal':` del switch de páginas (o dejar como fallback que hace `setPage('port')`)

---

### B4. Mover `divs` (Dividendos) al Motor de Análisis

**Pasos:**

1. En `renderSidebar()`: Eliminar el item "Dividendos" de SEGUIMIENTO
2. En `renderDecisionEngine()`: Después del bloque `earningsCard`, agregar una nueva sección de dividendos. El contenido actual de `renderDivs()` se renderiza como sección colapsable:
```javascript
// Después de earningsCard, agregar:
var divsCard='<div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:16px">'+
  '<div style="font-size:10px;font-family:\'JetBrains Mono\',monospace;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin-bottom:10px">💰 Dividendos próximos</div>'+
  // ... contenido de renderDivs() aquí (sin el header .ph) ...
  '</div>';
```
3. En `renderMain()`: Eliminar `case 'divs':` o redirigir a `decision`

---

### B5. Absorber `pb` (Position Builder) en `risk` (Riesgo)

**Pasos:**

1. En `renderSidebar()`: Eliminar "Position Builder" de HERRAMIENTAS
2. En `renderRisk()`: Agregar sistema de tabs idéntico al del Screener (B2):
   - Tab "Portfolio": contenido actual de renderRisk()
   - Tab "Nueva Posición": contenido actual de renderPB() sin el header
3. Agregar a S: `riskTab:'portfolio'`
4. En `renderDecisionEngine()`: Por cada ticker en la lista de scores, el botón de acción "→ Calcular sizing" hace:
```javascript
onclick="S.riskTab=\'position\';S.riskPrefill={ticker:'"+s.ticker+"',price:"+s.last+"};setPage('risk')"
```
5. En `renderRisk()` tab "Nueva Posición": si `S.riskPrefill` existe, pre-llenar los inputs con esos valores y luego limpiar el prefill.
6. En `renderMain()`: Eliminar `case 'pb':` o redirigir a `setPage('risk')`

---

### VERIFICACIÓN FASE B
Commit: `"refactor: nav consolidation B1-B5 — eliminar comp, sig→screener, rebal→port modal, divs→decision, pb→risk"`

Verificar:
- Sidebar muestra 13 items en total (contar)
- `setPage('sig')` y `setPage('comp')` redirigen correctamente
- La tab "Señales" del Screener muestra ALL_SIG correctamente
- El botón "Sugerir Rebalanceo" en Portfolio abre el modal
- El Motor de Análisis muestra sección de dividendos
- Risk tiene tabs Portfolio / Nueva Posición

---

## FASE C — MIGRACIÓN VISUAL AL SISTEMA NUEVO
### "Eliminar todos los vestigios del sistema legacy"

---

### C1. Reemplazo global de tokens y fuentes

Hacer estas sustituciones en todo el archivo `index.html`:

```
var(--green)  →  var(--grn)          [verificar ~40 ocurrencias]
var(--orange) →  var(--amber)        [verificar ~30 ocurrencias]
var(--white)  →  var(--bright)       [verificar ~20 ocurrencias]
'Share Tech Mono' → 'JetBrains Mono' [verificar ~15 ocurrencias]
```

**CUIDADO:** Hacer sustitución solo en strings de HTML/JS, NO en definiciones CSS `--green` o `--orange` si existen (mantener las definiciones CSS por compatibilidad con código no migrado durante la transición).

---

### C2. Migrar `renderPort()` al nuevo sistema visual

**Cambios específicos:**

**Eliminar:** `'<div class="ph"><div><h1>Portfolio Manager</h1>...'` — el topbar ya muestra el título

**Reemplazar KPI row** (`.krow` con funciones `kpi()`) por `.dash-kpi-card`:
```javascript
'<div class="dash-kpi" style="margin-bottom:20px">'+
'<div class="dash-kpi-card"><div class="dash-kpi-label">Capital</div><div class="dash-kpi-val">'+D(S.capital)+'</div><div class="dash-kpi-sub" style="color:var(--text3)">declarado</div></div>'+
'<div class="dash-kpi-card"><div class="dash-kpi-label">Valor Mercado</div><div class="dash-kpi-val">'+D(totM)+'</div>'+(USER_CURRENCY!=='USD'?'<div class="dash-kpi-sub" style="color:var(--text3)">'+fxConvert(totM)+'</div>':'')+' </div>'+
'<div class="dash-kpi-card"><div class="dash-kpi-label">Cash</div><div class="dash-kpi-val">'+D(S.capital-totC)+'</div><div class="dash-kpi-sub" style="color:var(--text3)">disponible</div></div>'+
'<div class="dash-kpi-card"><div class="dash-kpi-label">P&amp;L</div><div class="dash-kpi-val" style="color:'+(totP>=0?'var(--grn)':'var(--red)')+'">'+(totP>=0?'+':'')+D(totP)+'</div><div class="dash-kpi-sub" style="color:'+(totP>=0?'var(--grn)':'var(--red)')+'">'+pct(totP/(totC||1))+'</div></div>'+
'</div>'
```

**Reemplazar tabla** de la clase legacy a `.fos-table`:
```javascript
// Cambiar: '<div class="tw"><table id="tbl-port"><thead>'
// Por:     '<div class="tw"><table class="fos-table" id="tbl-port"><thead>'
```

**Agregar `.fos-section-label`** antes de la tabla:
```javascript
'<div class="fos-section-label" style="margin-bottom:10px">Posiciones</div>'
```

**Envolver en `.fos-card`** la tabla y la sección de capital:
```javascript
'<div class="fos-card">'+ [tabla completa] +'</div>'
```

**Selector de moneda:** Moverlo al topbar (dentro de `renderTopbar()` como elemento extra cuando la página activa es 'port') o mantenerlo pero con estilo nuevo.

---

### C3. Migrar `renderWatch()` al nuevo sistema visual

Mismos pasos que C2:
- Eliminar `.ph` + `<h1>`
- Tabla → `.fos-table`
- Agregar `.fos-section-label` antes de "Watchlist" y "Agregar"
- Panel de quick tags → envolver en `.fos-card`
- Tokens: `--green` → `--grn`, `--orange` → `--amber`

---

### C4. Migrar `renderInd()` al nuevo sistema visual

**Rediseño de vista principal (reemplazar tabla legacy por grid de cards):**

```javascript
// Reemplazar la tabla de portfolio + el grid de ticker cards por:
'<div class="fos-card" style="margin-bottom:16px">'+
'<div class="fos-section-label" style="margin-bottom:12px">Tus Activos — click para análisis completo</div>'+
'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px">'+
allT.slice(0,24).map(function(t){
  var s=ALL_SIG.find(function(x){return x.t===t;})||{sig:'HOLD',sc:60};
  var lp=getLivePrice(t);
  var cls=s.sc>=70?'fos-score--g':s.sc>=50?'fos-score--a':'fos-score--r';
  return '<div onclick="openDrawer(\''+t+'\','+lp+')" class="dash-action-btn" style="text-align:center;cursor:pointer">'+
    '<div style="font-size:13px;font-weight:700;color:var(--bright);font-family:\'JetBrains Mono\',monospace;margin-bottom:6px">'+t+'</div>'+
    '<span class="fos-score '+cls+'" style="margin:0 auto 6px;display:flex;align-items:center;justify-content:center">'+s.sc+'</span>'+
    '<div style="font-size:10px;color:var(--text3);font-family:\'JetBrains Mono\',monospace">$'+fmtD(lp)+'</div>'+
    '</div>';
}).join('')+
'</div></div>'
```

**Agregar nota informativa clara:**
```javascript
'<div style="background:rgba(61,190,122,.06);border:1px solid rgba(61,190,122,.15);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:11px;color:var(--text);line-height:1.6">'+
'<b style="color:var(--grn)">📊 Indicadores técnicos completos</b> — Haz click en cualquier activo para abrir el análisis con gráfico de velas, SMA20, SMA50, Bandas Bollinger y SMA200 en tiempo real.'+
'</div>'
```

---

### C5. Migrar `renderRisk()` al nuevo sistema visual (post Fase B5)

- Eliminar `.ph` header
- Migrar KPI cards al estilo `dash-kpi-card`
- Tabla → `.fos-table`
- Tokens: `--green` → `--grn`, `--orange` → `--amber`
- Hacer SCENARIOS dinámicos: leer `DE_CACHE.regime` para ajustar probabilidades

---

### VERIFICACIÓN FASE C
Commit: `"style: migrate port/watch/ind/risk to new design system — tokens, typography, layout"`

Verificar visualmente:
- Portfolio: no tiene header `.ph` duplicado, KPIs usan el mismo estilo que Dashboard
- Watchlist: misma coherencia
- Indicadores: grid de cards limpio, sin tabla con RSI/SMA fake
- Riesgo: visual consistente, tabs Portfolio/Nueva Posición funcionales

---

## FASE D — MEJORAS DE FUNCIONALIDAD
### "Después de que el producto sea visualmente coherente y sin datos falsos"

---

### D1. Dashboard: agregar mini-widget de noticias

En `renderDash()`, dentro de la columna derecha (después de Acciones Rápidas), agregar:
```javascript
// Tomar los primeros 3 items de getNewsData()
var miniNews=getNewsData().slice(0,3);
var miniNewsHtml=miniNews.map(function(n){
  var ic=n.impact==='bullish'?'var(--grn)':n.impact==='bearish'?'var(--red)':'var(--amber)';
  return '<div style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="setPage(\'news\')" onmouseover="this.style.opacity=\'.8\'" onmouseout="this.style.opacity=\'1\'">'+
    '<div style="font-size:11px;color:var(--bright);line-height:1.35;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">'+n.title+'</div>'+
    '<div style="display:flex;gap:6px;align-items:center">'+
    '<span style="font-size:9px;color:var(--text3);font-family:\'JetBrains Mono\',monospace">'+n.source+'</span>'+
    '<span style="width:3px;height:3px;border-radius:50%;background:var(--text3);display:inline-block"></span>'+
    '<span style="font-size:9px;font-weight:700;font-family:\'JetBrains Mono\',monospace;color:'+ic+'">'+relTime(n.hoursAgo)+'</span>'+
    '</div></div>';
}).join('');
// Agregar card al rightCol:
'<div class="fos-card" style="margin-top:14px">'+
'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
'<div class="fos-section-label">Últimas Noticias</div>'+
'<button onclick="setPage(\'news\')" style="font-size:10px;color:var(--text3);background:none;border:none;cursor:pointer;font-family:\'JetBrains Mono\',monospace">Ver todas →</button>'+
'</div>'+
miniNewsHtml+'</div>'
```

---

### D2. Indicadores: agregar timeframe selector al drawer

En la función `renderDrawerBody()` (o donde se construye el chart drawer), buscar donde se llama a `renderLWCharts()` y agregar tabs de timeframe:

```javascript
// Buscar el lugar donde se construye el drawer con el chart y agregar:
var tfTabs=['1M','3M','6M','1A','2A'].map(function(tf){
  var active=S.drawerTf===tf;
  return '<button onclick="S.drawerTf=\''+tf+'\';renderDrawerBody()" '+
    'style="padding:4px 10px;border:1px solid '+(active?'var(--grn)':'var(--border)')+';border-radius:6px;background:'+(active?'var(--grn-bg)':'transparent')+';color:'+(active?'var(--grn)':'var(--text3)')+';font-size:10px;font-family:\'JetBrains Mono\',monospace;cursor:pointer">'+tf+'</button>';
}).join('');

// Antes del canvas/chart, agregar:
'<div style="display:flex;gap:4px;margin-bottom:10px">'+tfTabs+'</div>'
```

Agregar `drawerTf:'6M'` al state S inicial y pasar ese parámetro a la función que hace fetch de datos históricos.

---

### D3. Señales en Screener: conectar filtros del tab Señales

Si se implementó B2, asegurar que el tab "Señales" del Screener reutiliza los filtros de `S.sigFilter` (BUY/HOLD/SELL/ALL) y los botones de filtro de renderSig().

---

### D4. Motor de Análisis: tabs Mercado Global / Por Activo

En `renderDecisionEngine()`, después del skeleton, envolver el contenido en un sistema de tabs:
- **Tab "Mercado Global":** regimeCard + vixCard + earningsCard + divsCard
- **Tab "Por Activo":** actionGuide + scoresHtml + disclaimer

```javascript
// Agregar a S: decisionTab: 'global' | 'tickers'
// Tabs HTML al inicio de de-body:
'<div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border)">'+
'<button onclick="S.decisionTab=\'global\';document.getElementById(\'de-body\').innerHTML=\'\';renderDecisionEngine()" ...>Mercado Global</button>'+
'<button onclick="S.decisionTab=\'tickers\';..." ...>Por Activo</button>'+
'</div>'
```

---

### D5. Bitácora: resumen estadístico automático

En `renderBitacora()`, al inicio, agregar un card de métricas calculadas desde los trades:
```javascript
// Calcular desde S.trades[] o loadTrades():
var trades=loadTrades()||[];
var closed=trades.filter(function(t){return t.exit;});
var wins=closed.filter(function(t){return t.pnl>0;}).length;
var wr=closed.length>0?(wins/closed.length*100).toFixed(0):0;
var avgPnl=closed.length>0?(closed.reduce(function(s,t){return s+t.pnl;},0)/closed.length).toFixed(2):0;

// KPI card:
'<div class="dash-kpi" style="margin-bottom:16px">'+
'<div class="dash-kpi-card"><div class="dash-kpi-label">Operaciones</div><div class="dash-kpi-val">'+closed.length+'</div></div>'+
'<div class="dash-kpi-card"><div class="dash-kpi-label">Win Rate</div><div class="dash-kpi-val" style="color:'+(wr>=50?'var(--grn)':'var(--red)')+'">'+wr+'%</div></div>'+
'<div class="dash-kpi-card"><div class="dash-kpi-label">P&amp;L Promedio</div><div class="dash-kpi-val" style="color:'+(avgPnl>=0?'var(--grn)':'var(--red)')+'">$'+avgPnl+'</div></div>'+
'</div>'
```

---

### VERIFICACIÓN FASE D
Commit: `"feat: dashboard news widget, drawer timeframes, decision tabs, bitacora stats"`

Verificar funcionamiento en browser para cada nueva feature.

---

## ORDEN DE EJECUCIÓN FINAL

```
Fase A (fixes credibilidad):
  A1 → A2 → A3 → A4 → commit → verificar en browser

Fase B (consolidación nav):
  B1 → B2 → B3 → B4 → B5 → commit → verificar en browser

Fase C (migración visual):
  C1 (global tokens) → C2 → C3 → C4 → C5 → commit → verificar

Fase D (funcionalidades):
  D1 → D2 → D3 → D4 → D5 → commit final → deploy
```

**Regla de cada fase:** Si algo no funciona, revertir solo ese cambio (no toda la fase) y continuar con el siguiente item.

---

## RESULTADO ESPERADO AL TERMINAR

- Nav con 13 módulos (de 19) — sin duplicación
- Cero datos falsos visibles al usuario (RSI random, calendarios viejos, placeholders)
- Todos los módulos con el mismo sistema visual: tokens correctos, JetBrains Mono, sin .ph headers
- Flujo conectado: Motor → sizing en Risk → posición en Portfolio
- Score proyectado: 8.3/10 (vs 4.8/10 antes de la auditoría)
