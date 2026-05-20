/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KITTY_FACTORY?: `0x${string}`;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
