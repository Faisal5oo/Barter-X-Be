const aiService = require('../utils/aiService');
const Product = require('../models/Product');
const SearchHistory = require('../models/SearchHistory');
const User = require('../models/User');
const Offer = require('../models/Offer');

// Get AI recommendations for user
exports.getRecommendations = async (req, res) => {
  try {
    const { limit = 10, userId } = req.query;
    const currentUserId = userId || req.user?.id || '507f1f77bcf86cd799439011';

    // Get user preferences and favorites
    const user = await User.findById(currentUserId).populate('favorites');
    const userPreferences = {
      favoriteCategories: user?.favoriteCategories || [],
      location: user?.address?.city || '',
      interests: user?.interests || [],
      preferences: user?.preferences || {},
      favorites: user?.favorites || []
    };

    // Get user's search history
    const searchHistory = await SearchHistory.getUserSearchAnalytics(currentUserId);

    // Get available products (excluding user's own products)
    const availableProducts = await Product.find({
      listedBy: { $ne: currentUserId },
      isActive: true
    })
    .limit(50)
    .sort({ createdAt: -1 });

    // Generate AI recommendations
    const recommendations = await aiService.generateProductRecommendations(
      currentUserId,
      userPreferences,
      searchHistory,
      availableProducts
    );

    // Get full product details for recommendations
    const recommendedProducts = [];
    for (const rec of recommendations.slice(0, limit)) {
      const product = await Product.findById(rec.productId)
        .populate('listedBy', 'name profileImage phone')
        .populate('reviews.user', 'name profileImage');
      
      if (product) {
        recommendedProducts.push({
          ...product.toObject(),
          aiInsights: {
            matchPercentage: rec.matchPercentage,
            reason: rec.reason,
            source: rec.source || 'ai'
          },
          isFavorite: user?.favorites?.some(fav => fav._id.toString() === product._id.toString()) || false
        });
      }
    }

    res.status(200).json({
      success: true,
      recommendations: recommendedProducts,
      totalCount: recommendations.length
    });

  } catch (error) {
    console.error('AI Recommendations Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get AI recommendations",
      error: error.message
    });
  }
};

// AI Chat endpoint
exports.aiChat = async (req, res) => {
  try {
    const { message, userId } = req.body;
    const currentUserId = userId || req.user?.id || '507f1f77bcf86cd799439011';

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    // Get user context
    const user = await User.findById(currentUserId);
    const searchHistory = await SearchHistory.getUserSearchAnalytics(currentUserId);
    
    const userContext = {
      userId: currentUserId,
      location: user?.address?.city || '',
      recentSearches: searchHistory.recentSearches || [],
      interests: user?.interests || []
    };

    // Get sample of available products for context
    const availableProducts = await Product.find({
      isActive: true
    })
    .limit(20)
    .select('title category isFree location')
    .sort({ createdAt: -1 });

    // Generate AI response
    const aiResponse = await aiService.generateChatResponse(
      message,
      userContext,
      availableProducts
    );

    res.status(200).json({
      success: true,
      response: aiResponse,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to process AI chat",
      error: error.message
    });
  }
};

