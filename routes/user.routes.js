import express from "express";

import User from "../models/User.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();


/*
|--------------------------------------------------------------------------
| CONSUME ONE DOWNLOAD/SHARE CREDIT
|--------------------------------------------------------------------------
|
| This endpoint is called immediately before:
|
| - Download
| - Share
|
| Creating/saving/editing an ad does NOT call this endpoint.
|
*/

router.post("/consume", protect, async (req, res) => {
    try {

        /*
         * First check the user.
         */
        const existingUser =
            await User.findById(req.user.userId);

        if (!existingUser) {
            return res.status(404).json({
                allowed: false,
                message: "User not found"
            });
        }


        /*
         * USER HAS NOT PAID
         */
        if (!existingUser.hasPaid) {
            return res.status(403).json({
                allowed: false,
                code: "PAYMENT_REQUIRED",
                message:
                    "Please purchase a plan before downloading or sharing."
            });
        }


        /*
         * LIFETIME
         *
         * Lifetime users don't consume credits.
         */
        if (
            existingUser.plan === "lifetime"
        ) {
            return res.json({
                allowed: true,
                unlimited: true,
                remaining: null
            });
        }


        /*
         * NORMAL PAID PLANS
         *
         * Atomically decrement exactly one credit.
         *
         * The condition downloadCredits > 0 is inside the
         * database query itself.
         *
         * This prevents two simultaneous requests from
         * spending the same final credit.
         */
        const user =
            await User.findOneAndUpdate(
                {
                    _id: req.user.userId,

                    hasPaid: true,

                    plan: {
                        $ne: "lifetime"
                    },

                    downloadCredits: {
                        $gt: 0
                    }
                },

                {
                    $inc: {
                        downloadCredits: -1
                    }
                },

                {
                    new: true
                }
            );


        /*
         * No credit was available.
         */
        if (!user) {
            return res.status(403).json({
                allowed: false,
                code: "CREDITS_EMPTY",
                message:
                    "Your Download/Share credits are finished. Please purchase or upgrade your plan."
            });
        }


        /*
         * SUCCESS
         */
        return res.json({
            allowed: true,
            unlimited: false,
            remaining:
                user.downloadCredits
        });

    } catch (error) {

        console.error(
            "CONSUME DOWNLOAD CREDIT ERROR:",
            error
        );

        return res.status(500).json({
            allowed: false,
            message: "Server error"
        });
    }
});


export default router;