import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { Chess } from "chess.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MODEL_ID = "gemini-4-hydrogen";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const THINKING_LEVEL_MAP: Record<string, ThinkingLevel> = {
  LOW: ThinkingLevel.LOW,
  MEDIUM: ThinkingLevel.MEDIUM,
  HIGH: ThinkingLevel.HIGH,
  XHIGH: ThinkingLevel.XHIGH,
};

function normalizeSan(san: string): string {
  return san.trim().replace(/[+#!?]+$/g, "");
}

function matchLegalMove(candidate: string, legalMoves: string[]): string | null {
  const trimmed = candidate.trim();
  if (legalMoves.includes(trimmed)) {
    return trimmed;
  }
  const normalizedCandidate = normalizeSan(trimmed);
  for (const legal of legalMoves) {
    if (normalizeSan(legal) === normalizedCandidate) {
      return legal;
    }
  }
  return null;
}

function extractApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const statusMatch = raw.match(/\b(400|401|403|404|429|500|503)\b/);
  const status = statusMatch ? Number(statusMatch[1]) : 500;

  if (status === 403 || raw.includes("PERMISSION_DENIED") || raw.includes("API_KEY_INVALID")) {
    return {
      status: status === 400 ? 400 : 403,
      message: "Gemini API anahtarı geçersiz veya eksik. Lütfen Settings > Secrets panelinden anahtarınızı kontrol edin.",
    };
  }
  if (status === 429 || raw.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "Gemini API kota sınırına ulaşıldı. Lütfen biraz bekleyip tekrar deneyin.",
    };
  }
  if (status === 404 || raw.includes("NOT_FOUND")) {
    return {
      status: 404,
      message: `Model (${MODEL_ID}) bulunamadı veya erişilemiyor.`,
    };
  }
  return {
    status,
    message: "Gemini 4 Hydrogen hamle üretirken bir bağlantı sorunu oluştu. Tekrar deneyebilirsiniz.",
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  app.post("/api/chess/move", async (req, res) => {
    try {
      const { fen, history = [], thinkingLevel = "MEDIUM" } = req.body ?? {};
      if (typeof fen !== "string" || !fen.trim()) {
        res.status(400).json({ error: "Geçersiz tahta durumu (FEN)." });
        return;
      }

      const chess = new Chess(fen);
      if (chess.isGameOver()) {
        res.status(400).json({ error: "Oyun zaten sona erdi." });
        return;
      }

      const legalMoves = chess.moves();
      if (legalMoves.length === 0) {
        res.status(400).json({ error: "Geçerli hamle bulunamadı." });
        return;
      }

      const turnName = chess.turn() === "w" ? "Beyaz (White)" : "Siyah (Black)";
      const recentHistory = Array.isArray(history) ? history.slice(-16).join(" ") : "";
      const mappedLevel = THINKING_LEVEL_MAP[String(thinkingLevel).toUpperCase()] ?? ThinkingLevel.MEDIUM;

      const buildPrompt = (retryNote?: string) => [
        `Sen dünya çapında bir satranç büyükustası motorusun (Gemini 4 Hydrogen).`,
        `Sıra: ${turnName}.`,
        `Tahta (FEN): ${fen}`,
        `Tahta görünümü:\n${chess.ascii()}`,
        recentHistory ? `Son hamleler: ${recentHistory}` : `Açılış konumu.`,
        `Oynayabileceğin TEK geçerli SAN hamleleri: ${legalMoves.join(", ")}`,
        retryNote ? `ÖNEMLİ DÜZELTME: ${retryNote}` : "",
        `En güçlü stratejik ve taktiksel hamleyi seç. Materyal dengesini, taş aktivitesini, şah güvenliğini ve taktiksel tehditleri (çatal, şiş, açmaz, mat ağı) değerlendir.`,
        `"move" alanı yukarıdaki geçerli SAN listesindeki hamlelerden BİREBİR biri olmalıdır.`,
        `"comment" alanı Türkçe olarak 1 kısa cümleyle bu hamlenin taktiksel amacını açıklamalıdır.`,
        `"evaluation" alanı Beyaz perspektifinden santipiyon cinsinden konum değerlendirmesi olmalıdır (ör. 0 eşit, +150 Beyaz üstün, -150 Siyah üstün).`,
      ]
        .filter(Boolean)
        .join("\n");

      const schema = {
        type: Type.OBJECT,
        properties: {
          move: {
            type: Type.STRING,
            description: "Exact legal SAN move selected from the legal moves list.",
          },
          comment: {
            type: Type.STRING,
            description: "Concise 1-sentence Turkish tactical explanation of the chosen move.",
          },
          evaluation: {
            type: Type.INTEGER,
            description: "Position evaluation in centipawns from White's perspective.",
          },
        },
        required: ["move", "comment", "evaluation"],
      };

      const callModel = async (promptText: string) => {
        const response = await ai.models.generateContent({
          model: MODEL_ID,
          contents: promptText,
          config: {
            systemInstruction:
              "You are a Grandmaster chess engine. Always pick strictly from the provided legal SAN moves list. Respond only with valid JSON matching the schema. Keep Turkish comments natural, sharp, and concise (max 18 words).",
            responseMimeType: "application/json",
            responseSchema: schema,
            thinkingConfig: {
              thinkingLevel: mappedLevel,
            },
          },
        });
        const text = (response.text ?? "").trim();
        return JSON.parse(text) as { move?: string; comment?: string; evaluation?: number };
      };

      let parsed = await callModel(buildPrompt());
      let matchedMove = parsed.move ? matchLegalMove(parsed.move, legalMoves) : null;

      if (!matchedMove) {
        parsed = await callModel(
          buildPrompt(
            `Az önceki "${parsed.move ?? ""}" hamlesi geçersizdi. Yalnızca şu listeden BİREBİR seçim yap: ${legalMoves.join(", ")}`
          )
        );
        matchedMove = parsed.move ? matchLegalMove(parsed.move, legalMoves) : null;
      }

      if (!matchedMove) {
        res.status(502).json({
          error: "Gemini 4 Hydrogen geçerli bir SAN hamlesi üretemedi. Lütfen tekrar deneyin.",
        });
        return;
      }

      const applied = chess.move(matchedMove);
      res.json({
        move: applied.san,
        from: applied.from,
        to: applied.to,
        comment:
          typeof parsed.comment === "string" && parsed.comment.trim()
            ? parsed.comment.trim()
            : `${applied.san} hamlesi ile konum geliştirildi.`,
        evaluation: typeof parsed.evaluation === "number" && Number.isFinite(parsed.evaluation) ? parsed.evaluation : 0,
      });
    } catch (err) {
      const apiErr = extractApiError(err);
      console.error("[/api/chess/move] error:", err);
      res.status(apiErr.status).json({ error: apiErr.message });
    }
  });

  app.post("/api/chess/hint", async (req, res) => {
    try {
      const { fen, history = [] } = req.body ?? {};
      if (typeof fen !== "string" || !fen.trim()) {
        res.status(400).json({ error: "Geçersiz tahta durumu (FEN)." });
        return;
      }

      const chess = new Chess(fen);
      if (chess.isGameOver()) {
        res.status(400).json({ error: "Oyun sona erdiği için ipucu verilemiyor." });
        return;
      }

      const legalMoves = chess.moves();
      const turnName = chess.turn() === "w" ? "Beyaz" : "Siyah";
      const recentHistory = Array.isArray(history) ? history.slice(-14).join(" ") : "";

      const prompt = [
        `Oyuncu (${turnName}) için en iyi satranç hamlesini öner.`,
        `Tahta (FEN): ${fen}`,
        `Tahta:\n${chess.ascii()}`,
        recentHistory ? `Son hamleler: ${recentHistory}` : "",
        `Geçerli SAN hamleleri: ${legalMoves.join(", ")}`,
        `"move" değeri yukarıdaki geçerli SAN hamlelerinden BİREBİR biri olmalı.`,
        `"title" kısa bir Türkçe taktik başlığı olsun (ör. "Merkez Kontrolü", "Çatal Fırsatı", "Şah Güvenliği").`,
        `"explanation" 1-2 kısa Türkçe cümleyle oyuncuya neden bu hamleyi yapması gerektiğini anlatsın.`,
      ]
        .filter(Boolean)
        .join("\n");

      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: prompt,
        config: {
          systemInstruction:
            "You are a Grandmaster chess coach speaking Turkish. Select strictly from the legal moves list and return valid JSON.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              move: { type: Type.STRING },
              title: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ["move", "title", "explanation"],
          },
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MEDIUM,
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim()) as {
        move?: string;
        title?: string;
        explanation?: string;
      };
      const matched = parsed.move ? matchLegalMove(parsed.move, legalMoves) : null;
      if (!matched) {
        res.status(502).json({ error: "İpucu hamlesi doğrulanamadı. Lütfen tekrar deneyin." });
        return;
      }

      const applied = chess.move(matched);
      res.json({
        move: applied.san,
        from: applied.from,
        to: applied.to,
        title: parsed.title?.trim() || "Önerilen Hamle",
        explanation:
          parsed.explanation?.trim() || `${applied.san} hamlesi tahtadaki konumunuzu güçlendirir.`,
      });
    } catch (err) {
      const apiErr = extractApiError(err);
      console.error("[/api/chess/hint] error:", err);
      res.status(apiErr.status).json({ error: apiErr.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Hidrojen Satranc server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
