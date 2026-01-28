/**
 * Calculate Anchor instruction discriminator using Web Crypto API
 * @param instructionName The instruction name (e.g., "settle_game")
 * @returns 8-byte discriminator array
 */
export async function calculateDiscriminator(
  instructionName: string,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`global:${instructionName}`);

  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);

  return hashArray.slice(0, 8);
}

// Pre-calculated discriminators for common instructions
// These are calculated from sha256("global:instruction_name").slice(0, 8)
export const DISCRIMINATORS = {
  CREATE_TABLE: new Uint8Array([
    0xd6, 0x8e, 0x83, 0xfa, 0xf2, 0x53, 0x87, 0xb9,
  ]),
  JOIN_TABLE: new Uint8Array([0x0e, 0x75, 0x54, 0x33, 0x5f, 0x92, 0xab, 0x46]),
  START_GAME: new Uint8Array([0xf9, 0x2f, 0xfc, 0xac, 0xb8, 0xa2, 0xf5, 0x0e]),
  SETTLE_GAME: new Uint8Array([0x60, 0x36, 0x18, 0xbd, 0xef, 0xc6, 0x56, 0x1d]),
  PLAYER_ACTION: new Uint8Array([
    0x25, 0x55, 0x19, 0x87, 0xc8, 0x74, 0x60, 0x65,
  ]),
  DEAL_CARDS: new Uint8Array([0x26, 0xda, 0xf7, 0x67, 0xda, 0xed, 0x18, 0x41]),
  SUBMIT_CARDS: new Uint8Array([
    0x6d, 0x53, 0xa1, 0xad, 0x8d, 0x1d, 0x47, 0xa8,
  ]),
  GENERATE_OFFSET: new Uint8Array([
    0x77, 0xf2, 0x60, 0xa7, 0x3b, 0xa5, 0x11, 0x9a,
  ]),
  ADVANCE_STAGE: new Uint8Array([
    0xf5, 0x74, 0xda, 0xd6, 0x32, 0x62, 0x9b, 0xcd,
  ]),
} as const;
