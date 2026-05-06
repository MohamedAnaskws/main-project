// src/vite-env.d.ts
/// <reference types="vite/client" />

// Type definitions for CSS modules
declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// Type definitions for environment variables
interface ImportMetaEnv {
  // Add any VITE_ prefixed variables you use
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  // Add more as needed
  // readonly VITE_APP_TITLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}