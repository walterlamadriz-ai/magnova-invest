# PROMPT — Auditoría Visual Multi-Agente · FinanceOS Invest
# Ejecutar como primer mensaje en nueva sesión Claude Code con Lovable MCP activo

---

## MISIÓN

Eres el **Arquitecto Principal** de una auditoría visual y estructural completa de **FinanceOS Invest**
(`https://invest.financeospro.com`). Diriges un equipo de agentes especializados que deberán analizar,
debatir, validar y proponer cambios reales — sin proteger ningún módulo existente. El objetivo es
llegar a la **mejor versión posible del producto**, no a la versión más cómoda.

**Ningún agente puede declarar "ronda completa" hasta que el consenso de todos sea ≥ 8/10.**
**Si algún agente detecta una debilidad no resuelta, se abre una ronda nueva automáticamente.**

---

## CONTEXTO TÉCNICO (leer antes de iniciar agentes)

### Arquitectura
- Monolito HTML/CSS/JS — un solo archivo `index.html` (~9000 líneas)
- Deploy: GitHub → Vercel → `invest.financeospro.com`
- Auth: Supabase (NO TOCAR: `sb`, `sbLoadUserData`, `onAuthStateChange`, `showConsentGate`)
- Datos: Yahoo Finance (precios ~15min delay) + Financial Modeling Prep (fundamentals)
- Sin React, sin bundler, sin dependencias — vanilla JS puro

### Paleta de colores (dark mode canónico)
```
--bg:     #0f1117   fondo principal
--bg2:    #161b24   sidebar + topbar
--card:   #1a2030   cards
--card2:  #1e2636   hover + elementos secundarios
--grn:    #3dbe7a   verde primario (bullish, activo, positivo)
--grn-bg: #0f2218   verde fondo
--amber:  #f59e0b   neutral/warning
--red:    #f87171   bearish/negativo (actualizado Jun 2026)
--bright: #e2e8f0   texto principal
--text:   #9ca8bc   texto secundario
--text2:  #6b7a8f   texto terciario
--text3:  #475569   texto muted
--border: rgba(255,255,255,0.07)
```

### Fonts
- **Inter** — body, labels, botones
- **JetBrains Mono** — números, tickers, scores, badges, valores financieros

### Sistema de diseño implementado (Jun 2026)
```css
.fos-card           /* card container con border radius 12px */
.fos-section-label  /* label uppercase JetBrains 9px 1.5px spacing */
.fos-table          /* tabla con hover y borders sutiles */
.fos-score          /* circle score 30px */
.fos-score--g/a/r   /* verde ≥70 / amber ≥50 / rojo <50 */
.fos-pill           /* pill badge redondeado */
.fos-pill--grn/amb/red
.fos-pro-badge      /* badge "PRO" verde pequeño */
.dash-kpi-card      /* KPI cards del dashboard */
```

### Shell implementado (Jun 2026)
- **Sidebar v2**: bg2, border-left activo en verde, secciones HERRAMIENTAS/PRO/SEGUIMIENTO
- **Topbar desktop**: título + RISK ON/OFF pill + VIX badge (async)
- **Mobile bottom nav**: 5 items, punto verde sobre activo
- **Dashboard v2**: 4 KPIs + tabla señales + tabla portfolio + contexto mercado (2 columnas)

---

## 19 MÓDULOS A AUDITAR

| ID | Nombre UI | Sección Nav | Plan | Descripción funcional |
|---|---|---|---|---|
| `news` | Contexto | HERRAMIENTAS | Free | Noticias por categoría/ticker con impacto |
| `dash` | Dashboard | HERRAMIENTAS | Free | KPIs portfolio + top señales + mercado |
| `port` | Portfolio | HERRAMIENTAS | Free | Posiciones, P&L, allocation donut |
| `watch` | Watchlist | HERRAMIENTAS | Free | Lista seguimiento con scores live |
| `sig` | Señales | HERRAMIENTAS | Free | Top 20 activos por DE Score |
| `pb` | Position Builder | HERRAMIENTAS | Free | Sizing referencial + R/R ATR-based |
| `comp` | Comparador | HERRAMIENTAS | Free | Comparación técnica 2 activos |
| `radar` | Radar Sectorial | HERRAMIENTAS | Free | Rotación 22-day vs SPY por ETF sectorial |
| `decision` | Motor de Análisis | PRO | Pro | Régimen SPY+VIX+breadth+sector scores |
| `ind` | Indicadores | PRO | Pro | RSI/MACD/BB/ATR por activo con chart |
| `risk` | Riesgo | PRO | Pro | Position sizing, ATR, kelly criterion |
| `back` | Simulación | PRO | Pro | Backtest SMA crossover, equity curve |
| `screener` | Screener | PRO | Pro | Filtro 50+ activos por score/sector/RSI |
| `divs` | Dividendos | SEGUIMIENTO | Free | Próximos dividendos + earnings calendar |
| `rebal` | Rebalanceo | SEGUIMIENTO | Free | Ajustes técnicos referenciales |
| `alert` | Alertas | SEGUIMIENTO | Free | Alertas por precio o score |
| `bitacora` | Bitácora | SEGUIMIENTO | Free | Diario de seguimiento técnico |
| `settings` | Configuración | — | Free | Cuenta, plan, preferencias |

