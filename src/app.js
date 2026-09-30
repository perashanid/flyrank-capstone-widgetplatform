const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const widgetsRoutes = require("./routes/widgets.routes");
const publicRoutes = require("./routes/public.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

// Public CORS: the whole point of this product is that ANY customer site can
// load the widget and submit to it, so origin is reflected rather than
// allow-listed. Credentials are not used (JWT is sent via Authorization
// header, not cookies), so this stays safe.
app.use(cors({ origin: true }));

// 20kb cap: generous for a lead-capture form, small enough that an oversized
// payload is rejected before it reaches validation logic (413 via errorHandler).
app.use(express.json({ limit: "20kb" }));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
app.use("/api/widgets", widgetsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/", publicRoutes); // /widget.v1.js, /widgets/:id/config, /submissions

app.use(errorHandler);

module.exports = app;
