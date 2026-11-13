import React, { useMemo, useRef, useState } from "react";
import type { Chess, Color, Move, PieceSymbol, Square } from "chess.js";
import type { HintData, PendingPromotion } from "../types/chess";
import { ChessPieceSvg } from "./ChessPieceSvg";

interface ChessBoardProps {
  chess: Chess;
  flipped: boolean;
  interactive: boolean;
  lastMove: { from: Square; to: Square } | null;
  hint: HintData | null;
  pendingPromotion: PendingPromotion | null;
  onAttemptMove: (from: Square, to: Square, promotion?: Exclude<PieceSymbol, "k" | "p">) => void;
  onConfirmPromotion: (piece: Exclude<PieceSymbol, "k" | "p">) => void;
  onCancelPromotion: () => void;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

function squareToGridPos(square: Square, flipped: boolean): { col: number; row: number } {
  const fileIndex = FILES.indexOf(square[0] as (typeof FILES)[number]);
  const rankIndex = RANKS.indexOf(square[1] as (typeof RANKS)[number]);
  return {
    col: flipped ? 7 - fileIndex : fileIndex,
    row: flipped ? 7 - rankIndex : rankIndex,
  };
}

export function ChessBoard({
  chess,
  flipped,
  interactive,
  lastMove,
  hint,
  pendingPromotion,
  onAttemptMove,
  onConfirmPromotion,
  onCancelPromotion,
}: ChessBoardProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [dragState, setDragState] = useState<{
    from: Square;
    piece: { type: PieceSymbol; color: Color };
    x: number;
    y: number;
    hoverSquare: Square | null;
    moved: boolean;
  } | null>(null);

  const displayFiles = useMemo(() => (flipped ? [...FILES].reverse() : [...FILES]), [flipped]);
  const displayRanks = useMemo(() => (flipped ? [...RANKS].reverse() : [...RANKS]), [flipped]);

  const activeSquare = dragState?.from ?? selectedSquare;

  const legalTargetsMap = useMemo(() => {
    const map = new Map<Square, Move>();
    if (!activeSquare || !interactive) return map;
    const moves = chess.moves({ square: activeSquare, verbose: true });
    for (const m of moves) {
      map.set(m.to, m);
    }
    return map;
  }, [chess, activeSquare, interactive]);

  // Identify checked King square
  const checkedKingSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    const board = chess.board();
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const cell = board[r][c];
        if (cell && cell.type === "k" && cell.color === turn) {
          return `${FILES[c]}${RANKS[r]}` as Square;
        }
      }
    }
    return null;
  }, [chess]);

  const getSquareFromPoint = (clientX: number, clientY: number): Square | null => {
    const el = boardRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }
    const col = Math.min(7, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * 8)));
    const row = Math.min(7, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * 8)));
    const file = displayFiles[col];
    const rank = displayRanks[row];
    return `${file}${rank}` as Square;
  };

  const handleSquareClick = (sq: Square) => {
    if (!interactive || pendingPromotion) return;

    const piece = chess.get(sq);
    if (selectedSquare && selectedSquare !== sq && legalTargetsMap.has(sq)) {
      onAttemptMove(selectedSquare, sq);
      setSelectedSquare(null);
      return;
    }

    if (piece && piece.color === chess.turn()) {
      setSelectedSquare((prev) => (prev === sq ? null : sq));
      return;
    }

    setSelectedSquare(null);
  };

  const handlePointerDown = (e: React.PointerEvent, sq: Square) => {
    if (!interactive || pendingPromotion || e.button !== 0) return;
    const piece = chess.get(sq);
    if (!piece || piece.color !== chess.turn()) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragState({
      from: sq,
      piece: { type: piece.type, color: piece.color },
      x: e.clientX,
      y: e.clientY,
      hoverSquare: sq,
      moved: false,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    const hoverSquare = getSquareFromPoint(e.clientX, e.clientY);
    setDragState((prev) =>
      prev
        ? {
            ...prev,
            x: e.clientX,
            y: e.clientY,
            hoverSquare,
            moved: prev.moved || Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > 4,
          }
        : null
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState) return;
    const dropSq = getSquareFromPoint(e.clientX, e.clientY);
    const { from, moved } = dragState;
    setDragState(null);

    if (moved && dropSq && dropSq !== from) {
      const legal = chess.moves({ square: from, verbose: true }).some((m) => m.to === dropSq);
      if (legal) {
        setSelectedSquare(null);
        onAttemptMove(from, dropSq);
        return;
      }
      setSelectedSquare(null);
    }
  };

  // Hint SVG arrow coordinates (in 0..800 viewBox)
  const hintArrow = useMemo(() => {
    if (!hint) return null;
    const fromPos = squareToGridPos(hint.from, flipped);
    const toPos = squareToGridPos(hint.to, flipped);
    return {
      x1: fromPos.col * 100 + 50,
      y1: fromPos.row * 100 + 50,
      x2: toPos.col * 100 + 50,
      y2: toPos.row * 100 + 50,
    };
  }, [hint, flipped]);

  const promotionChoices: Exclude<PieceSymbol, "k" | "p">[] = ["q", "r", "b", "n"];

  return (
    <div className="relative aspect-square w-full max-w-[min(74vh,640px)] min-w-[352px] select-none touch-none">
      {/* Board outer frame */}
      <div
        ref={boardRef}
        className="relative grid grid-cols-8 grid-rows-8 w-full h-full rounded-lg overflow-hidden border border-[#F3EFE6]/15 shadow-[0_18px_50px_rgba(0,0,0,0.65)]"
        role="grid"
        aria-label="Satranç Tahtası"
      >
        {displayRanks.map((rank, rIdx) =>
          displayFiles.map((file, fIdx) => {
            const sq = `${file}${rank}` as Square;
            const fileNum = FILES.indexOf(file);
            const rankNum = RANKS.indexOf(rank);
            const isLight = (fileNum + rankNum) % 2 === 0;
            const piece = chess.get(sq);

            const isSelected = selectedSquare === sq || dragState?.from === sq;
            const isLastFrom = lastMove?.from === sq;
            const isLastTo = lastMove?.to === sq;
            const isLegalTarget = legalTargetsMap.has(sq);
            const isCheckedKing = checkedKingSquare === sq;
            const isDragHover = dragState?.hoverSquare === sq && isLegalTarget;
            const isHintSquare = hint?.from === sq || hint?.to === sq;
            const isBeingDragged = dragState?.from === sq && dragState.moved;

            let bgClass = isLight ? "bg-[#E9DFCE]" : "bg-[#8A6145]";
            if (isSelected) {
              bgClass = isLight ? "bg-[#DFBE73]" : "bg-[#B28336]";
            } else if (isLastFrom || isLastTo) {
              bgClass = isLight ? "bg-[#E2CE99]" : "bg-[#9E7848]";
            }

            return (
              <button
                key={sq}
                type="button"
                onClick={() => handleSquareClick(sq)}
                onPointerDown={(e) => handlePointerDown(e, sq)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => setDragState(null)}
                aria-label={`${sq}${piece ? ` ${piece.color === "w" ? "Beyaz" : "Siyah"} ${piece.type}` : ""}`}
                className={`relative flex items-center justify-center w-full h-full min-w-[44px] min-h-[44px] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#D49A3A] ${bgClass} ${
                  piece && interactive && piece.color === chess.turn() ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                }`}
              >
                {/* Check radial warning */}
                {isCheckedKing && (
                  <span
                    className="absolute inset-0 bg-[radial-gradient(circle,rgba(220,38,38,0.85)_0%,rgba(220,38,38,0.35)_55%,transparent_78%)] pointer-events-none"
                    aria-hidden="true"
                  />
                )}

                {/* Hint square border highlight */}
                {isHintSquare && (
                  <span
                    className="absolute inset-0.5 border-2 border-[#10B981] rounded-sm pointer-events-none"
                    aria-hidden="true"
                  />
                )}

                {/* Drag target hover ring */}
                {isDragHover && (
                  <span
                    className="absolute inset-0 border-[3px] border-[#F3EFE6]/70 pointer-events-none"
                    aria-hidden="true"
                  />
                )}

                {/* Coordinate labels on outer left file and bottom rank */}
                {fIdx === 0 && (
                  <span
                    className={`absolute top-1 left-1 text-[10px] font-mono font-semibold leading-none pointer-events-none ${
                      isLight ? "text-[#6D4D37]" : "text-[#E9DFCE]/85"
                    }`}
                  >
                    {rank}
                  </span>
                )}
                {rIdx === 7 && (
                  <span
                    className={`absolute bottom-1 right-1 text-[10px] font-mono font-semibold leading-none pointer-events-none ${
                      isLight ? "text-[#6D4D37]" : "text-[#E9DFCE]/85"
                    }`}
                  >
                    {file}
                  </span>
                )}

                {/* Piece SVG */}
                {piece && !isBeingDragged && (
                  <div className="w-[82%] h-[82%] transition-transform duration-150 ease-out">
                    <ChessPieceSvg type={piece.type} color={piece.color} />
                  </div>
                )}

                {/* Legal move indicator */}
                {isLegalTarget && !piece && (
                  <span
                    className="w-[26%] h-[26%] rounded-full bg-[#141311]/30 pointer-events-none"
                    aria-hidden="true"
                  />
                )}
                {isLegalTarget && piece && (
                  <span
                    className="absolute inset-[6%] rounded-full border-[3.5px] border-[#141311]/35 pointer-events-none"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })
        )}

        {/* Hint vector arrow overlay */}
        {hintArrow && (
          <svg
            viewBox="0 0 800 800"
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="hint-arrowhead"
                markerWidth="5"
                markerHeight="5"
                refX="3.5"
                refY="2.5"
                orient="auto"
              >
                <polygon points="0 0, 5 2.5, 0 5" fill="#10B981" />
              </marker>
            </defs>
            <line
              x1={hintArrow.x1}
              y1={hintArrow.y1}
              x2={hintArrow.x2}
              y2={hintArrow.y2}
              stroke="#10B981"
              strokeWidth="12"
              strokeOpacity="0.78"
              strokeLinecap="round"
              markerEnd="url(#hint-arrowhead)"
            />
          </svg>
        )}
      </div>

      {/* Floating dragged piece */}
      {dragState?.moved && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{
            left: dragState.x,
            top: dragState.y,
            width: boardRef.current ? boardRef.current.getBoundingClientRect().width / 8 : 64,
            height: boardRef.current ? boardRef.current.getBoundingClientRect().width / 8 : 64,
          }}
        >
          <ChessPieceSvg type={dragState.piece.type} color={dragState.piece.color} />
        </div>
      )}

      {/* Pawn Promotion Overlay */}
      {pendingPromotion && (
        <div
          className="absolute inset-0 z-30 bg-[#141311]/75 flex items-center justify-center rounded-lg"
          role="dialog"
          aria-modal="true"
          aria-label="Piyon Terfisi Seçimi"
        >
          <div className="bg-[#1D1B18] border border-[#F3EFE6]/15 rounded-xl p-5 shadow-2xl flex flex-col items-center gap-4">
            <h2 className="text-sm font-semibold text-[#F3EFE6]">Terfi Edecek Taşı Seçin</h2>
            <div className="flex items-center gap-2">
              {promotionChoices.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onConfirmPromotion(p)}
                  className="w-16 h-16 p-2 rounded-lg bg-[#2A2622] hover:bg-[#D49A3A]/25 border border-[#F3EFE6]/10 hover:border-[#D49A3A] transition-colors cursor-pointer"
                  aria-label={`Terfi: ${p}`}
                >
                  <ChessPieceSvg type={p} color={pendingPromotion.color} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onCancelPromotion}
              className="text-xs text-[#A9A091] hover:text-[#F3EFE6] px-3 py-1.5 cursor-pointer"
            >
              İptal Et
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
