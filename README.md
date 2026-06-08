# Fulbito PWA

Fulbito es una PWA mobile-first para torneos barriales de futbol con experiencia visual tipo juego: canchas, campeonatos, equipos, jugadores, fixture, resultados, tabla, formaciones y backup JSON.

Produccion: https://fulbito-pwa.vercel.app

## Incluye

- App web responsive e instalable como PWA.
- UI mobile con HUD de campeonato, escudos, pitch visual y navegacion inferior.
- Demo inicial con campeonato, equipos, jugadores, canchas y partidos.
- Creacion de campeonatos/liga.
- Inscripcion de equipos al campeonato activo.
- Carga de canchas de barrio con tarifa, comision, responsable, horario y estado.
- Planteles con nombre, dorsal, posicion, apodo y foto del jugador.
- Formaciones visuales 5v5, 7v7 y 11v11.
- Fixture todos contra todos.
- Carga de resultados.
- Tabla automatica con puntos, PJ, G, E, P, GF, GC y DG.
- Vista `Negocio` con estimacion demo de ingresos.
- Backup/exportacion e importacion de datos JSON.
- Uso offline basico con service worker.
- Imagen Open Graph/Twitter Card en `og-image.jpg` para que al compartir el link aparezca una preview visual.

## Probar localmente

Desde esta carpeta:

```bash
python3 -m http.server 8080
```

Abrir:

```text
http://localhost:8080
```

En Windows tambien puede funcionar:

```powershell
python -m http.server 8080
```

## Assets de marca

El escudo base vive en `assets/icon.svg`. Para regenerar los PNG de instalacion y la imagen social:

```powershell
.\scripts\generate-brand-assets.ps1
```

El script genera:

- `assets/icon-192.png`
- `assets/icon-512.png`
- `og-image.jpg` en 1200x630 para previews sociales

## Modelo comercial sugerido

- Fee de inscripcion por equipo.
- Abono mensual para canchas partner.
- Comision por reservas de cancha generadas desde torneos.
- Sponsors por fecha, tabla, MVP o final.
- Estadisticas premium para equipos y jugadores.

## Proximo paso para version real

Esta version guarda datos en el navegador con `localStorage`. Para que canchas, equipos, organizadores y jugadores vean todo sincronizado desde distintos celulares, el siguiente paso es agregar:

- Login por rol.
- Base de datos online.
- Pagos de inscripcion y reservas.
- Paneles para cancha, organizador, equipo y jugador.
- Notificaciones push.
- Backend con permisos y auditoria.
