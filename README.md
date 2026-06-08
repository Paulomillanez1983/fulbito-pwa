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
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

## Supabase

Proyecto separado:

```text
fulbito-arena
```

Aplicar migraciones:

```powershell
supabase db push --linked --yes
```

La migracion inicial crea tablas, policies RLS, buckets de Storage y demo online.

## Google OAuth

El codigo ya llama a Supabase Auth con provider `google`. Para que el login funcione en produccion, el proveedor Google debe estar habilitado en Supabase Dashboard con Client ID/Secret de Google Cloud y redirects permitidos.

## Assets

El escudo base vive en `public/assets/icon.svg`.

```powershell
.\scripts\generate-brand-assets.ps1
```

Genera:

- `public/assets/icon-192.png`
- `public/assets/icon-512.png`
- `public/og-image.jpg`
