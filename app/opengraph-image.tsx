import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Fulbito Arena, torneos barriales con experiencia de juego";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const siteUrl = "https://fulbito-pwa.vercel.app";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: "linear-gradient(135deg, #02050b 0%, #071522 42%, #06110d 100%)",
          color: "#fff8e8",
          fontFamily: "Arial, Helvetica, sans-serif"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 24% 22%, rgba(85,246,255,.26), transparent 30%), radial-gradient(circle at 72% 42%, rgba(241,199,91,.34), transparent 30%), linear-gradient(180deg, transparent 54%, rgba(6,160,88,.28) 100%)"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -24,
            height: 190,
            background: "linear-gradient(90deg, rgba(14,112,62,.6), rgba(29,194,103,.44), rgba(14,112,62,.6))",
            borderTop: "3px solid rgba(255,255,255,.24)"
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 70,
            top: 78,
            display: "flex",
            width: 360,
            height: 410,
            opacity: .96
          }}
        >
          <img
            alt=""
            src={`${siteUrl}/assets/icon-512.png`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              filter: "drop-shadow(0 28px 70px rgba(241,199,91,.34))"
            }}
          />
        </div>
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 26,
            width: 720,
            padding: "72px 0 72px 78px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <img
              alt=""
              src={`${siteUrl}/assets/icon-192.png`}
              style={{
                width: 104,
                height: 104,
                borderRadius: 26,
                boxShadow: "0 0 0 2px rgba(241,199,91,.45), 0 20px 55px rgba(0,0,0,.5)"
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: "#55f6ff", fontSize: 24, fontWeight: 800, letterSpacing: 2 }}>PWA FUTBOL AMATEUR</span>
              <strong style={{ fontSize: 50, fontWeight: 900, lineHeight: 1 }}>FULBITO ARENA</strong>
            </div>
          </div>
          <h1 style={{ margin: 0, maxWidth: 660, fontSize: 74, lineHeight: .94, fontWeight: 950, textTransform: "uppercase" }}>
            Tu torneo entra en modo juego.
          </h1>
          <p style={{ margin: 0, maxWidth: 650, color: "#dce7f2", fontSize: 30, lineHeight: 1.28 }}>
            Crea copas barriales, invita equipos por WhatsApp, arma planteles y segui grupos, fixture y eliminatorias.
          </p>
          <div style={{ display: "flex", gap: 14 }}>
            <span
              style={{
                display: "flex",
                border: "1px solid rgba(241,199,91,.55)",
                borderRadius: 999,
                padding: "13px 20px",
                background: "linear-gradient(135deg, #ffe48c, #c9851f)",
                color: "#07080d",
                fontSize: 23,
                fontWeight: 900
              }}
            >
              Instalable como app
            </span>
            <span
              style={{
                display: "flex",
                border: "1px solid rgba(85,246,255,.36)",
                borderRadius: 999,
                padding: "13px 20px",
                background: "rgba(85,246,255,.12)",
                color: "#dffcff",
                fontSize: 23,
                fontWeight: 900
              }}
            >
              Fulbito TV + sorteos
            </span>
          </div>
        </div>
      </div>
    ),
    size
  );
}
