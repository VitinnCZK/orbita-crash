function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

/** Símbolo da marca Vitor Mello (vetor original, recortado no viewBox). */
function VitorMelloIcon() {
  return (
    <svg width="22" height="22" viewBox="600 740 1800 1520" fill="currentColor" aria-hidden="true">
      <polygon points="633.2,775.8 2234.3,775.8 2366.8,1033.5 2309.8,1144.5 2159,1437.8 2008.3,1144.5 1831.9,1144.5 2070.8,1609.4 1863,2013.7 1416.3,1144.5 1239.8,1144.5 1774.8,2185.4 1754.8,2224.2 1379.2,2224.2" />
    </svg>
  );
}

export function ExternalLinks() {
  return (
    <>
      <a
        className="jelly jelly-purple jelly-icon"
        href="https://github.com/VitinnCZK/orbita-crash"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Código no GitHub"
        title="Código no GitHub"
      >
        <GitHubIcon />
      </a>
      <a
        className="jelly jelly-purple jelly-icon"
        href="https://vitormello.dev"
        target="_blank"
        rel="noopener"
        aria-label="Site de Vitor Mello"
        title="vitormello.dev"
      >
        <VitorMelloIcon />
      </a>
    </>
  );
}
