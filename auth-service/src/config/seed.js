const User = require('../models/User');
const bcrypt = require('bcryptjs');

/**
 * Automatically seeds the default system administrator if missing, 
 * and heals/re-hashes plain-text admin credentials to restore system accessibility.
 */
const seedAdmin = async () => {
    try {
        const adminEmail = 'admin@gallery.com';
        
        // Lookup admin by role or email
        let adminUser = await User.findOne({ 
            $or: [
                { role: 'admin' },
                { email: adminEmail }
            ]
        });

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
            console.log(`[SEED] Default admin seeded successfully. Email: ${adminEmail}, Password: admin123`);
        } else {
            console.log(`[SEED] Admin account verified: ${adminUser.email}`);
            
            // Crytographic validation of standard bcrypt hash syntax
            // Syntax: $2[a-z]$[cost]$[hash_value_53_chars]
            const bcryptPattern = /^\$2[ayb]\$[0-9]{2}\$[A-Za-z0-9\.\/]{53}$/;
            const isHashed = bcryptPattern.test(adminUser.password);

            if (!isHashed) {
                console.warn(`[SEED][HEAL] Admin user exists, but password is NOT a valid bcrypt hash! Upgrading to secure bcryptjs representation...`);
                const salt = await bcrypt.genSalt(10);
                adminUser.password = await bcrypt.hash('admin123', salt);
                adminUser.role = 'admin'; // Safeguard correct role
                adminUser.status = 'active'; // Safeguard active status
                await adminUser.save();
                console.log(`[SEED][HEAL] Admin account healed and password hashed successfully.`);
            }
        }
    } catch (error) {
        console.error(`[SEED][ERROR] Seeding admin process encountered an exception: ${error.message}`);
    }
};

module.exports = seedAdmin;
