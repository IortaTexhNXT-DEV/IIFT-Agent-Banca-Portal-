/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Release of the web application, from package.json (set in vite.config.ts). */
  readonly VITE_APP_VERSION: string;
  /** Environment label shown on the sign-in page and in the footer, e.g. "UAT". */
  readonly VITE_APP_ENV?: string;
}
