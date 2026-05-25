/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SOCKET_URL?: string;
  readonly VITE_DEV_BACKEND_URL?: string;
  readonly VITE_ALCHEMY_BSC_URL?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
}

interface Window {
  ethereum?: {
    providers?: unknown[];
    isMetaMask?: boolean;
    isPhantom?: boolean;
    isTrust?: boolean;
  };
  trustwallet?: unknown;
  phantom?: { ethereum?: unknown };
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
