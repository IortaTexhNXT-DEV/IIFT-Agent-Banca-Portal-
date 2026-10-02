export const PRODUCT_NAME = 'SalesVerse 2.0';
export const COMPANY_NAME = 'Insurans Islam Family Takaful Sdn Bhd';
export const APP_VERSION = import.meta.env.VITE_APP_VERSION;
export const COPYRIGHT_YEAR = new Date().getFullYear();

/** Empty in production unless the deployment sets VITE_APP_ENV. */
export const APP_ENVIRONMENT =
  import.meta.env.VITE_APP_ENV ?? (import.meta.env.DEV ? 'Development' : '');
