export type User = { id: string; email: string; username: string };
export type AuthResponse = { access_token: string; user: User };
export type GameState = {
  game: { id: string; whiteId: string; blackId: string; status: string; winnerId?: string | null };
  board: any;
  moves: Array<{ fromSquare: string; toSquare: string; capturedPiece?: string | null }>;
  whiteUsername?: string; blackUsername?: string;
};
