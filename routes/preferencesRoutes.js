const express = require('express');
const router = express.Router();
const {
  getUserPreferences,
  updateUserPreferences,
  addProductReview,
  getProductReviews
} = require('../controllers/userPreferencesController');

// Get user preferences
router.get('/', getUserPreferences);

// Update user preferences
router.put('/', updateUserPreferences);

// Add product review
router.post('/review', addProductReview);

// Get product reviews
router.get('/reviews', getProductReviews);

module.exports = router; 