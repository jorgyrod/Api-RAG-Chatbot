import { Router } from "express";
import { chat } from "../services/chat.service";

export const chatRoutes = Router();

chatRoutes.post("/chat", async (req, res) => {
  const { userId, message } = req.body;

  if (typeof userId !== "string" || userId.trim() === "") {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  if (typeof message !== "string" || message.trim() === "") {
    res.status(400).json({ error: "Invalid message" });
    return;
  }

  try {
    const response = await chat(userId.trim(), message.trim());
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
