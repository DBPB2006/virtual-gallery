const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: function () {
            return this.authProvider === 'local';
        }
    },
    role: {
        type: String,
        enum: ['visitor', 'exhibitor', 'admin'],
        default: 'visitor',
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['active', 'pending'],
        default: 'active'
    }
});

module.exports = mongoose.model('User', userSchema);