// Get user insights
exports.getUserInsights = async (req, res) => {
  try {
    const { userId } = req.query;
    const currentUserId = userId || req.user?.id || '507f1f77bcf86cd799439011';

    // Get user statistics
    const userStats = await calculateUserStats(currentUserId);

    // Get recent interactions
    const recentOffers = await Offer.find({
      $or: [{ offeredBy: currentUserId }, { offeredTo: currentUserId }]
    })
    .limit(10)
    .sort({ createdAt: -1 })
    .populate('offeredProduct', 'title category')
    .populate('requestedProduct', 'title category');

    const interactions = recentOffers.map(offer => ({
      type: 'offer',
      action: offer.offeredBy.toString() === currentUserId ? 'sent' : 'received',
      offerType: offer.offerType,
      status: offer.status,
      createdAt: offer.createdAt
    }));

    // Generate AI insights
    const insights = await aiService.generateUserInsights(
      currentUserId,
      userStats,
      interactions
    );

    res.status(200).json({
      success: true,
      insights,
      stats: userStats,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('User Insights Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to generate user insights",
      error: error.message
    });
  }
};

// Helper function to calculate user statistics
const calculateUserStats = async (userId) => {
  try {
    // Get products listed by user
    const productsListed = await Product.countDocuments({ 
      listedBy: userId 
    });

    // Get successful trades (accepted offers)
    const successfulTrades = await Offer.countDocuments({
      $or: [{ offeredBy: userId }, { offeredTo: userId }],
      status: 'accepted'
    });

    // Get products viewed (from search history clicks)
    const searchHistory = await SearchHistory.find({ user: userId });
    const productsViewed = searchHistory.reduce((total, search) => 
      total + search.clickedProducts.length, 0
    );

    // Get favorite categories from search history
    const categories = searchHistory
      .map(search => search.filters?.category)
      .filter(Boolean);
    
    const categoryCount = {};
    categories.forEach(cat => {
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    
    const favoriteCategories = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category]) => category);

    // Get free items given and received
    const freeItemsGiven = await Product.countDocuments({
      listedBy: userId,
      isFree: true,
      isActive: false // Assuming inactive means given away
    });

    const freeItemsReceived = await Offer.countDocuments({
      offeredBy: userId,
      status: 'accepted'
    });

    return {
      productsListed,
      successfulTrades,
      productsViewed,
      favoriteCategories,
      freeItemsGiven,
      freeItemsReceived,
      totalSearches: searchHistory.length
    };

  } catch (error) {
    console.error('Error calculating user stats:', error);
    return {
      productsListed: 0,
      successfulTrades: 0,
      productsViewed: 0,
      favoriteCategories: [],
      freeItemsGiven: 0,
      freeItemsReceived: 0,
      totalSearches: 0
    };
  }
};

// Track search for recommendations
exports.trackSearch = async (req, res) => {
  try {
    const { query, filters = {}, resultsCount = 0, sessionId, userId } = req.body;
    const currentUserId = userId || req.user?.id || '507f1f77bcf86cd799439011';

    if (!query || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Query and sessionId are required"
      });
    }

    const searchRecord = new SearchHistory({
      user: currentUserId,
      searchQuery: query,
      searchType: filters.category ? 'category' : 'text',
      filters,
      resultsCount,
      sessionId
    });

    await searchRecord.save();

    res.status(201).json({
      success: true,
      message: "Search tracked successfully"
    });

  } catch (error) {
    console.error('Search Tracking Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to track search",
      error: error.message
    });
  }
};

// Track product click for recommendations
exports.trackProductClick = async (req, res) => {
  try {
    const { productId, sessionId, userId } = req.body;
    const currentUserId = userId || req.user?.id || '507f1f77bcf86cd799439011';

    if (!productId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "ProductId and sessionId are required"
      });
    }

    // Find the most recent search in this session
    const recentSearch = await SearchHistory.findOne({
      user: currentUserId,
      sessionId
    }).sort({ createdAt: -1 });

    if (recentSearch) {
      recentSearch.clickedProducts.push({
        product: productId,
        clickedAt: new Date()
      });
      await recentSearch.save();
      
      // Get product details for AI notification
      const product = await Product.findById(productId);
      if (product) {
        // Send interest-based notification with delay
        setTimeout(() => {
          console.log('\n🎯 ┌─────────────────────────────────────────┐');
          console.log('   │          Interest Tracked                │');
          console.log('   └─────────────────────────────────────────┘');
          console.log(`👀 You viewed: ${product.title}`);
          console.log(`📂 Category: ${product.category}`);
          console.log(`📍 Location: ${product.location}`);
          console.log('');
          console.log('⏰ Just now');
          console.log('📱 Mark read');
          console.log(`🔗 Click to view similar → /products?category=${product.category}`);
          console.log(`💡 We'll show you similar ${product.category} items!`);
          console.log('─'.repeat(60));
        }, 1500); // 1.5 second delay
      }
    }

    res.status(200).json({
      success: true,
      message: "Product click tracked successfully"
    });

  } catch (error) {
    console.error('Product Click Tracking Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to track product click",
      error: error.message
    });
  }
};

