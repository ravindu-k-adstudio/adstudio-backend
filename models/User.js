
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            default: ""
        },

        address: {
            type: String,
            default: ""
        },

        city: {
            type: String,
            default: ""
        },

        /*
         * This is the user's current purchased plan.
         *
         * A newly registered user receives "starter" as a
         * default account plan, but hasPaid remains false.
         */
        plan: {
            type: String,
            enum: [
                "starter",
                "basic",
                "growth",
                "scale",
                "lifetime"
            ],
            required: true,
            default: "starter"
        },

        /*
         * IMPORTANT:
         *
         * This is NOT true merely because the user has a plan name.
         *
         * It becomes true only after the backend receives and verifies
         * a successful PayHere notification.
         */
        hasPaid: {
            type: Boolean,
            default: false
        },

        /*
         * Number of paid Download/Share actions remaining.
         *
         * starter = 5
         * basic = 7
         * growth = 15
         * scale = 40
         *
         * lifetime = 0 in the database because Lifetime is handled
         * separately by checking user.plan === "lifetime".
         */
        downloadCredits: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model("User", userSchema);