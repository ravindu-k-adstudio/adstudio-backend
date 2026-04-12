import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

const VALID_PLANS = ["starter", "basic", "growth", "scale", "lifetime"];

/* ================= SIGN UP ================= */
router.post("/signup", async (req, res) => {
    try {
        const { name, email, password, plan } = req.body;

        if (!name || !email || !password || !plan) {
            return res.status(400).json({ message: "All fields required" });
        }

        if (!VALID_PLANS.includes(plan)) {
            return res.status(400).json({ message: "Invalid plan" });
        }

        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashed = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashed,
            plan
        });

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                hasPaid: user.hasPaid // ✅ ADD THIS
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                hasPaid: user.hasPaid // ✅ ADD THIS
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

/* ================= CURRENT USER ================= */
// router.get("/me", protect, (req, res) => {
//     res.json({
//         success: true,
//         user: {
//             id: req.user._id,
//             name: req.user.name,
//             email: req.user.email,
//             plan: req.user.plan
//             hasPaid: user.hasPaid // ✅ ADD THIS
//         }
//     });
// });

router.get("/me", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                hasPaid: user.hasPaid // ✅ ADD HERE
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
