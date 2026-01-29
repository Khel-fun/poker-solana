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

// Pre-calculated discriminators for all instructions
// These are calculated from sha256("global:instruction_name").slice(0, 8)
export const DISCRIMINATORS = {
  CREATE_TABLE: new Uint8Array([
    0xd6, 0x8e, 0x83, 0xfa, 0xf2, 0x53, 0x87, 0xb9,
  ]),
  JOIN_TABLE: new Uint8Array([0x0e, 0x75, 0x54, 0x33, 0x5f, 0x92, 0xab, 0x46]),
  LEAVE_TABLE: new Uint8Array([0xa3, 0x99, 0x5e, 0xc2, 0x13, 0x6a, 0x71, 0x20]),
  START_GAME: new Uint8Array([0xf9, 0x2f, 0xfc, 0xac, 0xb8, 0xa2, 0xf5, 0x0e]),
  PROCESS_CARDS_BATCH: new Uint8Array([
    0x4e, 0x95, 0xf3, 0x7d, 0xf6, 0xb7, 0xa0, 0xe0,
  ]),
  REVEAL_HAND: new Uint8Array([0xcf, 0xd0, 0x36, 0x50, 0x8a, 0x5d, 0xc5, 0x82]),
  REVEAL_CARD_OFFSET: new Uint8Array([
    0x0f, 0x47, 0x22, 0x37, 0xbb, 0x25, 0x91, 0x3e,
  ]),
  REVEAL_COMMUNITY: new Uint8Array([
    0xc5, 0xac, 0x33, 0xba, 0x12, 0x98, 0xaf, 0x57,
  ]),
  SETTLE_GAME: new Uint8Array([0x60, 0x36, 0x18, 0xbd, 0xef, 0xc6, 0x56, 0x1d]),
} as const;
