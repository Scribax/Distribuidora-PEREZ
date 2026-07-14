import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./lib/config.js";
import { errorHandler } from "./lib/errors.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { catalogRouter } from "./routes/catalog.js";
import { clientsRouter } from "./routes/clients.js";
import { purchasesRouter } from "./routes/purchases.js";
import { remittancesRouter } from "./routes/remittances.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { vendorsRouter } from "./routes/vendors.js";
import { reportsRouter } from "./routes/reports.js";
import { suppliersRouter } from "./routes/suppliers.js";
import { expensesRouter } from "./routes/expenses.js";
import { quotesRouter } from "./routes/quotes.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: "8mb" }));
app.use(morgan("combined"));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api", catalogRouter);
app.use("/api/clientes", clientsRouter);
app.use("/api/compras", purchasesRouter);
app.use("/api/remitos", remittancesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/vendedores", vendorsRouter);
app.use("/api/proveedores", suppliersRouter);
app.use("/api/gastos", expensesRouter);
app.use("/api/informes", reportsRouter);
app.use("/api/cotizaciones", quotesRouter);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
