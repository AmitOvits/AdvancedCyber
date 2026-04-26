import "dotenv/config";
import express from "express";
import cors from "cors";
import { getJwtSecret } from "./config/auth.js";
import { assertTrainingModeSafeToRun, isTrainingModeEnabled } from "./config/trainingMode.js";
import { createApiErrorHandler, apiNotFound } from "./middleware/errorHandler.js";
import { createRequireJwt } from "./middleware/requireJwt.js";
import { createAiExpertRouter } from "./routes/aiExpert.js";
import { createDemoAuthRouter } from "./routes/demoAuth.js";
import { createDemoCatalogRouter, getLatestUrcAlert } from "./routes/demoCatalog.js";
import { attachPerfGridHintHeaders } from "./labHints.js";

assertTrainingModeSafeToRun();

const app = express();
app.disable("x-powered-by");

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const trainingMode = isTrainingModeEnabled();
const port = Number.parseInt(process.env.PORT ?? "8081", 10);
const jwtSecret = getJwtSecret();
const requireJwt = createRequireJwt(jwtSecret);

app.use("/api", createAiExpertRouter());
app.use("/api/v2", createDemoAuthRouter(jwtSecret));
app.use("/api/v2", createDemoCatalogRouter({ requireJwt }));
app.get("/api/lab/alerts/latest", (_req, res) => {
  attachPerfGridHintHeaders(res);
  return res.json({ alert: getLatestUrcAlert() });
});

if (trainingMode) {
  app.use("/api/v1", createDemoCatalogRouter({ requireJwt, publicAccess: true }));
}

app.use("/api", apiNotFound);
app.use(createApiErrorHandler(trainingMode));

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port} (trainingMode=${trainingMode})`);
});
