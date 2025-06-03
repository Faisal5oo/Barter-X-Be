const Offer = require('../models/Offer');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Product = require('../models/Product');

exports.createOffer = async (req, res) => {
  try {
    const { offeredTo, offeredProduct, requestedProduct, message } = req.body;
    const offeredBy = req.user.id;

    if (offeredBy === offeredTo) {
      return res.status(400).json({ message: "Cannot make offer to yourself" });
    }

    const [offeredProd, requestedProd] = await Promise.all([
      Product.findById(offeredProduct),
      Product.findById(requestedProduct)
    ]);

    if (!offeredProd || !requestedProd) {
      return res.status(404).json({ message: "One or both products not found" });
    }

    if (offeredProd.listedBy.toString() !== offeredBy) {
      return res.status(403).json({ message: "You can only offer your own products" });
    }

    const newOffer = new Offer({
      offeredBy,
      offeredTo,
      offeredProduct,
      requestedProduct,
      message
    });

    const savedOffer = await newOffer.save();

    const chat = new Chat({
      participants: [offeredBy, offeredTo],
      offer: savedOffer._id
    });

    const savedChat = await chat.save();

    savedOffer.chatThread = savedChat._id;
    await savedOffer.save();

    const systemMessage = new Message({
      chat: savedChat._id,
      sender: offeredBy,
      content: `New barter offer: ${offeredProd.title} for ${requestedProd.title}`,
      type: 'offer',
      offer: savedOffer._id
    });

    const savedMessage = await systemMessage.save();

    savedChat.lastMessage = savedMessage._id;
    savedChat.lastActivity = new Date();
    await savedChat.save();

    const populatedOffer = await Offer.findById(savedOffer._id)
      .populate('offeredBy', 'name email')
      .populate('offeredTo', 'name email')
      .populate('offeredProduct', 'title images')
      .populate('requestedProduct', 'title images')
      .populate('chatThread');

    res.status(201).json(populatedOffer);
  } catch (err) {
    res.status(500).json({ message: "Failed to create offer", error: err.message });
  }
};

exports.getSentOffers = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const filter = { offeredBy: req.user.id };
    if (status) filter.status = status;

    const offers = await Offer.find(filter)
      .populate('offeredTo', 'name email')
      .populate('offeredProduct', 'title images')
      .populate('requestedProduct', 'title images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Offer.countDocuments(filter);

    res.status(200).json({
      offers,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalOffers: total
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch sent offers", error: err.message });
  }
};

exports.getReceivedOffers = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const filter = { offeredTo: req.user.id };
    if (status) filter.status = status;

    const offers = await Offer.find(filter)
      .populate('offeredBy', 'name email')
      .populate('offeredProduct', 'title images')
      .populate('requestedProduct', 'title images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Offer.countDocuments(filter);

    res.status(200).json({
      offers,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalOffers: total
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch received offers", error: err.message });
  }
};

exports.acceptOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id)
      .populate('offeredProduct', 'title')
      .populate('requestedProduct', 'title');

    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    if (offer.offeredTo.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the receiver can accept this offer" });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({ message: "Offer is no longer pending" });
    }

    offer.status = 'accepted';
    await offer.save();

    const systemMessage = new Message({
      chat: offer.chatThread,
      sender: req.user.id,
      content: `Offer accepted! The barter for ${offer.offeredProduct.title} and ${offer.requestedProduct.title} has been agreed upon.`,
      type: 'system'
    });

    await systemMessage.save();

    await Chat.findByIdAndUpdate(offer.chatThread, {
      lastMessage: systemMessage._id,
      lastActivity: new Date()
    });

    res.status(200).json({ message: "Offer accepted successfully", offer });
  } catch (err) {
    res.status(500).json({ message: "Failed to accept offer", error: err.message });
  }
};

exports.rejectOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id)
      .populate('offeredProduct', 'title')
      .populate('requestedProduct', 'title');

    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    if (offer.offeredTo.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the receiver can reject this offer" });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({ message: "Offer is no longer pending" });
    }

    offer.status = 'rejected';
    await offer.save();

    const systemMessage = new Message({
      chat: offer.chatThread,
      sender: req.user.id,
      content: `Offer rejected. The barter for ${offer.offeredProduct.title} and ${offer.requestedProduct.title} was declined.`,
      type: 'system'
    });

    await systemMessage.save();

    await Chat.findByIdAndUpdate(offer.chatThread, {
      lastMessage: systemMessage._id,
      lastActivity: new Date()
    });

    res.status(200).json({ message: "Offer rejected successfully", offer });
  } catch (err) {
    res.status(500).json({ message: "Failed to reject offer", error: err.message });
  }
};

// Cancel offer
exports.cancelOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id)
      .populate('offeredProduct', 'title')
      .populate('requestedProduct', 'title');

    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    // Check if user is the offerer
    if (offer.offeredBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the offerer can cancel this offer" });
    }

    // Check if offer is still pending
    if (offer.status !== 'pending') {
      return res.status(400).json({ message: "Offer is no longer pending" });
    }

    // Update offer status
    offer.status = 'cancelled';
    await offer.save();

    // Create system message
    const systemMessage = new Message({
      chat: offer.chatThread,
      sender: req.user.id,
      content: `Offer cancelled. The barter for ${offer.offeredProduct.title} and ${offer.requestedProduct.title} was cancelled by the offerer.`,
      type: 'system'
    });

    await systemMessage.save();

    // Update chat last activity
    await Chat.findByIdAndUpdate(offer.chatThread, {
      lastMessage: systemMessage._id,
      lastActivity: new Date()
    });

    res.status(200).json({ message: "Offer cancelled successfully", offer });
  } catch (err) {
    res.status(500).json({ message: "Failed to cancel offer", error: err.message });
  }
}; 