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
| Keep these ONLY in backend environment variables.
|
| Never expose PAYHERE_MERCHANT_SECRET to React/Vite.
|
*/

const MERCHANT_ID =
    process.env.PAYHERE_MERCHANT_ID;

const MERCHANT_SECRET =
    process.env.PAYHERE_MERCHANT_SECRET;

const FRONTEND_URL =
    process.env.FRONTEND_URL;

const PAYHERE_NOTIFY_URL =
    process.env.PAYHERE_NOTIFY_URL;


/*
|--------------------------------------------------------------------------
| PLAN PRICES
|--------------------------------------------------------------------------
|
| The backend is the source of truth for prices.
|
| Never accept the price from React.
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
|
| LIVE:
| https://www.payhere.lk/pay/checkout
|
| SANDBOX:
| https://sandbox.payhere.lk/pay/checkout
|
| Current value is LIVE.
|
*/

// const PAYHERE_CHECKOUT_URL = 
//     "https://www.payhere.lk/pay/checkout";

const PAYHERE_CHECKOUT_URL =
    "https://sandbox.payhere.lk/pay/checkout";


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
|
| {
|     plan: "starter",
|
|     customer: {
|         phone: "...",
|         address: "...",
|         city: "...",
|         country: "Sri Lanka"
|     }
| }
|
*/

