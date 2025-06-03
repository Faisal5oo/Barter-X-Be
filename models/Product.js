const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true
  },
  description: { 
    type: String, 
    required: true
  },
  category: {
    type: String,
    required: true
  },

  images: {
    type: [String],
    default: []
  },

  condition: { 
    type: String, 
    required: true
  },
  age: { 
    type: String, 
    required: true
  },
  warranty: { 
    type: String, 
    required: true
  },
  boxAccessories: { 
    type: String, 
    required: true
  },
  screenCondition: { 
    type: String
  },
  bodyCondition: { 
    type: String, 
    required: true
  },

  specs: {
    brand: { type: String },
    model: { type: String },
    year: { type: String },
    size: { type: String },
    color: { type: String },
    material: { type: String }
  },

  location: {
    type: String,
    required: true
  },

  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  
  shippingOptions: {
    inPerson: { type: Boolean, default: true },
    withinMiles: { type: Number, default: 10 },
    canShip: { type: Boolean, default: false },
    buyerPaysShipping: { type: Boolean, default: true },
    preferredLocations: {
      type: [String],
      default: []
    }
  },

  exchangePreferences: {
    preferredItems: { type: [String], default: [] },
    notInterestedIn: { type: [String], default: [] },
    cashOption: { type: Boolean, default: false },
    willingToAddCash: { type: Boolean, default: false },
    estimatedValue: { type: Number },
    notes: { type: String }
  },

  listedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],

  isApproved: { type: Boolean, default: true },
  moderationNotes: { type: String },
  reportCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Index for better search performance
productSchema.index({ title: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ location: 1 });
productSchema.index({ listedBy: 1 });
productSchema.index({ latitude: 1, longitude: 1 });

module.exports = mongoose.model('Product', productSchema);
