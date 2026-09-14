"use client";

import React from "react";
import { CheckCircle, Share2, Users, MapPin } from "lucide-react";

interface BenefitsVenueProps {
  className?: string;
}

export function BenefitsVenue({ className = "" }: BenefitsVenueProps) {
  const benefits = [
    {
      icon: <Share2 className="w-8 h-8" />,
      title: "Comparte Fácil",
      description: "Difunde tu cancha por WhatsApp, Instagram, Facebook y Twitter con un clic",
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Más Reservas",
      description: "Llega a más jugadores y organiza más partidos en tu cancha",
    },
    {
      icon: <MapPin className="w-8 h-8" />,
      title: "Ubicación Clara",
      description: "Los jugadores encuentran tu cancha fácilmente con GPS y fotos",
    },
    {
      icon: <CheckCircle className="w-8 h-8" />,
      title: "Control Total",
      description: "Gestiona precios, disponibilidad y datos de tu cancha desde un lugar",
    },
  ];

  return (
    <section className={`py-16 px-4 md:px-6 lg:px-8 bg-white ${className}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Beneficios para tu Cancha</h2>
          <p className="text-xl text-gray-600">Herramientas modernas diseñadas para dueños de canchas</p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex gap-4 p-6 bg-gradient-to-br from-emerald-50 to-transparent rounded-xl border border-emerald-200 hover:border-emerald-300 transition-colors">
              <div className="flex-shrink-0 text-emerald-600">{benefit.icon}</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
