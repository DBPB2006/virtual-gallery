const mongoose = require("mongoose");

const exhibitionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        category: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        },
        referencePrice: {
            type: Number,
            min: 0
        },
        referenceCurrency: {
            type: String,
            default: "INR"
        },
        priceINR: {
            type: Number,
            min: 0
        },
        transactionCurrency: {
            type: String,
            default: "INR"
        },
        isOnSale: {
            type: Boolean,
            default: false
        },
        coverImage: {
            type: String,
            default: ""
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

exhibitionSchema.virtual('price').get(function () {
    return this.priceINR;
});

exhibitionSchema.virtual('currency').get(function () {
    return this.transactionCurrency;
});

exhibitionSchema.virtual('isForSale').get(function () {
    return this.isOnSale;
});

module.exports = mongoose.model("Exhibition", exhibitionSchema);
