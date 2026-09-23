import "dotenv/config";
import express from "express";
import cors from "cors";
import { mockRoutes } from "./routes/mockApi.routes";
import { chatRoutes } from "./routes/chat.routes";

const app = express();

app.use(cors());

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Api-RAG-Chatbot",
    time: new Date().toISOString(),
  });
});

app.use("/mock", mockRoutes);
app.use("/api", chatRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("");
  console.log("========================================");
  console.log(`  RAG backend escuchando en :${PORT}`);
  console.log(`  http://localhost:${PORT}/health`);
  console.log("========================================");
  console.log("");
});
