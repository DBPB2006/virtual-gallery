const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const VerificationCode = require('../models/VerificationCode');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Validates Google reCAPTCHA v2 token.
 * Includes fallback dev modes if keys are not defined.
 */
async function verifyRecaptcha(token) {
    if (!token) {
        console.warn("[CAPTCHA] Missing captchaToken in request.");
        return false;
    }
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
        console.warn("[CAPTCHA][WARN] RECAPTCHA_SECRET_KEY not set. Skipping verification (DEV MODE).");
        return true;
    }
    try {
        const response = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`, {
            method: 'POST'
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error(`[CAPTCHA][ERROR] Verification failed: ${error.message}`);
        return false;
    }
}

/**
 * Verifies Google ID tokens or Access tokens.
 * Falls back dynamically to userinfo fetch if ID token verification fails.
 */
async function verifyGoogleToken(token) {
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        return {
            googleId: payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture
        };
    } catch (error) {
        console.log(`[GOOGLE][INFO] ID Token verification failed, falling back to Access Token API: ${error.message}`);
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) {
                console.error(`[GOOGLE][ERROR] Access Token userinfo API returned status: ${response.status}`);
                return null;
            }
            const payload = await response.json();
            return {
                googleId: payload.sub,
                email: payload.email,
                name: payload.name,
                picture: payload.picture
            };
        } catch (innerError) {
            console.error(`[GOOGLE][ERROR] Token fallback failed: ${innerError.message}`);
            return null;
        }
    }
}

/**
 * Creates user session inside express-session and connect-mongo shared store.
 */
function createSession(req, res, user, logContextMessage) {
    req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
    };

    req.session.save((err) => {
        if (err) {
            console.error(`[AUTH][SESSION_ERROR] Session save failed for user ${user.email}: ${err}`);
            return res.status(500).json({ message: 'Session creation failed' });
        }

        console.log(`[AUTH][SUCCESS] ${logContextMessage}: ${user.email} (Role: ${user.role})`);
        
        const redirectPath = user.role === 'admin'
            ? '/dashboard/admin'
            : user.role === 'exhibitor'
                ? '/dashboard/exhibitor'
                : '/';

        res.status(200).json({
            message: 'Authentication successful',
            user: req.session.user,
            redirectPath
        });
    });
}

/**
 * POST: /api/auth/register
 * Handles normal registration. Supports profile picture uploading.
 */
exports.registerNewUser = async (req, res) => {
    try {
        const { name, email, password, role, verificationCode, captchaToken, tncAccepted } = req.body;

        // CAPTCHA verification
        const isCaptchaValid = await verifyRecaptcha(captchaToken);
        if (!isCaptchaValid) {
            console.log(`[AUTH][REGISTER_FAIL] Captcha check failed for: ${email}`);
            return res.status(400).json({ message: 'Captcha verification failed' });
        }

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log(`[AUTH][REGISTER_FAIL] User already exists: ${email}`);
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Upload picture binding
        let picture = "";
        if (req.file) {
            const protocol = req.protocol;
            const host = req.get('host');
            picture = `${protocol}://${host}/uploads/${req.file.filename}`;
        }

        const targetRole = role === 'exhibitor' ? 'exhibitor' : 'visitor';
        let status = 'active';

        if (targetRole === 'exhibitor') {
            if (tncAccepted !== true && tncAccepted !== 'true') {
                return res.status(400).json({ message: 'Terms and Conditions must be accepted' });
            }
            if (!verificationCode) {
                return res.status(400).json({ message: 'Email verification code required for exhibitors' });
            }
            
            // Validate code
            const record = await VerificationCode.findOne({ email });
            if (!record || record.code !== verificationCode.toUpperCase()) {
                console.log(`[AUTH][REGISTER_FAIL] Invalid/expired code: ${email}`);
                return res.status(400).json({ message: 'Invalid or expired verification code' });
            }
            
            // Delete used code to prevent replays
            await VerificationCode.deleteOne({ email });
            status = 'pending';
        }

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: targetRole,
            status: status,
            isEmailVerified: targetRole === 'exhibitor', // Exhibitor already verified code
            picture
        });

        console.log(`[AUTH-CONTROLLER] Attempting to save new user: "${email}" (${targetRole})`);
        try {
            await newUser.save();
            console.log(`[AUTH-CONTROLLER][SUCCESS] User saved successfully. ID: ${newUser._id}, Email: ${newUser.email}`);
            res.status(201).json({ message: 'User registered successfully' });
        } catch (saveError) {
            console.error(`[AUTH-CONTROLLER][SAVE_FAIL] Database save failed for user "${email}":`, saveError.message);
            if (saveError.name === 'ValidationError') {
                console.error(`[AUTH-CONTROLLER][VALIDATION_ERROR] Detailed Validation Failures:`, JSON.stringify(saveError.errors));
                return res.status(400).json({ message: "Validation error saving user", errors: saveError.errors });
            }
            throw saveError; // pass to outer catch
        }
    } catch (error) {
        console.error(`[AUTH-CONTROLLER][REGISTER_ERROR] Register process exception: ${error.message}`);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * POST: /api/auth/login
 * Handles local user login. Includes dynamic plain-text password healing.
 */
exports.authenticateUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            console.log("[AUTH][LOGIN_FAIL] Missing email/password parameters.");
            return res.status(400).json({ message: 'Please provide email and password' });
        }

        const user = await User.findOne({ email });
        if (!user || user.isDeleted) {
            console.log(`[AUTH][LOGIN_FAIL] User not found or isDeleted: ${email}`);
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        if (user.isBlocked) {
            console.log(`[AUTH][LOGIN_FAIL] User is blocked: ${email}`);
            return res.status(403).json({ message: 'Account is blocked. Contact support.' });
        }

        if (user.role === 'exhibitor' && user.status === 'pending') {
            console.log(`[AUTH][LOGIN_FAIL] Exhibitor account pending admin approval: ${email}`);
            return res.status(403).json({ message: 'Your exhibitor account is pending admin approval.' });
        }

        // Compare password.
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, user.password);
        } catch (hashErr) {
            console.log(`[AUTH][WARN] Bcrypt comparison threw error (likely plain text): ${hashErr.message}`);
        }

        // Dynamic Self-Healing password fallback check
        if (!isMatch) {
            if (password === user.password) {
                console.warn(`[AUTH][HEAL] Stale plain-text credentials matched for ${email}. Encrypting on-the-fly...`);
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(password, salt);
                await user.save();
                isMatch = true;
                console.log(`[AUTH][HEAL] Credentials successfully secured for ${email}.`);
            } else {
                console.log(`[AUTH][LOGIN_FAIL] Password mismatch for: ${email}`);
                return res.status(400).json({ message: 'Invalid credentials' });
            }
        }

        // Create and save session
        createSession(req, res, user, 'Local Login Success');

    } catch (error) {
        console.error(`[AUTH][LOGIN_ERROR] Authenticate process exception: ${error.message}`);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * POST: /api/auth/google/register
 * Handles Google user registration.
 */
exports.googleRegister = async (req, res) => {
    try {
        const { token, role, captchaToken, tncAccepted } = req.body;

        // CAPTCHA verification
        const isCaptchaValid = await verifyRecaptcha(captchaToken);
        if (!isCaptchaValid) {
            console.log(`[AUTH][GOOGLE_FAIL] Captcha check failed during registration.`);
            return res.status(400).json({ message: 'Captcha verification failed' });
        }

        if (!token) {
            return res.status(400).json({ message: 'No token provided' });
        }

        const googleUser = await verifyGoogleToken(token);
        if (!googleUser) {
            console.log(`[AUTH][GOOGLE_FAIL] Token validation rejected.`);
            return res.status(400).json({ message: 'Invalid Google token' });
        }

        const { googleId, email, name } = googleUser;

        const existingUser = await User.findOne({
            $or: [{ email }, { googleId }]
        });

        if (existingUser) {
            console.log(`[AUTH][GOOGLE_FAIL] Account already registered for ${email}. Redirecting to Login.`);
            return res.status(400).json({ message: 'Account already exists. Please log in.' });
        }

        const allocatedRole = role === 'exhibitor' ? 'exhibitor' : 'visitor';
        let status = 'active';

        if (allocatedRole === 'exhibitor') {
            if (tncAccepted !== true && tncAccepted !== 'true') {
                return res.status(400).json({ message: 'Terms and Conditions must be accepted' });
            }
            status = 'pending';
        }

        const newUser = new User({
            name,
            email,
            authProvider: 'google',
            googleId,
            role: allocatedRole,
            status: status,
            isEmailVerified: true // Google accounts are pre-verified
        });

        console.log(`[AUTH-CONTROLLER] Attempting to save new Google user: "${email}" (${allocatedRole})`);
        try {
            await newUser.save();
            console.log(`[AUTH-CONTROLLER][SUCCESS] Google user saved successfully. ID: ${newUser._id}, Email: ${newUser.email}`);
        } catch (saveError) {
            console.error(`[AUTH-CONTROLLER][SAVE_FAIL] Database save failed for Google user "${email}":`, saveError.message);
            if (saveError.name === 'ValidationError') {
                console.error(`[AUTH-CONTROLLER][VALIDATION_ERROR] Detailed Validation Failures:`, JSON.stringify(saveError.errors));
                return res.status(400).json({ message: "Validation error saving Google user", errors: saveError.errors });
            }
            throw saveError;
        }

        if (status === 'pending') {
            return res.status(201).json({
                message: 'Account created. Pending Admin Approval.',
                user: { role: 'exhibitor', status: 'pending' }
            });
        }

        createSession(req, res, newUser, 'Google Registration Success');

    } catch (error) {
        console.error(`[AUTH][GOOGLE_ERROR] Google registration process exception: ${error.message}`);
        res.status(500).json({ message: 'Google registration failed', error: error.message });
    }
};

/**
 * POST: /api/auth/google/login
 * Handles Google user login.
 */
exports.googleLogin = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'No token provided' });
        }

        const googleUser = await verifyGoogleToken(token);
        if (!googleUser) {
            console.log(`[AUTH][GOOGLE_FAIL] Token validation rejected.`);
            return res.status(400).json({ message: 'Invalid Google token' });
        }

        const { googleId, email } = googleUser;

        let user = await User.findOne({
            $or: [{ googleId }, { email }]
        });

        if (!user) {
            console.log(`[AUTH][GOOGLE_FAIL] User not registered: ${email}`);
            return res.status(403).json({
                message: 'Account not registered. Please sign up first.',
                needRegistration: true
            });
        }

        if (user.isBlocked) return res.status(403).json({ message: 'Account is blocked.' });
        if (user.isDeleted) return res.status(403).json({ message: 'Account deleted.' });

        if (user.role === 'exhibitor' && user.status === 'pending') {
            console.log(`[AUTH][GOOGLE_FAIL] Pending admin approval: ${email}`);
            return res.status(403).json({ message: 'Your exhibitor account is pending admin approval.' });
        }

        // Link Google ID to existing local email if not linked
        if (!user.googleId) {
            user.googleId = googleId;
            if (user.authProvider === 'local') {
                user.authProvider = 'google'; // Convert or mark as google integrated
            }
            await user.save();
            console.log(`[AUTH][GOOGLE_INFO] Local account linked to Google: ${email}`);
        }

        createSession(req, res, user, 'Google Login Success');

    } catch (error) {
        console.error(`[AUTH][GOOGLE_ERROR] Google login process exception: ${error.message}`);
        res.status(500).json({ message: 'Google login failed', error: error.message });
    }
};

/**
 * POST: /api/auth/logout
 * Terminates the active session and clears the express cookie.
 */
exports.terminateSession = (req, res) => {
    const userEmail = req.session?.user?.email || 'Unknown';
    req.session.destroy((err) => {
        if (err) {
            console.error(`[AUTH][LOGOUT_FAIL] Logout failed for ${userEmail}: ${err}`);
            return res.status(500).json({ message: 'Logout failed' });
        }
        console.log(`[AUTH][SUCCESS] Logged out user session: ${userEmail}`);
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
    });
};

/**
 * GET: /api/auth/check-auth
 * Validates active session state and returns details.
 */
exports.verifySessionStatus = (req, res) => {
    if (req.session && req.session.user) {
        res.json({ isAuthenticated: true, user: req.session.user });
    } else {
        res.json({ isAuthenticated: false });
    }
};