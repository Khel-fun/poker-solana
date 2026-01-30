// TOML Generator
// Generates Prover.toml files from structured inputs.
// Handles serialization of various Noir input types.

// serialization of value to TOML format
export function serializeValue(value: unknown): string {
  if (typeof value === "string") {
    // Field values are strings, wrap in quotes
    return `"${value}"`;
  }

  if (typeof value === "number") {
    // Numbers are serialized as quoted strings for Noir Field compatibility
    return `"${value}"`;
  }

  if (typeof value === "bigint") {
    // BigInts are serialized as quoted strings
    return `"${value.toString()}"`;
  }

  if (typeof value === "boolean") {
    // Booleans are lowercase
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    // Arrays are serialized with square brackets
    return serializeArray(value);
  }

  // Fallback: convert to string
  return `"${String(value)}"`;
}

// Serialize an array to TOML format
export function serializeArray(arr: unknown[]): string {
  const elements = arr.map((item) => serializeValue(item));
  return `[${elements.join(", ")}]`;
}

// Generate a Prover.toml content string from inputs.
// // @example
//  ```typescript
//  const toml = generateToml({
//    seed: '12345',
//    root_commitment: '0xabc...',
//    cards: ['1', '2', '3']
//  });
//  Returns:
//  seed = "12345"
//  root_commitment = "0xabc..."
//  cards = ["1", "2", "3"]
//  ```
export function generateToml(inputs: Record<string, unknown>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(inputs)) {
    const serialized = serializeValue(value);
    lines.push(`${key} = ${serialized}`);
  }

  // Add trailing newline
  return lines.join("\n") + "\n";
}

export class TomlGenerator {
  static serializeValue = serializeValue;
  static serializeArray = serializeArray;
  static generate = generateToml;

  static forShuffle(
    seed: string,
    rootCommitment: string,
    cards: string[],
  ): string {
    return generateToml({
      seed,
      root_commitment: rootCommitment,
      cards,
    });
  }

  static forReveal(
    cards: string[],
    onchainCommitments: string[],
    players: string[],
    playerStatus: boolean[],
  ): string {
    return generateToml({
      cards,
      onchain_commitments: onchainCommitments,
      players,
      player_status: playerStatus,
    });
  }

  static forCommunity(cards: string[], onchainCommitments: string): string {
    return generateToml({
      cards,
      onchain_commitments: onchainCommitments,
    });
  }
}
