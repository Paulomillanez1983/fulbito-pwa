export default function OfflinePage() {
  return (
    <main className="offline-page">
      <img alt="" src="/assets/icon.svg" />
      <p className="eyebrow">Modo offline</p>
      <h1>Fulbito Arena esta sin conexion</h1>
      <p>La PWA mantiene la pantalla base en cache. Para datos, login, resultados y canchas necesitas volver a estar online.</p>
      <a href="/">Volver a la arena</a>
    </main>
  );
}
