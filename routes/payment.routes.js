import express from "express";
import crypto from "crypto";

import User from "../models/User.js";
import Payment from "../models/Payment.js";

import { protect } from "../middleware/auth.middleware.js";
import { PLANS } from "../config/plans.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| PAYHERE CONFIGURATION
|--------------------------------------------------------------------------
|
| Keep these ONLY in backend .env.
|
| Never expose PAYHERE_MERCHANT_SECRET to React/Vite.
|
*/

const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID;
const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;

const FRONTEND_URL =
    process.env.FRONTEND_URL || "http://localhost:5173";

const PAYHERE_NOTIFY_URL =
    process.env.PAYHERE_NOTIFY_URL ||
    "https://YOUR_PUBLIC_BACKEND_DOMAIN/api/payment/notify";


/*
|--------------------------------------------------------------------------
| PLAN PRICES
|--------------------------------------------------------------------------
|
| The backend is the source of truth for prices.
|
| Do NOT accept the price from React.
|
*/

const PLAN_PRICES = {
    starter: 7.00,
    basic: 10.00,
    growth: 19.99,
    scale: 29.99,
    lifetime: 99.99
};


/*
|--------------------------------------------------------------------------
| PAYHERE CHECKOUT URL
|--------------------------------------------------------------------------
*/

const PAYHERE_CHECKOUT_URL =
    "https://www.payhere.lk/pay/checkout";


/*
|--------------------------------------------------------------------------
| CREATE PAYMENT
|--------------------------------------------------------------------------
|
| Frontend calls:
|
| POST /api/payment/create
|
| body:
| {
|     "plan": "starter"
| }
|
*/

