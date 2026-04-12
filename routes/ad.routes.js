import express from "express";
import Ad from "../models/Ad.js";
import User from "../models/User.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

/* ---------------- SAVE AD ---------------- */
router.post("/save", protect, async (req, res) => {
    try {
        const { title, image, data, size, language } = req.body;

        if (!title || !image || !data) {
            return res.status(400).json({
                message: "Title, image and canvas data required"
            });
        }

        const ad = await Ad.create({
            user: req.user.userId,
            title,
            image,
            data,
            size,
            language
        });

        await User.findByIdAndUpdate(req.user.userId, {
            $push: { ads: ad._id },
            // $inc: { adsCreated: 1 } 
        });

        res.status(201).json({ success: true, ad });
    } catch (err) {
        console.error("SAVE AD ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/* ---------------- UPDATE AD ---------------- */
router.put("/:id", protect, async (req, res) => {
    try {
        const adId = req.params.id;
        const { title, image, data, size, language } = req.body;

        if (!title || !image || !data) {
            return res.status(400).json({
                message: "Title, image and canvas data required"
            });
        }

        // Find the ad and ensure it belongs to the user
        const ad = await Ad.findOne({ _id: adId, user: req.user.userId });
        if (!ad) {
            return res.status(404).json({ message: "Ad not found or not authorized" });
        }

        // Update the ad
        ad.title = title;
        ad.image = image;
        ad.data = data;
        ad.size = size;
        ad.language = language;

        await ad.save();

        res.json({ success: true, ad });
    } catch (err) {
        console.error("UPDATE AD ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});


/* ---------------- GET MY ADS ---------------- */
router.get("/my", protect, async (req, res) => {
    try {
        const ads = await Ad.find({ user: req.user.userId })
            .sort({ createdAt: -1 });

        res.json(ads);
    } catch (err) {
        console.error("GET ADS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/* ---------------- DELETE AD ---------------- */
router.delete("/:id", protect, async (req, res) => {
    try {
        const adId = req.params.id;

        // Find the ad and ensure it belongs to the user
        const ad = await Ad.findOne({ _id: adId, user: req.user.userId });
        if (!ad) {
            return res.status(404).json({ message: "Ad not found or not authorized" });
        }

        // Delete the ad
        await Ad.findByIdAndDelete(adId);

        // Update user document: remove ad id and decrement adsCreated
        await User.findByIdAndUpdate(req.user.userId, {
            $pull: { ads: adId },
            $inc: { adsCreated: -1 }
        });

        res.json({ success: true, message: "Ad deleted successfully" });
    } catch (err) {
        console.error("DELETE AD ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});


export default router;