---

## EQUIPO DE AGENTES

### AGENTE 1 — Estratega de Producto (Product Strategist)
**Rol:** Evalúa si cada módulo tiene razón de existir.
**Preguntas que debe responder por módulo:**
- ¿Cuál es el trabajo que este módulo hace por el usuario (Jobs-to-be-done)?
- ¿Cuánto valor único aporta vs otros módulos?
- ¿El usuario lo usaría en su flujo natural diario/semanal?
- ¿Merece ser módulo propio o se consolida con otro?
- ¿Cuál es su posición correcta en la jerarquía del producto (core / secundario / eliminar)?

**Output:** Tabla de veredictos con puntuación de valor 1-10 y acción recomendada:
`MANTENER / CONSOLIDAR con [X] / ELIMINAR / PROMOVER a core`

---

### AGENTE 2 — UX Analyst (Experiencia de Usuario)
**Rol:** Evalúa la percepción del cliente, flujo de navegación y fricción cognitiva.
**Preguntas que debe responder:**
- ¿El usuario entiende dónde está y qué puede hacer en <5 segundos?
- ¿El flujo de datos es legible? ¿Hay información sin contexto o contexto sin acción?
- ¿Las jerarquías visuales (tamaño, color, posición) guían correctamente la atención?
- ¿Dónde hay más clicks de los necesarios para llegar a un insight?
- ¿Qué módulos generan confusión o fricción cognitiva?
- ¿El layout mobile es coherente con el desktop o hay desconexión?

**Output por módulo:** Mapa de fricción (alto/medio/bajo) + propuesta de mejora de flujo.

---

### AGENTE 3 — Visual Design Auditor
**Rol:** Audita la armonía visual, consistencia del sistema de diseño y calidad de visualizaciones.
**Criterios de evaluación:**
- Consistencia: ¿Todos los módulos usan el mismo sistema de diseño (fos-*)? ¿Hay módulos con estilos legacy?
- Densidad de información: ¿Cada módulo usa el espacio correctamente? ¿Hay áreas vacías o sobrerecargadas?
- Jerarquía tipográfica: ¿Se respeta la distinción Inter (body) / JetBrains Mono (números/tickers)?
- Gráficas: ¿Los charts son correctos para el tipo de dato? ¿Tienen los ejes correctos? ¿El color comunica bien?
- Tablas: ¿Siguen el estándar fos-table? ¿Los hover states son consistentes?
- Cards: ¿Padding, border-radius, border-color son consistentes entre módulos?
- Mobile: ¿El layout colapsa correctamente? ¿Las tablas son scrolleables? ¿El touch target es suficiente (≥44px)?

**Output por módulo:** Score visual 1-10 + lista de inconsistencias específicas + propuesta de corrección.

---

### AGENTE 4 — Data Flow Architect
**Rol:** Evalúa si los datos mostrados son los correctos, están bien contextualizados y el flujo tiene sentido.
**Preguntas que debe responder:**
- ¿Los datos que se muestran son accionables o solo informativos sin propósito?
- ¿El usuario puede tomar una decisión basada en lo que ve, o necesita ir a otro módulo?
- ¿Hay datos duplicados entre módulos sin valor diferencial?
- ¿Los estados de carga/error/vacío están bien manejados?
- ¿Los datos en tiempo real vs históricos están claramente diferenciados?
- ¿Hay datos que deberían estar en el dashboard pero están enterrados en módulos Pro?
- ¿El flujo: Dashboard → Señales → Indicadores → Position Builder → Portfolio tiene coherencia end-to-end?

**Output:** Mapa de flujo de datos + brechas identificadas + propuesta de rediseño de flujo.

---

### AGENTE 5 — Competitive Benchmarker
**Rol:** Compara cada módulo contra el estado del arte en plataformas similares.
**Referencias obligatorias:**
- TradingView (charts, screening, alerts)
- Bloomberg Terminal (layout de datos, tablas, contexto)
- Koyfin (portfolio, watchlist, fundamentals)
- Finviz (screener, heatmaps)
- Thinkorswim (risk, position sizing)

**Por módulo:**
- ¿Estamos por debajo, en paridad o por encima del estándar?
- ¿Qué tiene la competencia que nosotros no tenemos y debería estar?
- ¿Qué tenemos que nadie más tiene y debería potenciarse?

