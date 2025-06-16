const FreeRequest = require('../models/FreeRequest');
const Product = require('../models/Product');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const { createFreeRequestNotification } = require('./notificationController');

// Create a free request
exports.createFreeRequest = async (req, res) => {
  try {
    const { productId, message, userId } = req.body;
    const requesterId = userId || req.user?.id || '507f1f77bcf86cd799439011'; // fallback test ID

    // Check if product exists and is free
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (!product.isFree) {
      return res.status(400).json({ message: "This product is not marked as free" });
    }

    if (product.listedBy.toString() === requesterId) {
      return res.status(400).json({ message: "You cannot request your own product" });
    }

    // Check if user already made a request for this product
    const existingRequest = await FreeRequest.findOne({
      requester: requesterId,
      product: productId,
      status: { $in: ['pending', 'accepted'] }
    });

    if (existingRequest) {
      return res.status(400).json({ 
        message: "You have already made a request for this product" 
      });
    }

    // Create the free request
    const freeRequest = new FreeRequest({
      requester: requesterId,
      productOwner: product.listedBy,
      product: productId,
      message
    });

    await freeRequest.save();

    // Create or find existing chat
    let chat = await Chat.findOne({
      participants: { $all: [requesterId, product.listedBy] }
    });

    if (!chat) {
      chat = new Chat({
        participants: [requesterId, product.listedBy]
      });
      await chat.save();
    }

    // Update free request with chat thread
    freeRequest.chatThread = chat._id;
    await freeRequest.save();

    // Create system message in chat
    const systemMessage = new Message({
      chat: chat._id,
      sender: requesterId,
      content: `Free item request: ${message}`,
      type: 'free_request',
      data: { freeRequestId: freeRequest._id }
    });

    await systemMessage.save();

    // Update chat with last message
    chat.lastMessage = systemMessage._id;
    chat.lastActivity = new Date();
    await chat.save();

    // Get requester info for notification
    const requester = await User.findById(requesterId, 'name');
    
    // Create notification for product owner
    await createFreeRequestNotification(
      freeRequest._id,
      product.listedBy,
      requesterId,
      product.title,
      requester.name
    );

    // Populate the response
    const populatedRequest = await FreeRequest.findById(freeRequest._id)
      .populate('requester', 'name email profileImage')
      .populate('productOwner', 'name email')
      .populate('product', 'title images')
      .populate('chatThread');

    res.status(201).json({
      message: "Free request sent successfully",
      freeRequest: populatedRequest
    });

  } catch (error) {
    res.status(500).json({ 
      message: "Failed to create free request", 
      error: error.message 
    });
  }
};

// Get received free requests (for product owners)
exports.getReceivedFreeRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, userId } = req.query;
    const skip = (page - 1) * limit;
    const ownerId = userId || req.user?.id || '507f1f77bcf86cd799439011';

    const filter = { productOwner: ownerId };
    if (status) filter.status = status;

    const requests = await FreeRequest.find(filter)
      .populate('requester', 'name email profileImage')
      .populate('product', 'title images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await FreeRequest.countDocuments(filter);

    res.status(200).json({
      requests,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalRequests: total
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to fetch received requests", 
      error: error.message 
    });
  }
};

// Get sent free requests (for requesters)
exports.getSentFreeRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, userId } = req.query;
    const skip = (page - 1) * limit;
    const requesterId = userId || req.user?.id || '507f1f77bcf86cd799439011';

    const filter = { requester: requesterId };
    if (status) filter.status = status;

    const requests = await FreeRequest.find(filter)
      .populate('productOwner', 'name email')
      .populate('product', 'title images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await FreeRequest.countDocuments(filter);

    res.status(200).json({
      requests,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalRequests: total
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to fetch sent requests", 
      error: error.message 
    });
  }
};

// Respond to free request (accept/reject)
exports.respondToFreeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, responseMessage = '', userId } = req.body; // action: 'accept' or 'reject'
    const ownerId = userId || req.user?.id;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Use 'accept' or 'reject'" });
    }

    const freeRequest = await FreeRequest.findOne({
      _id: requestId,
      productOwner: ownerId,
      status: 'pending'
    });

    if (!freeRequest) {
      return res.status(404).json({ message: "Free request not found or already responded" });
    }

    // Update request status
    freeRequest.status = action === 'accept' ? 'accepted' : 'rejected';
    freeRequest.responseMessage = responseMessage;
    freeRequest.respondedAt = new Date();
    await freeRequest.save();

    // Send system message to chat
    if (freeRequest.chatThread) {
      const systemMessage = new Message({
        chat: freeRequest.chatThread,
        sender: ownerId,
        content: `Free request ${action}ed${responseMessage ? ': ' + responseMessage : ''}`,
        type: 'system'
      });

      await systemMessage.save();

      // Update chat
      await Chat.findByIdAndUpdate(freeRequest.chatThread, {
        lastMessage: systemMessage._id,
        lastActivity: new Date()
      });
    }

    // If accepted, mark product as no longer active
    if (action === 'accept') {
      await Product.findByIdAndUpdate(freeRequest.product, {
        isActive: false
      });
    }

    const populatedRequest = await FreeRequest.findById(freeRequest._id)
      .populate('requester', 'name email')
      .populate('product', 'title images');

    res.status(200).json({
      message: `Free request ${action}ed successfully`,
      freeRequest: populatedRequest
    });

  } catch (error) {
    res.status(500).json({ 
      message: "Failed to respond to free request", 
      error: error.message 
    });
  }
};

// Cancel free request (for requester)
exports.cancelFreeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { userId } = req.query;
    const requesterId = userId || req.user?.id;

    const freeRequest = await FreeRequest.findOne({
      _id: requestId,
      requester: requesterId,
      status: 'pending'
    });

    if (!freeRequest) {
      return res.status(404).json({ message: "Free request not found or cannot be cancelled" });
    }

    freeRequest.status = 'cancelled';
    await freeRequest.save();

    // Send system message to chat
    if (freeRequest.chatThread) {
      const systemMessage = new Message({
        chat: freeRequest.chatThread,
        sender: requesterId,
        content: 'Free request cancelled',
        type: 'system'
      });

      await systemMessage.save();

      // Update chat
      await Chat.findByIdAndUpdate(freeRequest.chatThread, {
        lastMessage: systemMessage._id,
        lastActivity: new Date()
      });
    }

    res.status(200).json({
      message: "Free request cancelled successfully"
    });

  } catch (error) {
    res.status(500).json({ 
      message: "Failed to cancel free request", 
      error: error.message 
    });
  }
}; 