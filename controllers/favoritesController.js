const Product = require('../models/Product');
const User = require('../models/User');
const mongoose = require('mongoose');

// Add product to favorites
exports.addToFavorites = async (req, res) => {
  try {
    const { productId, userId } = req.body;
    const currentUserId = userId || req.user?.id;

    if (!productId || !currentUserId) {
      return res.status(400).json({
        success: false,
        message: "Product ID and User ID are required"
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Check if already in favorites
    const user = await User.findById(currentUserId);
    if (user.favorites && user.favorites.includes(productId)) {
      return res.status(400).json({
        success: false,
        message: "Product already in favorites"
      });
    }

    // Add to favorites
    await User.findByIdAndUpdate(
      currentUserId,
      { $addToSet: { favorites: productId } },
      { new: true }
    );

    // Also add to product's favorites count
    await Product.findByIdAndUpdate(
      productId,
      { $addToSet: { favorites: currentUserId } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Product added to favorites successfully"
    });

  } catch (error) {
    console.error('Add to Favorites Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to add product to favorites",
      error: error.message
    });
  }
};

// Remove product from favorites
exports.removeFromFavorites = async (req, res) => {
  try {
    const { productId, userId } = req.body;
    const currentUserId = userId || req.user?.id;

    if (!productId || !currentUserId) {
      return res.status(400).json({
        success: false,
        message: "Product ID and User ID are required"
      });
    }

    // Remove from user's favorites
    await User.findByIdAndUpdate(
      currentUserId,
      { $pull: { favorites: productId } },
      { new: true }
    );

    // Remove from product's favorites count
    await Product.findByIdAndUpdate(
      productId,
      { $pull: { favorites: currentUserId } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Product removed from favorites successfully"
    });

  } catch (error) {
    console.error('Remove from Favorites Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to remove product from favorites",
      error: error.message
    });
  }
};

// Get user's favorite products
exports.getFavorites = async (req, res) => {
  try {
    const { userId } = req.query;
    const currentUserId = userId || req.user?.id;

    if (!currentUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Get user with populated favorites
    const user = await User.findById(currentUserId)
      .populate({
        path: 'favorites',
        populate: {
          path: 'listedBy',
          select: 'name profileImage'
        }
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Filter active products only
    const activeFavorites = user.favorites.filter(product => product.isActive);

    res.status(200).json({
      success: true,
      favorites: activeFavorites,
      count: activeFavorites.length
    });

  } catch (error) {
    console.error('Get Favorites Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get favorite products",
      error: error.message
    });
  }
};

// Check if product is in favorites
exports.checkFavorite = async (req, res) => {
  try {
    const { productId, userId } = req.query;
    const currentUserId = userId || req.user?.id;

    if (!productId || !currentUserId) {
      return res.status(400).json({
        success: false,
        message: "Product ID and User ID are required"
      });
    }

    const user = await User.findById(currentUserId).select('favorites');
    const isFavorite = user.favorites && user.favorites.includes(productId);

    res.status(200).json({
      success: true,
      isFavorite: isFavorite
    });

  } catch (error) {
    console.error('Check Favorite Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to check favorite status",
      error: error.message
    });
  }
}; 