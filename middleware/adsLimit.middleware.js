import User from "../models/User.js";

const PLAN_LIMITS = {
    starter: 3,
    basic: 5,
    growth: 10,
    scale: 30,
    lifetime: Infinity
};

export const checkAdsLimit = async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(req.user.userId, {
            $inc: { adsCreated: 1 }
        });
        // await User.findById(req.user.userId);

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        const limit = PLAN_LIMITS[user.plan];

        if (limit === undefined) {
            return res.status(400).json({ message: "Invalid plan" });
        }

        if (user.adsCreated >= limit) {
            return res
                .status(403)
                .json({ message: "Ads limit reached. Upgrade your plan." });
        }

        next();
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
