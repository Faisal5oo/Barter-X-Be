const User = require('../models/User');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// Get user preferences
exports.getUserPreferences = async (req, res) => {
  try {
    const { userId } = req.query;
    const currentUserId = userId || req.user?.id;

    if (!currentUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const user = await User.findById(currentUserId).select('preferences');
    
    res.status(200).json({
      success: true,
      preferences: user.preferences || {
        categories: [],
        conditions: [],
        priceRange: { min: 0, max: 1000000 },
        brands: [],
        locations: [],
        freeOnly: false
      }
    });

  } catch (error) {
    console.error('Get User Preferences Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get user preferences",
      error: error.message
    });
  }
};

// Update user preferences
exports.updateUserPreferences = async (req, res) => {
  try {
    const { userId, preferences } = req.body;
    const currentUserId = userId || req.user?.id;

    if (!currentUserId || !preferences) {
      return res.status(400).json({
        success: false,
        message: "User ID and preferences are required"
      });
    }

    // Validate preferences structure
    const validPreferences = {
      categories: preferences.categories || [],
      conditions: preferences.conditions || [],
      priceRange: {
        min: preferences.priceRange?.min || 0,
        max: preferences.priceRange?.max || 1000000
      },
      brands: preferences.brands || [],
      locations: preferences.locations || [],
      freeOnly: preferences.freeOnly || false
    };

    const updatedUser = await User.findByIdAndUpdate(
      currentUserId,
      { $set: { preferences: validPreferences } },
      { new: true, select: 'preferences' }
    );

    res.status(200).json({
      success: true,
      message: "User preferences updated successfully",
      preferences: updatedUser.preferences
    });

  } catch (error) {
    console.error('Update User Preferences Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update user preferences",
      error: error.message
    });
  }
};

// Add product review and rating
exports.addProductReview = async (req, res) => {
  try {
    const { productId, userId, rating, review } = req.body;
    const currentUserId = userId || req.user?.id;

    if (!productId || !currentUserId || !rating) {
      return res.status(400).json({
        success: false,
        message: "Product ID, User ID, and rating are required"
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5"
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

    // Get user info
    const user = await User.findById(currentUserId).select('name profileImage');

    // Check if user already reviewed this product
    const existingReviewIndex = product.reviews.findIndex(
      r => r.user.toString() === currentUserId
    );

    const reviewData = {
      user: currentUserId,
      userName: user.name,
      userImage: user.profileImage,
      rating: rating,
      review: review || '',
      createdAt: new Date()
    };

    if (existingReviewIndex >= 0) {
      // Update existing review
      product.reviews[existingReviewIndex] = reviewData;
    } else {
      // Add new review
      product.reviews.push(reviewData);
    }

    // Calculate average rating
    const totalRating = product.reviews.reduce((sum, r) => sum + r.rating, 0);
    product.averageRating = totalRating / product.reviews.length;

    await product.save();

    res.status(200).json({
      success: true,
      message: "Review added successfully",
      averageRating: product.averageRating,
      totalReviews: product.reviews.length
    });

  } catch (error) {
    console.error('Add Product Review Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to add product review",
      error: error.message
    });
  }
};

// Get product reviews
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.query;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    const product = await Product.findById(productId).select('reviews averageRating');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.status(200).json({
      success: true,
      reviews: product.reviews || [],
      averageRating: product.averageRating || 0,
      totalReviews: product.reviews?.length || 0
    });

  } catch (error) {
    console.error('Get Product Reviews Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get product reviews",
      error: error.message
    });
  }
}; 