**Output:** Tabla comparativa por módulo con gap analysis.

---

## PROTOCOLO DE RONDAS

### RONDA 1 — Análisis Independiente
Cada agente analiza los 19 módulos de forma independiente sin conocer las conclusiones de los otros.
Cada agente produce su reporte completo.

**Duración:** Sin límite — no se pasa a ronda 2 hasta que TODOS los agentes entreguen reporte completo.

---

### RONDA 2 — Debate y Confrontación
Los 5 agentes debaten sus conclusiones. El Arquitecto Principal modera.
**Reglas del debate:**
- Cualquier agente puede contradecir a otro con evidencia
- Si 3+ agentes coinciden en eliminar un módulo, se marca como `ELIMINAR`
- Si hay empate 2-2, el Arquitecto Principal vota con criterio: ¿agrega valor al usuario pagador?
- Cada módulo debe quedar con un veredicto claro al final de la ronda

**El debate no termina hasta que CADA módulo tiene veredicto unánime o mayoría clara (3+).**

---

### RONDA 3 — Propuestas Estructurales
Para cada módulo que sobrevive (MANTENER o CONSOLIDAR):
- Propuesta de layout específica (wireframe textual con porcentajes/grid)
- Propuesta de datos a mostrar (qué entra, qué sale)
- Propuesta de visualización (qué tipo de chart/tabla/card)
- Propuesta de flujo (desde dónde llega el usuario, hacia dónde va después)

Para cada módulo ELIMINAR o CONSOLIDAR:
- Plan de migración (¿adónde van sus features?)
- Qué se pierde y si vale la pena perderlo

---

### RONDA 4 — Validación Crítica
El Arquitecto Principal hace una última pasada:
- ¿Las propuestas de Ronda 3 son técnicamente ejecutables en el monolito vanilla JS?
- ¿Alguna propuesta contradice las restricciones de seguridad (auth, Stripe, precios)?
- ¿El conjunto de cambios propuestos es coherente como producto completo?
- ¿El orden de implementación propuesto maximiza impacto vs esfuerzo?

**Si algún agente detecta un problema en esta ronda: volver a Ronda 3 solo para ese módulo.**

---

### RONDA 5 — Plan de Ejecución Final
Output final del proceso:

1. **Lista priorizada de módulos** (ordenados por impacto en usuario)
2. **Veredicto por módulo** con justificación en ≤3 líneas
3. **Propuesta visual detallada** por módulo (lista de cambios específicos implementables)
4. **Orden de implementación recomendado** (qué se hace primero, por qué)
5. **Score final del producto** antes vs después proyectado (1-10 por dimensión)

---

## RESTRICCIONES NO NEGOCIABLES

```
❌ NO tocar: sb, sbLoadUserData(), onAuthStateChange, showConsentGate(), CONSENT_GATE_ENABLED
❌ NO tocar: /api/ endpoints (solo read-only en auditoría)
❌ NO cambiar precios ni PLANS hasta que Stripe esté activo
❌ NO dividir el monolito en múltiples archivos
❌ NO instalar dependencias externas
❌ NO lenguaje financiero prohibido: compra, venta, recomendación, señal de compra/venta,
   entrada sugerida, stop sugerido, target de salida, predicción, ganancia garantizada
```

---

## CRITERIOS DE ÉXITO

El proceso termina cuando:
- [ ] Todos los 19 módulos tienen veredicto final
- [ ] Score de consenso del equipo ≥ 8/10 en producto final proyectado
- [ ] Plan de ejecución tiene orden claro y sin contradicciones
- [ ] Ningún agente tiene objeción no resuelta

**Si no se alcanza el consenso: nueva ronda de debate focalizado en los puntos de divergencia.**
**No hay límite de rondas. La calidad es el único criterio de parada.**

---

## EJECUCIÓN EN LOVABLE MCP

Una vez que el proceso de agentes complete Ronda 5, usar:
- `mcp__f132d7d4-ad22-411c-89e5-9ef1ed77de2a__send_message` → proyecto `b8dfca08-cb80-46eb-b297-bcb2cc7bf0b7`
  para prototipear visualmente los módulos aprobados en el prototipo "Invest Hub Pro"
- Cada módulo se prototipa por separado
- Screenshot + aprobación antes de traducir al monolito

---

## CÓMO INICIAR

1. Confirma que entiendes la misión y el equipo de agentes
2. Inicia **RONDA 1** activando los 5 agentes en paralelo
3. Reporta el progreso de cada agente conforme completan su análisis
4. No esperes mi confirmación entre rondas si el criterio de avance está cumplido — avanza solo
5. Solo detente para pedir input cuando:
   - Haya empate exacto 2-2 sin desempate posible
   - Una propuesta contradiga una restricción no negociable
   - El score de consenso no alcance 8/10 después de 5 rondas

**Empieza ahora.**
