const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  offeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  offeredTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  offeredProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: function() { return this.offerType !== 'cash-only'; }
  },
  requestedProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  
  // Offer Type and Cash Information
  offerType: {
    type: String,
    enum: ['barter', 'barter-plus-cash', 'cash-only'],
    required: true,
    default: 'barter'
  },
  cashAmount: {
    type: Number,
    required: function() { return this.offerType === 'barter-plus-cash' || this.offerType === 'cash-only'; },
    default: 0
  },
  currency: {
    type: String,
    default: 'PKR'
  },
  
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending'
  },
  chatThread: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat'
  }
}, {
  timestamps: true
});

// Index for better query performance
offerSchema.index({ offeredBy: 1 });
offerSchema.index({ offeredTo: 1 });
offerSchema.index({ status: 1 });
offerSchema.index({ offerType: 1 });

module.exports = mongoose.model('Offer', offerSchema);