router.post("/create", protect, async (req, res) => {
    try {
        const { plan } = req.body;

        /*
         * Validate plan on the server.
         */
        if (!plan || !PLANS[plan]) {
            return res.status(400).json({
                message: "Invalid plan"
            });
        }

        /*
         * Make sure price exists.
         */
        const amount = PLAN_PRICES[plan];

        if (!amount) {
            return res.status(400).json({
                message: "Plan price is not configured"
            });
        }

        /*
         * Make sure PayHere credentials exist.
         */
        if (!MERCHANT_ID || !MERCHANT_SECRET) {
            console.error(
                "PayHere Merchant ID or Merchant Secret is missing"
            );

            return res.status(500).json({
                message: "Payment system is not configured"
            });
        }

        /*
         * Get authenticated user from database.
         */
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        /*
         * Generate a unique order ID.
         *
         * We do NOT parse the user/plan later from this string.
         * The payment record and custom parameters handle that.
         */
        const orderId =
            `ADSTUDIO_${user._id}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

        const formattedAmount =
            Number(amount).toFixed(2);

        const currency = "USD";

        /*
         * PayHere hash:
         *
         * MD5(
         *   merchant_id +
         *   order_id +
         *   amount +
         *   currency +
         *   MD5(merchant_secret)
         * )
         *
         * The merchant secret MUST stay on the server.
         */
        const merchantSecretHash = crypto
            .createHash("md5")
            .update(MERCHANT_SECRET)
            .digest("hex")
            .toUpperCase();

        const hash = crypto
            .createHash("md5")
            .update(
                MERCHANT_ID +
                orderId +
                formattedAmount +
                currency +
                merchantSecretHash
            )
            .digest("hex")
            .toUpperCase();

        /*
         * Save payment as pending BEFORE sending the customer
         * to PayHere.
         */
        await Payment.create({
            user: user._id,
            orderId,
            plan,
            amount,
            currency,
            status: "pending"
        });

        /*
         * PayHere requires customer contact information.
         *
         * Your current User model only contains name/email.
         *
         * Therefore the frontend must eventually collect the
         * user's real phone/address/city.
         *
         * For safety, we refuse to create a payment until those
         * values exist rather than sending fake information.
         */
        if (
            !user.phone ||
            !user.address ||
            !user.city
        ) {
            return res.status(400).json({
                message:
                    "Please complete your phone, address and city before making a payment.",
                code: "CUSTOMER_DETAILS_REQUIRED"
            });
        }

        const nameParts =
            user.name.trim().split(/\s+/);

        const firstName =
            nameParts.shift() || "Customer";

        const lastName =
            nameParts.join(" ") || "Customer";

        /*
         * Return payment data to React.
         *
         * React will create an HTML form and POST these values
         * directly to PayHere.
         */
        return res.json({
            success: true,

            checkoutUrl: PAYHERE_CHECKOUT_URL,

            payment: {
                merchant_id: MERCHANT_ID,

                return_url:
                    `${FRONTEND_URL}/payment-success?order_id=${encodeURIComponent(orderId)}`,

                cancel_url:
                    `${FRONTEND_URL}/pricing`,

                notify_url:
                    PAYHERE_NOTIFY_URL,

                first_name: firstName,

                last_name: lastName,

                email: user.email,

                phone: user.phone,

                address: user.address,

                city: user.city,

                country: "Sri Lanka",

                order_id: orderId,

                items:
                    `AdStudio ${plan} Plan`,

                currency,

                amount: formattedAmount,

                hash,

                custom_1: user._id.toString(),

                custom_2: plan
            }
        });

    } catch (error) {
        console.error(
            "PAYHERE CREATE ERROR:",
            error
        );

        return res.status(500).json({
            message: "Unable to create payment"
        });
    }
});


/*
|--------------------------------------------------------------------------
| PAYHERE NOTIFICATION
|--------------------------------------------------------------------------
|
| PayHere calls this server-to-server.
|
| POST /api/payment/notify
|
| IMPORTANT:
| Express urlencoded middleware is already enabled in app.js.
|
*/

router.post("/notify", async (req, res) => {
    try {
        const {
            merchant_id,
            order_id,
            payment_id,
            payhere_amount,
            payhere_currency,
            status_code,
            md5sig,
            custom_1,
            custom_2
        } = req.body;

        console.log(
            "PayHere notification received:",
            {
                order_id,
                payment_id,
                status_code
            }
        );

        /*
         * Basic validation.
         */
        if (
            !merchant_id ||
            !order_id ||
            !payment_id ||
            !payhere_amount ||
            !payhere_currency ||
            status_code === undefined ||
            !md5sig
        ) {
            console.error(
                "Invalid PayHere notification payload"
            );

            return res.sendStatus(400);
        }

        /*
         * Confirm this notification belongs to our merchant.
         */
        if (merchant_id !== MERCHANT_ID) {
            console.error(
                "Invalid PayHere merchant ID"
            );

            return res.sendStatus(400);
        }

        /*
         * Verify PayHere's notification signature.
         */
        const merchantSecretHash = crypto
            .createHash("md5")
            .update(MERCHANT_SECRET)
            .digest("hex")
            .toUpperCase();

        const localMd5 = crypto
            .createHash("md5")
            .update(
                merchant_id +
                order_id +
                payhere_amount +
                payhere_currency +
                status_code +
                merchantSecretHash
            )
            .digest("hex")
            .toUpperCase();

        if (localMd5 !== md5sig) {
            console.error(
                "Invalid PayHere notification signature"
            );

            return res.sendStatus(400);
        }

        /*
         * Find the payment we created before redirecting
         * the customer to PayHere.
         */
        const payment = await Payment.findOne({
            orderId: order_id
        });

        if (!payment) {
            console.error(
                "Payment order not found:",
                order_id
            );

            return res.sendStatus(404);
        }

        /*
         * Idempotency:
         *
         * If PayHere sends the same successful notification
         * again, DO NOT grant another package.
         */
        if (
            payment.status === "success" &&
            payment.paymentId === payment_id
        ) {
            return res.sendStatus(200);
        }

        /*
         * Record the PayHere payment ID.
         */
        payment.paymentId = payment_id;

        /*
         * Handle unsuccessful payments.
         */
        if (String(status_code) !== "2") {

            if (String(status_code) === "-1") {
                payment.status = "cancelled";
            } else if (String(status_code) === "-3") {
                payment.status = "chargedback";
            } else {
                payment.status = "failed";
            }

            await payment.save();

            return res.sendStatus(200);
        }

        /*
         * Confirm the amount and currency against the plan
         * we created on our server.
         */
        const expectedAmount =
            PLAN_PRICES[payment.plan];

        if (
            Number(payhere_amount).toFixed(2) !==
            Number(expectedAmount).toFixed(2)
        ) {
            console.error(
                "PayHere amount mismatch:",
                {
                    expected: expectedAmount,
                    received: payhere_amount
                }
            );

            return res.sendStatus(400);
        }

        if (
            payhere_currency !==
            payment.currency
        ) {
            console.error(
                "PayHere currency mismatch"
            );

            return res.sendStatus(400);
        }

        /*
         * The custom user ID must match the payment record.
         */
        if (
            custom_1 &&
            custom_1 !== payment.user.toString()
        ) {
            console.error(
                "Payment user mismatch"
            );

            return res.sendStatus(400);
        }

        /*
         * The custom plan must match the payment record.
         */
        if (
            custom_2 &&
            custom_2 !== payment.plan
        ) {
            console.error(
                "Payment plan mismatch"
            );

            return res.sendStatus(400);
        }

        /*
         * Find the user.
         */
        const user = await User.findById(
            payment.user
        );

        if (!user) {
            return res.sendStatus(404);
        }

        /*
         * SUCCESS
         *
         * The user gets the credits belonging to the
         * purchased package.
         */
        user.hasPaid = true;
        user.plan = payment.plan;

        if (payment.plan === "lifetime") {
            /*
             * Lifetime is unlimited.
             * We don't store Infinity in MongoDB.
             */
            user.downloadCredits = 0;
        } else {
            user.downloadCredits =
                PLANS[payment.plan].downloads;
        }

        await user.save();

        /*
         * Mark payment successful only AFTER the user
         * has been successfully updated.
         */
        payment.status = "success";

        await payment.save();

        console.log(
            "PAYMENT SUCCESS:",
            {
                user: user.email,
                plan: payment.plan,
                paymentId: payment_id
            }
        );

        return res.sendStatus(200);

    } catch (error) {
        console.error(
            "PAYHERE NOTIFY ERROR:",
            error
        );

        return res.sendStatus(500);
    }
});


export default router;