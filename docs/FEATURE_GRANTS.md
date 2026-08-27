# Feature grants

Per-company entitlements for the GCN App. Replaces the old boolean columns on
`companies` (`is_roof_king`, `feature_roof_king`, `feature_door_to_door`,
`feature_storm_intel`), which are kept only as a rollback path and are no longer
read by anything.

## Model

Two tables. `platform_features` is the registry — every feature and sub-feature
the app knows about, seeded from code, two levels deep. `company_features` is the
grant: one row per company per feature, with `enabled` and a `config` jsonb.

A sub-feature resolves ON only when its own row is enabled **and** its parent
resolves ON. Switching a parent off hides the whole module without touching the
child rows, so switching it back on restores exactly what was there before.

## Reading it

- Server: `company_has_feature(company_id, key)` — used by RLS policies and any
  gated server function. This is the real gate.
- Client: `useFeatures()` → `can(key)`, plus `<FeatureGate feature="...">` and the
  `RequireFeature` route guard. Cosmetic only — never the sole check.
- `company_my_context()` returns the resolved map in one call. Super admins
  resolve every key true.

Client gating hides things. Server gating is what actually stops them. Any new
gated action needs both.

## Module access

`has_commercial_module()` wraps `company_has_feature(auth_company_id(),
'commercial')` and drives RLS on `rk_accounts`, `rk_properties`, `rk_tickets`
and `rk_form_templates`. It replaced `is_roof_king_member()`, which read the
legacy boolean and would have blocked any company other than GCN from reading
rows they had just created themselves.

## Per-company data

Two things that used to be global are now scoped by `company_id`:

- The `rk_*` tables — all existing rows belong to Global Contractor Network.
- The `spf_*` calculator catalog — products, details, stacks, layers, field
  defaults and settings. Existing rows are GCN's, not platform defaults.

A company with no `spf_products` rows gets an explicit empty state, **not** a
fallback to seed constants. That fallback existed and would have shown one
company's pricing to another. Do not reintroduce it.

## Adding a feature

1. Add the row to `platform_features` (parent first if it's a sub-feature).
2. Grant it to whoever should have it — nobody, by default.
3. Gate the UI with `can()` / `<FeatureGate>` and the server path with
   `company_has_feature()`.

Registering a feature grants it to no one, so a new build is inert until it is
rolled out deliberately.
