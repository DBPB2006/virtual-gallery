const User = require('../models/User');

const requireAuthentication = async (req, res, next) => {
    if (req.session && req.session.user) {
        try {
            const user = await User.findById(req.session.user.id || req.session.user._id);

            if (!user) {
                req.session.destroy();
                return res.status(401).json({ message: 'User no longer exists' });
            }

            if (!user.isActive) {
                req.session.destroy();
                return res.status(403).json({ message: "Account disabled" });
            }

            req.user = user;
            next();
        } catch (err) {
            console.error("Auth Middleware DB Error inside Payment Service:", err);
            res.status(500).json({ message: "Server Error during Auth" });
        }
    } else {
        res.status(401).json({ message: 'No session, authorization denied' });
    }
};

module.exports = requireAuthentication;
