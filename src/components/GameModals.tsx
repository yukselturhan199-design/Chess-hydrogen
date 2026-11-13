interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onReturnToTitle: () => void;
}

export function PauseModal({ onResume, onRestart, onReturnToTitle }: PauseModalProps) {
  return (
    <div
      className="fixed inset-0 z-40 bg-[#141311]/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Oyun Duraklatıldı"
    >
      <div className="w-full max-w-sm bg-[#1C1A17] border border-[#F3EFE6]/14 rounded-xl p-6 shadow-2xl flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2
            className="text-2xl font-semibold text-[#F3EFE6]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Oyun Duraklatıldı
          </h2>
          <p className="text-sm text-[#A9A091]">
            Mevcut tahta konumunuz korunuyor.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="min-h-[44px] w-full px-4 py-2.5 rounded-lg bg-[#D49A3A] hover:bg-[#E0A94B] text-[#141311] font-semibold text-sm transition-colors cursor-pointer"
          >
            Devam Et
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="min-h-[44px] w-full px-4 py-2.5 rounded-lg bg-[#27241F] hover:bg-[#322E28] text-[#F3EFE6] font-medium text-sm border border-[#F3EFE6]/10 transition-colors cursor-pointer"
          >
            Yeni Parti Başlat
          </button>
          <button
            type="button"
            onClick={onReturnToTitle}
            className="min-h-[44px] w-full px-4 py-2.5 rounded-lg text-[#C9C1B2] hover:text-[#F3EFE6] hover:bg-[#F3EFE6]/5 font-medium text-sm transition-colors cursor-pointer"
          >
            Ana Menüye Dön
          </button>
        </div>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  title: string;
  subtitle: string;
  moveCount: number;
  isDraw: boolean;
  isPlayerWin: boolean;
  onPlayAgain: () => void;
  onReturnToTitle: () => void;
  onInspectBoard: () => void;
}

export function GameOverModal({
  title,
  subtitle,
  moveCount,
  isDraw,
  isPlayerWin,
  onPlayAgain,
  onReturnToTitle,
  onInspectBoard,
}: GameOverModalProps) {
  const accentText = isDraw ? "text-[#C9C1B2]" : isPlayerWin ? "text-[#10B981]" : "text-[#D49A3A]";

  return (
    <div
      className="fixed inset-0 z-40 bg-[#141311]/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Oyun Bitti"
    >
      <div className="w-full max-w-md bg-[#1C1A17] border border-[#F3EFE6]/15 rounded-xl p-6 sm:p-7 shadow-2xl flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className={`text-xs font-medium tracking-wide ${accentText}`}>
            <span>Parti Tamamlandı</span>
            <span className="mx-2 text-[#F3EFE6]/30" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{Math.ceil(moveCount / 2)} Hamle</span>
          </div>
          <h2
            className="text-3xl font-semibold text-[#F3EFE6]"
            style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
          >
            {title}
          </h2>
          <p className="text-sm text-[#C9C1B2] leading-relaxed">{subtitle}</p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onPlayAgain}
            className="min-h-[44px] w-full px-5 py-2.5 rounded-lg bg-[#D49A3A] hover:bg-[#E0A94B] text-[#141311] font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
          >
            Tekrar Oyna
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onInspectBoard}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#27241F] hover:bg-[#322E28] text-[#F3EFE6] font-medium text-sm border border-[#F3EFE6]/10 transition-colors whitespace-nowrap cursor-pointer"
            >
              Tahtayı İncele
            </button>
            <button
              type="button"
              onClick={onReturnToTitle}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#27241F] hover:bg-[#322E28] text-[#C9C1B2] hover:text-[#F3EFE6] font-medium text-sm border border-[#F3EFE6]/10 transition-colors whitespace-nowrap cursor-pointer"
            >
              Ana Menü
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
