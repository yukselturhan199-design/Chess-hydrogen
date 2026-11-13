import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import {
  ArrowLeftRight,
  Lightbulb,
  Loader2,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ChessBoard } from "./components/ChessBoard";
import { ChessPieceSvg } from "./components/ChessPieceSvg";
import { GameOverModal, PauseModal } from "./components/GameModals";
import { TitleScreen } from "./components/TitleScreen";
import type {
  GameState,
  HintData,
  MoveRecord,
  OpponentMode,
  PendingPromotion,
  SidePreference,
  ThinkingDepth,
} from "./types/chess";
import {
  computeCapturedSummary,
  computeStaticCentipawns,
  DEPTH_LABELS,
  describeGameResult,
  formatEvalDisplay,
} from "./utils/chessHelpers";
import { soundEngine } from "./utils/sound";

export default function App() {
  const [gameState, setGameState] = useState<GameState>("TITLE_MENU");
  const [opponentMode, setOpponentMode] = useState<OpponentMode>("AI");
  const [sidePreference, setSidePreference] = useState<SidePreference>("w");
  const [thinkingDepth, setThinkingDepth] = useState<ThinkingDepth>("MEDIUM");

  const [playerColor, setPlayerColor] = useState<Color>("w");
  const [flipped, setFlipped] = useState(false);
  const [muted, setMuted] = useState(false);

  const [fen, setFen] = useState<string>(() => new Chess().fen());
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [evaluationCp, setEvaluationCp] = useState<number>(0);
  const [aiComment, setAiComment] = useState<string>(
    "Açılışta merkez kareleri kontrol etmek ve taşları hızla geliştirmek önceliklidir."
  );

  const [aiThinking, setAiThinking] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [activeHint, setActiveHint] = useState<HintData | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [inspectingBoard, setInspectingBoard] = useState(false);

  const sessionRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const moveListEndRef = useRef<HTMLDivElement | null>(null);

  const chess = useMemo(() => {
    const instance = new Chess();
    instance.load(fen);
    return instance;
  }, [fen]);

  const capturedSummary = useMemo(() => computeCapturedSummary(chess), [chess]);

  const lastMove = useMemo(() => {
    if (moveHistory.length === 0) return null;
    const last = moveHistory[moveHistory.length - 1];
    return { from: last.from, to: last.to };
  }, [moveHistory]);

  const aiColor: Color = playerColor === "w" ? "b" : "w";
  const isAiTurn = opponentMode === "AI" && gameState === "PLAYING" && chess.turn() === aiColor && !chess.isGameOver();
  const isBoardInteractive =
    gameState === "PLAYING" &&
    !chess.isGameOver() &&
    !aiThinking &&
    (opponentMode === "LOCAL" || chess.turn() === playerColor);

  const cancelPendingRequest = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setAiThinking(false);
    setHintLoading(false);
  }, []);

  const playMoveAudio = useCallback((flags: string, isCheck: boolean, isGameOver: boolean, playerWon: boolean) => {
    if (isGameOver) {
      soundEngine.playGameOver(playerWon);
      return;
    }
    if (isCheck) {
      soundEngine.playCheck();
      return;
    }
    if (flags.includes("k") || flags.includes("q")) {
      soundEngine.playCastle();
      return;
    }
    if (flags.includes("c") || flags.includes("e")) {
      soundEngine.playCapture();
      return;
    }
    soundEngine.playMove();
  }, []);

  const startNewGame = useCallback(
    (overrideSide?: SidePreference) => {
      cancelPendingRequest();
      sessionRef.current += 1;

      const pref = overrideSide ?? sidePreference;
      const chosenPlayerColor: Color =
        opponentMode === "LOCAL"
          ? "w"
          : pref === "random"
            ? Math.random() < 0.5
              ? "w"
              : "b"
            : pref;

      const fresh = new Chess();
      setPlayerColor(chosenPlayerColor);
      setFlipped(chosenPlayerColor === "b");
      setFen(fresh.fen());
      setMoveHistory([]);
      setEvaluationCp(0);
      setActiveHint(null);
      setPendingPromotion(null);
      setApiError(null);
      setInspectingBoard(false);
      setAiComment(
        opponentMode === "AI"
          ? chosenPlayerColor === "w"
            ? "Beyaz taşlarla ilk hamle sizin. Gemini 4 Hydrogen yanıt için hazır."
            : "Gemini 4 Hydrogen beyaz taşlarla açılışı hesaplıyor."
          : "İki kişilik masa hazır. Beyaz taşlar açılış hamlesini oynar."
      );
      setGameState("PLAYING");
    },
    [cancelPendingRequest, opponentMode, sidePreference]
  );

  // Auto-scroll move list
  useEffect(() => {
    moveListEndRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [moveHistory.length]);

  // Execute AI turn automatically when it's Gemini 4 Hydrogen's turn
  const requestAiMove = useCallback(async () => {
    const currentSession = sessionRef.current;
    const snapshot = new Chess(fen);
    if (snapshot.isGameOver()) return;

    cancelPendingRequest();
    const controller = new AbortController();
    abortRef.current = controller;

    setAiThinking(true);
    setApiError(null);

    const startTime = Date.now();
    try {
      const response = await fetch("/api/chess/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          fen,
          history: moveHistory.map((m) => m.san),
          thinkingLevel: thinkingDepth,
        }),
      });

      const data = (await response.json()) as {
        move?: string;
        comment?: string;
        evaluation?: number;
        error?: string;
      };

      if (!response.ok || !data.move) {
        throw new Error(data.error || "Gemini 4 Hydrogen hamle üretemedi.");
      }

      // Ensure realistic brief turn pacing (>= 450ms)
      const elapsed = Date.now() - startTime;
      if (elapsed < 450) {
        await new Promise((r) => setTimeout(r, 450 - elapsed));
      }

      if (sessionRef.current !== currentSession || controller.signal.aborted) {
        return;
      }

      const nextChess = new Chess(fen);
      const applied = nextChess.move(data.move);
      const over = nextChess.isGameOver();
      const winner = nextChess.isCheckmate() ? (nextChess.turn() === "w" ? "b" : "w") : null;

      setFen(nextChess.fen());
      setMoveHistory((prev) => [
        ...prev,
        {
          san: applied.san,
          from: applied.from,
          to: applied.to,
          color: applied.color,
          piece: applied.piece,
          captured: applied.captured,
          flags: applied.flags,
          comment: data.comment,
        },
      ]);
      if (typeof data.evaluation === "number") {
        setEvaluationCp(data.evaluation);
      } else {
        setEvaluationCp(computeStaticCentipawns(nextChess));
      }
      if (data.comment) {
        setAiComment(data.comment);
      }
      setActiveHint(null);
      playMoveAudio(applied.flags, nextChess.inCheck(), over, winner === playerColor);

      if (over) {
        setGameState("GAME_OVER");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (sessionRef.current !== currentSession) return;
      setApiError(err instanceof Error ? err.message : "Bağlantı hatası oluştu.");
    } finally {
      if (sessionRef.current === currentSession) {
        setAiThinking(false);
      }
    }
  }, [fen, moveHistory, thinkingDepth, cancelPendingRequest, playMoveAudio, playerColor]);

  useEffect(() => {
    if (isAiTurn && !aiThinking && !apiError) {
      void requestAiMove();
    }
  }, [isAiTurn, aiThinking, apiError, requestAiMove]);

  // Apply human move
  const executePlayerMove = useCallback(
    (from: Square, to: Square, promotion?: Exclude<PieceSymbol, "k" | "p">) => {
      const nextChess = new Chess(fen);

      // Check if pawn promotion choice is needed
      if (!promotion) {
        const piece = nextChess.get(from);
        const isPromotionRank =
          piece?.type === "p" &&
          ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"));

        if (isPromotionRank) {
          const legalPromos = nextChess
            .moves({ square: from, verbose: true })
            .filter((m) => m.to === to && m.promotion);
          if (legalPromos.length > 0) {
            setPendingPromotion({ from, to, color: piece.color });
            return;
          }
        }
      }

      try {
        const applied = nextChess.move({ from, to, promotion: promotion ?? "q" });
        const over = nextChess.isGameOver();
        const winner = nextChess.isCheckmate() ? (nextChess.turn() === "w" ? "b" : "w") : null;

        setFen(nextChess.fen());
        setMoveHistory((prev) => [
          ...prev,
          {
            san: applied.san,
            from: applied.from,
            to: applied.to,
            color: applied.color,
            piece: applied.piece,
            captured: applied.captured,
            flags: applied.flags,
          },
        ]);
        setActiveHint(null);
        setPendingPromotion(null);
        setApiError(null);
        if (opponentMode === "LOCAL") {
          setEvaluationCp(computeStaticCentipawns(nextChess));
        }

        playMoveAudio(
          applied.flags,
          nextChess.inCheck(),
          over,
          opponentMode === "LOCAL" ? winner !== null : winner === playerColor
        );

        if (over) {
          setGameState("GAME_OVER");
        }
      } catch {
        // Illegal move attempt ignored cleanly
      }
    },
    [fen, opponentMode, playMoveAudio, playerColor]
  );

  // Undo last move(s)
  const handleUndo = useCallback(() => {
    if (moveHistory.length === 0 || gameState === "TITLE_MENU") return;
    cancelPendingRequest();
    sessionRef.current += 1;

    const pliesToUndo =
      opponentMode === "AI" && chess.turn() === playerColor && moveHistory.length >= 2 ? 2 : 1;

    const remaining = moveHistory.slice(0, moveHistory.length - pliesToUndo);
    const rebuilt = new Chess();
    for (const m of remaining) {
      rebuilt.move(m.san);
    }

    setFen(rebuilt.fen());
    setMoveHistory(remaining);
    setEvaluationCp(computeStaticCentipawns(rebuilt));
    setActiveHint(null);
    setPendingPromotion(null);
    setApiError(null);
    setInspectingBoard(false);
    setGameState("PLAYING");
    soundEngine.playMove();
  }, [moveHistory, gameState, cancelPendingRequest, opponentMode, chess, playerColor]);

  // Request Gemini 4 Hydrogen Hint
  const handleHint = useCallback(async () => {
    if (gameState !== "PLAYING" || chess.isGameOver() || aiThinking || hintLoading) return;
    const currentSession = sessionRef.current;
    setHintLoading(true);
    setApiError(null);

    try {
      const response = await fetch("/api/chess/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fen,
          history: moveHistory.map((m) => m.san),
        }),
      });
      const data = (await response.json()) as HintData & { error?: string };
      if (!response.ok || !data.move) {
        throw new Error(data.error || "İpucu alınamadı.");
      }
      if (sessionRef.current !== currentSession) return;
      setActiveHint(data);
    } catch (err) {
      if (sessionRef.current !== currentSession) return;
      setApiError(err instanceof Error ? err.message : "İpucu isteği başarısız oldu.");
    } finally {
      if (sessionRef.current === currentSession) {
        setHintLoading(false);
      }
    }
  }, [gameState, chess, aiThinking, hintLoading, fen, moveHistory]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  // Global keyboard shortcuts during play
  useEffect(() => {
    if (gameState === "TITLE_MENU") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (pendingPromotion) {
          setPendingPromotion(null);
          return;
        }
        if (gameState === "PLAYING") {
          setGameState("PAUSED");
        } else if (gameState === "PAUSED") {
          setGameState("PLAYING");
        }
        return;
      }

      if (gameState !== "PLAYING") return;

      const lower = e.key.toLowerCase();
      if (lower === "h") {
        e.preventDefault();
        void handleHint();
      } else if (lower === "z") {
        e.preventDefault();
        handleUndo();
      } else if (lower === "f") {
        e.preventDefault();
        setFlipped((p) => !p);
      } else if (lower === "m") {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameState, pendingPromotion, handleHint, handleUndo, toggleMute]);

  // Pair moves into full turns for algebraic table
  const movePairs = useMemo(() => {
    const pairs: Array<{ moveNumber: number; white?: MoveRecord; black?: MoveRecord }> = [];
    for (let i = 0; i < moveHistory.length; i += 2) {
      pairs.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: moveHistory[i],
        black: moveHistory[i + 1],
      });
    }
    return pairs;
  }, [moveHistory]);

  const gameResult = useMemo(
    () => (chess.isGameOver() ? describeGameResult(chess, opponentMode, playerColor) : null),
    [chess, opponentMode, playerColor]
  );

  // Evaluation bar fill percentage for White (clamped 5%..95%)
  const whiteBarPercent = useMemo(() => {
    if (Math.abs(evaluationCp) >= 9000) {
      return evaluationCp > 0 ? 100 : 0;
    }
    const sigmoid = 1 / (1 + Math.exp(-evaluationCp / 350));
    return Math.min(95, Math.max(5, Math.round(sigmoid * 100)));
  }, [evaluationCp]);

  if (gameState === "TITLE_MENU") {
    return (
      <TitleScreen
        opponentMode={opponentMode}
        sidePreference={sidePreference}
        thinkingDepth={thinkingDepth}
        onChangeOpponentMode={setOpponentMode}
        onChangeSidePreference={setSidePreference}
        onChangeThinkingDepth={setThinkingDepth}
        onStartGame={() => startNewGame()}
      />
    );
  }

  const topColor: Color = flipped ? "w" : "b";
  const bottomColor: Color = flipped ? "b" : "w";

  const renderPlayerStrip = (sideColor: Color) => {
    const isTurn = chess.turn() === sideColor && !chess.isGameOver();
    const isEngine = opponentMode === "AI" && sideColor === aiColor;
    const label =
      opponentMode === "LOCAL"
        ? sideColor === "w"
          ? "Beyaz Oyuncu"
          : "Siyah Oyuncu"
        : isEngine
          ? `Gemini 4 Hydrogen`
          : `Siz (${sideColor === "w" ? "Beyaz" : "Siyah"})`;

    const captured = sideColor === "w" ? capturedSummary.capturedByWhite : capturedSummary.capturedByBlack;
    const capturedColor: Color = sideColor === "w" ? "b" : "w";
    const advantage =
      sideColor === "w" ? capturedSummary.whiteAdvantage : -capturedSummary.whiteAdvantage;

    return (
      <div className="w-full max-w-[min(74vh,640px)] flex items-center justify-between gap-4 py-1.5 px-1">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center border shrink-0 ${
              sideColor === "w"
                ? "bg-[#FAF5EB] border-[#F3EFE6]/40"
                : "bg-[#221F1C] border-[#F3EFE6]/20"
            }`}
            aria-hidden="true"
          >
            <div className="w-5 h-5">
              <ChessPieceSvg type="k" color={sideColor} />
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#F3EFE6] truncate">{label}</span>
              {isEngine && (
                <span className="text-xs text-[#A9A091] shrink-0">
                  {DEPTH_LABELS[thinkingDepth].label}
                </span>
              )}
            </div>
            {/* Captured pieces + material diff */}
            <div className="flex items-center gap-1 min-h-[18px]">
              {captured.length > 0 && (
                <div className="flex items-center -space-x-1">
                  {captured.map((p, idx) => (
                    <div key={`${p}-${idx}`} className="w-4 h-4">
                      <ChessPieceSvg type={p} color={capturedColor} />
                    </div>
                  ))}
                </div>
              )}
              {advantage > 0 && (
                <span className="text-xs font-mono tabular-nums text-[#D49A3A] ml-1">
                  +{advantage}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Explicit turn indicator text + icon (never hue-only) */}
        <div className="shrink-0 text-xs font-medium flex items-center gap-1.5">
          {isEngine && aiThinking ? (
            <span className="flex items-center gap-1.5 text-[#D49A3A]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              <span>Düşünüyor...</span>
            </span>
          ) : isTurn ? (
            <span className="text-[#D49A3A]">
              {chess.inCheck() ? "Şah Altında · Sıra" : "Hamle Sırası"}
            </span>
          ) : (
            <span className="text-[#787166]">Bekliyor</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-dvh w-screen overflow-hidden bg-[#141311] text-[#F3EFE6] flex flex-col lg:flex-row">
      {/* Primary Board Arena (>= 85% unobstructed playfield presence) */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col items-center justify-center px-4 py-3 lg:px-8 lg:py-4 gap-2">
        {renderPlayerStrip(topColor)}

        <div className="flex items-stretch justify-center gap-3 w-full max-w-[calc(min(74vh,640px)+28px)]">
          {/* Minimal Evaluation Hairline Bar */}
          <div
            className="w-3.5 rounded-sm overflow-hidden bg-[#221F1C] border border-[#F3EFE6]/12 flex flex-col justify-end shrink-0 relative"
            title={`Konum Değerlendirmesi: ${formatEvalDisplay(evaluationCp)}`}
            aria-label={`Konum değerlendirmesi ${formatEvalDisplay(evaluationCp)}`}
          >
            <div
              className="w-full bg-[#E9DFCE] transition-[height] duration-300 ease-out"
              style={{ height: `${flipped ? 100 - whiteBarPercent : whiteBarPercent}%` }}
            />
          </div>

          <ChessBoard
            chess={chess}
            flipped={flipped}
            interactive={isBoardInteractive}
            lastMove={lastMove}
            hint={activeHint}
            pendingPromotion={pendingPromotion}
            onAttemptMove={(from, to) => executePlayerMove(from, to)}
            onConfirmPromotion={(piece) => {
              if (pendingPromotion) {
                executePlayerMove(pendingPromotion.from, pendingPromotion.to, piece);
              }
            }}
            onCancelPromotion={() => setPendingPromotion(null)}
          />
        </div>

        {renderPlayerStrip(bottomColor)}
      </main>

      {/* Study Side Panel */}
      <aside className="w-full lg:w-[340px] xl:w-[370px] shrink-0 bg-[#181614] border-t lg:border-t-0 lg:border-l border-[#F3EFE6]/10 flex flex-col max-h-[34dvh] lg:max-h-full">
        {/* Compact Header & Eval */}
        <div className="px-5 py-3.5 border-b border-[#F3EFE6]/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1
              className="text-lg font-semibold text-[#F3EFE6] truncate"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Hidrojen Satranç
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs font-mono tabular-nums text-[#C9C1B2]">
            <span>Değerlendirme</span>
            <span className="text-[#D49A3A] font-semibold">{formatEvalDisplay(evaluationCp)}</span>
          </div>
        </div>

        {/* Tactical Analysis / Hint / Error Note */}
        <div className="px-5 py-3.5 border-b border-[#F3EFE6]/10 flex flex-col gap-2">
          {apiError ? (
            <div className="flex flex-col gap-2 text-xs text-[#FCA5A5]">
              <p className="leading-relaxed">{apiError}</p>
              <div className="flex items-center gap-2">
                {isAiTurn && (
                  <button
                    type="button"
                    onClick={() => void requestAiMove()}
                    className="px-3 py-1.5 rounded-md bg-[#D49A3A] text-[#141311] font-semibold whitespace-nowrap cursor-pointer"
                  >
                    Tekrar Dene
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setApiError(null)}
                  className="px-2.5 py-1.5 rounded-md text-[#C9C1B2] hover:text-[#F3EFE6] cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </div>
          ) : activeHint ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#10B981]">
                  İpucu: {activeHint.title} ({activeHint.move})
                </span>
                <button
                  type="button"
                  onClick={() => setActiveHint(null)}
                  className="text-[#9D9587] hover:text-[#F3EFE6] cursor-pointer"
                >
                  Gizle
                </button>
              </div>
              <p className="text-xs sm:text-[13px] text-[#E4DED2] leading-relaxed">
                {activeHint.explanation}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium text-[#A9A091]">
                {opponentMode === "AI" ? "Gemini 4 Hydrogen Notu" : "Masa Durumu"}
              </div>
              <p className="text-xs sm:text-[13px] text-[#E4DED2] leading-relaxed">
                {aiThinking ? "Tahta konumu analiz ediliyor ve aday hamleler karşılaştırılıyor..." : aiComment}
              </p>
            </div>
          )}
        </div>

        {/* Algebraic Move History */}
        <div className="flex-1 min-h-0 overflow-y-auto study-scroll px-5 py-3">
          {movePairs.length === 0 ? (
            <p className="text-xs text-[#8C8477] py-4">
              Henüz hamle yapılmadı. Başlamak için tahtadan bir taş seçin veya sürükleyin.
            </p>
          ) : (
            <div className="grid grid-cols-[36px_1fr_1fr] gap-y-1 text-xs font-mono tabular-nums">
              {movePairs.map((pair) => (
                <div key={pair.moveNumber} className="contents">
                  <span className="text-[#787166] py-1">{pair.moveNumber}.</span>
                  <span className="text-[#F3EFE6] py-1 px-1.5 rounded hover:bg-[#F3EFE6]/5">
                    {pair.white?.san ?? ""}
                  </span>
                  <span className="text-[#C9C1B2] py-1 px-1.5 rounded hover:bg-[#F3EFE6]/5">
                    {pair.black?.san ?? ""}
                  </span>
                </div>
              ))}
              <div ref={moveListEndRef} />
            </div>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="px-4 py-3 border-t border-[#F3EFE6]/10 bg-[#151311] flex flex-wrap items-center justify-between gap-2">
          {inspectingBoard && gameResult ? (
            <div className="w-full flex items-center gap-2">
              <button
                type="button"
                onClick={() => startNewGame()}
                className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-[#D49A3A] hover:bg-[#E0A94B] text-[#141311] text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                Yeni Parti
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelPendingRequest();
                  setGameState("TITLE_MENU");
                }}
                className="min-h-[40px] px-3 py-2 rounded-lg bg-[#27241F] hover:bg-[#322E28] text-[#F3EFE6] text-xs font-medium whitespace-nowrap cursor-pointer"
              >
                Ana Menü
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={moveHistory.length === 0}
                  title="Geri Al (Z)"
                  className="min-h-[40px] px-3 py-2 rounded-lg bg-[#23201C] hover:bg-[#2E2A25] disabled:opacity-40 disabled:pointer-events-none text-xs font-medium text-[#F3EFE6] flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Geri Al</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleHint()}
                  disabled={!isBoardInteractive || hintLoading}
                  title="Gemini 4 Hydrogen İpucu (H)"
                  className="min-h-[40px] px-3 py-2 rounded-lg bg-[#23201C] hover:bg-[#2E2A25] disabled:opacity-40 disabled:pointer-events-none text-xs font-medium text-[#10B981] flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
                >
                  {hintLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>İpucu</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFlipped((p) => !p)}
                  title="Tahtayı Çevir (F)"
                  aria-label="Tahtayı Çevir"
                  className="min-h-[40px] min-w-[40px] p-2 rounded-lg bg-[#23201C] hover:bg-[#2E2A25] text-[#C9C1B2] hover:text-[#F3EFE6] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  title={muted ? "Sesi Aç (M)" : "Sesi Kapat (M)"}
                  aria-label={muted ? "Sesi Aç" : "Sesi Kapat"}
                  className="min-h-[40px] min-w-[40px] p-2 rounded-lg bg-[#23201C] hover:bg-[#2E2A25] text-[#C9C1B2] hover:text-[#F3EFE6] flex items-center justify-center transition-colors cursor-pointer"
                >
                  {muted ? (
                    <VolumeX className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Volume2 className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setGameState("PAUSED")}
                  title="Menü / Duraklat (Esc)"
                  className="min-h-[40px] px-3 py-2 rounded-lg bg-[#23201C] hover:bg-[#2E2A25] text-xs font-medium text-[#F3EFE6] flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Menü</span>
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Modals */}
      {gameState === "PAUSED" && (
        <PauseModal
          onResume={() => setGameState("PLAYING")}
          onRestart={() => startNewGame()}
          onReturnToTitle={() => {
            cancelPendingRequest();
            setGameState("TITLE_MENU");
          }}
        />
      )}

      {gameState === "GAME_OVER" && gameResult && !inspectingBoard && (
        <GameOverModal
          title={gameResult.title}
          subtitle={gameResult.subtitle}
          moveCount={moveHistory.length}
          isDraw={gameResult.isDraw}
          isPlayerWin={gameResult.isPlayerWin}
          onPlayAgain={() => startNewGame()}
          onInspectBoard={() => setInspectingBoard(true)}
          onReturnToTitle={() => {
            cancelPendingRequest();
            setGameState("TITLE_MENU");
          }}
        />
      )}
    </div>
  );
}
