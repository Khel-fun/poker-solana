import fs from "fs";
import path from "path";

import {
  VerifyConfig,
  VerificationResult,
  ProofResult,
  CircuitId,
  CircuitConfig,
} from "../types";
import { walletClient } from "../../WalletService";
import {
  Signature,
  pipe,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  assertIsSendableTransaction,
  assertIsTransactionWithBlockhashLifetime,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  type Address,
} from "@solana/kit";
import { getSetComputeUnitLimitInstruction } from "@solana-program/compute-budget";

export class ProofVerify {
  
  private validateConfig(config: VerifyConfig): void {
    if (!config.rpcUrl) {
      throw new Error("VerifyConfig.rpcUrl is required");
    }
    if (!config.programIds || Object.keys(config.programIds).length === 0) {
      throw new Error(
        "VerifyConfig.programIds is required and must contain at least one circuit programId",
      );
    }
    if (!config.walletClient) {
      throw new Error("VerifyConfig.wallet is required");
    }
  }

  private async setupDefaultVerifyConfig(): Promise<VerifyConfig> {
    let config: VerifyConfig;
    let rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("RPC_URL environment variable is required");
    }

    // Build programIds map from environment variables
    const programIds: Partial<Record<CircuitId, string>> = {};
    const circuitIds: CircuitId[] = [
      CircuitId.Shuffle,
      CircuitId.Reveal,
      CircuitId.Community,
    ];

    circuitIds.forEach((id) => {
      const env_var = `VERIFY_${id.toUpperCase()}_PROGRAM_ID`;
      const program_id = process.env[env_var];
      if (!program_id) {
        throw new Error(`Missing environment variable ${env_var}`);
      }
      programIds[id] = program_id;
    });

    const client = await walletClient;
    const computeUnits = 500_000;
    const commitment = "confirmed";

    config = {
      rpcUrl,
      programIds,
      walletClient: client,
      computeUnits,
      commitment,
    };

    this.validateConfig(config);
    return config;
  }

  private async getCluster(): Promise<string> {
    const config: VerifyConfig = await this.setupDefaultVerifyConfig();
    const url = config.rpcUrl.toLowerCase();
    if (url.includes("mainnet")) return "mainnet";
    if (url.includes("testnet")) return "testnet";
    if (url.includes("devnet")) return "devnet";
    if (url.includes("localhost") || url.includes("127.0.0.1")) return "custom";
    return "devnet"; // Default to devnet
  }

  private async getProgramID(circuitId: CircuitId): Promise<string> {
    const config: VerifyConfig = await this.setupDefaultVerifyConfig();
    const programId = config.programIds[circuitId];
    if (!programId) {
      throw new Error(`Missing programId for circuit ${circuitId}`);
    }
    return programId;
  }

  private createInstructionData(proofResult: ProofResult): PayloadData {
    const { proof, publicWitness } = proofResult;
    const data = Buffer.concat([proof, publicWitness]);
    return {
      data,
      proofSize: proof.length,
      witnessSize: publicWitness.length,
    };
  }

  async submitTxn(
    payloadData: PayloadData,
    programId: string,
  ): Promise<Signature> {
    const address: Address = programId as Address;
    const config: VerifyConfig = await this.setupDefaultVerifyConfig();
    const client = config.walletClient;
    const { value: latestBlockhash } = await client.rpc
      .getLatestBlockhash()
      .send();

    const verifyInstruction = {
      programAddress: address,
      accounts: [],
      data: new Uint8Array(payloadData.data),
    };

    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(client.wallet, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) =>
        appendTransactionMessageInstructions(
          [
            getSetComputeUnitLimitInstruction({ units: 500_000 }),
            verifyInstruction,
          ],
          tx,
        ),
    );

    // Compile the transaction message and sign it.
    const txn = await signTransactionMessageWithSigners(transactionMessage);
    assertIsSendableTransaction(txn);
    assertIsTransactionWithBlockhashLifetime(txn);

    await client.sendAndConfirmTransaction(txn, {
      commitment: "confirmed",
    });

    const signature = getSignatureFromTransaction(txn);
    return signature;
  }

  async verifyOnChain(proofResult: ProofResult): Promise<VerificationResult> {
    const instructionData: PayloadData =
      this.createInstructionData(proofResult);
    const programId = await this.getProgramID(proofResult.circuitId);
    const signature = await this.submitTxn(instructionData, programId);
    const cluster = await this.getCluster();
    const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;

    return {
      signature,
      success: true,
      cluster,
      explorerUrl,
    };
  }
}

export interface PayloadData {
  data: Buffer;
  proofSize: number;
  witnessSize: number;
}

export class VerificationError extends Error {
  readonly circuitId: string;
  readonly cause?: Error;

  constructor(message: string, circuitId: string, cause?: Error) {
    super(message);
    this.name = "VerificationError";
    this.circuitId = circuitId;
    this.cause = cause;
  }
}

export const proofVerify = new ProofVerify();
