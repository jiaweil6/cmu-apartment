const SDK_BASE = "https://js.api.here.com/v3/3.1/";

/** Stylesheet for the map's zoom/layer controls. */
export const HERE_UI_STYLESHEET = `${SDK_BASE}mapsjs-ui.css`;

// Each module depends on the ones before it, so they load in order.
const MODULES = ["mapsjs-core.js", "mapsjs-service.js", "mapsjs-ui.js", "mapsjs-mapevents.js"];

let loading: Promise<typeof H> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

/** Loads the HERE Maps SDK once and resolves with the global `H` namespace. */
export function loadHereMaps(): Promise<typeof H> {
  loading ??= (async () => {
    for (const file of MODULES) await loadScript(SDK_BASE + file);
    if (!window.H) throw new Error("HERE Maps SDK loaded without defining H");
    return window.H;
  })().catch((error) => {
    loading = null; // allow a retry on the next mount
    throw error;
  });
  return loading;
}
