# Texas Hold'em Poker Game

A real-time multiplayer Texas Hold'em poker game built with React, Express, and Socket.io.

## Project Structure

```
poker-solana/
├── backend/          # Express + Socket.io server
├── frontend/         # Vite + React client
├── shared/           # Shared TypeScript types
└── POKER_GAME_PLAN.md  # Complete implementation guide
```

## Features

- **Real-time multiplayer** gameplay using WebSocket
- **Full Texas Hold'em** rules (preflop → flop → turn → river → showdown)
- **Hand evaluation** from Royal Flush to High Card
- **Side pot calculation** for all-in scenarios
- **Lobby system** with game creation and joining
- **Turn timer** with action panel (fold/check/call/raise/all-in)
- **Responsive UI** with TailwindCSS

## Setup

### Prerequisites
- Node.js 18+
- pnpm

### Installation

```bash
# Install backend dependencies
cd backend
pnpm install

# Install frontend dependencies
cd ../frontend
pnpm install
```

### Running the Application

**Option 1: Run both servers separately**

```bash
# Terminal 1 - Backend (port 3001)
cd backend
pnpm dev

# Terminal 2 - Frontend (port 5173)
cd frontend
pnpm dev
```

**Option 2: Kill existing processes if ports are in use**

```bash
# Kill process on port 3001 (backend)
lsof -ti:3001 | xargs kill -9

# Kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9
```

### Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## How to Play

1. **Enter your name** on the home page
2. **Create a game** or **join an existing game**
3. **Wait in the lobby** for other players to join
4. **Host starts the game** (minimum 2 players required)
5. **Play poker!** Follow Texas Hold'em rules

## Game Configuration

When creating a game, you can configure:
- **Max Players**: 2-8 players
- **Blinds**: Small blind and big blind amounts
- **Starting Chips**: Initial chip count for each player
- **Turn Time**: Seconds per turn (15-120)

## Tech Stack

### Backend
- Express.js - HTTP server
- Socket.io - WebSocket communication
- TypeScript - Type safety
- UUID - Unique ID generation

### Frontend
- Vite - Build tool
- React 19 - UI framework
- React Router - Client-side routing
- Zustand - State management
- Socket.io-client - WebSocket client
- TailwindCSS - Styling
- Lucide React - Icons

## API Endpoints

### REST API
- `POST /api/games` - Create new game
- `GET /api/games` - List active games
- `GET /api/games/:id` - Get game details

### WebSocket Events
See `POKER_GAME_PLAN.md` for complete event documentation.

## Development

### Backend Development
```bash
cd backend
pnpm dev  # Runs with tsx watch for hot reload
```

### Frontend Development
```bash
cd frontend
pnpm dev  # Runs Vite dev server with HMR
```

## Troubleshooting

### Port Already in Use
If you see `EADDRINUSE` errors:
```bash
# Backend (port 3001)
lsof -ti:3001 | xargs kill -9

# Frontend (port 5173)
lsof -ti:5173 | xargs kill -9
```

### Workbox/Service Worker Warnings
The workbox warnings in the browser console are harmless and can be ignored. They appear because this app doesn't have PWA features configured.

### WebSocket Connection Issues
- Ensure backend is running on port 3001
- Check CORS settings in `backend/src/index.ts`
- Verify Socket.io client URL in `frontend/src/services/socket.ts`

## License

MIT
