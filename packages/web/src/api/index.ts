import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { authMiddleware } from "./middleware/auth";
import { guestsRouter } from "./routes/guests";
import { reservationsRouter } from "./routes/reservations";
import { menuRouter } from "./routes/menu";
import { ordersRouter } from "./routes/orders";
import { inventoryRouter } from "./routes/inventory";
import { staffRouter } from "./routes/staff";
import { shiftbotRouter } from "./routes/shiftbot";
import { analyticsRouter } from "./routes/analytics";

const app = new Hono()
  .use(
    cors({
      origin: (origin) => origin ?? "*",
      credentials: true,
      exposeHeaders: ["set-auth-token"],
    })
  )
  // Better Auth — must be before basePath
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .basePath("api")
  .use("*", authMiddleware)
  .get("/health", (c) => c.json({ status: "ok", ts: Date.now() }, 200))
  .route("/guests", guestsRouter)
  .route("/reservations", reservationsRouter)
  .route("/menu", menuRouter)
  .route("/orders", ordersRouter)
  .route("/inventory", inventoryRouter)
  .route("/staff", staffRouter)
  .route("/shiftbot", shiftbotRouter)
  .route("/analytics", analyticsRouter);

export type AppType = typeof app;
export default app;
