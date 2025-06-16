const mongoose = require('mongoose');

const freeRequestSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending'
  },
  chatThread: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat'
  },
  responseMessage: {
    type: String,
    maxlength: 500
  },
  respondedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Prevent duplicate requests for the same product by the same user
freeRequestSchema.index({ requester: 1, product: 1 }, { unique: true });

// Index for better query performance
freeRequestSchema.index({ productOwner: 1, status: 1 });
freeRequestSchema.index({ requester: 1, status: 1 });
freeRequestSchema.index({ status: 1 });
freeRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('FreeRequest', freeRequestSchema); 