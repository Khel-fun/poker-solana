import { CliOptions, CliResult } from "../types";
import { execa, type Options as ExecaOptions } from "execa";

const DEFAULT_TIMEOUT = 60; // seconds
const NARGO_PATH = process.env.NARGO_PATH || "nargo"; // path to nargo executable
const SUNSPOT_PATH = process.env.SUNSPOT_PATH || "sunspot"; // path to sunspot executable

export class CliExecutor {
  private readonly nargoPath: string;
  private readonly sunspotPath: string;

  constructor(options?: { nargoPath?: string; sunspotPath?: string }) {
    this.nargoPath = options?.nargoPath || NARGO_PATH;
    this.sunspotPath = options?.sunspotPath || SUNSPOT_PATH;
  }

  private async execute(
    command: string,
    args: string[],
    options?: CliOptions,
  ): Promise<CliResult> {
    const startTime = Date.now();
    const fullCommand = `${command} ${args.join(" ")}`;

    const execaOptions: ExecaOptions = {
      cwd: options?.cwd,
      timeout: options?.timeout || DEFAULT_TIMEOUT,
      env: options?.env,
      reject: false, // Don't throw on non-zero exit codes
    };

    try {
      const result = await execa(command, args, execaOptions);
      const duration = Date.now() - startTime;
      // Check for errors
      if (result.exitCode !== 0) {
        const errorMessage = this.formatError(
          fullCommand,
          result.exitCode ?? 1,
          String(result.stderr ?? ""),
        );
        throw new CliExecutionError(errorMessage, {
          command: fullCommand,
          exitCode: result.exitCode ?? 1,
          stdout: String(result.stdout ?? ""),
          stderr: String(result.stderr ?? ""),
          duration,
        });
      }

      return {
        command: fullCommand,
        exitCode: result.exitCode ?? 0,
        stdout: String(result.stdout ?? ""),
        stderr: String(result.stderr ?? ""),
        duration,
      };
    } catch (error) {
      // Re-throw CliExecutionError as-is
      if (error instanceof CliExecutionError) {
        throw error;
      }

      // Handle other errors (e.g., command not found, timeout)
      const duration = Date.now() - startTime;

      if (this.isExecaError(error)) {
        const execaError = error as ExecaError;

        // Check for timeout
        if (execaError.timedOut) {
          throw new CliExecutionError(
            `Command timed out after ${options?.timeout || DEFAULT_TIMEOUT}ms: ${fullCommand}`,
            {
              command: fullCommand,
              exitCode: -1,
              stdout: execaError.stdout || "",
              stderr: execaError.stderr || "",
              duration,
            },
          );
        }

        // Command not found or other spawn errors
        throw new CliExecutionError(
          `Failed to execute command: ${fullCommand}\n${execaError.message}`,
          {
            command: fullCommand,
            exitCode: execaError.exitCode ?? -1,
            stdout: execaError.stdout || "",
            stderr: execaError.stderr || "",
            duration,
          },
        );
      }

      // Unknown error
      throw new CliExecutionError(
        `Unknown error executing command: ${fullCommand}\n${String(error)}`,
        {
          command: fullCommand,
          exitCode: -1,
          stdout: "",
          stderr: "",
          duration,
        },
      );
    }
  }

  async executeNargo(args: string[], options?: CliOptions): Promise<CliResult> {
    return this.execute(this.nargoPath, args, options);
  }

  async executeSunspot(
    args: string[],
    options?: CliOptions,
  ): Promise<CliResult> {
    return this.execute(this.sunspotPath, args, options);
  }

  private formatError(
    command: string,
    exitCode: number,
    stderr: string,
  ): string {
    let message = `Command failed with exit code ${exitCode}: ${command}`;
    if (stderr) {
      message += `\n\nStderr:\n${stderr}`;
    }
    return message;
  }

  private isExecaError(error: unknown): error is ExecaError {
    return (
      typeof error === "object" &&
      error !== null &&
      ("exitCode" in error || "timedOut" in error || "command" in error)
    );
  }
}

export class CliExecutionError extends Error {
  readonly command: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly duration: number;

  constructor(message: string, result: CliResult) {
    super(message);
    this.name = "CliExecutionError";
    this.command = result.command;
    this.exitCode = result.exitCode;
    this.stdout = result.stdout;
    this.stderr = result.stderr;
    this.duration = result.duration;
  }
}

interface ExecaError {
  exitCode?: number;
  timedOut?: boolean;
  message: string;
  stdout?: string;
  stderr?: string;
  command?: string;
}

export const cliExecutor = new CliExecutor();
