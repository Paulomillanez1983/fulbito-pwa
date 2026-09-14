"use client";

import { useEffect, useState } from "react";
import { Share2, Copy, Check } from "lucide-react";

interface ShareMetricsProps {
  venueId: string;
  venueName: string;
}

export function ShareMetrics({ venueId, venueName }: ShareMetricsProps) {
  const [shareCount, setShareCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const shareUrl = `https://fulbito-pwa.vercel.app?register_venue=true&venue=${venueId}`;

  useEffect(() => {
    // Cargar conteo de shares (si tienes API)
    const loadShareCount = async () => {
      try {
        const res = await fetch(`/api/venues/${venueId}/shares`);
        if (res.ok) {
          const data = await res.json();
          setShareCount(data.count || 0);
        }
      } catch (err) {
        console.log("No metrics endpoint");
      }
    };

    loadShareCount();
  }, [venueId]);

  const copyUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 font-semibold">Compartimientos</p>
          <p className="text-2xl font-bold text-emerald-600">{shareCount}</p>
        </div>
        <button
          onClick={copyUrl}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 border border-emerald-200 rounded-lg transition-colors"
        >
          {copied ? (
            <>
              <Check size={16} className="text-green-600" />
              <span className="text-sm font-semibold text-green-600">Copiado</span>
            </>
          ) : (
            <>
              <Copy size={16} className="text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-600">Copiar Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
