import { Router, Request, Response } from "express";
import { GameService } from "../services/GameService";
import { getBackendPublicKey } from "../services/SolanaService";
import type { CreateGameRequest } from "../../../shared/types";

const router = Router();

// Create a new game
router.post("/games", (req: Request, res: Response) => {
  const {
    hostId,
    hostName,
    name,
    settings,
    hostWalletAddress,
    hostPlayerSeatAddress,
  } = req.body as CreateGameRequest;

  if (!hostId || !hostName || !name || !settings) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const tableId = Date.now().toString();
  const backendPublicKey = getBackendPublicKey();

  const result = GameService.createGame(
    hostId,
    hostName,
    name,
    settings,
    hostWalletAddress,
    hostPlayerSeatAddress,
    undefined,
    tableId,
  );

  res.status(201).json({
    ...result,
    tableId,
    backendPublicKey,
  });
});

// Attach on-chain table PDA after creator creates it
router.post("/games/:id/table", (req: Request, res: Response) => {
  const { id } = req.params;
  const { tablePDA } = req.body as { tablePDA?: string };

  if (!tablePDA) {
    return res.status(400).json({ error: "Missing tablePDA" });
  }

  const updated = GameService.setTablePDA(id, tablePDA);
  if (!updated) {
    return res.status(404).json({ error: "Game not found" });
  }

  res.json({ success: true });
});

// Get all active games
router.get("/games", (_req: Request, res: Response) => {
  const games = GameService.getActiveGames();
  res.json(games);
});

// Get a specific game
router.get("/games/:id", (req: Request, res: Response) => {
  const game = GameService.getGame(req.params.id);

  if (!game) {
    return res.status(404).json({ error: "Game not found" });
  }

  res.json({
    id: game.id,
    name: game.name,
    hostId: game.hostId,
    status: game.status,
    playerCount: game.players.length,
    maxPlayers: game.settings.maxPlayers,
    settings: game.settings,
  });
});

export { router as gameRoutes };
