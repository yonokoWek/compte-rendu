export default function Home() {
  return (
    <html lang="fr">
      <body style={{ padding: 40, fontFamily: 'sans-serif' }}>
        <h1>Compte Rendu - Test</h1>
        <p>Si vous voyez ceci, le déploiement fonctionne.</p>
        <p>Il est {new Date().toISOString()}</p>
      </body>
    </html>
  );
}