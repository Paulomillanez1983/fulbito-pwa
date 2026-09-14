"use client";

import { useState, useCallback } from "react";
import { VenueManagementSection } from "./venue-management-section";
import type { ArenaData } from "@/lib/types";

interface VenueIntegrationProps {
  data: ArenaData;
  onVenueCreated?: (venue: any) => void;
}

/**
 * Componente de integración para las mejoras de UX/UI de canchas
 * Gestiona el registro, visualización y compartimiento de canchas
 * 
 * Uso:
 * <VenueIntegration data={data} onVenueCreated={handleVenueCreated} />
 */
export function VenueIntegration({ data, onVenueCreated }: VenueIntegrationProps) {
  const userRole = data.user?.roles?.[0];

  const handleVenueCreated = useCallback(
    (newVenue: any) => {
      console.log("✅ Nueva cancha registrada:", newVenue);
      onVenueCreated?.(newVenue);
      // Aquí se puede agregar lógica adicional como:
      // - Analytics
      // - Notificaciones
      // - Recargar datos
    },
    [onVenueCreated]
  );

  return (
    <section className="w-full py-12 px-4 md:px-6 lg:px-8">
      <VenueManagementSection
        venues={data.venues || []}
        userRole={userRole}
        onVenueCreated={handleVenueCreated}
      />
    </section>
  );
}
