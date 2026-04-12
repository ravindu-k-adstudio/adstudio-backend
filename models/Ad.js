import mongoose from "mongoose";

const adSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        title: {
            type: String,
            required: true
        },

        image: {
            type: String, // base64 preview
            required: true
        },

        data: {
            type: String, // ✅ canvas JSON (stage.toJSON())
            required: true
        },

        size: String,
        language: String
    },
    { timestamps: true }
);

export default mongoose.model("Ad", adSchema);
