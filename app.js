import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes.js";
import adRoutes from "./routes/ad.routes.js";
import userRoutes from "./routes/user.routes.js";
import paymentRoutes from "./routes/payment.routes.js";

dotenv.config();

const app = express();

/* ================= CORS ================= */

app.use(cors({
    origin: true,
    credentials: true
}));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }

    next();
});

/* ================= BODY ================= */

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

/* ================= ROUTES ================= */

app.use("/api/auth", authRoutes);
app.use("/api/ads", adRoutes);
app.use("/api/user", userRoutes);
app.use("/api/payment", paymentRoutes);

/* ================= TEST ================= */

app.get("/", (req, res) => {
    res.send("API is running...");
});

export default app;