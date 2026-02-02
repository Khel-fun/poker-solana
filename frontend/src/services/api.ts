import type { CreateGameRequest, CreateGameResponse, GameListItem, GameSettings } from '../../../shared/types';

const API_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export const api = {
  async createGame(data: CreateGameRequest): Promise<CreateGameResponse> {
    const response = await fetch(`${API_URL}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create game');
    return response.json();
  },

  async getActiveGames(): Promise<GameListItem[]> {
    const response = await fetch(`${API_URL}/api/games`);
    if (!response.ok) throw new Error('Failed to fetch games');
    return response.json();
  },

  async getGame(gameId: string): Promise<{ id: string; name: string; status: string; playerCount: number; maxPlayers: number; settings: GameSettings }> {
    const response = await fetch(`${API_URL}/api/games/${gameId}`);
    if (!response.ok) throw new Error('Failed to fetch game');
    return response.json();
  },

  async attachTable(gameId: string, tablePDA: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/games/${gameId}/table`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tablePDA }),
    });
    if (!response.ok) throw new Error('Failed to attach table');
  },
};
