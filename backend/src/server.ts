import dotenv from "dotenv";
dotenv.config();  // 👈 MUST be first, before any other imports

import app from "./app";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Syntra backend running on http://localhost:${PORT}`);
});
