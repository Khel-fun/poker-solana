import {
  CircuitRegistry,
  circuitRegistry,
} from "../proof-generation/circuit_registry";
import { CliExecutor, cliExecutor } from "../proof-generation/cli_executor";
import {
  toShuffleInputs,
  toCommunityInputs,
  toRevealInputs,
} from "../proof-generation/input_adapter";
import {
  ProofGenerator,
  proofGenerator,
} from "../proof-generation/proof_generator";
import { ProofVerify, proofVerify } from "../proof-verification/proof_verify";
import {
  ProofSystemOptions,
  ProofResult,
  VerificationResult,
  VerifyConfig,
  CircuitConfig,
  CircuitId,
  CliResult,
  ShuffleInputs,
  CommunityInputs,
  RevealInputs,
} from "../types";

export class ProofSystemService {
  private readonly circuitRegistry: CircuitRegistry;
  private readonly cliExecutor: CliExecutor;
  private readonly proof_generator: ProofGenerator;
  private proof_verify: ProofVerify;

  constructor(options?: ProofSystemOptions) {
    this.circuitRegistry = options?.circuitsPath
      ? new CircuitRegistry(options.circuitsPath)
      : circuitRegistry;

    this.cliExecutor =
      options?.sunspotPath && options?.nargoPath
        ? new CliExecutor({
            nargoPath: options.nargoPath,
            sunspotPath: options.sunspotPath,
          })
        : cliExecutor;

    this.proof_generator = new ProofGenerator({
      circuitRegistry: this.circuitRegistry,
      cliExecutor: this.cliExecutor,
    });

    this.proof_verify = options?.verifyConfig
      ? new ProofVerify()
      : proofVerify;
  }

  // PROOF GENERATION

  async generateShuffleProof(
    seed: bigint | string,
    rootCommitment: bigint | string,
    cards: number[],
  ): Promise<ProofResult> {
    const inputs: ShuffleInputs = toShuffleInputs(seed, rootCommitment, cards);
    return this.proof_generator.generateProof(CircuitId.Shuffle, inputs);
  }

  async generateCommunityProof(
    cards: number[],
    commitment: bigint | string,
  ): Promise<ProofResult> {
    const inputs: CommunityInputs = toCommunityInputs(cards, commitment);
    return this.proof_generator.generateProof(CircuitId.Community, inputs);
  }

  async generateRevealProof(
    cards: number[],
    commitments: (bigint | string)[],
    players: (bigint | string)[],
    playerStatus: boolean[],
  ): Promise<ProofResult> {
    const inputs: RevealInputs = toRevealInputs(
      cards,
      commitments,
      players,
      playerStatus,
    );
    return this.proof_generator.generateProof(CircuitId.Reveal, inputs);
  }

  async generateProof(
    circuitId: CircuitId,
    inputs: ShuffleInputs | RevealInputs | CommunityInputs,
  ): Promise<ProofResult> {
    return this.proof_generator.generateProof(circuitId, inputs);
  }

  // PROOF VERIFICATION

  async verifyProof(proofResult: ProofResult): Promise<VerificationResult> {
    if (!this.proof_verify) {
      throw new Error(
        "Verification service not configured. " +
          "Provide verifyConfig in ProofSystemOptions or call configureVerification().",
      );
    }

    return this.proof_verify.verifyOnChain(proofResult);
  }

  // configureVerification(config: VerifyConfig): void {
  //   this.proof_verify = new ProofVerify();
  // }

  isVerificationConfigured(): boolean {
    return this.proof_verify !== null;
  }

  async generateAndVerify(
    circuitId: CircuitId,
    inputs: ShuffleInputs | RevealInputs | CommunityInputs,
  ): Promise<{ proof: ProofResult; verification: VerificationResult }> {
    // Generate proof
    const proof = await this.proof_generator.generateProof(circuitId, inputs);

    // Verify on-chain
    const verification = await this.verifyProof(proof);

    return { proof, verification };
  }
}

export const proofSystemService = new ProofSystemService();
