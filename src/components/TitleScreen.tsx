import { useEffect, useState } from "react";
import type { OpponentMode, SidePreference, ThinkingDepth } from "../types/chess";
import { DEPTH_LABELS } from "../utils/chessHelpers";

interface TitleScreenProps {
  opponentMode: OpponentMode;
  sidePreference: SidePreference;
  thinkingDepth: ThinkingDepth;
  onChangeOpponentMode: (mode: OpponentMode) => void;
  onChangeSidePreference: (side: SidePreference) => void;
  onChangeThinkingDepth: (depth: ThinkingDepth) => void;
  onStartGame: () => void;
}

const BACKDROP_URL = "/src/assets/images/chess_study_backdrop_1794585354855.jpg";

export function TitleScreen({
  opponentMode,
  sidePreference,
  thinkingDepth,
  onChangeOpponentMode,
  onChangeSidePreference,
  onChangeThinkingDepth,
  onStartGame,
}: TitleScreenProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "BUTTON") return;
        e.preventDefault();
        onStartGame();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onStartGame]);

  const depths: ThinkingDepth[] = ["LOW", "MEDIUM", "HIGH", "XHIGH"];

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#141311] text-[#F3EFE6] flex items-center">
      {/* Full-bleed generated key-art backdrop with fallback */}
      {!imgFailed ? (
        <img
          src={BACKDROP_URL}
          alt="Ceviz ve akçaağaç Staunton taşlarıyla satranç masası"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-80"
        />
      ) : (
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_72%_48%,#2E241B_0%,#141311_68%)]"
          aria-hidden="true"
        />
      )}

      {/* Calibrated dark left-to-right scrim for guaranteed 4.5:1+ legibility */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-[#141311] via-[#141311]/90 to-[#141311]/30"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#141311]/85 via-transparent to-[#141311]/55"
        aria-hidden="true"
      />

      {/* Calm negative-space foreground container */}
      <section className="relative z-10 w-full max-w-2xl px-8 sm:px-14 lg:px-20 py-10 flex flex-col gap-8">
        {/* Bespoke inline SVG emblem + Title lockup */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <svg
              width="42"
              height="42"
              viewBox="0 0 44 44"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="shrink-0"
            >
              <rect
                x="1.5"
                y="1.5"
                width="41"
                height="41"
                rx="9"
                fill="#1D1A16"
                stroke="#D49A3A"
                strokeOpacity="0.65"
                strokeWidth="1.5"
              />
              <circle cx="22" cy="22" r="14" stroke="#D49A3A" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 3" />
              <path
                d="M16 32h13v-2.5H16V32zm2.2-4.2c-.3-4.6 3.5-5.7 3.8-9.5-1.2.4-3 .5-4-.6-.8-.9.3-3.8 1.5-5.6l-1.3-2 2.2.8c1.1-.8 2.6-1 3.7-.3 2.7 1.7 4.4 5.8 4.4 10.6 0 2.5-.6 4.8-1.4 6.6H18.2z"
                fill="#F3EFE6"
              />
              <circle cx="31.5" cy="12.5" r="2.2" fill="#D49A3A" />
            </svg>
            <div className="text-xs tracking-wide text-[#C9C1B2]">
              <span>Gemini 4 Hydrogen</span>
              <span className="mx-2 text-[#D49A3A]" aria-hidden="true">·</span>
              <span>Turnuva Kuralları</span>
              <span className="mx-2 text-[#D49A3A]" aria-hidden="true">·</span>
              <span>Türkçe Analiz</span>
            </div>
          </div>

          <h1
            className="text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold tracking-tight text-[#F3EFE6] leading-[1.08]"
            style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
          >
            Hidrojen Satranç
          </h1>

          <p className="text-[15px] sm:text-base text-[#C9C1B2] leading-relaxed max-w-lg">
            Her hamlede konumunuzu değerlendiren Gemini 4 Hydrogen motoruna karşı oynayın veya aynı masada iki kişilik klasik satranç açın.
          </p>
        </div>

        {/* Clean Match Setup Controls */}
        <div className="flex flex-col gap-5 max-w-md border-t border-[#F3EFE6]/12 pt-6">
          {/* Opponent mode */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-[#A9A091]">Oyun Modu</span>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#1D1B18] border border-[#F3EFE6]/10 rounded-lg">
              <button
                type="button"
                onClick={() => onChangeOpponentMode("AI")}
                className={`min-h-[40px] px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D49A3A] ${
                  opponentMode === "AI"
                    ? "bg-[#D49A3A] text-[#141311] font-semibold"
                    : "text-[#C9C1B2] hover:text-[#F3EFE6] hover:bg-[#F3EFE6]/5"
                }`}
              >
                Gemini 4 Hydrogen
              </button>
              <button
                type="button"
                onClick={() => onChangeOpponentMode("LOCAL")}
                className={`min-h-[40px] px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D49A3A] ${
                  opponentMode === "LOCAL"
                    ? "bg-[#D49A3A] text-[#141311] font-semibold"
                    : "text-[#C9C1B2] hover:text-[#F3EFE6] hover:bg-[#F3EFE6]/5"
                }`}
              >
                İki Kişilik Masa
              </button>
            </div>
          </div>

          {/* Side preference & AI Thinking Level */}
          {opponentMode === "AI" && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-[#A9A091]">Tarafınız</span>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#1D1B18] border border-[#F3EFE6]/10 rounded-lg">
                  {[
                    { id: "w" as SidePreference, label: "Beyaz" },
                    { id: "random" as SidePreference, label: "Rastgele" },
                    { id: "b" as SidePreference, label: "Siyah" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeSidePreference(opt.id)}
                      className={`min-h-[40px] px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D49A3A] ${
                        sidePreference === opt.id
                          ? "bg-[#F3EFE6] text-[#141311] font-semibold"
                          : "text-[#C9C1B2] hover:text-[#F3EFE6] hover:bg-[#F3EFE6]/5"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#A9A091]">Motor Düşünme Derinliği</span>
                  <span className="text-[#D49A3A] font-mono tabular-nums">
                    {DEPTH_LABELS[thinkingDepth].detail}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#1D1B18] border border-[#F3EFE6]/10 rounded-lg">
                  {depths.map((depth) => (
                    <button
                      key={depth}
                      type="button"
                      onClick={() => onChangeThinkingDepth(depth)}
                      className={`min-h-[40px] px-2.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D49A3A] ${
                        thinkingDepth === depth
                          ? "bg-[#F3EFE6] text-[#141311] font-semibold"
                          : "text-[#C9C1B2] hover:text-[#F3EFE6] hover:bg-[#F3EFE6]/5"
                      }`}
                    >
                      {DEPTH_LABELS[depth].label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Primary Start CTA + single flat control-hint line */}
          <div className="flex flex-col gap-3 pt-2">
            <button
              type="button"
              onClick={onStartGame}
              className="min-h-[48px] w-full sm:w-auto sm:self-start px-8 py-3 rounded-lg bg-[#D49A3A] hover:bg-[#E0A94B] active:scale-[0.99] text-[#141311] font-semibold text-base transition-[background-color,transform] duration-150 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F3EFE6] cursor-pointer"
            >
              Oyuna Başla
            </button>

            <p className="text-xs text-[#9D9587] font-mono tracking-tight">
              Tıkla veya Sürükle Hamle · H İpucu · Z Geri Al · F Çevir · Esc Menü
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
