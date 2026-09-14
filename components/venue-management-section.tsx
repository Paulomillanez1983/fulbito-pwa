"use client";

import { useState } from "react";
import { VenueRegistrationWizard } from "@/components/venue-registration-wizard";
import { VenueCardEnhanced } from "@/components/venue-card-enhanced";
import type { ArenaVenue } from "@/lib/types";

interface VenueManagementSectionProps {
  venues: ArenaVenue[];
  userRole?: string;
  onVenueCreated?: (venue: ArenaVenue) => void;
}

export function VenueManagementSection({
  venues,
  userRole,
  onVenueCreated,
}: VenueManagementSectionProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<ArenaVenue | null>(null);

  const isVenueOwner = userRole === "owner_cancha" || userRole === "admin";

  return (
    <div className="space-y-6">
      {/* Header con botón de registro */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">⚽ Canchas</h2>
          <p className="text-gray-600 mt-1">
            {venues.length} cancha{venues.length !== 1 ? "s" : ""} disponible
            {venues.length !== 1 ? "s" : ""}
          </p>
        </div>

        {isVenueOwner && (
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <span className="text-xl">🏟️</span>
            <span>Registra tu Cancha</span>
          </button>
        )}
      </div>

      {/* Grid de canchas */}
      {venues.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map((venue) => (
            <VenueCardEnhanced
              key={venue.id}
              venue={venue}
              onClick={() => setSelectedVenue(venue)}
              onShare={() => {
                // Evento de tracking si es necesario
                console.log("Shared venue:", venue.name);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-lg mb-4">No hay canchas registradas aún</p>
          {isVenueOwner && (
            <button
              onClick={() => setShowWizard(true)}
              className="text-emerald-600 hover:text-emerald-700 font-semibold underline"
            >
              Sé el primero en registrar una cancha →
            </button>
          )}
        </div>
      )}

      {/* Wizard para registrar cancha */}
      {showWizard && (
        <VenueRegistrationWizard
          onComplete={async (venueData) => {
            // Aquí integrar con tu API
            console.log("Nueva cancha:", venueData);
            setShowWizard(false);
            // Llamar callback
            onVenueCreated?.(venueData as ArenaVenue);
          }}
          onClose={() => setShowWizard(false)}
        />
      )}

      {/* Detalle de cancha (opcional) */}
      {selectedVenue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold text-gray-900">{selectedVenue.name}</h3>
              <button
                onClick={() => setSelectedVenue(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            {selectedVenue.photo_urls && selectedVenue.photo_urls.length > 0 && (
              <img
                src={selectedVenue.photo_urls[0]}
                alt={selectedVenue.name}
                className="w-full h-64 object-cover rounded-lg mb-4"
              />
            )}
            <p className="text-gray-700 mb-4">{selectedVenue.description}</p>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <strong>Ubicación:</strong> {selectedVenue.address}
              </p>
              <p>
                <strong>Precio:</strong> ${selectedVenue.price_per_hour}/hora
              </p>
              {selectedVenue.capacity && (
                <p>
                  <strong>Capacidad:</strong> {selectedVenue.capacity} jugadores
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
