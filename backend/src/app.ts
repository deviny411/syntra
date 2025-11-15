import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import treeRouter from "./routes/tree.routes";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/tree", treeRouter);

// Health check
app.get("/", (_req, res) => {
  res.send("🌲 Syntra backend running!");
});

export default app;
