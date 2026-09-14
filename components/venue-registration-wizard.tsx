"use client";

import { useState, useRef } from "react";
import { ChevronRight, ChevronLeft, Upload, MapPin, DollarSign, Users, CheckCircle, AlertCircle } from "lucide-react";
import type { ArenaVenue } from "@/lib/types";

interface VenueRegistrationWizardProps {
  onComplete?: (venue: Partial<ArenaVenue>) => void;
  onClose?: () => void;
}

type Step = "basic" | "location" | "pricing" | "photos" | "review";

interface FormData {
  name: string;
  description: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  pricePerHour: number | null;
  suggestedInscription: number | null;
  commission: number | null;
  capacity: number | null;
  photos: File[];
}

export function VenueRegistrationWizard({ onComplete, onClose }: VenueRegistrationWizardProps) {
  const [step, setStep] = useState<Step>("basic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    address: "",
    latitude: null,
    longitude: null,
    pricePerHour: null,
    suggestedInscription: null,
    commission: null,
    capacity: null,
    photos: [],
  });

  const steps: Step[] = ["basic", "location", "pricing", "photos", "review"];
  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleNext = () => {
    // Validate current step
    if (!validateStep(step)) {
      return;
    }
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
      setError("");
    }
  };

  const handlePrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
      setError("");
    }
  };

  const validateStep = (currentStep: Step): boolean => {
    setError("");
    switch (currentStep) {
      case "basic":
        if (!formData.name.trim()) {
          setError("El nombre de la cancha es requerido");
          return false;
        }
        if (formData.name.length < 3) {
          setError("El nombre debe tener al menos 3 caracteres");
          return false;
        }
        return true;
      case "location":
        if (!formData.address.trim()) {
          setError("La dirección es requerida");
          return false;
        }
        if (formData.latitude === null || formData.longitude === null) {
          setError("Por favor, selecciona la ubicación en el mapa");
          return false;
        }
        return true;
      case "pricing":
        if (formData.pricePerHour === null || formData.pricePerHour <= 0) {
          setError("El precio por hora es requerido");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + formData.photos.length > 5) {
      setError("Máximo 5 fotos permitidas");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      photos: [...prev.photos, ...files],
    }));
  };

  const handleRemovePhoto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      onComplete?.(formData);
    } catch (err) {
      setError("Error al registrar la cancha. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-6 py-6 rounded-t-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Registra tu Cancha</h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-emerald-800 rounded-full p-2 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-emerald-500 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-emerald-100">
            Paso {currentStepIndex + 1} de {steps.length}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Basic Info */}
          {step === "basic" && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Users size={24} className="text-emerald-600" />
                Información Básica
              </h3>
              <p className="text-sm text-gray-600">Cuéntanos sobre tu cancha</p>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre de la Cancha *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Ej: Cancha El Barrío"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Ej: Cancha 5v5 con iluminación nocturna..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Capacidad de jugadores (Opcional)
                </label>
                <input
                  type="number"
                  value={formData.capacity || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      capacity: e.target.value ? parseInt(e.target.value) : null,
                    }))
                  }
                  placeholder="Ej: 22"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Location */}
          {step === "location" && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <MapPin size={24} className="text-emerald-600" />
                Ubicación
              </h3>
              <p className="text-sm text-gray-600">Dónde se encuentra tu cancha</p>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Dirección *
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, address: e.target.value }))
                  }
                  placeholder="Calle, número, barrio"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Latitud *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.latitude || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        latitude: e.target.value ? parseFloat(e.target.value) : null,
                      }))
                    }
                    placeholder="-34.7"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Longitud *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.longitude || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        longitude: e.target.value ? parseFloat(e.target.value) : null,
                      }))
                    }
                    placeholder="-58.3"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 Tip: Abre Google Maps, encuentra tu cancha, haz clic y copia las coordenadas
                </p>
              </div>
            </div>
          )}

          {/* Pricing */}
          {step === "pricing" && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign size={24} className="text-emerald-600" />
                Precios y Comisión
              </h3>
              <p className="text-sm text-gray-600">Configuración financiera de tu cancha</p>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Precio por Hora ($) *
                </label>
                <input
                  type="number"
                  value={formData.pricePerHour || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      pricePerHour: e.target.value ? parseFloat(e.target.value) : null,
                    }))
                  }
                  placeholder="1000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Inscripción Sugerida ($) (Opcional)
                </label>
                <input
                  type="number"
                  value={formData.suggestedInscription || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      suggestedInscription: e.target.value ? parseFloat(e.target.value) : null,
                    }))
                  }
                  placeholder="500"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Comisión (%) (Opcional)
                </label>
                <input
                  type="number"
                  value={formData.commission || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      commission: e.target.value ? parseFloat(e.target.value) : null,
                    }))
                  }
                  placeholder="5"
                  min="0"
                  max="100"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Photos */}
          {step === "photos" && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Upload size={24} className="text-emerald-600" />
                Fotos de tu Cancha
              </h3>
              <p className="text-sm text-gray-600">Sube hasta 5 fotos (máximo 5MB cada una)</p>

              {/* Upload Area */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-emerald-300 rounded-lg p-8 text-center hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                <Upload size={32} className="mx-auto mb-2 text-emerald-600" />
                <p className="font-semibold text-gray-900">Sube tus fotos aquí</p>
                <p className="text-sm text-gray-600">o haz clic para seleccionar</p>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              {/* Photo Grid */}
              {formData.photos.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {formData.photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-40 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                      <p className="text-xs text-gray-600 mt-1 truncate">{photo.name}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  Fotos subidas: <span className="font-semibold">{formData.photos.length}/5</span>
                </p>
              </div>
            </div>
          )}

          {/* Review */}
          {step === "review" && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle size={24} className="text-emerald-600" />
                Revisa tu Información
              </h3>
              <p className="text-sm text-gray-600">Verifica que todo sea correcto antes de registrar</p>

              <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase">Nombre</p>
                  <p className="text-lg text-gray-900 font-medium">{formData.name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase">Ubicación</p>
                  <p className="text-gray-900">{formData.address}</p>
                  <p className="text-sm text-gray-600">
                    {formData.latitude}, {formData.longitude}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase">Precio por Hora</p>
                  <p className="text-lg text-emerald-600 font-semibold">${formData.pricePerHour}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase">Fotos</p>
                  <p className="text-gray-900">{formData.photos.length} foto(s) subida(s)</p>
                </div>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✓ Todo listo para registrar tu cancha en Fulbito Arena
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 mt-4">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3 justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
            Atrás
          </button>

          {step === "review" ? (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  <span>Registrar Cancha</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
            >
              Siguiente
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
