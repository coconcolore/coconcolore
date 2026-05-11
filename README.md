# Ethereal Art Flow Pro

Dieses Projekt wurde auf Supabase migriert.

## Voraussetzungen

1. Node.js 20+
2. Ein Supabase-Projekt (EU-Region empfohlen: Frankfurt)

## Lokales Setup

1. Dependencies installieren:

```bash
npm install
```

2. `.env.local` anlegen:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY

# Optional
VITE_SUPABASE_STORAGE_BUCKET=public
VITE_LOGIN_URL=/login
```

3. Development starten:

```bash
npm run dev
```

## Login / Sign in

Die App ist jetzt mit Login abgesichert.

1. Login-Seite: `/login`
2. Nicht eingeloggte Nutzer werden auf `/login` umgeleitet
3. Nach erfolgreichem Sign-in geht es automatisch auf die angeforderte Seite zurück

## Datenbank-Migration (Supabase)

1. Öffne Supabase Dashboard -> SQL Editor
2. Führe den Inhalt aus:

- `supabase/migrations/20260507_000001_init_schema_and_rls.sql`
- `supabase/migrations/20260507_000002_harden_rls.sql`
- `supabase/migrations/20260507_000003_course_publish_requires_artist_approval.sql`
- `supabase/migrations/20260508_000004_allow_self_upgrade_to_kuenstler.sql`
- `supabase/migrations/20260508_000005_restore_strict_role_change_guard.sql`
- `supabase/migrations/20260508_000006_course_two_stage_approval_workflow.sql`

Die Migration erstellt:

1. Alle Tabellen (`users`, `course`, `booking`, etc.)
2. Indizes und `updated_date` Trigger
3. Baseline-RLS Policies
4. Storage Bucket `public` + Upload Policies

Reihenfolge ist wichtig:

1. `20260507_000001_init_schema_and_rls.sql`
2. `20260507_000002_harden_rls.sql`
3. `20260507_000003_course_publish_requires_artist_approval.sql`
4. `20260508_000004_allow_self_upgrade_to_kuenstler.sql`
5. `20260508_000005_restore_strict_role_change_guard.sql`
6. `20260508_000006_course_two_stage_approval_workflow.sql`

## Wichtiger Hinweis zu RLS

Die aktuellen Policies sind bewusst als funktionale Baseline gesetzt (damit das bestehende Frontend direkt läuft).
Als nächster Schritt sollten die Policies auf rollen- und eigentümerbasierte Regeln gehärtet werden.

## Edge Functions (Stripe + Public Data)

Portierte Functions liegen unter:

1. `supabase/functions/createCheckoutSession`
2. `supabase/functions/getPublicCourse`
3. `supabase/functions/stripePayouts`
4. `supabase/functions/stripeWebhook`

### Deploy

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase functions deploy getPublicCourse
supabase functions deploy createCheckoutSession
supabase functions deploy stripePayouts
supabase functions deploy stripeWebhook
```

### Secrets setzen

```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
supabase secrets set SUPABASE_ANON_KEY=YOUR_ANON_KEY
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Stripe Webhook

In Stripe einen Webhook auf diese URL setzen:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripeWebhook`

Event:

1. `checkout.session.completed`

## Smoke-Test Plan (3 Accounts)

Vorbereitung:

1. Drei Users in Supabase Auth anlegen (Künstler, Location Manager, Admin)
2. Seed-Skript ausführen und E-Mails anpassen:
	- `supabase/scripts/smoke_test_seed.sql`

Alternativ: Testnutzer direkt via Admin API erstellen/aktualisieren:

```bash
SUPABASE_URL=https://kpinczhcsikkojjkznhq.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
node scripts/create-test-users.mjs
```

Standard-Testnutzer (falls keine ENV-Overrides gesetzt sind):

1. `admin@test.local` / `Admin12345!`
2. `kuenstler@test.local` / `Artist12345!`
3. `location@test.local` / `Location12345!`

### 1) Künstler

Kurse (`/courses`, `/courses/new`, `/courses/:id`):

1. Eigene Kurse sichtbar, fremde nicht
2. Neuen Kurs erstellen funktioniert
3. Statuswechsel von `entwurf` auf `ausstehend_freigabe` möglich
4. Direkter Versuch auf `freigegeben_intern` oder `veroeffentlicht` muss fehlschlagen

Kalender (`/kalender`):

1. Slots lesen funktioniert
2. Freien Slot auf `gebucht` mit eigener E-Mail buchen funktioniert
3. Beliebiges Überschreiben eines bereits gebuchten Slots muss fehlschlagen

Abrechnung (`/invoices`):

1. Nur eigene Erlösdaten sichtbar
2. Keine globale Rechnungsverwaltung sichtbar

### 2) Location Manager

Kurse:

1. Keine Künstler-Kurserstellung erforderlich
2. Lesen veröffentlichter Kurse möglich

Kalender:

1. Räume erstellen/bearbeiten/löschen funktioniert
2. Slots erstellen/bearbeiten/löschen funktioniert

Admin:

1. Admin-Panel nicht sichtbar (oder Zugriff verweigert)

Abrechnung:

1. Kein Zugriff auf globale Abrechnungsverwaltung

### 3) Admin

Kurse:

1. Alle Kurse sichtbar
2. Interne Freigabe (`ausstehend_freigabe` -> `freigegeben_intern`) funktioniert
3. Veröffentlichung (`freigegeben_intern` -> `veroeffentlicht`) funktioniert
4. Ablehnung mit Hinweis (`abgelehnt` + `admin_notes`) funktioniert

Kalender:

1. Volle Verwaltung von Räumen und Slots

Admin (`/admin`):

1. User-Rollen ändern funktioniert
2. Artist-Freigabe funktioniert
3. Platform Settings speichern funktioniert
4. Payout-Status ändern funktioniert

Abrechnung (`/invoices`):

1. Alle Buchungen sichtbar
2. Rechnung erstellen/Status ändern funktioniert

## Erwartete Sicherheitschecks

1. Künstler darf Kurs nicht direkt auf `freigegeben_intern` oder `veroeffentlicht` setzen
2. Veröffentlichung ist nur aus `freigegeben_intern` erlaubt
3. Ablehnung muss `admin_notes` enthalten
4. Nicht-Manager darf `booking` und `payout_request` Status nicht direkt updaten
5. Öffentlich (`anon`) nur veröffentlichte Kurse und freigegebene Künstlerprofile

## Vollständiger Smoke-Test (automatisiert)

Der folgende Script-Flow testet Ende-zu-Ende:

1. Künstler Login
2. Künstlerprofil ausfüllen
3. Kurs als Entwurf erstellen (`entwurf`)
4. Künstler reicht Kurs ein (`ausstehend_freigabe`)
5. Admin setzt interne Freigabe (`freigegeben_intern`)
6. Veröffentlichung vor Artist-Freigabe wird blockiert
7. Admin genehmigt Artist
8. Admin veröffentlicht Kurs
9. Admin erstellt Raum
10. Admin erstellt freien Zeitslot
11. Künstler bucht den freien Slot

Ausführen:

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
SUPABASE_ANON_KEY=YOUR_ANON_KEY \
npm run smoke:flow
```

Optional mit eigenen Accounts:

```bash
SMOKE_ADMIN_EMAIL=admin@test.local
SMOKE_ADMIN_PASSWORD=Admin12345!
SMOKE_ARTIST_EMAIL=kuenstler@test.local
SMOKE_ARTIST_PASSWORD=Artist12345!
```
# coconcolore
