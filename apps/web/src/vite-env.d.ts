/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CIRCLES_ENV?: 'sandbox' | 'mainnet';
  readonly VITE_POT_GOVERNANCE_FACTORY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
