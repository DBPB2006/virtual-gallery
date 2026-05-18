const VerificationCode = require('../models/VerificationCode');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Configure Nodemailer SMTP settings using credentials
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.sendVerificationCode = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required' });

        // Generate 6-char alphanumeric code (uppercase)
        const code = crypto.randomBytes(3).toString('hex').toUpperCase();

        // Save/Update code in shared database
        await VerificationCode.findOneAndUpdate(
            { email },
            { email, code, expiresAt: Date.now() + 5 * 60 * 1000 }, // 5 minutes expiration
            { upsert: true, new: true }
        );

        // Mail setup
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your Verification Code',
            text: `Your verification code is: ${code}. It expires in 5 minutes.`
        };

        // Fallback for development if credentials are missing
        if (!process.env.EMAIL_USER) {
            console.log(`[DEV] Verification Code for ${email}: ${code}`);
            return res.status(200).json({ message: 'Verification code sent (Dev Mode checked logs)' });
        }

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Verification code sent' });

    } catch (error) {
        console.error('Send Code Error:', error);
        res.status(500).json({ message: 'Failed to send verification code' });
    }
};

exports.verifyCode = async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ message: 'Email and code required' });

        const record = await VerificationCode.findOne({ email });
        if (!record) return res.status(400).json({ message: 'Invalid or expired code' });

        if (record.code !== code.toUpperCase()) {
            return res.status(400).json({ message: 'Invalid code' });
        }

        // Keep code valid for the subsequent registration route, do not delete here.
        // It will be deleted by authController.registerNewUser.
        res.status(200).json({ message: 'Email verified successfully', verified: true });

    } catch (error) {
        console.error('Verify Code Error:', error);
        res.status(500).json({ message: 'Verification failed' });
    }
};
