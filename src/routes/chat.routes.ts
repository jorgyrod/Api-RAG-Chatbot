import { Router } from "express";
import { chat } from "../services/chat.service";
import { Turn } from "../services/llm.service";

export const chatRoutes = Router();

function historyValidation(value: unknown): Turn[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is Turn =>
        typeof item === "object" &&
        item !== null &&
        (item as Turn).role !== undefined &&
        ((item as Turn).role === "user" ||
          (item as Turn).role === "assistant") &&
        typeof (item as Turn).content === "string" &&
        (item as Turn).content.trim() !== "",
    )
    .map((item) => ({ role: item.role, content: item.content.slice(0, 4000) }));
}

chatRoutes.post("/chat", async (req, res) => {
  const { userId, message, history } = req.body;

  if (typeof userId !== "string" || userId.trim() === "") {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  if (typeof message !== "string" || message.trim() === "") {
    res.status(400).json({ error: "Invalid message" });
    return;
  }

  try {
    const response = await chat(
      userId.trim(),
      message.trim(),
      historyValidation(history),
    );
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
