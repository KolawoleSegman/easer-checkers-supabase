// Run with: npm test   (builds first, then uses Node's built-in test runner)
const test = require('node:test');
const assert = require('node:assert');
const { Board } = require('../dist/src/board/Board.js');

const position = (pieces, turn = 'white') => {
  const grid = Array.from({ length: 10 }, () => Array(10).fill(null));
  for (const [r, c, color, king] of pieces) grid[r][c] = { color, isKing: !!king };
  const b = new Board();
  b.setState(grid, turn);
  return b;
};

test('initial position: 20 pieces each, 9 opening moves for white', () => {
  const b = new Board();
  assert.strictEqual(b.getValidMoves('white').length, 9);
});

test('man passing the back row mid-capture is not crowned', () => {
  const b = position([[2, 4, 'white'], [1, 3, 'black'], [1, 1, 'black'], [9, 9, 'white'], [9, 7, 'black']]);
  const mid = b.makeMove(b.getValidMoves('white').find((m) => m.toRow === 0));
  assert.strictEqual(mid.getGrid()[0][2].isKing, false);
  assert.ok(mid.isMultiCaptureInProgress());
});

test('man ending on the back row is crowned', () => {
  const b = position([[2, 4, 'white'], [1, 3, 'black'], [9, 9, 'white'], [9, 7, 'black']]);
  assert.strictEqual(b.makeMove(b.getValidMoves('white')[0]).getGrid()[0][2].isKing, true);
});

test('jumped pieces keep blocking within a sequence', () => {
  const b = position([[5, 5, 'white', true], [4, 4, 'black'], [7, 7, 'black'], [9, 1, 'white']]);
  const jump = b.getValidMoves('white').find((m) => m.toRow === 3 && m.toCol === 3);
  assert.strictEqual(b.makeMove(jump).isMultiCaptureInProgress(), false);
});

test('maximum-capture rule is enforced', () => {
  // Left jump takes 2, right jump takes 1: only the 2-piece line is legal.
  const b = position([[6, 4, 'white'], [5, 3, 'black'], [3, 3, 'black'], [5, 5, 'black'], [9, 9, 'white']]);
  const moves = b.getValidMoves('white');
  assert.ok(moves.every((m) => m.toRow === 4 && m.toCol === 2));
});

test('random playouts always terminate with a legal move list', () => {
  for (let g = 0; g < 100; g++) {
    let b = new Board();
    for (let ply = 0; ply < 500; ply++) {
      if (b.getWinner()) break;
      const ms = b.getValidMoves(b.currentTurn);
      assert.ok(ms.length > 0);
      b = b.makeMove(ms[Math.floor(Math.random() * ms.length)]);
    }
  }
});
