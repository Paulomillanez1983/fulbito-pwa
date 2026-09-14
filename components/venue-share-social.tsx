"use client";

import { Share2, MessageCircle, Heart, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { ArenaVenue } from "@/lib/types";

interface VenueShareSocialProps {
  venue: ArenaVenue;
  baseUrl?: string;
}

export function VenueShareSocial({ venue, baseUrl = "https://fulbito-pwa.vercel.app" }: VenueShareSocialProps) {
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const venueUrl = `${baseUrl}?register_venue=true&venue=${venue.id}`;
  const venueTitle = venue.name || "Cancha de Futbol";
  const venueDescription = `Registrate en ${venueTitle} en Fulbito Arena - Torneos barriales premium`;
  const venueImage = venue.photo_urls?.[0] || `${baseUrl}/og-image.jpg`;

  const shareLinks = [
    {
      name: "WhatsApp",
      icon: "💬",
      url: `https://wa.me/?text=${encodeURIComponent(`${venueDescription}\n${venueUrl}`)}`,
      color: "bg-green-600 hover:bg-green-700",
    },
    {
      name: "Instagram",
      icon: "📷",
      url: `https://www.instagram.com/`,
      color: "bg-pink-600 hover:bg-pink-700",
      action: () => {
        copyToClipboard(venueUrl);
        alert("Link copiado. Comparte en tu historia o feed de Instagram!");
      },
    },
    {
      name: "Facebook",
      icon: "f",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(venueUrl)}`,
      color: "bg-blue-600 hover:bg-blue-700",
    },
    {
      name: "Twitter",
      icon: "𝕏",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(venueDescription)}&url=${encodeURIComponent(venueUrl)}`,
      color: "bg-black hover:bg-gray-800",
    },
    {
      name: "Copiar Link",
      icon: "🔗",
      action: () => copyToClipboard(venueUrl),
      color: "bg-emerald-600 hover:bg-emerald-700",
    },
  ];

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative">
      {/* Main Share Button */}
      <button
        onClick={() => setShowShareMenu(!showShareMenu)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition-colors shadow-md hover:shadow-lg"
      >
        <Share2 size={18} />
        <span>Compartir Cancha</span>
      </button>

      {/* Share Menu */}
      {showShareMenu && (
        <div className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-3 min-w-[280px] animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Share Title */}
          <div className="mb-3 pb-3 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Comparte en:</p>
          </div>

          {/* Social Buttons Grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {shareLinks.slice(0, 4).map((link) => (
              <button
                key={link.name}
                onClick={() => {
                  if (link.action) {
                    link.action();
                  } else if (link.url) {
                    window.open(link.url, "_blank", "width=600,height=400");
                  }
                  setShowShareMenu(false);
                }}
                className={`${link.color} text-white py-2 rounded-md font-semibold text-sm transition-colors flex items-center justify-center gap-1`}
              >
                <span>{link.icon}</span>
                <span>{link.name}</span>
              </button>
            ))}
          </div>

          {/* Copy Link Button */}
          <button
            onClick={() => {
              copyToClipboard(venueUrl);
              setShowShareMenu(false);
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-md font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check size={16} />
                <span>Link Copiado!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copiar Link de Invitación</span>
              </>
            )}
          </button>

          {/* QR Code Option */}
          <div className="mt-3 pt-3 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500 mb-2">O genera un código QR</p>
            <button
              onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(venueUrl)}`, "_blank")}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold underline"
            >
              Generar QR
            </button>
          </div>
        </div>
      )}

      {/* Mobile Native Share (if available) */}
      {typeof navigator !== "undefined" && navigator.share && (
        <button
          onClick={() => {
            navigator.share({
              title: venueTitle,
              text: venueDescription,
              url: venueUrl,
            }).catch(() => {});
          }}
          className="ml-2 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          title="Compartir nativamente"
        >
          <Share2 size={18} className="text-gray-700" />
        </button>
      )}
    </div>
  );
}
