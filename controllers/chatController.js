const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Offer = require('../models/Offer');

exports.getChats = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const chats = await Chat.find({
      participants: req.user.id,
      isActive: true
    })
      .populate('participants', 'name email')
      .populate('offer', 'status')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name'
        }
      })
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Chat.countDocuments({
      participants: req.user.id,
      isActive: true
    });

    res.status(200).json({
      chats,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalChats: total
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch chats", error: err.message });
  }
};


exports.getChatMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const chat = await Chat.findById(id);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ message: "You are not a participant in this chat" });
    }

    const messages = await Message.find({ chat: id })
      .populate('sender', 'name email')
      .populate('offer', 'status offeredProduct requestedProduct')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Message.countDocuments({ chat: id });

    res.status(200).json({
      messages: messages.reverse(), 
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalMessages: total
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch messages", error: err.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type = 'text' } = req.body;

    const chat = await Chat.findById(id);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ message: "You are not a participant in this chat" });
    }

    const message = new Message({
      chat: id,
      sender: req.user.id,
      content,
      type
    });

    const savedMessage = await message.save();

    chat.lastMessage = savedMessage._id;
    chat.lastActivity = new Date();
    await chat.save();

    const populatedMessage = await Message.findById(savedMessage._id)
      .populate('sender', 'name email');

    res.status(201).json(populatedMessage);
  } catch (err) {
    res.status(500).json({ message: "Failed to send message", error: err.message });
  }
};

exports.markMessageAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const chat = await Chat.findById(message.chat);
    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ message: "You are not a participant in this chat" });
    }

    const alreadyRead = message.readBy.some(read => read.user.toString() === req.user.id);
    
    if (!alreadyRead) {
      message.readBy.push({
        user: req.user.id,
        readAt: new Date()
      });
      await message.save();
    }

    res.status(200).json({ message: "Message marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark message as read", error: err.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const userChats = await Chat.find({
      participants: req.user.id,
      isActive: true
    }).select('_id');

    const chatIds = userChats.map(chat => chat._id);

    const unreadCount = await Message.countDocuments({
      chat: { $in: chatIds },
      sender: { $ne: req.user.id },
      'readBy.user': { $ne: req.user.id }
    });

    res.status(200).json({ unreadCount });
  } catch (err) {
    res.status(500).json({ message: "Failed to get unread count", error: err.message });
  }
};
