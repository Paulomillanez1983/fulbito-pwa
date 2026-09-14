# 🎯 EJEMPLO: Cómo usar todas las mejoras en tu app

Este archivo muestra ejemplos prácticos de cómo integrar los nuevos componentes en tu aplicación.

## 1️⃣ Opción Fácil: Usar todo integrado en una sección

### En tu `components/arena-experience.tsx`

```tsx
import { VenueIntegration } from "@/components/venue-integration";
import { HowItWorksVenue } from "@/components/how-it-works-venue";
import { BenefitsVenue } from "@/components/benefits-venue";

export function ArenaExperience({ data, ... }) {
  return (
    <div className="space-y-8">
      {/* Tu contenido existente */}
      
      {/* NUEVA: Sección de canchas con toda la UX mejorada */}
      <VenueIntegration data={data} />
      
      {/* NUEVA: Mostrar cómo funciona (marketing) */}
      <HowItWorksVenue />
      
      {/* NUEVA: Mostrar beneficios (marketing) */}
      <BenefitsVenue />
      
      {/* Resto de contenido */}
    </div>
  );
}
```

---

## 2️⃣ Opción Modular: Usar componentes individuales

### Solo la tarjeta de cancha mejorada

```tsx
import { VenueCardEnhanced } from "@/components/venue-card-enhanced";

function MyVenuesList() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {venues.map(venue => (
        <VenueCardEnhanced
          key={venue.id}
          venue={venue}
          onClick={() => handleSelectVenue(venue)}
          onShare={() => trackShare(venue.id)}
        />
      ))}
    </div>
  );
}
```

### Solo el wizard de registro

```tsx
import { VenueRegistrationWizard } from "@/components/venue-registration-wizard";
import { useState } from "react";

function VenueRegisterPage() {
  const [showWizard, setShowWizard] = useState(false);

  return (
    <div>
      <button onClick={() => setShowWizard(true)}>
        Registrar Cancha
      </button>

      {showWizard && (
        <VenueRegistrationWizard
          onComplete={async (venueData) => {
            // Guardar en Supabase
            const { data, error } = await supabase
              .from("venues")
              .insert([{
                name: venueData.name,
                description: venueData.description,
                address: venueData.address,
                latitude: venueData.latitude,
                longitude: venueData.longitude,
                price_per_hour: venueData.pricePerHour,
                suggested_inscription: venueData.suggestedInscription,
                commission: venueData.commission,
                capacity: venueData.capacity,
                owner_id: user.id,
              }]);

            // Subir fotos
            for (const photo of venueData.photos) {
              await supabase.storage
                .from("venue-photos")
                .upload(`${data[0].id}/${photo.name}`, photo);
            }

            setShowWizard(false);
          }}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
```

### Solo el compartir en redes

```tsx
import { VenueShareSocial } from "@/components/venue-share-social";

function ShareVenueModal({ venue, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-sm">
        <h2 className="text-2xl font-bold mb-4">Comparte {venue.name}</h2>
        <VenueShareSocial venue={venue} />
        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 bg-gray-200 rounded-lg"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
```

---

## 3️⃣ Ejemplo completo de página de canchas

```tsx
"use client";

import { useState } from "react";
import { VenueManagementSection } from "@/components/venue-management-section";
import { HowItWorksVenue } from "@/components/how-it-works-venue";
import { BenefitsVenue } from "@/components/benefits-venue";
import { ShareMetrics } from "@/components/share-metrics";
import type { ArenaData } from "@/lib/types";

interface VenuesPageProps {
  data: ArenaData;
}

export function VenuesPage({ data }: VenuesPageProps) {
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  const selectedVenue = data.venues?.find(v => v.id === selectedVenueId);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            🏟️ Canchas en Fulbito Arena
          </h1>
          <p className="text-xl text-emerald-100">
            Registra tu cancha y llega a más jugadores
          </p>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Venue Management */}
        <VenueManagementSection
          venues={data.venues || []}
          userRole={data.user?.roles?.[0]}
          onVenueCreated={(newVenue) => {
            console.log("✅ Cancha registrada:", newVenue);
            // Recargar datos o actualizar estado
          }}
        />

        {/* Metrics si hay cancha seleccionada */}
        {selectedVenue && (
          <div className="mt-8">
            <ShareMetrics
              venueId={selectedVenue.id}
              venueName={selectedVenue.name}
            />
          </div>
        )}
      </div>

      {/* How It Works */}
      <HowItWorksVenue />

      {/* Benefits */}
      <BenefitsVenue />

      {/* FAQ o CTA adicional */}
      <section className="bg-emerald-50 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            ¿Preguntas?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Contacta con nuestro equipo de soporte
          </p>
          <a
            href="mailto:support@fulbito-pwa.vercel.app"
            className="inline-block px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors"
          >
            Enviar Email
          </a>
        </div>
      </section>
    </div>
  );
}
```

---

## 4️⃣ Configuración en el layout principal

### En `app/layout.tsx` o `app/page.tsx`

Asegúrate de que los imports están correctos:

```tsx
// Importa los nuevos componentes
import { VenueIntegration } from "@/components/venue-integration";
import { HowItWorksVenue } from "@/components/how-it-works-venue";
import { BenefitsVenue } from "@/components/benefits-venue";
import { VenueManagementSection } from "@/components/venue-management-section";
import { VenueCardEnhanced } from "@/components/venue-card-enhanced";
import { VenueRegistrationWizard } from "@/components/venue-registration-wizard";
import { VenueShareSocial } from "@/components/venue-share-social";
import { ShareMetrics } from "@/components/share-metrics";

// En tu componente principal
export default function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const data = await getArenaData(...);

  return (
    <>
      {/* Contenido existente */}
      
      {/* Nueva sección de canchas */}
      <VenueIntegration data={data} />
      
      {/* Resto de contenido */}
    </>
  );
}
```

---

## 5️⃣ Variables de entorno (si necesitas tracking)

En `.env.local`:

```env
# URLs para compartir
NEXT_PUBLIC_SHARE_BASE_URL=https://fulbito-pwa.vercel.app

# Analytics (opcional)
NEXT_PUBLIC_ANALYTICS_ID=tu-id
```

---

## ✅ Checklist de integración

- [ ] Importar componentes en tu archivo
- [ ] Agregar tipos si es necesario
- [ ] Probar en desarrollo: `npm run dev`
- [ ] Probar en mobile
- [ ] Probar compartir en WhatsApp
- [ ] Probar registro de cancha
- [ ] Probar carga de fotos
- [ ] Deploy a producción

---

## 🐛 Troubleshooting

**Problema:** "Cannot find module"
**Solución:** Verifica que la ruta de import sea correcta (usa `@/components/...`)

**Problema:** Componente no aparece
**Solución:** Asegúrate de que esté dentro del div correcto con `z-50` si es modal

**Problema:** Fotos no se suben
**Solución:** Verifica que Supabase Storage esté configurado con RLS correcto

**Problema:** Compartir no funciona en mobile
**Solución:** Algunos navegadores no soportan `navigator.share`, pero tienes el fallback de copiar link

---

## 📞 Soporte

Si necesitas ayuda, revisa:

1. `INTEGRATION_GUIDE.md` - Guía detallada
2. Los comentarios en cada componente
3. Los tipos en `@/lib/types.ts`

---

**Rama:** `feature/venue-ux-improvements`
**Status:** ✅ Lista para usar
**Última actualización:** 2024-09-14
