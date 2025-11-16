import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import aiRouter from "./routes/ai.routes";
import treeRouter from "./routes/tree.routes";
import conceptRouter from "./routes/concept.routes";
import masteryRouter from "./routes/mastery.routes";


dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/tree", treeRouter);
app.use("/api/ai", aiRouter);
app.use("/api/mastery", masteryRouter);
app.use("/api", conceptRouter); // Mounts /api/concept/:concept


// Health check
app.get("/", (_req, res) => {
  res.send("🌲 Syntra backend running!");
});

export default app;
