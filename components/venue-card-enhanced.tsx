"use client";

import { useState } from "react";
import { MapPin, DollarSign, Users, ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { VenueShareSocial } from "./venue-share-social";
import type { ArenaVenue } from "@/lib/types";

interface VenueCardEnhancedProps {
  venue: ArenaVenue;
  onClick?: () => void;
  onShare?: () => void;
}

export function VenueCardEnhanced({ venue, onClick, onShare }: VenueCardEnhancedProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showShare, setShowShare] = useState(false);

  const photos = venue.photo_urls || [];
  const hasPhotos = photos.length > 0;

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-xl shadow-lg hover:shadow-2xl transition-shadow overflow-hidden cursor-pointer"
    >
      {/* Photo Gallery */}
      <div className="relative w-full aspect-video bg-gray-200 overflow-hidden">
        {hasPhotos ? (
          <>
            <img
              src={photos[photoIndex]}
              alt={`${venue.name} - Photo ${photoIndex + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {photos.length > 1 && (
              <>
                {/* Photo Counter */}
                <div className="absolute top-3 right-3 bg-black bg-opacity-60 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  {photoIndex + 1}/{photos.length}
                </div>

                {/* Navigation Arrows */}
                <button
                  onClick={handlePrevPhoto}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 rounded-full p-2 transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={handleNextPhoto}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 rounded-full p-2 transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight size={20} />
                </button>

                {/* Dot Indicators */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                  {photos.map((_, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoIndex(index);
                      }}
                      className={`h-2 rounded-full transition-all ${
                        index === photoIndex
                          ? "bg-white w-6"
                          : "bg-white bg-opacity-50 w-2 hover:bg-opacity-75"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center">
            <div className="text-center">
              <Users size={48} className="text-emerald-600 mx-auto mb-2" />
              <p className="text-emerald-700 font-semibold">Sin fotos aún</p>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Name */}
        <div>
          <h3 className="text-lg font-bold text-gray-900 line-clamp-2 group-hover:text-emerald-600 transition-colors">
            {venue.name}
          </h3>
          {venue.description && (
            <p className="text-sm text-gray-600 line-clamp-2 mt-1">{venue.description}</p>
          )}
        </div>

        {/* Location */}
        {venue.address && (
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <MapPin size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2">{venue.address}</span>
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
          {/* Price */}
          {venue.price_per_hour && (
            <div className="flex items-center gap-2">
              <div className="bg-emerald-100 rounded-lg p-2">
                <DollarSign size={16} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Hora</p>
                <p className="text-sm font-bold text-gray-900">${venue.price_per_hour}</p>
              </div>
            </div>
          )}

          {/* Capacity */}
          {venue.capacity && (
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 rounded-lg p-2">
                <Users size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Jugadores</p>
                <p className="text-sm font-bold text-gray-900">{venue.capacity}</p>
              </div>
            </div>
          )}
        </div>

        {/* CTA Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
          <button
            onClick={onClick}
            className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            Ver Detalles
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowShare(true);
              onShare?.();
            }}
            className="py-2 px-3 border border-emerald-600 text-emerald-600 hover:bg-emerald-50 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-1"
          >
            <Share2 size={14} />
            Compartir
          </button>
        </div>

        {/* Share Modal */}
        {showShare && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold text-emerald-900">Compartir cancha</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShare(false);
                }}
                className="text-emerald-600 hover:text-emerald-800"
              >
                ✕
              </button>
            </div>
            <VenueShareSocial venue={venue} />
          </div>
        )}
      </div>
    </div>
  );
}