// Get AI-powered daily recommendations
exports.getDailyRecommendations = async (req, res) => {
  try {
    const { userId } = req.query;
    const currentUserId = userId || req.user?.id || '507f1f77bcf86cd799439011';

    // Get user profile and preferences  
    const user = await User.findById(currentUserId);
    const searchHistory = await SearchHistory.getUserSearchAnalytics(currentUserId);
    
    // Get fresh products (last 3 days for daily recommendations)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const freshProducts = await Product.find({
      listedBy: { $ne: currentUserId },
      isActive: true,
      createdAt: { $gte: threeDaysAgo }
    })
    .limit(30)
    .sort({ createdAt: -1 });

    if (freshProducts.length === 0) {
      // If no fresh products, get recent active products
      const recentProducts = await Product.find({
        listedBy: { $ne: currentUserId },
        isActive: true
      })
      .limit(20)
      .sort({ createdAt: -1 });

      if (recentProducts.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No products available for recommendations",
          recommendations: []
        });
      }

      // Use recent products instead
      const userPreferences = {
        favoriteCategories: user?.favoriteCategories || searchHistory?.topCategories || [],
        location: user?.address?.city || '',
        interests: user?.interests || []
      };

      const recommendations = await aiService.generateProductRecommendations(
        currentUserId,
        userPreferences,
        searchHistory,
        recentProducts
      );

      return res.status(200).json({
        success: true,
        recommendations: recommendations.slice(0, 8),
        message: "Daily recommendations based on recent products",
        timestamp: new Date()
      });
    }

    // Generate daily recommendations with fresh products
    const userPreferences = {
      favoriteCategories: user?.favoriteCategories || searchHistory?.topCategories || [],
      location: user?.address?.city || '',
      interests: user?.interests || []
    };

    const dailyRecommendations = await aiService.generateProductRecommendations(
      currentUserId,
      userPreferences,
      searchHistory,
      freshProducts
    );

    // Send daily notification with delay
    if (dailyRecommendations.length > 0) {
      setTimeout(() => {
        const topProduct = freshProducts.find(p => p._id.toString() === dailyRecommendations[0].productId);
        console.log('\n✨ ┌─────────────────────────────────────────┐');
        console.log('   │           🌅 Fresh Daily Picks          │');
        console.log('   └─────────────────────────────────────────┘');
        console.log(`${dailyRecommendations.length} new items added today that match your preferences!`);
        if (topProduct) {
          console.log(`Top pick: ${topProduct.title} (${dailyRecommendations[0].matchPercentage}% match)`);
        }
        console.log('');
        console.log('⏰ Just now');
        console.log('📱 Mark read');
        console.log('🔗 Click to view → /daily-recommendations');
        console.log('💡 Fresh listings from today - check them out before they\'re gone!');
        console.log('─'.repeat(60));
      }, 3000); // 3 second delay for daily recommendations
    }

    res.status(200).json({
      success: true,
      recommendations: dailyRecommendations.slice(0, 10),
      message: `Found ${dailyRecommendations.length} daily recommendations`,
      freshProductsCount: freshProducts.length,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Daily Recommendations Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get daily recommendations",
      error: error.message
    });
  }
};

// Send message notification between users
exports.sendMessageNotification = async (req, res) => {
  try {
    const { fromUserId, toUserId, message, productId } = req.body;

    if (!fromUserId || !toUserId || !message) {
      return res.status(400).json({
        success: false,
        message: "From user, to user, and message are required"
      });
    }

    // Get user and product details
    const fromUser = await User.findById(fromUserId).select('name');
    const product = productId ? await Product.findById(productId).select('title category') : null;

    // Send notification with delay
    setTimeout(() => {
      console.log('\n💬 ┌─────────────────────────────────────────┐');
      console.log('   │           New Message                   │');
      console.log('   └─────────────────────────────────────────┘');
      console.log(`From: ${fromUser?.name || 'Unknown User'}`);
      console.log(`Message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
      if (product) {
        console.log(`About: ${product.title} (${product.category})`);
      }
      console.log('');
      console.log('⏰ Just now');
      console.log('📱 Mark read');
      console.log('🔗 Click to reply → /messages');
      console.log('💡 Someone is interested in your item!');
      console.log('─'.repeat(60));
    }, 1000); // 1 second delay

    res.status(200).json({
      success: true,
      message: "Message notification sent successfully"
    });

  } catch (error) {
    console.error('Message Notification Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to send message notification",
      error: error.message
    });
  }
}; 