const mongoose = require('mongoose');

// Address Schema
const addressSchema = new mongoose.Schema({
  label: { type: String },
  street: { type: String },
  city: { type: String },
  state: { type: String },
  zipCode: { type: String },
  country: { type: String },
}, { _id: false });

// Notification Schema
const notificationSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g., 'message', 'offer', etc.
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

// User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/\S+@\S+\.\S+/, 'Please enter a valid email address'],
  },

  password: {
    type: String,
    required: true,
    minlength: 6,
  },

  phone: {
    type: String,
    required: false,
  },

  profileImage: {
    type: String,
    required: false,
  },

  address: {
    type: addressSchema,
    required: false,
  },

  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: [],
  }],

  myListings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    default: [],
  }],

  myOffers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
    default: [],
  }],

  notifications: {
    type: [notificationSchema],
    default: [],
  },

  // AI Recommendation fields
  favoriteCategories: {
    type: [String],
    default: [],
  },

  interests: {
    type: [String],
    default: [],
  },

  searchPreferences: {
    preferredLocations: {
      type: [String],
      default: [],
    },
    priceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 10000 }
    },
    preferFreeItems: { type: Boolean, default: false }
  },

  // User Preferences for AI recommendations
  preferences: {
    categories: {
      type: [String],
      default: []
    },
    conditions: {
      type: [String],
      default: []
    },
    priceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 1000000 }
    },
    brands: {
      type: [String],
      default: []
    },
    locations: {
      type: [String],
      default: []
    },
    freeOnly: {
      type: Boolean,
      default: false
    }
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