router.post("/create", protect, async (req, res) => {
    try {

        const {
            plan,
            customer
        } = req.body;


        /*
         * Validate plan.
         */
        if (
            !plan ||
            !PLANS[plan] ||
            !PLAN_PRICES[plan]
        ) {
            return res.status(400).json({
                message: "Invalid plan"
            });
        }


        /*
         * Make sure PayHere configuration exists.
         */
        if (
            !MERCHANT_ID ||
            !MERCHANT_SECRET ||
            !FRONTEND_URL ||
            !PAYHERE_NOTIFY_URL
        ) {
            console.error(
                "PayHere configuration is incomplete. " +
                "Check PAYHERE_MERCHANT_ID, " +
                "PAYHERE_MERCHANT_SECRET, " +
                "FRONTEND_URL and PAYHERE_NOTIFY_URL."
            );

            return res.status(500).json({
                message:
                    "Payment system is not configured"
            });
        }


        /*
         * Get authenticated user.
         */
        const user =
            await User.findById(
                req.user.userId
            );

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }


        /*
         * Customer details are required by PayHere.
         *
         * We deliberately collect these at payment time
         * instead of forcing them into signup.
         */
        const phone =
            customer?.phone?.trim();

        const address =
            customer?.address?.trim();

        const city =
            customer?.city?.trim();

        const country =
            customer?.country?.trim() ||
            "Sri Lanka";


        /*
         * Validate customer details BEFORE creating
         * the pending Payment record.
         */
        if (!phone) {
            return res.status(400).json({
                code: "CUSTOMER_DETAILS_REQUIRED",
                field: "phone",
                message:
                    "Please enter your phone number."
            });
        }

        if (phone.length < 7) {
            return res.status(400).json({
                code: "CUSTOMER_DETAILS_INVALID",
                field: "phone",
                message:
                    "Please enter a valid phone number."
            });
        }

        if (!address) {
            return res.status(400).json({
                code: "CUSTOMER_DETAILS_REQUIRED",
                field: "address",
                message:
                    "Please enter your address."
            });
        }

        if (address.length < 3) {
            return res.status(400).json({
                code: "CUSTOMER_DETAILS_INVALID",
                field: "address",
                message:
                    "Please enter a valid address."
            });
        }

        if (!city) {
            return res.status(400).json({
                code: "CUSTOMER_DETAILS_REQUIRED",
                field: "city",
                message:
                    "Please enter your city."
            });
        }

        if (city.length < 2) {
            return res.status(400).json({
                code: "CUSTOMER_DETAILS_INVALID",
                field: "city",
                message:
                    "Please enter a valid city."
            });
        }


        /*
         * Save customer information to the user's account.
         *
         * This means the user only needs to enter these details
         * the first time.
         *
         * It also keeps the information available for
         * future PayHere purchases.
         */
        user.phone = phone;
        user.address = address;
        user.city = city;

        await user.save();


        /*
         * Generate a unique order ID.
         */
        const orderId =
            `ADSTUDIO_${user._id}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;


        /*
         * Server-side price.
         */
        const amount =
            PLAN_PRICES[plan];

        const formattedAmount =
            Number(amount).toFixed(2);

        const currency =
            "USD";


        /*
         * PayHere checkout hash:
         *
         * MD5(
         *   merchant_id +
         *   order_id +
         *   formatted amount +
         *   currency +
         *   MD5(merchant_secret)
         * )
         *
         * Merchant Secret NEVER leaves the backend.
         */
        const merchantSecretHash =
            crypto
                .createHash("md5")
                .update(MERCHANT_SECRET)
                .digest("hex")
                .toUpperCase();

        const hash =
            crypto
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
         * Save payment as pending BEFORE sending
         * customer to PayHere.
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
         * Split user's existing name.
         */
        const nameParts =
            user.name
                .trim()
                .split(/\s+/);

        const firstName =
            nameParts.shift() ||
            "Customer";

        const lastName =
            nameParts.join(" ") ||
            "Customer";


        /*
         * Return PayHere form data to React.
         *
         * React will submit this as an HTML POST form.
         */
        return res.json({
            success: true,

            checkoutUrl:
                PAYHERE_CHECKOUT_URL,

            payment: {

                merchant_id:
                    MERCHANT_ID,

                return_url:
                    `${FRONTEND_URL}/payment-success?order_id=${encodeURIComponent(orderId)}`,

                cancel_url:
                    `${FRONTEND_URL}/pricing`,

                notify_url:
                    PAYHERE_NOTIFY_URL,

                first_name:
                    firstName,

                last_name:
                    lastName,

                email:
                    user.email,

                phone:
                    phone,

                address:
                    address,

                city:
                    city,

                country:
                    country,

                order_id:
                    orderId,

                items:
                    `AdStudio ${plan} Plan`,

                currency:
                    currency,

                amount:
                    formattedAmount,

                hash:
                    hash,

                custom_1:
                    user._id.toString(),

                custom_2:
                    plan
            }
        });

    } catch (error) {

        console.error(
            "PAYHERE CREATE ERROR:",
            error
        );

        return res.status(500).json({
            message:
                "Unable to create payment"
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
| This receives application/x-www-form-urlencoded data.
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
         * Confirm merchant.
         */
        if (
            merchant_id !==
            MERCHANT_ID
        ) {
            console.error(
                "Invalid PayHere merchant ID"
            );

            return res.sendStatus(400);
        }


        /*
         * Verify PayHere notification signature.
         */
        const merchantSecretHash =
            crypto
                .createHash("md5")
                .update(MERCHANT_SECRET)
                .digest("hex")
                .toUpperCase();

        const localMd5 =
            crypto
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


        if (
            localMd5 !==
            md5sig
        ) {
            console.error(
                "Invalid PayHere notification signature"
            );

            return res.sendStatus(400);
        }


        /*
         * Find our payment record.
         */
        const payment =
            await Payment.findOne({
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
         * Idempotency.
         *
         * Once this order has already been successfully
         * processed, never grant it again.
         */
        if (
            payment.status ===
            "success"
        ) {
            return res.sendStatus(200);
        }


        /*
         * Record PayHere payment ID.
         */
        payment.paymentId =
            payment_id;


        /*
         * Handle payment status.
         *
         * 2   = success
         * 0   = pending
         * -1  = cancelled
         * -2  = failed
         * -3  = chargedback
         */
        if (
            String(status_code) ===
            "0"
        ) {

            payment.status =
                "pending";

            await payment.save();

            return res.sendStatus(200);
        }


        if (
            String(status_code) ===
            "-1"
        ) {

            payment.status =
                "cancelled";

            await payment.save();

            return res.sendStatus(200);
        }


        if (
            String(status_code) ===
            "-3"
        ) {

            payment.status =
                "chargedback";

            await payment.save();

            return res.sendStatus(200);
        }


        if (
            String(status_code) ===
            "-2"
        ) {

            payment.status =
                "failed";

            await payment.save();

            return res.sendStatus(200);
        }


        /*
         * Only status 2 can grant credits.
         */
        if (
            String(status_code) !==
            "2"
        ) {

            payment.status =
                "failed";

            await payment.save();

            return res.sendStatus(200);
        }


        /*
         * Confirm amount against our database.
         */
        const expectedAmount =
            PLAN_PRICES[
            payment.plan
            ];

        if (
            Number(payhere_amount).toFixed(2) !==
            Number(expectedAmount).toFixed(2)
        ) {

            console.error(
                "PayHere amount mismatch:",
                {
                    expected:
                        expectedAmount,

                    received:
                        payhere_amount
                }
            );

            return res.sendStatus(400);
        }


        /*
         * Confirm currency.
         */
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
         * Confirm custom user ID.
         */
        if (
            custom_1 &&
            custom_1 !==
            payment.user.toString()
        ) {

            console.error(
                "Payment user mismatch"
            );

            return res.sendStatus(400);
        }


        /*
         * Confirm custom plan.
         */
        if (
            custom_2 &&
            custom_2 !==
            payment.plan
        ) {

            console.error(
                "Payment plan mismatch"
            );

            return res.sendStatus(400);
        }


        /*
         * Find user.
         */
        const user =
            await User.findById(
                payment.user
            );

        if (!user) {
            return res.sendStatus(404);
        }


        /*
         * SUCCESS
         *
         * Only now do we grant the purchased plan.
         */
        user.hasPaid = true;

        user.plan =
            payment.plan;


        /*
         * Lifetime = unlimited.
         *
         * We do not store Infinity in MongoDB.
         */
        if (
            payment.plan ===
            "lifetime"
        ) {

            user.downloadCredits =
                0;

        } else {

            user.downloadCredits =
                PLANS[
                    payment.plan
                ].downloads;
        }


        await user.save();


        /*
         * Mark payment successful only AFTER
         * the user was successfully updated.
         */
        payment.status =
            "success";

        await payment.save();


        console.log(
            "PAYMENT SUCCESS:",
            {
                user:
                    user.email,

                plan:
                    payment.plan,

                paymentId:
                    payment_id
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

