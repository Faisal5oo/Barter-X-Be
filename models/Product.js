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

  // Free product indicator
  isFree: {
    type: Boolean,
    default: false
  },

  images: {
    type: [String],
    default: []
  },

  // Conditional fields based on category
  condition: { 
    type: String, 
    required: function() { return this.category !== 'food'; }
  },
  age: { 
    type: String, 
    required: function() { return this.category !== 'food'; }
  },
  warranty: { 
    type: String, 
    required: function() { return this.category !== 'food'; }
  },
  boxAccessories: { 
    type: String, 
    required: function() { return this.category !== 'food'; }
  },
  screenCondition: { 
    type: String,
    required: function() { return this.category !== 'food'; }
  },
  bodyCondition: { 
    type: String, 
    required: function() { return this.category !== 'food'; }
  },

  // Food specific fields
  expiryDate: {
    type: Date,
    required: function() { return this.category === 'food'; }
  },
  foodType: {
    type: String,
    required: function() { return this.category === 'food'; },
    enum: ['fresh', 'packaged', 'cooked', 'other']
  },
  dietaryInfo: {
    vegetarian: { type: Boolean, default: false },
    vegan: { type: Boolean, default: false },
    glutenFree: { type: Boolean, default: false },
    containsNuts: { type: Boolean, default: false },
    halal: { type: Boolean, default: false },
    kosher: { type: Boolean, default: false }
  },

  specs: {
    brand: { type: String },
    model: { 
      type: String,
      required: function() { return this.category !== 'food'; }
    },
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
    notes: { type: String },
    
    // Cash offer settings
    acceptCashOffers: { type: Boolean, default: false },
    pricingInfo: {
      minPrice: { type: Number, default: 0 },
      maxPrice: { type: Number, default: 0 },
      fixedPrice: { type: Number, default: 0 },
      currency: { type: String, default: 'PKR' }
    }
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
  reportCount: { type: Number, default: 0 },

  // Reviews and Ratings
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userName: { type: String, required: true },
    userImage: { type: String },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    review: { type: String },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  }
}, {
  timestamps: true
});

// Add a pre-save middleware to set expiry date for food items
productSchema.pre('save', function(next) {
  if (this.category === 'food' && !this.expiryDate) {
    // Set expiry date to 24 hours from now for food items
    this.expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  next();
});

// Add a static method to clean up expired food listings
productSchema.statics.cleanupExpiredFood = async function() {
  const now = new Date();
  await this.updateMany(
    { 
      category: 'food',
      expiryDate: { $lt: now },
      isActive: true 
    },
    { 
      $set: { isActive: false }
    }
  );
};

// Index for better search performance
productSchema.index({ title: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ location: 1 });
productSchema.index({ listedBy: 1 });
productSchema.index({ latitude: 1, longitude: 1 });
productSchema.index({ expiryDate: 1 }, { sparse: true });

module.exports = mongoose.model('Product', productSchema);
