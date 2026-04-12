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
    origin: [
        "http://localhost:5173",
        "http://192.168.1.28:5173",
        "http://localhost:8081",
        "exp://192.168.1.28:8081",
        "https://adstudioproject.netlify.app" // ✅ FIX
    ],
    credentials: true
}));

app.options("*", cors()); // ✅ FIX

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