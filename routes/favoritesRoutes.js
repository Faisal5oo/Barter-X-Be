const express = require('express');
const router = express.Router();
const {
  addToFavorites,
  removeFromFavorites,
  getFavorites,
  checkFavorite
} = require('../controllers/favoritesController');

// Add product to favorites
router.post('/add', addToFavorites);

// Remove product from favorites
router.post('/remove', removeFromFavorites);

// Get user's favorite products
router.get('/', getFavorites);

// Check if product is in favorites
router.get('/check', checkFavorite);

module.exports = router; 