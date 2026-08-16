/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the DPDPA Sentinel backend, e.g. http://localhost:4000 */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

