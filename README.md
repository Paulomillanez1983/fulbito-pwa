# Fulbito Arena

PWA mobile-first para torneos barriales con estetica de juego deportivo premium, Google Login, roles y backend Supabase.

Produccion: https://fulbito-pwa.vercel.app

## Producto

- Roles: jugador, capitan/DT, duenio de cancha, organizador, arbitro/veedor y admin.
- Login con Google via Supabase Auth.
- Backend real con Postgres, RLS y Storage.
- Canchas partner con precio por hora, inscripcion sugerida y comision.
- Equipos con escudo, sigla, barrio y plantel.
- Subida de escudos, fotos de cancha y fotos de jugadores a Supabase Storage.
- Formacion visual 5v5, 7v7 y 11v11 con dorsal, apodo y posicion.
- Torneos tipo liga, mundial barrial o copa eliminatoria.
- Calendario de partidos y estados.
- Submissions y confirmaciones de resultado antes de actualizar tabla.
- Tabla automatica solo con partidos finalizados.
- PWA instalable con service worker basico.
- Open Graph/Twitter Card con imagen 1200x630.

## Stack

- Next.js App Router
- Supabase Auth, Postgres, RLS y Storage
- Vercel
- TypeScript

## Local

```powershell
npm install
npm run dev
```

Abrir:

```text
http://localhost:3000
```

Variables:

```text
NEXT_PUBLIC_SITE_URL=https://fulbito-pwa.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://tlggovsdkeptwsyytbsz.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

## Supabase

Proyecto separado:

```text
Name: fulbito-arena
Ref: tlggovsdkeptwsyytbsz
URL: https://tlggovsdkeptwsyytbsz.supabase.co
Region: sa-east-1
```

Aplicar migraciones:

```powershell
supabase db push --linked --yes
```

La migracion inicial crea:

- Tablas: `profiles`, `user_roles`, `venues`, `teams`, `team_members`, `tournaments`, `tournament_teams`, `matches`, `match_result_submissions`, `result_confirmations`, `lineups`, `lineup_slots`.
- RLS activo en todas las tablas publicas.
- Buckets publicos de lectura y upload autenticado: `team-badges`, `player-photos`, `venue-photos`.
- Demo online con canchas, equipos, planteles, torneo, fixture y tabla.

## Google OAuth

El codigo ya llama a Supabase Auth con provider `google`. Para que el login funcione en produccion, el proveedor Google debe estar habilitado en Supabase Dashboard con Client ID/Secret de Google Cloud y redirects permitidos.

Callback autorizado en Google Cloud:

```text
https://tlggovsdkeptwsyytbsz.supabase.co/auth/v1/callback
```

Redirects permitidos en Supabase Auth:

```text
https://fulbito-pwa.vercel.app/**
https://*.vercel.app/**
http://localhost:3000/**
http://127.0.0.1:3000/**
```

No usar `service_role` en el frontend. La app solo necesita la URL publica y la publishable key; permisos de escritura quedan controlados por Auth + RLS.

## Assets

El escudo base vive en `public/assets/icon.svg`.

```powershell
.\scripts\generate-brand-assets.ps1
```

Genera:

- `public/assets/icon-192.png`
- `public/assets/icon-512.png`
- `public/og-image.jpg`
