import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        orderId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        paymentId: {
            type: String,
            default: null,
            index: true
        },

        plan: {
            type: String,
            enum: [
                "starter",
                "basic",
                "growth",
                "scale",
                "lifetime"
            ],
            required: true
        },

        amount: {
            type: Number,
            required: true
        },

        currency: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: [
                "pending",
                "success",
                "failed",
                "cancelled",
                "chargedback"
            ],
            default: "pending"
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model("Payment", paymentSchema);