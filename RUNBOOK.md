# RUNBOOK Operativo — FinanceOS Invest

Guía de continuidad para detectar y responder a caídas. Pareja con la observabilidad
PostHog (evento `api_error`) ya instrumentada en la app.

---

## 1. Dependencias externas (single points of failure)

| Proveedor | Qué provee | Endpoint(s) | Riesgo | Plan B actual |
|---|---|---|---|---|
| **Yahoo Finance** (no oficial) | Precios, marketbar, noticias, histórico | `/api/quote`, `/api/marketbar`, `/api/news`, `/api/history` | **Alto** — sin SLA, puede bloquear o rate-limitear | Cache localStorage (precios 2h, noticias 15min, marketbar 3min) + fallback RSS en news |
| **Financial Modeling Prep (FMP)** | Fundamentals, dividendos | `/api/fundamentals` | Medio — límite del tier free | Cache localStorage 1h |
| **Supabase** | Auth + datos de usuario | `*.supabase.co` | Alto — sin esto no hay login | Ninguno (crítico) |
| **Stripe** | Pagos | `/api/create-checkout`, `/api/stripe-webhook` | Alto para ingresos | Trial sigue funcionando sin Stripe |
| **Vercel** | Hosting + edge functions | todo | Alto | Ninguno |
| **PostHog** | Analítica/observabilidad | `us.i.posthog.com` | Bajo — no afecta UX (track es no-op si falla) | — |

---

## 2. Detección — alertas a configurar en PostHog

La app emite el evento **`api_error`** con propiedad `context`. Crear alertas (Insights →
nueva alerta) sobre estos contextos:

| `context` | Significa | Severidad | Umbral sugerido |
|---|---|---|---|
| `checkout` (`critical:true`) | Falla el checkout de Stripe | **P0** — pérdida directa de ingreso | ≥1 en 5 min → avisar ya |
| `quotes` | Yahoo no devuelve precios | P1 — dashboard degradado | >10 en 15 min → revisar Yahoo |
| `marketbar` | Falla la barra de mercado | P2 | >20 en 1h |
| `news` | Falla el feed de noticias | P2 | >20 en 1h |
| `uncaught` / `promise` | Error JS no controlado en cliente | P1 si es masivo | pico repentino → revisar último deploy |

Además: caída de muchos eventos en general (registro/login a 0) puede indicar caída total
de Supabase o Vercel.

---

## 3. Respuesta por escenario

### Yahoo Finance bloqueado / rate-limit (spike de `quotes`/`marketbar`/`news`)
1. Verificar: `curl -s "https://invest.financeospro.com/api/quote?ticker=SPY"` — ¿200 con precio o error?
2. La app degrada sola a cache (precios hasta 2h). El usuario ve badge "Caché".
3. Si persiste >2h: rotar el `User-Agent` en `api/quote.js`/`marketbar.js`/`news.js`, o
   activar proveedor de respaldo (ver §4 — pendiente E3).

### Stripe falla (`checkout` critical)
1. Verificar variables en Vercel: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_INVEST_PRO*`.
2. Revisar dashboard de Stripe (estado de la API).
3. El trial sigue activo — el usuario no queda bloqueado, solo no puede pagar.

### Supabase caído (login falla, eventos a 0)
1. Status: https://status.supabase.com
2. No hay fallback — comunicar mantenimiento. Datos de usuario están en Supabase (con backups automáticos del plan).

### Pico de `uncaught`/`promise` tras un deploy
1. Probable regresión del último push. Revisar `git log` y el commit reciente.
2. Rollback rápido: `git revert <sha> && git push` (Vercel redespliega solo).

---

## 4. Pendientes de resiliencia (no implementados)

- **E3 — Proveedor de datos de respaldo**: agregar failover de Yahoo a FMP/Alpha Vantage
  en `/api/quote` y `/api/marketbar` cuando Yahoo devuelva error/empty. Hoy solo hay cache.
- **Backups Supabase**: confirmar política de backup/restore del plan actual.
- **Health-check proactivo**: Vercel Cron → ping a `/api/quote` y `/api/marketbar` →
  webhook a Slack/email si fallan (complementa las alertas reactivas de PostHog).

---

## 5. Despliegue y rollback
- Deploy: push a `main` → Vercel auto-despliega (~1-2 min).
- Rollback: `git revert <sha> && git push`, o desde el dashboard de Vercel (Promote a un
  deploy anterior).
- Validar JS antes de push: `node -e "new Function(<script de index.html>)"`.
- Recordatorio: `vercel.json` usa `outputDirectory:"."` → assets estáticos van en la RAÍZ del repo.
