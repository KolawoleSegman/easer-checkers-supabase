import { Injectable } from '@nestjs/common';
import { Worker } from 'worker_threads';
import { join } from 'path';
import { Board, Move, PieceColor, Piece } from '../board/Board';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

interface DifficultyProfile {
  depth: number;
  timeMs: number;
  blunderChance: number;
  noise: number;
  quiescence: number;
}

/**
 * Expert is tuned as a "grandmaster" style engine for 10×10 International
 * draughts: deep iterative deepening, long think time, zero randomness,
 * capture quiescence, transposition table, and a positional evaluation that
 * rewards tempo, structure, king activity, and endgame technique.
 */
const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  easy: { depth: 3, timeMs: 250, blunderChance: 0.2, noise: 0.8, quiescence: 0 },
  medium: { depth: 5, timeMs: 600, blunderChance: 0.05, noise: 0.2, quiescence: 1 },
  hard: { depth: 9, timeMs: 1500, blunderChance: 0, noise: 0, quiescence: 3 },
  expert: { depth: 16, timeMs: 3500, blunderChance: 0, noise: 0, quiescence: 6 },
};

const WIN_SCORE = 1_000_000;
const MAN = 100;
const KING = 450; // Flying kings are extremely valuable in international draughts

class SearchTimeout extends Error {}

type TTEntry = {
  depth: number;
  score: number;
  flag: 0 | 1 | 2; // exact | lower | upper
  moveKey?: string;
};

@Injectable()
export class AiService {
  /** Simple transposition table (cleared each root search). */
  private tt = new Map<string, TTEntry>();
  private killerMoves: Move[][] = [];
  private nodes = 0;
  private deadline = 0;
  private quiescenceLimit = 0;

  getProfile(difficulty: string | null | undefined): DifficultyProfile {
    const key = (difficulty || 'medium') as Difficulty;
    return DIFFICULTY_PROFILES[key] || DIFFICULTY_PROFILES.medium;
  }

