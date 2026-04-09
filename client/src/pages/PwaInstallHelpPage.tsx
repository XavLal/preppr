import { Link } from "react-router-dom";

function AndroidInstallIllustration() {
  return (
    <svg
      className="pwa-help-capture"
      viewBox="0 0 320 420"
      role="img"
      aria-labelledby="pwa-android-cap-title"
    >
      <title id="pwa-android-cap-title">
        Schéma du menu Chrome sur Android avec l’option d’installation de l’application
      </title>
      <rect width="320" height="420" fill="#e8ecea" rx="12" />
      <rect x="12" y="12" width="296" height="44" fill="#fff" rx="8" stroke="#d5dedc" />
      <circle cx="36" cy="34" r="10" fill="#cbd5d1" />
      <rect x="54" y="26" width="200" height="16" rx="4" fill="#eef4f2" />
      <rect x="266" y="28" width="28" height="12" rx="3" fill="#0d8065" opacity="0.35" />
      <text x="160" y="90" textAnchor="middle" fill="#5a6a68" fontSize="11" fontFamily="system-ui, sans-serif">
        preppr.example…
      </text>
      <rect x="24" y="108" width="272" height="180" fill="#fff" rx="10" stroke="#d5dedc" />
      <rect x="44" y="128" width="180" height="10" rx="3" fill="#e8f5f1" />
      <rect x="44" y="148" width="232" height="8" rx="2" fill="#eef4f2" />
      <rect x="44" y="164" width="200" height="8" rx="2" fill="#eef4f2" />
      <rect x="44" y="180" width="220" height="8" rx="2" fill="#eef4f2" />
      <rect x="232" y="300" width="64" height="48" fill="#fff" rx="10" stroke="#0d8065" strokeWidth="2" />
      <text x="264" y="328" textAnchor="middle" fill="#14201f" fontSize="18" fontFamily="system-ui, sans-serif">
        ⋮
      </text>
      <rect x="140" y="268" width="168" height="132" fill="#fff" rx="10" stroke="#d5dedc" strokeWidth="1.5" />
      <rect x="152" y="282" width="144" height="12" rx="3" fill="#f4f7f6" />
      <rect x="152" y="302" width="144" height="32" rx="6" fill="#e8f5f1" stroke="#0d8065" strokeWidth="1.5" />
      <text x="176" y="322" fill="#095848" fontSize="10" fontWeight="600" fontFamily="system-ui, sans-serif">
        Installer l’app
      </text>
      <rect x="152" y="342" width="144" height="22" rx="4" fill="#f4f7f6" />
      <rect x="152" y="370" width="144" height="22" rx="4" fill="#f4f7f6" />
    </svg>
  );
}

function IosInstallIllustration() {
  return (
    <svg
      className="pwa-help-capture"
      viewBox="0 0 320 420"
      role="img"
      aria-labelledby="pwa-ios-cap-title"
    >
      <title id="pwa-ios-cap-title">
        Schéma de Safari sur iPhone avec le bouton Partager et l’option Sur l’écran d’accueil
      </title>
      <rect width="320" height="420" fill="#e8ecea" rx="12" />
      <rect x="12" y="12" width="296" height="36" fill="#fff" rx="8" stroke="#d5dedc" />
      <rect x="24" y="24" width="120" height="12" rx="3" fill="#eef4f2" />
      <text x="160" y="72" textAnchor="middle" fill="#5a6a68" fontSize="11" fontFamily="system-ui, sans-serif">
        preppr.example…
      </text>
      <rect x="24" y="88" width="272" height="220" fill="#fff" rx="10" stroke="#d5dedc" />
      <rect x="44" y="108" width="160" height="10" rx="3" fill="#e8f5f1" />
      <rect x="44" y="128" width="232" height="8" rx="2" fill="#eef4f2" />
      <rect x="44" y="144" width="200" height="8" rx="2" fill="#eef4f2" />
      <rect x="12" y="318" width="296" height="90" fill="#f2f4f3" rx="0" />
      <rect x="12" y="318" width="296" height="1" fill="#d5dedc" />
      <circle cx="64" cy="358" r="18" fill="#fff" stroke="#d5dedc" />
      <path
        d="M64 348v20M54 358h20"
        stroke="#14201f"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <text x="64" y="388" textAnchor="middle" fill="#5a6a68" fontSize="8" fontFamily="system-ui, sans-serif">
        Partager
      </text>
      <rect x="110" y="320" width="200" height="76" fill="#fff" rx="10" stroke="#0d8065" strokeWidth="1.5" />
      <rect x="122" y="334" width="160" height="24" rx="6" fill="#e8f5f1" stroke="#0d8065" strokeWidth="1.2" />
      <text x="152" y="351" fill="#095848" fontSize="9" fontWeight="600" fontFamily="system-ui, sans-serif">
        Sur l’écran d’accueil
      </text>
      <rect x="122" y="366" width="160" height="18" rx="4" fill="#f4f7f6" />
    </svg>
  );
}

export default function PwaInstallHelpPage() {
  return (
    <div className="settings pwa-install-help">
      <p className="breadcrumb">
        <Link to="/parametres">Paramètres</Link>
        <span className="muted small" aria-hidden="true">
          {" "}
          /{" "}
        </span>
        <span className="muted small">Installer l’app</span>
      </p>
      <h1>Installer Preppr sur votre téléphone</h1>
      <p className="muted small">
        Une fois installée, Preppr s’ouvre comme une application et reste utilisable hors ligne pour la liste de
        courses (selon ce que votre navigateur a déjà mis en cache).
      </p>

      <div className="pwa-help-grid">
        <figure className="card pwa-help-card">
          <figcaption className="pwa-help-caption">
            <strong>Android (Chrome)</strong>
            <span className="muted small">
              Touchez le menu <strong>⋮</strong> en haut à droite, puis choisissez{" "}
              <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong> (selon la
              version).
            </span>
          </figcaption>
          <AndroidInstallIllustration />
        </figure>

        <figure className="card pwa-help-card">
          <figcaption className="pwa-help-caption">
            <strong>iPhone ou iPad (Safari)</strong>
            <span className="muted small">
              Touchez le bouton <strong>Partager</strong>{" "}
              <span aria-hidden="true">(□↑)</span>, faites défiler si besoin, puis{" "}
              <strong>Sur l’écran d’accueil</strong>.
            </span>
          </figcaption>
          <IosInstallIllustration />
        </figure>
      </div>

      <p className="muted small">
        Si vous ne voyez pas l’invite d’installation, vérifiez que vous ouvrez le site en{" "}
        <strong>HTTPS</strong> et que vous utilisez bien Chrome (Android) ou Safari (iOS).
      </p>

      <div className="row" style={{ marginTop: "1.25rem" }}>
        <Link to="/parametres" className="btn ghost">
          Retour aux paramètres
        </Link>
      </div>
    </div>
  );
}
