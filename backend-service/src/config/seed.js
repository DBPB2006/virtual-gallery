const User = require('../models/User');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
    try {
        const adminEmail = 'admin@gallery.com';
        
        let adminUser = await User.findOne({ email: adminEmail });

        if (!adminUser) {
            console.log('[SEED] No admin user detected. Seeding default system administrator...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);

            adminUser = new User({
                name: 'System Admin',
                email: adminEmail,
                password: hashedPassword,
                role: 'admin',
                status: 'active',
                isEmailVerified: true,
                authProvider: 'local'
            });

            await adminUser.save();
            console.log(`[SEED] Default admin seeded successfully. Email: ${adminEmail}`);
        } else {
            console.log(`[SEED] Admin account already exists: ${adminUser.email}`);
        }
    } catch (error) {
        console.error(`[SEED][ERROR] Seeding admin process encountered an exception: ${error.message}`);
    }
};

module.exports = seedAdmin;