  // -----------------------------------------------------------------------
  // Board hashing (sufficient for TT within one search)
  // -----------------------------------------------------------------------
  private hashBoard(board: Board): string {
    const grid = board.getGrid();
    let h = board.currentTurn === 'white' ? 'w' : 'b';
    // Mid-capture positions have different legal moves than the same grid at
    // the start of a turn, so they must not share a table entry.
    const chain = board.getMultiCapturePiece();
    if (chain) {
      h += `|${chain.row},${chain.col}`;
      for (const g of board.getGhosts()) h += `g${g.row}${g.col}`;
      h += '|';
    }
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid.length; c++) {
        const p = grid[r][c];
        if (!p) continue;
        h += `${r}${c}${p.color[0]}${p.isKing ? 'K' : 'm'}`;
      }
    }
    return h;
  }

  private moveKey(m: Move): string {
    return `${m.fromRow},${m.fromCol},${m.toRow},${m.toCol},${m.isCapture ? 1 : 0}`;
  }

  // -----------------------------------------------------------------------
  // Grandmaster-style evaluation (International draughts)
  // -----------------------------------------------------------------------
  evaluate(board: Board, color: PieceColor): number {
    const grid = board.getGrid() as Piece[][];
    const size = grid.length; // 10
    const opp: PieceColor = color === 'white' ? 'black' : 'white';
    const center = (size - 1) / 2;

    let score = 0;
    let myMen = 0;
    let myKings = 0;
    let oppMen = 0;
    let oppKings = 0;

    // Column balance (avoid overloading one wing)
    const myFile = new Array(size).fill(0);
    const oppFile = new Array(size).fill(0);

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const piece = grid[r][c];
        if (!piece) continue;
        const mine = piece.color === color;
        const sign = mine ? 1 : -1;

        if (piece.isKing) {
          if (mine) myKings++;
          else oppKings++;
          // Active central kings dominate endgames
          const centerDist = Math.abs(r - center) + Math.abs(c - center);
          score += sign * (KING + (size * 2 - centerDist) * 5);
          // Kings on the edge are slightly less useful
          if (c === 0 || c === size - 1 || r === 0 || r === size - 1) {
            score -= sign * 8;
          }
        } else {
          if (mine) {
            myMen++;
            myFile[c]++;
          } else {
            oppMen++;
            oppFile[c]++;
          }

          let val = MAN;
          // Promotion race — advanced men are gold
          const advancement = piece.color === 'white' ? size - 1 - r : r;
          val += advancement * advancement * 1.8; // quadratic push
          val += advancement * 8;

          // Prefer the "strong" central diagonals
          val += (size / 2 - Math.abs(c - center)) * 2.5;

          // Base (back rank) defense early / midgame
          const isBack =
            (piece.color === 'white' && r === size - 1) ||
            (piece.color === 'black' && r === 0);
          if (isBack) val += 18;

          // Almost promoting
          if (advancement >= size - 2) val += 35;
          if (advancement >= size - 3) val += 12;

          score += sign * val;
        }
      }
    }

    // --- Mobility & tempo (critical in draughts) ---
    let myMoves: Move[] = [];
    let oppMoves: Move[] = [];
    try {
      myMoves = board.getValidMoves(color);
      oppMoves = board.getValidMoves(opp);
      score += myMoves.length * 6;
      score -= oppMoves.length * 6;

      const myCaps = myMoves.filter((m) => m.isCapture);
      const oppCaps = oppMoves.filter((m) => m.isCapture);
      // Being forced into a bad capture sequence is catastrophic
      score += myCaps.length * 40;
      score -= oppCaps.length * 48;

      // Prefer longer capture chains when available
      for (const m of myCaps) {
        const span = Math.abs(m.toRow - m.fromRow) + Math.abs(m.toCol - m.fromCol);
        score += span * 3;
      }
      for (const m of oppCaps) {
        const span = Math.abs(m.toRow - m.fromRow) + Math.abs(m.toCol - m.fromCol);
        score -= span * 3;
      }
    } catch {
      /* ignore */
    }

    // --- Structure: balanced development, avoid empty wings ---
    const mySpread = myFile.filter((n) => n > 0).length;
    const oppSpread = oppFile.filter((n) => n > 0).length;
    score += mySpread * 3;
    score -= oppSpread * 3;

    // --- Endgame technique ---
    const total = myMen + myKings + oppMen + oppKings;
    const materialLead =
      (myMen - oppMen) * MAN + (myKings - oppKings) * KING;

    if (total <= 14) score += materialLead * 0.25;
    if (total <= 10) score += materialLead * 0.4;
    if (total <= 6) score += materialLead * 0.7;

    // King vs men: centralize and restrict
    if (myKings >= 1 && oppKings === 0 && oppMen <= 3) {
      score += 50 + myKings * 20;
    }
    if (oppKings >= 1 && myKings === 0 && myMen <= 3) {
      score -= 50 + oppKings * 20;
    }

    // Opposition / tempo in pure king endings
    if (myMen + oppMen === 0 && myKings + oppKings <= 4) {
      score += (myKings - oppKings) * 80;
      // Prefer having the move when material is equal
      if (myKings === oppKings && board.currentTurn === color) score += 15;
    }

    // Slight bonus if we have more "tempo" (side to move with equal material)
    if (Math.abs(materialLead) < 30 && board.currentTurn === color) {
      score += 8;
    }

    return score;
  }

  // -----------------------------------------------------------------------
  // Move ordering (captures, killers, TT move)
  // -----------------------------------------------------------------------
  private orderMoves(
    moves: Move[],
    ttMoveKey?: string,
    ply: number = 0,
  ): Move[] {
    const killers = this.killerMoves[ply] || [];
    const killerKeys = new Set(killers.map((k) => this.moveKey(k)));

    return [...moves].sort((a, b) => {
      const ka = this.moveKey(a);
      const kb = this.moveKey(b);
      let sa = 0;
      let sb = 0;
      if (ttMoveKey && ka === ttMoveKey) sa += 50_000;
      if (ttMoveKey && kb === ttMoveKey) sb += 50_000;
      if (a.isCapture) sa += 10_000 + Math.abs(a.toRow - a.fromRow) * 100;
      if (b.isCapture) sb += 10_000 + Math.abs(b.toRow - b.fromRow) * 100;
      if (killerKeys.has(ka)) sa += 5_000;
      if (killerKeys.has(kb)) sb += 5_000;
      return sb - sa;
    });
  }

  private storeKiller(ply: number, move: Move) {
    if (move.isCapture) return;
    if (!this.killerMoves[ply]) this.killerMoves[ply] = [];
    const arr = this.killerMoves[ply];
    const key = this.moveKey(move);
    if (arr[0] && this.moveKey(arr[0]) === key) return;
    arr.unshift(move);
    if (arr.length > 2) arr.length = 2;
  }

  // -----------------------------------------------------------------------
  // Alpha-beta + quiescence + TT
  // -----------------------------------------------------------------------
  private search(
    board: Board,
    depth: number,
    alpha: number,
    beta: number,
    color: PieceColor,
    ply: number,
  ): number {
    if ((++this.nodes & 63) === 0 && Date.now() > this.deadline) {
      throw new SearchTimeout();
    }

    const alphaOrig = alpha;
    const key = this.hashBoard(board);
    const ttHit = this.tt.get(key);
    if (ttHit && ttHit.depth >= depth) {
      if (ttHit.flag === 0) return ttHit.score;
      if (ttHit.flag === 1) alpha = Math.max(alpha, ttHit.score);
      if (ttHit.flag === 2) beta = Math.min(beta, ttHit.score);
      if (alpha >= beta) return ttHit.score;
    }

    const winner = board.checkWin();
    if (winner) {
      return winner === color ? WIN_SCORE - ply : -WIN_SCORE + ply;
    }

    const mover = board.currentTurn;
    let moves = board.getValidMoves(mover);
    if (moves.length === 0) {
      return mover === color ? -WIN_SCORE + ply : WIN_SCORE - ply;
    }

    // Quiescence at horizon
    if (depth <= 0) {
      const standPat = this.evaluate(board, color);
      if (this.quiescenceLimit <= 0) return standPat;

      const captures = moves.filter((m) => m.isCapture);
      if (captures.length === 0) return standPat;

      const maximizing = mover === color;
      if (maximizing) {
        let best = standPat;
        if (best > alpha) alpha = best;
        if (alpha >= beta) return best;
        for (const move of this.orderMoves(captures)) {
          // Temporarily reduce quiescence budget via local depth encoding:
          // we recurse with depth 0 and rely on a shrinking counter stored
          // on the instance — snapshot/restore for safety.
          const prevQ = this.quiescenceLimit;
          this.quiescenceLimit = prevQ - 1;
          const score = this.search(board.makeMove(move), 0, alpha, beta, color, ply + 1);
          this.quiescenceLimit = prevQ;
          if (score > best) best = score;
          if (best > alpha) alpha = best;
          if (alpha >= beta) break;
        }
        return best;
      } else {
        let best = standPat;
        if (best < beta) beta = best;
        if (alpha >= beta) return best;
        for (const move of this.orderMoves(captures)) {
          const prevQ = this.quiescenceLimit;
          this.quiescenceLimit = prevQ - 1;
          const score = this.search(board.makeMove(move), 0, alpha, beta, color, ply + 1);
          this.quiescenceLimit = prevQ;
          if (score < best) best = score;
          if (best < beta) beta = best;
          if (alpha >= beta) break;
        }
        return best;
      }
    }

    moves = this.orderMoves(moves, ttHit?.moveKey, ply);
    const maximizing = mover === color;
    let bestMoveKey: string | undefined;
    let best = maximizing ? -Infinity : Infinity;

    for (const move of moves) {
      const score = this.search(
        board.makeMove(move),
        depth - 1,
        alpha,
        beta,
        color,
        ply + 1,
      );

      if (maximizing) {
        if (score > best) {
          best = score;
          bestMoveKey = this.moveKey(move);
        }
        if (best > alpha) alpha = best;
        if (alpha >= beta) {
          this.storeKiller(ply, move);
          break;
        }
      } else {
        if (score < best) {
          best = score;
          bestMoveKey = this.moveKey(move);
        }
        if (best < beta) beta = best;
        if (alpha >= beta) {
          this.storeKiller(ply, move);
          break;
        }
      }
    }

    // Store TT
    let flag: 0 | 1 | 2 = 0;
    if (best <= alphaOrig) flag = 2;
    else if (best >= beta) flag = 1;
    this.tt.set(key, { depth, score: best, flag, moveKey: bestMoveKey });

    return best;
  }

  // -----------------------------------------------------------------------
  // Iterative deepening root search
  // -----------------------------------------------------------------------
  private rankRootMoves(
    board: Board,
    color: PieceColor,
    moves: Move[],
    profile: DifficultyProfile,
    needFullRanking: boolean,
  ): { move: Move; score: number }[] {
    this.tt.clear();
    this.killerMoves = [];
    this.nodes = 0;
    this.deadline = Date.now() + profile.timeMs;
    this.quiescenceLimit = profile.quiescence;

    let ranked = this.orderMoves(moves).map((move) => ({ move, score: 0 }));

    for (let depth = 1; depth <= profile.depth; depth++) {
      try {
        const current: { move: Move; score: number }[] = [];
        let alpha = -Infinity;
        const order = ranked.map((r) => r.move);

        for (const move of order) {
          // Aspiration window around previous score for this move when possible
          const prev = ranked.find((r) => this.moveKey(r.move) === this.moveKey(move));
          const guess = prev?.score ?? 0;
          const window = depth >= 4 ? 50 : WIN_SCORE;
          let score: number;

          if (!needFullRanking && depth >= 4 && Number.isFinite(guess)) {
            let a = guess - window;
            let b = guess + window;
            score = this.search(board.makeMove(move), depth - 1, a, b, color, 1);
            if (score <= a || score >= b) {
              // Research full window
              score = this.search(
                board.makeMove(move),
                depth - 1,
                needFullRanking ? -Infinity : alpha,
                Infinity,
                color,
                1,
              );
            }
          } else {
            score = this.search(
              board.makeMove(move),
              depth - 1,
              needFullRanking ? -Infinity : alpha,
              Infinity,
              color,
              1,
            );
          }

          current.push({ move, score });
          if (!needFullRanking && score > alpha) alpha = score;
        }

        current.sort((a, b) => b.score - a.score);
        ranked = current;
        if (Math.abs(ranked[0].score) >= WIN_SCORE / 2) break;
      } catch (e) {
        if (e instanceof SearchTimeout) break;
        throw e;
      }
    }
    return ranked;
  }

  /**
   * Runs the search in a worker thread so a long think never freezes the
   * server (HTTP + Socket.IO share one event loop). Falls back to searching
   * inline if the worker cannot be started.
   */
  async getBestMoveAsync(
    board: Board,
    color: PieceColor,
    difficulty: string = 'medium',
  ): Promise<Move | null> {
    try {
      return await this.runInWorker(board, color, difficulty);
    } catch (err) {
      console.error('AI worker failed, searching inline:', err);
      return this.getBestMove(board, color, difficulty);
    }
  }

  private active = 0;
  private waiting: (() => void)[] = [];
  private static readonly MAX_WORKERS = 2;

  private async acquire() {
    if (this.active < AiService.MAX_WORKERS) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private release() {
    const next = this.waiting.shift();
    if (next) next(); // hand the slot straight to the next waiter
    else this.active--;
  }

  private async runInWorker(
    board: Board,
    color: PieceColor,
    difficulty: string,
  ): Promise<Move | null> {
    await this.acquire();
    try {
      return await new Promise<Move | null>((resolve, reject) => {
        const worker = new Worker(join(__dirname, 'ai.worker.js'), {
          workerData: { board: board.toJSON(), color, difficulty },
        });
        let settled = false;
        const done = (fn: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          void worker.terminate();
          fn();
        };
        const timer = setTimeout(
          () => done(() => reject(new Error('AI worker timed out'))),
          15_000,
        );
        worker.once('message', (msg: any) => {
          if (msg?.error) return done(() => reject(new Error(msg.error)));
          const m = msg?.move;
          done(() =>
            resolve(
              m
                ? new Move(m.fromRow, m.fromCol, m.toRow, m.toCol, m.isCapture, m.capturedPiece ?? null)
                : null,
            ),
          );
        });
        worker.once('error', (e) => done(() => reject(e)));
        worker.once('exit', (code) =>
          done(() => reject(new Error(`AI worker exited (${code})`))),
        );
      });
    } finally {
      this.release();
    }
  }

  getBestMove(
    board: Board,
    color: PieceColor,
    difficultyOrDepth: string | number = 'medium',
  ): Move | null {
    const profile: DifficultyProfile =
      typeof difficultyOrDepth === 'number'
        ? {
            depth: difficultyOrDepth,
            timeMs: 7000,
            blunderChance: 0,
            noise: 0,
            quiescence: 5,
          }
        : this.getProfile(difficultyOrDepth);

    const moves = board.getValidMoves(color);
    if (moves.length === 0) return null;
    if (moves.length === 1) return moves[0];

    const weak = profile.noise > 0 || profile.blunderChance > 0;
    const ranked = this.rankRootMoves(board, color, moves, profile, weak);

    if (profile.blunderChance > 0 && Math.random() < profile.blunderChance) {
      const poolStart = Math.max(1, Math.floor(ranked.length * 0.45));
      const pool = ranked.slice(poolStart, Math.max(poolStart + 1, ranked.length - 1));
      const choice = pool.length > 0 ? pool : ranked;
      return choice[Math.floor(Math.random() * choice.length)].move;
    }

    if (profile.noise > 0) {
      const noisy = ranked
        .map((r) => ({
          ...r,
          score: r.score + (Math.random() * 2 - 1) * profile.noise * MAN,
        }))
        .sort((a, b) => b.score - a.score);
      return noisy[0].move;
    }

    return ranked[0].move;
  }
}
