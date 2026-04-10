import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },

        adsCreated: {
            type: Number,
            default: 0
        },
        plan: {
            type: String,
            enum: ["starter", "basic", "growth", "scale", "lifetime"],
            required: true
        },
        hasPaid: {
            type: Boolean,
            default: false
        }


    },
    { timestamps: true }
);

export default mongoose.model("User", userSchema);
