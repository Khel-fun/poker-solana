import fs from "fs";
import path from "path";

import {
  CircuitId,
  CircuitConfig,
  CircuitInputs,
  CliOptions,
  ProofResult,
} from "../types";
import { CircuitRegistry, circuitRegistry } from "./circuit_registry";
import { CliExecutor, cliExecutor } from "./cli_executor";
import { toTomlRecord } from "./input_adapter";
import { generateToml } from "./toml_generator";

export class ProofGenerator {
  private readonly circuitRegistry: CircuitRegistry;
  private readonly cliExecutor: CliExecutor;

  // Cache of active proof generation tasks
  private readonly activeTasks: Map<string, Promise<ProofResult>> = new Map();

  constructor(options?: {
    circuitRegistry?: CircuitRegistry;
    cliExecutor?: CliExecutor;
  }) {
    this.circuitRegistry = options?.circuitRegistry || circuitRegistry;
    this.cliExecutor = options?.cliExecutor || cliExecutor;
  }

  private getTaskKey(circuitId: CircuitId, inputs: CircuitInputs): string {
    // Simple hash of inputs for deduplication
    const inputHash = JSON.stringify(inputs);
    return `${circuitId}:${Buffer.from(inputHash).toString("base64").slice(0, 32)}`;
  }

  private async writeProverToml(
    circuitId: CircuitId,
    inputs: CircuitInputs,
  ): Promise<void> {
    const tomlPath = this.circuitRegistry.getProverTomlPath(circuitId);
    const tomlContent = generateToml(toTomlRecord(inputs));

    // Ensure directory exists
    const dir = path.dirname(tomlPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(tomlPath, tomlContent, "utf-8");
  }

  private async generateWitness(circuitId: CircuitId): Promise<void> {
    const config = this.circuitRegistry.get(circuitId);
    const options: CliOptions = { cwd: config.circDir };

    await this.cliExecutor.executeNargo(["execute"], options);

    // Verify witness was created
    const witnessPath = this.circuitRegistry.getWitnessPath(circuitId);
    if (!fs.existsSync(witnessPath)) {
      throw new ProofGenerationError(
        `Witness file not created at ${witnessPath}`,
        circuitId,
      );
    }
  }

  private async generateGroth16Proof(circuitId: CircuitId): Promise<void> {
    const config = this.circuitRegistry.get(circuitId);
    const witnessPath = this.circuitRegistry.getWitnessPath(circuitId);

    // sunspot prove <acir> <witness> <ccs> <pk>
    await this.cliExecutor.executeSunspot(
      ["prove", config.acirPath, witnessPath, config.ccsPath, config.pkPath],
      { cwd: config.circDir },
    );

    // Verify proof was created
    const proofPath = this.circuitRegistry.getProofPath(circuitId);
    if (!fs.existsSync(proofPath)) {
      throw new ProofGenerationError(
        `Proof file not created at ${proofPath}`,
        circuitId,
      );
    }
  }

  private async readProofFiles(circuitId: CircuitId): Promise<ProofResult> {
    const proofPath: string = this.circuitRegistry.getProofPath(circuitId);
    const publicWitnessPath: string =
      this.circuitRegistry.getPublicWitnessPath(circuitId);

    if (!fs.existsSync(proofPath)) {
      throw new ProofGenerationError(
        `Proof file not found at ${proofPath}`,
        circuitId,
      );
    }
    if (!fs.existsSync(publicWitnessPath)) {
      throw new ProofGenerationError(
        `Public witness file not found at ${publicWitnessPath}`,
        circuitId,
      );
    }

    const proof = fs.readFileSync(proofPath);
    const publicWitness = fs.readFileSync(publicWitnessPath);

    const proofResult: ProofResult = {
      circuitId,
      proof,
      publicWitness,
      generatedAt: new Date(),
    };

    return proofResult;
  }

  private async executeProofGeneration(
    circuitId: CircuitId,
    inputs: CircuitInputs,
  ): Promise<ProofResult> {
    const config = this.circuitRegistry.get(circuitId);
    const startTime = Date.now();

    try {
      // Step 1: Write Prover.toml
      await this.writeProverToml(circuitId, inputs);

      // Step 2: Generate witness with nargo execute
      await this.generateWitness(circuitId);

      // Step 3: Generate Groth16 proof with sunspot prove
      await this.generateGroth16Proof(circuitId);

      // Step 4: Read proof files
      const result = await this.readProofFiles(circuitId);

      const duration = Date.now() - startTime;

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof ProofGenerationError) {
        throw error;
      }

      throw new ProofGenerationError(
        `Proof generation failed for ${circuitId}: ${String(error)}`,
        circuitId,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async generateProof(
    circuitId: CircuitId,
    inputs: CircuitInputs,
  ): Promise<ProofResult> {
    // Check if circuit is ready
    if (!this.circuitRegistry.isReady(circuitId)) {
      const status = this.circuitRegistry.getStatus(circuitId);
      throw new ProofGenerationError(
        `Circuit '${circuitId}' is not ready for proof generation. ` +
          `Status: ACIR=${status.acirExists}, CCS=${status.ccsExists}, PK=${status.pkExists}`,
        circuitId,
      );
    }

    // Generate unique task key based on inputs
    const taskKey = this.getTaskKey(circuitId, inputs);

    // Check for existing task (deduplication)
    const existingTask = this.activeTasks.get(taskKey);
    if (existingTask) {
      return existingTask;
    }

    // Create new task
    const task = this.executeProofGeneration(circuitId, inputs);
    this.activeTasks.set(taskKey, task);

    try {
      const result = await task;
      return result;
    } finally {
      // Remove from active tasks
      this.activeTasks.delete(taskKey);
    }
  }
}

export class ProofGenerationError extends Error {
  readonly circuitId: CircuitId;
  readonly cause?: Error;

  constructor(message: string, circuitId: CircuitId, cause?: Error) {
    super(message);
    this.name = "ProofGenerationError";
    this.circuitId = circuitId;
    this.cause = cause;
  }
}

export const proofGenerator = new ProofGenerator();
