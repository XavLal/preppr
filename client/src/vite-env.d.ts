/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module "*?raw" {
  const content: string;
  export default content;
}

// Permet d'importer des modules React écrits en `.jsx` depuis TypeScript.
declare module "*.jsx" {
  const Component: any;
  export default Component;
}

