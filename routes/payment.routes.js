import express from "express";
import crypto from "crypto";
import User from "../models/User.js";

const router = express.Router();

/* ================= PAYHERE NOTIFY ================= */
router.post("/notify", async (req, res) => {
    try {
        const {
            merchant_id,
            order_id,
            payhere_amount,
            payhere_currency,
            status_code,
            md5sig
        } = req.body;

        // 🔐 VERIFY SIGNATURE (IMPORTANT)
        const local_md5 = crypto
            .createHash("md5")
            .update(
                merchant_id +
                order_id +
                payhere_amount +
                payhere_currency +
                status_code +
                process.env.MERCHANT_SECRET
            )
            .digest("hex")
            .toUpperCase();

        if (local_md5 !== md5sig) {
            console.log("❌ Invalid signature");
            return res.sendStatus(400);
        }

        // ✅ PAYMENT SUCCESS
        if (status_code == 2) {
            const [userId, plan] = order_id.split("_");

            const user = await User.findById(userId);
            if (!user) return res.sendStatus(404);

            user.hasPaid = true;
            user.plan = plan;
            user.adsCreated = 0;

            await user.save();

            console.log("✅ Payment success:", user.email);
        }

        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

export default router;