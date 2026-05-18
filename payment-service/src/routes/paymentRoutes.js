const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const requireAuthentication = require('../middlewares/requireAuthentication');

router.post('/create-order', requireAuthentication, paymentController.initiatePurchaseOrder);
router.post('/verify-payment', requireAuthentication, paymentController.confirmPaymentStatus);

module.exports = router;
