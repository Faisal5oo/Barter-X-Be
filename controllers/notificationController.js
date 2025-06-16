const Notification = require('../models/Notification');
const User = require('../models/User');

// Create a notification
exports.createNotification = async (recipientId, senderId, type, title, message, data = {}) => {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type,
      title,
      message,
      data
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Get all notifications for a user
exports.getUserNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false, userId } = req.query;
    const skip = (page - 1) * limit;

    // For testing without auth - use userId from query or a test user ID
    const recipientId = userId || req.user?.id || '507f1f77bcf86cd799439011'; // fallback test ID

    const filter = { recipient: recipientId };
    if (unreadOnly === 'true') {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter)
      .populate('sender', 'name profileImage')
      .populate('data.offerId')
      .populate('data.productId', 'title images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const totalNotifications = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({
      recipient: recipientId,
      isRead: false
    });

    res.status(200).json({
      notifications,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalNotifications / limit),
        totalNotifications,
        unreadCount
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to fetch notifications", 
      error: error.message 
    });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { userId } = req.query;
    const recipientId = userId || req.user?.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: recipientId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.status(200).json({ message: "Notification marked as read", notification });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to mark notification as read", 
      error: error.message 
    });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.query;
    const recipientId = userId || req.user?.id || '507f1f77bcf86cd799439011';
    
    await Notification.updateMany(
      { recipient: recipientId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to mark all notifications as read", 
      error: error.message 
    });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { userId } = req.query;
    const recipientId = userId || req.user?.id;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: recipientId
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.status(200).json({ message: "Notification deleted successfully" });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to delete notification", 
      error: error.message 
    });
  }
};

// Get notification count (unread)
exports.getNotificationCount = async (req, res) => {
  try {
    const { userId } = req.query;
    const recipientId = userId || req.user?.id || '507f1f77bcf86cd799439011';
    
    const unreadCount = await Notification.countDocuments({
      recipient: recipientId,
      isRead: false
    });

    res.status(200).json({ unreadCount });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to get notification count", 
      error: error.message 
    });
  }
};

// Helper function to create offer notification
exports.createOfferNotification = async (offerId, recipientId, senderId, offerType, productTitle, senderName) => {
  let title, message;
  
  switch (offerType) {
    case 'barter':
      title = 'New Barter Offer';
      message = `${senderName} sent you a barter offer for ${productTitle}`;
      break;
    case 'barter-plus-cash':
      title = 'New Barter + Cash Offer';
      message = `${senderName} sent you a barter + cash offer for ${productTitle}`;
      break;
    case 'cash-only':
      title = 'New Cash Offer';
      message = `${senderName} sent you a cash offer for ${productTitle}`;
      break;
    default:
      title = 'New Offer';
      message = `${senderName} sent you an offer for ${productTitle}`;
  }

  return this.createNotification(
    recipientId,
    senderId,
    'offer_received',
    title,
    message,
    { offerId }
  );
};

// Helper function to create free request notification
exports.createFreeRequestNotification = async (freeRequestId, recipientId, senderId, productTitle, senderName) => {
  const title = 'Free Item Request';
  const message = `${senderName} is interested in your free item: ${productTitle}`;

  return this.createNotification(
    recipientId,
    senderId,
    'free_request',
    title,
    message,
    { freeRequestId }
  );
}; 