import { CircuitConfig, CircuitId, CircuitStatus } from "../types";
import path from "path";
import fs from "fs";

const DEFAULT_CIRCUIT_PATH = path.join(__dirname, "../../circuitry");

export class CircuitRegistry {
  private readonly circuits: Map<CircuitId, CircuitConfig> = new Map();
  private readonly circuitPath: string;

  constructor(circuitPath?: string) {
    this.circuitPath = circuitPath || DEFAULT_CIRCUIT_PATH;
    this.initializeDefaultCircuit();
  }

  private initializeDefaultCircuit() {
    const shuffle_circuit = {
      id: CircuitId.Shuffle,
      name: "Shuffle",
      circDir: path.join(this.circuitPath, "shuffle"),
      acirPath: path.join(
        this.circuitPath,
        "target",
        "shuffle.json",
      ),
      ccsPath: path.join(this.circuitPath, "target", "shuffle.ccs"),
      pkPath: path.join(this.circuitPath, "target", "shuffle.pk"),
      vkPath: path.join(this.circuitPath, "target", "shuffle.vk"),
    };
    this.registerCircuit(shuffle_circuit);

    const community_circuit = {
      id: CircuitId.Community,
      name: "Community",
      circDir: path.join(this.circuitPath, "community"),
      acirPath: path.join(
        this.circuitPath,
        "target",
        "community.json",
      ),
      ccsPath: path.join(
        this.circuitPath,
        "target",
        "community.ccs",
      ),
      pkPath: path.join(
        this.circuitPath,
        "target",
        "community.pk",
      ),
      vkPath: path.join(
        this.circuitPath,
        "target",
        "community.vk",
      ),
    };
    this.registerCircuit(community_circuit);

    const reveal_circuit = {
      id: CircuitId.Reveal,
      name: "Reveal",
      circDir: path.join(this.circuitPath, "reveal"),
      acirPath: path.join(this.circuitPath, "target", "reveal.json"),
      ccsPath: path.join(this.circuitPath, "target", "reveal.ccs"),
      pkPath: path.join(this.circuitPath, "target", "reveal.pk"),
      vkPath: path.join(this.circuitPath, "target", "reveal.vk"),
    };
    this.registerCircuit(reveal_circuit);
  }

  registerCircuit(circuit: CircuitConfig): void {
    this.circuits.set(circuit.id, circuit);
  }

  get(id: CircuitId): CircuitConfig {
    const circuit = this.circuits.get(id);
    if (!circuit) {
      throw new Error(`Circuit ${id} not found`);
    }
    return circuit;
  }

  getStatus(id: CircuitId): CircuitStatus {
    const circuit = this.get(id);
    return {
      id,
      acirExists: fs.existsSync(circuit.acirPath),
      ccsExists: fs.existsSync(circuit.ccsPath),
      pkExists: fs.existsSync(circuit.pkPath),
      vkExists: fs.existsSync(circuit.vkPath),
    };
  }

  isReady(id: CircuitId): boolean {
    const config = this.get(id);
    return (
      fs.existsSync(config.acirPath) &&
      fs.existsSync(config.ccsPath) &&
      fs.existsSync(config.pkPath)
    );
  }

  getProverTomlPath(id: CircuitId): string {
    const circuit = this.get(id);
    return path.join(circuit.circDir, "prover.toml");
  }

  getWitnessPath(id: CircuitId): string {
    const circuit = this.get(id);
    return path.join(this.circuitPath, "target", `${id}.gz`);
  }

  getProofPath(id: CircuitId): string {
    const circuit = this.get(id);
    return path.join(this.circuitPath, "target", `${id}.proof`);
  }

  getPublicWitnessPath(id: CircuitId): string {
    const circuit = this.get(id);
    return path.join(this.circuitPath, "target", `${id}.pw`);
  }

  getCircuitsPath(): string {
    return this.circuitPath;
  }
}

export const circuitRegistry = new CircuitRegistry();
