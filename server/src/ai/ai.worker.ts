import { parentPort, workerData } from 'worker_threads';
import { Board } from '../board/Board';
import { AiService } from './ai.service';

// Runs one AI search off the main thread and posts the chosen move back.
try {
  const { board: state, color, difficulty } = workerData;
  const board = new Board();
  board.setState(state.board, state.currentTurn, state.multiCapturePiece, state.ghosts ?? []);
  const move = new AiService().getBestMove(board, color, difficulty);
  parentPort?.postMessage({
    move: move
      ? {
          fromRow: move.fromRow,
          fromCol: move.fromCol,
          toRow: move.toRow,
          toCol: move.toCol,
          isCapture: move.isCapture,
          capturedPiece: move.capturedPiece,
        }
      : null,
  });
} catch (e: any) {
  parentPort?.postMessage({ error: e?.message || String(e) });
}
