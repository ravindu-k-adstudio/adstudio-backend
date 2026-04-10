import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/auth.middleware.js";
import { PLANS } from "../config/plans.js";

const router = express.Router();

/* ---------------- UPGRADE PLAN ---------------- */
router.post("/upgrade", protect, async (req, res) => {
    try {
        const { plan } = req.body;

        if (!PLANS[plan]) {
            return res.status(400).json({ message: "Invalid plan" });
        }

        const user = await User.findById(req.user.userId);

        user.plan = plan;
        user.adsCreated = 0;
        await user.save();

        const token = jwt.sign(
            { userId: user._id, plan: user.plan },
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
                adsCreated: user.adsCreated
            }
        });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

/* ---------------- CONSUME CREDIT ---------------- */

router.post("/consume", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // 🔴 STEP 1 — BLOCK IF NOT PAID
        if (!user.hasPaid) {
            return res.status(403).json({
                allowed: false,
                message: "Please purchase a plan"
            });
        }

        const planKey = user.plan;
        const planConfig = PLANS[planKey];

        if (!planConfig) {
            return res.status(400).json({
                message: "Invalid plan",
                plan: user.plan
            });
        }

        // 🟡 STEP 2 — CHECK PLAN LIMIT
        if (
            planConfig.ads !== Infinity &&
            user.adsCreated >= planConfig.ads
        ) {
            return res.status(403).json({
                allowed: false,
                message: "Ad limit reached. Upgrade your plan."
            });
        }

        // 🟢 STEP 3 — INCREMENT USAGE
        user.adsCreated += 1;
        await user.save();

        res.json({
            allowed: true,
            usedAds: user.adsCreated,
            remaining:
                planConfig.ads === Infinity
                    ? Infinity
                    : planConfig.ads - user.adsCreated
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});


export default router;