const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const Exhibition = require('../models/Exhibition');
const Notification = require('../models/Notification');

exports.initiatePurchaseOrder = async (req, res) => {
    try {
        const { exhibitionId } = req.body;
        const userId = req.user.id;

        const exhibition = await Exhibition.findById(exhibitionId);
        if (!exhibition) {
            return res.status(404).json({ message: 'Exhibition not found' });
        }

        let amountINR = exhibition.priceINR;
        if (!amountINR && exhibition.price && (exhibition.transactionCurrency === 'INR' || exhibition.currency === 'INR')) {
            amountINR = exhibition.price;
        }

        if (!amountINR || amountINR <= 0) {
            console.error(`[PAYMENT_ERROR] Invalid Price for Exhibition ${exhibitionId}`);
            return res.status(400).json({ message: 'Exhibition has no valid INR price.' });
        }

        const now = new Date();
        if (new Date(exhibition.endDate) < now) {
            return res.status(400).json({ message: "This exhibition has ended. Access cannot be purchased." });
        }

        if (!exhibition.isOnSale) {
            return res.status(400).json({ message: "This exhibition is free. No purchase required." });
        }

        const options = {
            amount: amountINR * 100, // Paise
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
            notes: {
                exhibitionId: exhibitionId,
                userId: userId,
                originalCurrency: exhibition.referenceCurrency,
                originalPrice: exhibition.referencePrice
            }
        };

        let orderData;
        let isMock = false;

        const hasRealKeys = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;

        if (hasRealKeys) {
            try {
                const realRazorpay = new Razorpay({
                    key_id: process.env.RAZORPAY_KEY_ID,
                    key_secret: process.env.RAZORPAY_KEY_SECRET
                });
                orderData = await realRazorpay.orders.create(options);
            } catch (error) {
                console.error("[PAYMENT_ERROR] Razorpay API Failed, falling back to Mock:", error.message);
                isMock = true;
            }
        } else {
            isMock = true;
        }

        if (isMock) {
            orderData = {
                id: `order_${Date.now()}_mock`,
                amount: options.amount,
                currency: options.currency,
                status: 'created'
            };
        }

        // Persist Order in Shared Database
        const newOrder = new Order({
            userId,
            exhibitorId: exhibition.createdBy,
            exhibitionId,
            razorpayOrderId: orderData.id,
            amount: exhibition.priceINR,
            currency: 'INR',
            status: 'created'
        });

        console.log(`[PAYMENT-CONTROLLER] Attempting to save new order: User: ${userId}, Exhibition: ${exhibitionId}, Razorpay ID: ${orderData.id}`);
        try {
            await newOrder.save();
            console.log(`[PAYMENT-CONTROLLER][SUCCESS] Order saved successfully to DB. ID: ${newOrder._id}, Status: ${newOrder.status}`);
        } catch (saveError) {
            console.error(`[PAYMENT-CONTROLLER][SAVE_FAIL] Database save failed for order:`, saveError.message);
            if (saveError.name === 'ValidationError') {
                console.error(`[PAYMENT-CONTROLLER][VALIDATION_ERROR] Detailed Validation Failures:`, JSON.stringify(saveError.errors));
                return res.status(400).json({ message: "Validation error saving order", errors: saveError.errors });
            }
            throw saveError; // pass to outer catch
        }

        if (isMock) {
            res.json({
                isMock: true,
                orderId: orderData.id,
                amount: orderData.amount,
                currency: orderData.currency
            });
        } else {
            res.json({
                orderId: orderData.id,
                amount: orderData.amount,
                currency: orderData.currency,
                keyId: process.env.RAZORPAY_KEY_ID
            });
        }

    } catch (error) {
        console.error(`[ERROR][PaymentController] Create Order: ${error.message}`);
        res.status(500).json({ message: 'Server error creating order' });
    }
};

exports.confirmPaymentStatus = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Missing payment details' });
        }

        const isMockOrder = razorpay_order_id.endsWith('_mock');
        let isValid = false;

        if (isMockOrder) {
            isValid = true;
        } else {
            const secret = process.env.RAZORPAY_KEY_SECRET;
            if (!secret) return res.status(500).json({ message: 'Server config error' });

            const body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(body.toString())
                .digest('hex');

            if (expectedSignature === razorpay_signature) {
                isValid = true;
            }
        }

        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        if (order.status === 'paid') {
            return res.json({ success: true, message: "Payment verified successfully" });
        }

        order.status = 'paid';
        order.razorpayPaymentId = razorpay_payment_id;
        order.paidAt = new Date();

        console.log(`[PAYMENT-CONTROLLER] Attempting to confirm order payment to 'paid'. Order ID: ${order._id}, Razorpay Order ID: ${razorpay_order_id}`);
        try {
            await order.save();
            console.log(`[PAYMENT-CONTROLLER][SUCCESS] Order status successfully updated to 'paid'. Order ID: ${order._id}`);
        } catch (saveError) {
            console.error(`[PAYMENT-CONTROLLER][SAVE_FAIL] Database update failed for payment confirmation on order ${order._id}:`, saveError.message);
            if (saveError.name === 'ValidationError') {
                console.error(`[PAYMENT-CONTROLLER][VALIDATION_ERROR] Detailed Validation Failures:`, JSON.stringify(saveError.errors));
                return res.status(400).json({ success: false, message: "Validation error confirming payment", errors: saveError.errors });
            }
            throw saveError;
        }

        // Trigger Notifications asynchronously inside shared db
        (async () => {
            try {
                const fullOrder = await Order.findById(order._id).populate('exhibitionId', 'title');
                const title = fullOrder.exhibitionId?.title || "Exhibition";

                await Notification.create({
                    userId: order.userId,
                    title: "Payment Successful",
                    message: `Your access to ${title} has been confirmed.`,
                    type: 'payment',
                    link: `/exhibitions/view/${order.exhibitionId}`
                });

                await Notification.create({
                    userId: order.exhibitorId,
                    title: "New Participant",
                    message: `A new participant has joined ${title}.`,
                    type: 'participant',
                    link: `/dashboard/exhibitor/sales`
                });
            } catch (e) {
                console.error("[ERROR] Payment Notification Failed:", e);
            }
        })();

        return res.json({
            success: true,
            message: "Payment verified successfully",
            redirectTo: `/exhibitions/view/${order.exhibitionId}`
        });

    } catch (error) {
        console.error(`[ERROR][PaymentController] Verify: ${error.message}`);
        res.status(500).json({ success: false, message: 'Server verification failed' });
    }
};
