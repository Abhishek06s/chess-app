import { Chess } from "chess.js";

export class MoveNode {
  constructor({
    id,
    fen,
    san = null,
    move = null,
    parent = null,
  }) {
    this.id = id;
    this.fen = fen;
    this.san = san;
    this.move = move ? {
      from: move.from,
      to: move.to,
      piece: move.piece,
      color: move.color,
      flags: move.flags || "",
      san: move.san || san,
      captured: move.captured || null,
      promotion: move.promotion || null
    } : null;
    this.parent = parent;
    this.children = [];
  }
}

export function buildMoveTree(pgn) {
  if (!pgn) {
    return new MoveNode({
      id: crypto.randomUUID(),
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    });
  }

  const game = new Chess();
  try {
    game.loadPgn(pgn);
  } catch (e) {
    console.error("Failed to load initial PGN in tree builder:", e);
  }

  const moves = game.history({ verbose: true });
  const replay = new Chess();

  const root = new MoveNode({
    id: crypto.randomUUID(),
    fen: replay.fen(),
  });

  let current = root;

  moves.forEach((move) => {
    replay.move(move);

    const node = new MoveNode({
      id: crypto.randomUUID(),
      fen: replay.fen(),
      san: move.san,
      move,
      parent: current,
    });

    current.children.push(node);
    current = node;
  });

  return root;
}


export function getMainline(root) {
  const nodes = [];
  let current = root;

  while (current) {
    nodes.push(current);
    if (!current.children || !current.children.length) break;
    current = current.children[0];
  }

  return nodes;
}


export function getVariationIndex(node) {
  if (!node || !node.parent) return 0;
  return node.parent.children.findIndex((child) => child.id === node.id);
}


export function getSiblingVariations(node) {
  if (!node || !node.parent) return [];
  return node.parent.children;
}

function buildPgnRecursive(node, moveNumber = 1, isBlackMove = false) {
  let pgn = "";

  const children = node.children || [];

  if (!children.length) {
    return "";
  }

  const mainMove = children[0];

  if (mainMove.san) {
    if (!isBlackMove) {
      pgn += `${moveNumber}. ${mainMove.san} `;
    } else {
      pgn += `${mainMove.san} `;
    }
  }

  // Variations
  for (let i = 1; i < children.length; i++) {
    const variation = children[i];

    let variationText = "";

    if (!isBlackMove) {
      variationText += `(${moveNumber}. ${variation.san}`;
    } else {
      variationText += `(${moveNumber}... ${variation.san}`;
    }

    variationText += " ";
    variationText += buildPgnRecursive(
      variation,
      isBlackMove ? moveNumber + 1 : moveNumber,
      !isBlackMove,
    );

    variationText += ") ";

    pgn += variationText;
  }

  pgn += buildPgnRecursive(
    mainMove,
    isBlackMove ? moveNumber + 1 : moveNumber,
    !isBlackMove,
  );

  return pgn;
}

export function exportTreeToPgn(root, headers = {}) {
  const tags = Object.entries(headers)
    .map(([key, value]) => `[${key} "${value}"]`)
    .join("\n");

  const moves = buildPgnRecursive(root).trim();

  return `${tags}\n\n${moves}`;
}