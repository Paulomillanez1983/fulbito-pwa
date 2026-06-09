import { NextResponse, type NextRequest } from "next/server";

type NominatimReverseResult = {
  display_name?: string;
  address?: {
    road?: string;
    pedestrian?: string;
    footway?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    quarter?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
  };
};

function validCoordinate(value: string | null, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const latitude = validCoordinate(url.searchParams.get("lat"), -90, 90);
  const longitude = validCoordinate(url.searchParams.get("lon"), -180, 180);

  if (latitude === null || longitude === null) {
    return NextResponse.json({ error: "Coordenadas invalidas" }, { status: 400 });
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "18",
    addressdetails: "1",
    layer: "address",
    "accept-language": "es"
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: {
      "User-Agent": "Fulbito Arena PWA contact: https://fulbito-pwa.vercel.app",
      Referer: "https://fulbito-pwa.vercel.app"
    },
    next: { revalidate: 60 * 60 * 24 }
  });

  if (!response.ok) {
    return NextResponse.json({ error: "No se pudo leer la direccion" }, { status: 502 });
  }

  const result = (await response.json()) as NominatimReverseResult;
  const address = result.address ?? {};
  const street = address.road ?? address.pedestrian ?? address.footway ?? "";
  const house = address.house_number ? ` ${address.house_number}` : "";
  const neighborhood =
    address.suburb ??
    address.neighbourhood ??
    address.quarter ??
    address.city_district ??
    address.village ??
    address.town ??
    address.city ??
    "";
  const displayAddress = street ? `${street}${house}` : result.display_name?.split(",").slice(0, 2).join(", ").trim() ?? "";

  return NextResponse.json(
    {
      neighborhood,
      address: displayAddress,
      attribution: "OpenStreetMap / Nominatim"
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"
      }
    }
  );
}
