/** Reown's Solana adapters return bytes; tolerate wrapped legacy signatures. */
export function signatureBytes(value: unknown): Uint8Array {
  const candidate = value instanceof Uint8Array ? value
    : value && typeof value === "object" && "signature" in value ? value.signature : null;
  if (!(candidate instanceof Uint8Array) || candidate.length !== 64) {
    throw new Error("The wallet returned an invalid signature.");
  }
  return candidate;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function walletError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/reject|denied|cancel|closed|4001/i.test(message)) {
    return "Connection or signature cancelled. Try again when ready.";
  }
  return message || "Unable to connect wallet. Please try again.";
}
