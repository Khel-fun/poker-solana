// ----------------------------------------------------
//   CIRCUIT
// ----------------------------------------------------

// types of circuits
export enum CircuitId {
  Shuffle = "shuffle",
  Community = "community",
  Reveal = "reveal",
}

// confiurations for the Circuit
export interface CircuitConfig {
  id: CircuitId;
  name: string; // human-redable circuit name -> Shuffle, Community, Reveal
  circDir: string; // absolute path to the source directory of the circuit -> /src/circuitry/{name}
  acirPath: string; // absolute path to the acir file -> /src/circuitry/{name}/target/{name}.json
  ccsPath: string; // absolute path to the ccs file -> /src/circuitry/{name}/target/{name}.ccs
  pkPath: string; // absolute path to the pk file -> /src/circuitry/{name}/target/{name}.pk
  vkPath: string; // absolute path to the vk file -> /src/circuitry/{name}/target/{name}.vk
}

// status of circuit compilation
export interface CircuitStatus {
  id: CircuitId;
  acirExists: boolean;
  ccsExists: boolean;
  pkExists: boolean;
  vkExists: boolean;
}

// --------------------------------------------
//   CLI
// --------------------------------------------

// CLI options
export interface CliOptions {
  cwd?: string; // current working directory
  timeout?: number; // timeout in seconds
  env?: Record<string, string>; // environment variables
}

// CLI Results
export interface CliResult {
  command: string; // command executed
  exitCode: number; // exit code of the command
  stdout: string; // output of the command
  stderr: string; // error output of the command
  duration: number; // duration in milliseconds
}

// ------------------------------------------------
//   PROOF GENERATION
// ------------------------------------------------

// shuffle circuit inputs
export interface ShuffleInputs {
  seed: string; // random seed for deterministic shuffle
  root_commitment: string; //  commitment to the shuffled deck
  cards: string[]; // first 15 cards in the deck
}

// community circuit inputs
export interface CommunityInputs {
  cards: string[]; // five community cards
  onchain_commitments: string; //  commitment to the Community
}

// reveal circuit inputs
export interface RevealInputs {
  cards: string[]; // 10 hole cards
  onchain_commitments: string[]; // commitment to the hole cards
  players: string[]; // player addresses
  player_status: boolean[]; // availability of player in the game
}

export type CircuitInputs = ShuffleInputs | CommunityInputs | RevealInputs;

export interface ProofResult {
  circuitId: CircuitId;
  proof: Buffer; // raw proof bytes
  publicWitness: Buffer; // public witness bytes
  generatedAt: Date; //timestamp
}

// ------------------------------------------------
//   PROOF VERIFICATION
// ------------------------------------------------

import { Client } from "../WalletService";

// configuration for verification service
export interface VerifyConfig {
  rpcUrl: string; // Solana RPC endpointurl
  /**
   * Map of circuit IDs to their deployed verifier program addresses.
   * Each circuit's programId is obtained after deploying the corresponding solana verification program.
   *
   * @example
   * ```ts
   * programIds: {
   *   shuffle: "ShufProgram1111111111111111111111111111111",
   *   reveal: "RevlProgram1111111111111111111111111111111",
   *   community: "CommProgram1111111111111111111111111111111",
   * }
   * ```
   */
  programIds: Partial<Record<CircuitId, string>>;
  walletClient: Client;
  computeUnits?: number; // compute unit limit for Transaction (default: 500,000)
  commitment?: "processed" | "confirmed" | "finalized"; //  transaction commitment level (default: "confirmed")
}

// result of on-chain verification
export interface VerificationResult {
  signature: string; // txn signature
  success: boolean; // verification success status
  cluster: string; // solana cluster (devnet)
  explorerUrl: string; // explorer url
}

export enum VerificationTaskStatus {
  Pending = "pending",
  Generating = "generating",
  Verifying = "verifying",
  Success = "success",
  Failed = "failed",
}

export interface VerificationTask {
  roundId: string; // game-round id
  circuitId: CircuitId;
  status: VerificationTaskStatus;
  resultPromise: Promise<VerificationResult>; // promise that resolves to VerificationResult
  result?: VerificationResult; // result populated upon success
  error?: Error;
  queuedAt: Date; // when task was queued
  completedAt?: Date; // when task was completed
}

export interface VerificationSummary {
  roundId: string; // game-round id
  allSuccess: boolean; // Whether all proofs verified successfully
  totalTasks: number; // total number of tasks
  successCount: number; // Number of successful verifications
  failedCount: number; // Number of failed verifications
  tasks: VerificationTask[]; // List of verification tasks
  signatures: string[]; //txn signatures for succesful verifications
}

// ------------------------------------------------
//   PROOF SYSTEM
// ------------------------------------------------

export interface ProofSystemOptions {
  circuitsPath?: string; // path to circuits
  nargoPath?: string; // path to nargo binary
  sunspotPath?: string; // path to sunspot binary
  verifyConfig?: VerifyConfig; // verification configuartions
}
