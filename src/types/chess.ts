import type { Color, PieceSymbol, Square } from "chess.js";

export type GameState = "TITLE_MENU" | "PLAYING" | "PAUSED" | "GAME_OVER";

export type OpponentMode = "AI" | "LOCAL";

export type SidePreference = "w" | "b" | "random";

export type ThinkingDepth = "LOW" | "MEDIUM" | "HIGH" | "XHIGH";

export interface MoveRecord {
  san: string;
  from: Square;
  to: Square;
  color: Color;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  flags: string;
  comment?: string;
}

export interface HintData {
  move: string;
  from: Square;
  to: Square;
  title: string;
  explanation: string;
}

export interface PendingPromotion {
  from: Square;
  to: Square;
  color: Color;
}

export interface CapturedSummary {
  capturedByWhite: PieceSymbol[];
  capturedByBlack: PieceSymbol[];
  whiteAdvantage: number;
}
