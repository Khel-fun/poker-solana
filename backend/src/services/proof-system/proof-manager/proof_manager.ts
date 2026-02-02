import {
  CircuitId,
  CircuitInputs,
  ProofResult,
  VerificationResult,
  VerificationTaskStatus,
  VerificationTask,
  VerificationSummary,
} from "../types";
import { ProofSystemService, proofSystemService } from "./proof_system_service";

export class ProofManager {
  private readonly proofSystemService: ProofSystemService;
  private readonly tasks: Map<string, VerificationTask[]>;

  constructor(options?: { proofSystemService?: ProofSystemService }) {
    this.proofSystemService = options?.proofSystemService || proofSystemService;
    // mapping from roundId to tasks list
    this.tasks = new Map<string, VerificationTask[]>();
  }

  cleanup(roundId: string): void {
    console.log(`[ProofVerificationManager] Cleaning up hand ${roundId}`);
    this.tasks.delete(roundId);
  }

  async queueTask(
    roundId: string,
    circuitId: CircuitId,
    inputs: CircuitInputs,
  ): Promise<void> {
    // Create task entry
    const task: VerificationTask = {
      roundId,
      circuitId,
      status: VerificationTaskStatus.Pending,
      resultPromise: null as unknown as Promise<VerificationResult>, // promise set below
      queuedAt: new Date(),
    };

    // Start async proof generation + verification
    task.resultPromise = this.executeTask(task, inputs);

    // Add to round's task list
    const roundTasks = this.tasks.get(roundId) ?? [];
    roundTasks.push(task);
    this.tasks.set(roundId, roundTasks);
  }

  private async executeTask(
    task: VerificationTask,
    inputs: CircuitInputs,
  ): Promise<VerificationResult> {
    try {
      // PHASE 01 -  PROOF GENERATION
      task.status = VerificationTaskStatus.Generating;
      const proof = await this.proofSystemService.generateProof(
        task.circuitId,
        inputs,
      );

      // PHASE 02 -  PROOF VERIFICATION
      task.status = VerificationTaskStatus.Verifying;
      const verificationResult =
        await this.proofSystemService.verifyProof(proof);

      // PHASE 03 -  TASK COMPLETION
      // Success
      task.status = VerificationTaskStatus.Success;
      task.result = verificationResult;
      task.completedAt = new Date();

      console.log(
        `[ProofVerificationManager] ${task.circuitId} verified: ${verificationResult.signature}`,
      );

      return verificationResult;
    } catch (error) {
      // Failure
      task.status = VerificationTaskStatus.Failed;
      task.error = error instanceof Error ? error : new Error(String(error));
      task.completedAt = new Date();

      console.error(
        `[ProofVerificationManager] ${task.circuitId} failed for hand ${task.roundId}:`,
        task.error.message,
      );

      throw task.error;
    }
  }

  public async roundVerification(roundId: string): Promise<VerificationSummary> {
    const roundTasks = this.tasks.get(roundId);

    if (!roundTasks || roundTasks.length === 0) {
      return {
        roundId,
        allSuccess: true,
        totalTasks: 0,
        successCount: 0,
        failedCount: 0,
        tasks: [],
        signatures: [],
      };
    }

    console.log(
      `[ProofVerificationManager] Awaiting ${roundTasks.length} proofs for game-round ${roundId}`,
    );
    // Wait for all tasks to complete (success or failure)
    await Promise.allSettled(roundTasks.map((t) => t.resultPromise));

    // Build summary
    const successCount = roundTasks.filter(
      (t) => t.status === VerificationTaskStatus.Success,
    ).length;
    const failedCount = roundTasks.filter(
      (t) => t.status === VerificationTaskStatus.Failed,
    ).length;
    const signatures = roundTasks
      .filter(
        (t) =>
          t.status === VerificationTaskStatus.Success && t.result?.signature,
      )
      .map((t) => t.result!.signature);

    const summary: VerificationSummary = {
      roundId,
      allSuccess: failedCount === 0,
      totalTasks: roundTasks.length,
      successCount,
      failedCount,
      tasks: roundTasks,
      signatures,
    };

    console.log(
      `[ProofVerificationManager] Round ${roundId} complete: ` +
        `${successCount}/${roundTasks.length} verified`,
    );

    return summary;
  }

  getSummary(roundId: string): VerificationSummary {
    const roundTasks = this.tasks.get(roundId) ?? [];

    const pendingCount = roundTasks.filter(
      (t) =>
        t.status === VerificationTaskStatus.Pending ||
        t.status === VerificationTaskStatus.Generating ||
        t.status === VerificationTaskStatus.Verifying,
    ).length;
    const successCount = roundTasks.filter(
      (t) => t.status === VerificationTaskStatus.Success,
    ).length;
    const failedCount = roundTasks.filter(
      (t) => t.status === VerificationTaskStatus.Failed,
    ).length;

    const signatures = roundTasks
      .filter(
        (t) =>
          t.status === VerificationTaskStatus.Success && t.result?.signature,
      )
      .map((t) => t.result!.signature);

    const summary: VerificationSummary = {
      roundId,
      allSuccess: failedCount == 0,
      totalTasks: pendingCount + successCount + failedCount,
      successCount,
      failedCount,
      tasks: roundTasks,
      signatures,
    };

    return summary;
  }
}

export const proofManager = new ProofManager();
