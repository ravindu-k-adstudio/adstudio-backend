import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

const VALID_PLANS = [
    "starter",
    "basic",
    "growth",
    "scale",
    "lifetime"
];


/*
|--------------------------------------------------------------------------
| SIGN UP
|--------------------------------------------------------------------------
*/

router.post("/signup", async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            plan
        } = req.body;

        if (
            !name ||
            !email ||
            !password ||
            !plan
        ) {
            return res.status(400).json({
                message: "All fields required"
            });
        }

        if (!VALID_PLANS.includes(plan)) {
            return res.status(400).json({
                message: "Invalid plan"
            });
        }

        const exists =
            await User.findOne({
                email: email.toLowerCase()
            });

        if (exists) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

        const hashed =
            await bcrypt.hash(
                password,
                10
            );

        /*
         * IMPORTANT:
         *
         * The selected/default plan does NOT mean paid.
         *
         * A new user always starts with:
         *
         * hasPaid = false
         * downloadCredits = 0
         */
        const user =
            await User.create({
                name: name.trim(),

                email:
                    email.toLowerCase().trim(),

                password: hashed,

                plan,

                hasPaid: false,

                downloadCredits: 0
            });


        const token =
            jwt.sign(
                {
                    userId: user._id
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "7d"
                }
            );


        return res.status(201).json({
            success: true,

            token,

            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                hasPaid: user.hasPaid,
                downloadCredits:
                    user.downloadCredits
            }
        });

    } catch (error) {

        console.error(
            "SIGNUP ERROR:",
            error
        );

        return res.status(500).json({
            message: "Server error"
        });
    }
});


/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

router.post("/login", async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;

        const user =
            await User.findOne({
                email:
                    email.toLowerCase().trim()
            });

        if (!user) {
            return res.status(400).json({
                message:
                    "Invalid credentials"
            });
        }

        const match =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!match) {
            return res.status(400).json({
                message:
                    "Invalid credentials"
            });
        }


        const token =
            jwt.sign(
                {
                    userId: user._id
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "7d"
                }
            );


        return res.json({
            success: true,

            token,

            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                hasPaid: user.hasPaid,
                downloadCredits:
                    user.downloadCredits
            }
        });

    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        return res.status(500).json({
            message: "Server error"
        });
    }
});


/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
*/

router.get("/me", protect, async (req, res) => {
    try {

        const user =
            await User.findById(
                req.user.userId
            );

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }


        return res.json({
            success: true,

            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                hasPaid: user.hasPaid,
                downloadCredits:
                    user.downloadCredits
            }
        });

    } catch (error) {

        console.error(
            "AUTH ME ERROR:",
            error
        );

        return res.status(500).json({
            message: "Server error"
        });
    }
});


export default router;