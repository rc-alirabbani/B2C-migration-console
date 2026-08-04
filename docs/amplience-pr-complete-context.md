# Amplience Integration — Complete Context (Start → PR #9 → Final State)

**Repository:** [muk10/B2C-migration-console](https://github.com/muk10/B2C-migration-console)  
**Fork / PR author:** [rc-alirabbani/B2C-migration-console](https://github.com/rc-alirabbani/B2C-migration-console)  
**Merged PR:** [#9 — Amplience content implementation](https://github.com/muk10/B2C-migration-console/pull/9) (into `development`)

This document is a single narrative of what was built, what reviewers asked to change, and how the solution looks **after** addressing feedback. Use it for handover, Confluence, or opening in a new tab for review.

---

## 1. Business goal

Extend the **B2C Migration Console** (`bm_accelerator`) so teams can:

1. **Connect** to Amplience Dynamic Content from Business Manager.
2. **List, preview, and export** Amplience content as SFCC content assets (IMPEX).
3. **Expose a JSON catalog API** for a **React** demo storefront (gallery + live CDN preview).
4. Align with the project’s **LINK** standard: credentials in **Site Preferences**, HTTP via **Service Framework**, no secrets in `session.custom` or `.env`.

Amplience was the first CMS provider; the storefront cartridge was later renamed to **`app_custom_cms`** so Contentful and others can be added later without another cartridge rename.

---

## 2. What was delivered (functional scope)

### 2.1 Business Manager — Content Migration wizard

| Item | Detail |
|------|--------|
| **Entry** | Merchant Tools → B2C Migration → Amplience → **Content Migration** |
| **Controller** | `Accelerator-ContentMigration` |
| **Steps** | Connect → Select content → Preview → Export IMPEX |
| **Connect** | Test Connection against **Site Preferences** (no credential form) |
| **Backend** | `amplienceContentFetcher`, `amplienceContentTransformer`, `contentXmlBuilder`, `contentMigrationRunner` |
| **Output** | Content assets under library folder **`amplience/`** with custom attributes (`amplienceContentId`, `amplienceDeliveryKey`, `amplienceWidgetType`, `amplienceSourceJson`, etc.) |

Related: **Content Schema Migration** (`Accelerator-ContentSchemaMigration`) for Amplience content types / schema mapping.

### 2.2 Business Manager — Platform connector

| Item | Detail |
|------|--------|
| **Connector ID** | `amplience` in `connectors/registry.js` |
| **Auth** | Personal Access Token (`amp_pat_…`) via Site Preferences |
| **Test** | `amplienceConnector.testConnectionWith` — lists hubs, optional CDN check for default delivery key |
| **HTTP** | `amplienceApi.js` → Service ID **`accelerator.amplience.api`** |

### 2.3 Storefront — CMS API (`app_custom_cms`)

| Endpoint | Purpose |
|----------|---------|
| `AmplienceContent-List` | **JSON catalog** for React gallery (pagination, filters) |
| `AmplienceContent-Show` | ISML gallery (optional; React is primary UX) |
| `AmplienceContent-Detail` / `Preview` / `Compose` / `Include` | Preview, locale, composition, includes |
| **Live refresh** | `amplienceContent.js` → CDN via `amplienceLiveFetcher` + `amplienceCore` (synced from `packages/amplience-core`) |

### 2.4 React demo (`react-storefront/`)

| Route | Purpose |
|-------|---------|
| `/amplience-gallery` | Browse migrated catalog from SFCC (`AmplienceContent-List` or synced JSON) |
| `/amplience-demo?ids=…` | Live render from Amplience CDN using migrated IDs/keys |

**Packages:** `packages/amplience-core`, `packages/amplience-react` — shared logic; SFCC copy via `npm run sync:amplience-core`.

### 2.5 Headless Page Designer (optional)

- `app_custom_cms/cartridge/experience/components/commerce_assets/amplienceWidget.json`
- React: `AmpliencePdWidget` + SCAPI page composition (see `packages/amplience-pwa-demo`).

---

## 3. End-to-end data flow (final architecture)

```
Amplience CMS (Management API + CDN)
        │
        │ ① BM Content Migration wizard (bm_accelerator)
        ▼
IMPEX → SFCC Content Library / amplience/ folder
        │
        ├── ② AmplienceContent-List  ──► React gallery (catalog)
        │
        └── ③ contentId / deliveryKey on assets ──► Amplience CDN (live bodies)
```

**Principle:** SFCC is the **system of record** for *which* components were migrated. React (and optional ISML gallery) lists from SFCC. **Published** HTML/images/text are loaded from **Amplience CDN** using stored references.

Detailed diagram and tables: [`docs/amplience-content-data-flow.md`](amplience-content-data-flow.md).

---

## 4. PR review feedback (muk10) and how it was addressed

### 4.1 Process / size

| Feedback | Response |
|----------|----------|
| PR too large; split feature-wise | Acknowledged; future PRs smaller (e.g. React demo separate). Single end-to-end PR was used because one developer owned the full module. |
| Multiple cartridges (`app_custom_amplience`, `app_custom_headless`, `app_custom_royalcyber`, `app_storefront_base`) | Consolidated and removed (see §5). |

### 4.2 Architecture (LINK) — four critical fixes

| # | Issue | Fix |
|---|--------|-----|
| 1 | Missing **`accelerator.amplience.api`** in `services.xml` | Added credential, profile, and service in `metadata/services.xml`; routing in `serviceHttp.js` + `amplienceApi.js`. |
| 2 | **Secrets in `session.custom`** on Test Connection | Removed PAT/hub storage from session; only `dataMigrationSession.markConnected` (non-secret flag). |
| 3 | **Amplience not in Site Preferences metadata** | Added `rcMigAmplienceHubName`, `rcMigAmpliencePersonalAccessToken`, `rcMigAmplienceDefaultDeliveryKey` in `metadata/meta/system-objecttype-extensions.xml`; wired in `migrationPreferences.js` + prefs-only `configAccessor.js`. |
| 4 | **`config:generate` / `.env.example`** reintroduced | Removed script and `.env`; upload scripts no longer call `config:generate`. Credentials **only** from Site Preferences. |

**Amplience prefs (final):** Hub name, PAT (password), optional default delivery key. **No** Client ID / Client Secret in metadata (PAT-only).

### 4.3 Connect step UI (after prefs worked)

- Read-only summary fields with **placeholders** (`my-brand`, `amp_pat_...`, `home/banner`).
- PAT shown as **password** field with `••••••••` when configured.
- Single-line hint: *Configure under Site Preferences → Custom Preferences → B2C Migration Console*.

### 4.4 Lint / commit

- Removed unused `buildFormParams` and `form` in `content-migration.js` and `content-schema-migration.js` (husky pre-commit).

---

## 5. Cartridge evolution (before → after PR cleanup)

| Before (early PR) | After (merged + feedback) |
|-------------------|---------------------------|
| `app_custom_amplience` | **`app_custom_cms`** (generic CMS cartridge; Amplience code under `scripts/helpers/amplience*`) |
| `app_custom_headless` (generated PD JSON) | Removed; `amplienceWidget.json` lives in **`app_custom_cms`** |
| `app_custom_royalcyber` (theme) | Removed — React owns presentation |
| `app_storefront_base` (full SFRA) | Removed from repo — not required for migration + React API |
| `modules` in repo | Removed from repo — still required **on SFCC site path** from standard SFCC distribution |
| `bm_accelerator` | Unchanged — BM wizard + migration |

**Deploy today:**

```bash
npm run upload:accelerator   # bm_accelerator
npm run upload:cms           # app_custom_cms (alias: upload:amplience)
```

**SFCC cartridge paths:**

| Site | Path |
|------|------|
| Business Manager | `bm_accelerator` |
| Storefront (API for React) | `app_custom_cms:modules` |

---

## 6. Configuration & metadata (operator checklist)

### 6.1 Import (once per sandbox / on metadata change)

1. **Administration → Site Development → Site Import & Export**  
   - `metadata/meta/system-objecttype-extensions.xml`  
   - `metadata/services.xml` (includes `accelerator.amplience.api`)

2. Verify **Administration → Operations → Services** → `accelerator.amplience.api`.

3. Verify **Site Preferences → Custom Preferences → B2C Migration Console** → Amplience fields.

### 6.2 Site Preferences (Amplience)

| Preference ID | Purpose |
|---------------|---------|
| `rcMigAmplienceHubName` | Hub name (Dynamic Content → Settings → Properties) |
| `rcMigAmpliencePersonalAccessToken` | `amp_pat_…` (password) |
| `rcMigAmplienceDefaultDeliveryKey` | Optional (e.g. `home/banner`) for connect CDN check |

### 6.3 Test in BM

1. **Content Migration** → Connect → **Test Connection** (reads prefs only).  
2. Load content list → preview → export IMPEX.  
3. Import IMPEX → confirm `amplience/` folder and assets.

### 6.4 Test storefront / React

1. `https://<sandbox>/.../AmplienceContent-List?page=1&pageSize=5` → `"ok": true`.  
2. `npm run sync:sfcc-catalog` → `npm run start:react` → `http://localhost:3001/amplience-gallery`.

---

## 7. Key code locations

### 7.1 `bm_accelerator`

| Area | Path |
|------|------|
| Content wizard UI | `cartridge/templates/default/accelerator/contentMigration.isml`, `client/default/js/content-migration.js` |
| Connect summary UI | `cartridge/templates/default/accelerator/components/connectionSummaryFields.isml` |
| Controller | `cartridge/controllers/Accelerator.js` (`ContentMigration`, `TestConnection`, `buildConnectionSummary`) |
| Config | `scripts/migration/configAccessor.js`, `migrationPreferences.js`, `config.defaults.js` |
| Connector | `scripts/migration/connectors/amplience/` |
| Content pipeline | `scripts/migration/contentMigration/amplience*` |
| HTTP service | `scripts/migration/core/amplienceApi.js`, `serviceHttp.js` |

### 7.2 `app_custom_cms`

| Area | Path |
|------|------|
| API controller | `cartridge/controllers/AmplienceContent.js` |
| Core helper | `cartridge/scripts/helpers/amplienceContent.js` |
| Synced core | `cartridge/scripts/helpers/amplienceCore/` ← `npm run sync:amplience-core` |
| PD widget | `cartridge/experience/components/commerce_assets/amplienceWidget.json` |

### 7.3 React & packages

| Area | Path |
|------|------|
| Gallery / demo | `react-storefront/src/pages/` |
| Hooks | `packages/amplience-react/src/hooks/` |
| Shared CDN/transform | `packages/amplience-core/src/` |

### 7.4 Tests

| Area | Path |
|------|------|
| BM content fetcher | `test/unit/bm_accelerator/content/amplienceContentFetcher.js` |
| Storefront helpers | `test/unit/app_custom_cms/helpers/` |
| Core package | `test/unit/packages/amplience-core/` |

---

## 8. NPM scripts (reference)

| Script | Purpose |
|--------|---------|
| `npm run upload:accelerator` | BM cartridge |
| `npm run upload:cms` | Storefront CMS cartridge |
| `npm run sync:amplience-core` | Copy `packages/amplience-core` → SFCC |
| `npm run sync:sfcc-catalog` | Pull `AmplienceContent-List` → React JSON |
| `npm run start:react` | Dev gallery + demo |
| `npm run test:cms` | CMS helper unit tests |

---

## 9. PR timeline (commits / themes — fork)

Typical sequence on feature branch (names may vary):

1. End-to-end Amplience module (BM wizard, IMPEX, storefront, React).  
2. PAT / connect step fixes for content widget preview.  
3. Reviewer feedback: prefs-only, services, session cleanup, UI polish.  
4. **“Finalized the final feedback”** — architecture aligned with `MIGRATION.md` / LINK guide.  
5. Merge **PR #9** into **`development`** (`c8e45a8` on upstream).

---

## 10. What reviewers should verify on merge

- [ ] Metadata re-imported (`services.xml` + `system-objecttype-extensions.xml`).  
- [ ] Amplience prefs set; **Test Connection** succeeds without credential forms.  
- [ ] No `session.custom` Amplience secrets; no `config:generate` in CI/upload.  
- [ ] `accelerator.amplience.api` used for outbound Amplience HTTP.  
- [ ] Only **`bm_accelerator`** + **`app_custom_cms`** deployed for this feature (plus **`modules`** on storefront site from SFCC standard).  
- [ ] React gallery uses SFCC catalog; live preview hits CDN.  

---

## 11. Future work (post-PR)

| Topic | Notes |
|-------|--------|
| **Contentful** | New branch `feature/Contentful-Content-Implementation`; extend `app_custom_cms` with `contentful/` helpers and APIs (same prefs pattern: `rcMigContentful*`). |
| **Smaller PRs** | React demo, metadata-only, BM-only migrations as separate reviews. |
| **Remove ISML gallery** | If React is the only storefront UX, `AmplienceContent-Show` can be deprecated later. |

---

## 12. Related docs in repo

| Document | Purpose |
|----------|---------|
| [`docs/amplience-content-data-flow.md`](amplience-content-data-flow.md) | Technical data flow & URLs |
| [`documentation/link_installation.md`](../documentation/link_installation.md) | LINK install & services |
| [`AGENTS.md`](../AGENTS.md) | Agent/dev quick map |
| [`react-storefront/README.md`](../react-storefront/README.md) | Local React setup |
| [`packages/README.md`](../packages/README.md) | Shared packages & PD setup |

---

*Generated for handover and PR closure context. Last aligned with merged Amplience work on `development` and cartridge name `app_custom_cms`.*
