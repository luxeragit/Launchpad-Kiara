import { createAppKit } from "@reown/appkit/react";
import { SolanaAdapter, type Provider } from "@reown/appkit-adapter-solana/react";
import { solana, solanaDevnet, solanaTestnet } from "@reown/appkit/networks";

let pending: Promise<ReturnType<typeof createAppKit>> | undefined;

/** One real SDK instance, loaded separately from the terminal's initial bundle. */
export function getWalletKit() {
  if (!pending) {
    pending = initialize().catch((error) => {
      pending = undefined;
      throw error;
    });
  }
  return pending;
}

async function initialize() {
  const projectId = import.meta.env.VITE_REOWN_PROJECT_ID?.trim();
  if (!projectId || !/^[a-f0-9]{32}$/i.test(projectId)) {
    throw new Error("Wallet connection is not configured. Check the Reown Project ID.");
  }
  const response = await fetch("/api/network/status");
  if (!response.ok) throw new Error("Unable to check the wallet network. Please retry.");
  const { walletNetwork } = await response.json();
  const network = walletNetwork === "mainnet-beta" ? solana
    : walletNetwork === "devnet" ? solanaDevnet
    : walletNetwork === "testnet" ? solanaTestnet : undefined;
  if (!network) throw new Error("Wallet network is not configured. Connection is paused.");

  const kit = createAppKit({
    adapters: [new SolanaAdapter()],
    projectId,
    // Follow the existing server wallet network, not the trading network.
    // Connecting/signing a login message never grants transaction approval.
    networks: [network],
    defaultNetwork: network,
    metadata: {
      name: "KiaraFun",
      description: "Connect your Solana wallet to KiaraFun",
      url: window.location.origin,
      icons: [new URL("/kiara.png", window.location.origin).href],
    },
    themeMode: document.documentElement.classList.contains("light") ? "light" : "dark",
    themeVariables: { "--w3m-accent": "#f077a5", "--w3m-border-radius-master": "2px" },
    enableNetworkSwitch: false,
    features: {
      analytics: false,
      email: false,
      socials: [],
      swaps: false,
      onramp: false,
      history: false,
    },
  });
  await kit.ready();
  return kit;
}

export type WalletKit = Awaited<ReturnType<typeof getWalletKit>>;

export function getSolanaProvider(kit: WalletKit): Provider {
  const provider = kit.getProvider<Provider>("solana");
  if (!provider?.signMessage) throw new Error("This wallet does not support Solana message signing.");
  return provider;
}

/** Resolves only for an actual connected Solana account; closing cancels cleanly. */
export async function connectSolana(kit: WalletKit): Promise<string> {
  const existing = kit.getAccount("solana");
  if (existing?.isConnected && existing.address) return existing.address;
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let opened = false;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribeAccount = () => {};
    let unsubscribeState = () => {};
    const finish = (address?: string, error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(closeTimer);
      unsubscribeAccount();
      unsubscribeState();
      if (address) resolve(address);
      else reject(error || new Error("Wallet connection cancelled."));
    };
    const timeout = setTimeout(() => {
      void kit.close();
      finish(undefined, new Error("Wallet connection timed out. Please try again."));
    }, 180_000);
    unsubscribeAccount = kit.subscribeAccount((account) => {
      if (account.isConnected && account.address) finish(account.address);
    }, "solana");
    unsubscribeState = kit.subscribeState((state) => {
      if (state.open) opened = true;
      else if (opened) {
        // Some adapters close the modal just before emitting the connected account.
        closeTimer = setTimeout(() => {
          const account = kit.getAccount("solana");
          finish(account?.isConnected ? account.address : undefined);
        }, 350);
      }
    });
    void kit.open({ view: "Connect", namespace: "solana" }).catch((error: unknown) => finish(undefined, error));
  });
}
