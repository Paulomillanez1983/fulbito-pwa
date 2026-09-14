"use client";

import React from "react";

interface HowItWorksProps {
  className?: string;
}

export function HowItWorksVenue({ className = "" }: HowItWorksProps) {
  const steps = [
    {
      number: 1,
      title: "Registra tu Cancha",
      description: "Completa el formulario con datos básicos, ubicación y precios",
      icon: "📝",
    },
    {
      number: 2,
      title: "Sube Fotos",
      description: "Muestra tu cancha con fotos de calidad (máximo 5)",
      icon: "📸",
    },
    {
      number: 3,
      title: "Comparte en Redes",
      description: "Difunde tu cancha por WhatsApp, Instagram, Facebook",
      icon: "📤",
    },
    {
      number: 4,
      title: "Recibe Reservas",
      description: "Los jugadores se registran y reservan tu cancha",
      icon: "⚽",
    },
  ];

  return (
    <section className={`py-16 px-4 md:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white ${className}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Así funciona</h2>
          <p className="text-xl text-gray-600">Registra tu cancha en 4 simples pasos</p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Card */}
              <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow h-full border border-gray-200">
                {/* Number Badge */}
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                  {step.number}
                </div>

                {/* Icon */}
                <div className="text-5xl mb-4">{step.icon}</div>

                {/* Content */}
                <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.description}</p>
              </div>

              {/* Arrow */}
              {index < steps.length - 1 && (
                <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 items-center justify-center text-emerald-600 text-2xl pointer-events-none">
                  →
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <button className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-lg font-bold text-lg shadow-lg hover:shadow-xl transition-all">
            🏟️ Registra tu Cancha Ahora
          </button>
        </div>
      </div>
    </section>
  );
}
