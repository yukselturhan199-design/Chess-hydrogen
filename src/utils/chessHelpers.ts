import type { Chess, PieceSymbol } from "chess.js";
import type { CapturedSummary, ThinkingDepth } from "../types/chess";

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const STARTING_COUNTS: Record<Exclude<PieceSymbol, "k">, number> = {
  q: 1,
  r: 2,
  b: 2,
  n: 2,
  p: 8,
};

const DISPLAY_ORDER: Exclude<PieceSymbol, "k">[] = ["q", "r", "b", "n", "p"];

export function computeCapturedSummary(chess: Chess): CapturedSummary {
  const board = chess.board();
  const onBoard = {
    w: { q: 0, r: 0, b: 0, n: 0, p: 0 },
    b: { q: 0, r: 0, b: 0, n: 0, p: 0 },
  };

  for (const row of board) {
    for (const cell of row) {
      if (!cell || cell.type === "k") continue;
      onBoard[cell.color][cell.type] += 1;
    }
  }

  const capturedByWhite: PieceSymbol[] = [];
  const capturedByBlack: PieceSymbol[] = [];
  let whiteMaterial = 0;
  let blackMaterial = 0;

  for (const piece of DISPLAY_ORDER) {
    whiteMaterial += onBoard.w[piece] * PIECE_VALUES[piece];
    blackMaterial += onBoard.b[piece] * PIECE_VALUES[piece];

    const missingBlack = Math.max(0, STARTING_COUNTS[piece] - onBoard.b[piece]);
    for (let i = 0; i < missingBlack; i += 1) {
      capturedByWhite.push(piece);
    }

    const missingWhite = Math.max(0, STARTING_COUNTS[piece] - onBoard.w[piece]);
    for (let i = 0; i < missingWhite; i += 1) {
      capturedByBlack.push(piece);
    }
  }

  return {
    capturedByWhite,
    capturedByBlack,
    whiteAdvantage: whiteMaterial - blackMaterial,
  };
}

export function computeStaticCentipawns(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === "w" ? -10000 : 10000;
  }
  if (chess.isDraw()) {
    return 0;
  }
  const board = chess.board();
  let score = 0;
  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue;
      const val = PIECE_VALUES[cell.type] * 100;
      score += cell.color === "w" ? val : -val;
    }
  }
  return score;
}

export function formatEvalDisplay(centipawns: number): string {
  if (Math.abs(centipawns) >= 9000) {
    return centipawns > 0 ? "+M" : "-M";
  }
  const pawns = centipawns / 100;
  const formatted = Math.abs(pawns).toFixed(1);
  if (Math.abs(pawns) < 0.05) return "0.0";
  return pawns > 0 ? `+${formatted}` : `-${formatted}`;
}

export const DEPTH_LABELS: Record<ThinkingDepth, { label: string; detail: string }> = {
  LOW: { label: "Hızlı", detail: "Düşük gecikme" },
  MEDIUM: { label: "Dengeli", detail: "Standart oyun" },
  HIGH: { label: "Derin", detail: "Güçlü taktik" },
  XHIGH: { label: "Maksimum", detail: "XHigh analiz" },
};

export function describeGameResult(
  chess: Chess,
  opponentMode: "AI" | "LOCAL",
  playerColor: "w" | "b"
): { title: string; subtitle: string; isPlayerWin: boolean; isDraw: boolean } {
  if (chess.isCheckmate()) {
    const winnerColor = chess.turn() === "w" ? "b" : "w";
    const winnerLabel = winnerColor === "w" ? "Beyaz" : "Siyah";
    if (opponentMode === "LOCAL") {
      return {
        title: `${winnerLabel} Kazandı`,
        subtitle: "Şah Mat ile oyun sona erdi.",
        isPlayerWin: true,
        isDraw: false,
      };
    }
    const playerWon = winnerColor === playerColor;
    return {
      title: playerWon ? "Kazandınız" : "Gemini 4 Hydrogen Kazandı",
      subtitle: playerWon
        ? "Rakip şahı mat ederek masayı kapattınız."
        : "Gemini 4 Hydrogen şah mat ile partiyi tamamladı.",
      isPlayerWin: playerWon,
      isDraw: false,
    };
  }

  if (chess.isStalemate()) {
    return {
      title: "Berabere",
      subtitle: "Pat — yasal hamle kalmadığı için oyun berabere.",
      isPlayerWin: false,
      isDraw: true,
    };
  }
  if (chess.isThreefoldRepetition()) {
    return {
      title: "Berabere",
      subtitle: "Üçlü konum tekrarı nedeniyle oyun berabere.",
      isPlayerWin: false,
      isDraw: true,
    };
  }
  if (chess.isInsufficientMaterial()) {
    return {
      title: "Berabere",
      subtitle: "Yetersiz materyal — mat imkanı kalmadı.",
      isPlayerWin: false,
      isDraw: true,
    };
  }
  return {
    title: "Berabere",
    subtitle: "50 hamle kuralı gereği oyun berabere.",
    isPlayerWin: false,
    isDraw: true,
  };
}
