const express = require('express');
const router = express.Router();
const {
  getRecommendations,
  aiChat,
  getUserInsights,
  trackSearch,
  trackProductClick,
  getDailyRecommendations,
  sendMessageNotification
} = require('../controllers/aiController');

// Get AI recommendations for user
router.get('/recommendations', getRecommendations);

// AI Chat endpoint
router.post('/chat', aiChat);

// Get user insights
router.get('/insights', getUserInsights);

// Track search for recommendations
router.post('/track/search', trackSearch);

// Track product click for recommendations
router.post('/track/click', trackProductClick);

// Get daily AI recommendations
router.get('/daily-recommendations', getDailyRecommendations);

// Send message notification between users
router.post('/message-notification', sendMessageNotification);

module.exports = router; 