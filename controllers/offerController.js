const Offer = require('../models/Offer');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Product = require('../models/Product');
const User = require('../models/User');
const { createOfferNotification } = require('./notificationController');

exports.createOffer = async (req, res) => {
  try {
    const { 
      offeredTo, 
      offeredProduct, 
      requestedProduct, 
      message, 
      offerType = 'barter',
      cashAmount = 0
    } = req.body;
    const offeredBy = req.user.id;

    if (offeredBy === offeredTo) {
      return res.status(400).json({ message: "Cannot make offer to yourself" });
    }

    // Validate offer type
    const validOfferTypes = ['barter', 'barter-plus-cash', 'cash-only'];
    if (!validOfferTypes.includes(offerType)) {
      return res.status(400).json({ message: "Invalid offer type" });
    }

    // Get the requested product to check cash offer settings
    const requestedProd = await Product.findById(requestedProduct);
    if (!requestedProd) {
      return res.status(404).json({ message: "Requested product not found" });
    }

    // Check if cash offers are allowed
    const acceptsCashOffers = requestedProd.exchangePreferences?.acceptCashOffers || false;
    
    if (!acceptsCashOffers && (offerType === 'barter-plus-cash' || offerType === 'cash-only')) {
      return res.status(403).json({ 
        message: "This product owner does not accept cash offers. Only barter exchange is allowed." 
      });
    }

    // Validate cash amount for cash-involved offers
    if ((offerType === 'barter-plus-cash' || offerType === 'cash-only') && (!cashAmount || cashAmount <= 0)) {
      return res.status(400).json({ message: "Cash amount is required and must be greater than 0" });
    }

    // Validate cash amount against price range/fixed price
    if (acceptsCashOffers && cashAmount > 0) {
      const pricingInfo = requestedProd.exchangePreferences?.pricingInfo;
      if (pricingInfo) {
        // Check fixed price
        if (pricingInfo.fixedPrice > 0 && offerType === 'cash-only') {
          if (cashAmount !== pricingInfo.fixedPrice) {
            return res.status(400).json({ 
              message: `This item has a fixed price of ${pricingInfo.fixedPrice} ${pricingInfo.currency || 'PKR'}` 
            });
          }
        }
        // Check price range for cash-only offers
        else if (pricingInfo.minPrice > 0 || pricingInfo.maxPrice > 0) {
          if (offerType === 'cash-only') {
            if (pricingInfo.minPrice > 0 && cashAmount < pricingInfo.minPrice) {
              return res.status(400).json({ 
                message: `Minimum price is ${pricingInfo.minPrice} ${pricingInfo.currency || 'PKR'}` 
              });
            }
            if (pricingInfo.maxPrice > 0 && cashAmount > pricingInfo.maxPrice) {
              return res.status(400).json({ 
                message: `Maximum price is ${pricingInfo.maxPrice} ${pricingInfo.currency || 'PKR'}` 
              });
            }
          }
        }
      }
    }

    let offeredProd = null;
    // For non-cash-only offers, validate the offered product
    if (offerType !== 'cash-only') {
      if (!offeredProduct) {
        return res.status(400).json({ message: "Offered product is required for barter offers" });
      }
      
      offeredProd = await Product.findById(offeredProduct);
      if (!offeredProd) {
        return res.status(404).json({ message: "Offered product not found" });
      }

      if (offeredProd.listedBy.toString() !== offeredBy) {
        return res.status(403).json({ message: "You can only offer your own products" });
      }
    }

    const newOffer = new Offer({
      offeredBy,
      offeredTo,
      offeredProduct: offerType !== 'cash-only' ? offeredProduct : undefined,
      requestedProduct,
      message,
      offerType,
      cashAmount: (offerType === 'barter-plus-cash' || offerType === 'cash-only') ? cashAmount : 0,
      currency: requestedProd.exchangePreferences?.pricingInfo?.currency || 'PKR'
    });

    const savedOffer = await newOffer.save();

    const chat = new Chat({
      participants: [offeredBy, offeredTo],
      offer: savedOffer._id
    });

    const savedChat = await chat.save();

    savedOffer.chatThread = savedChat._id;
    await savedOffer.save();

    // Create appropriate system message based on offer type
    let systemMessageContent = '';
    switch (offerType) {
      case 'barter':
        systemMessageContent = `New barter offer: ${offeredProd.title} for ${requestedProd.title}`;
        break;
      case 'barter-plus-cash':
        systemMessageContent = `New barter + cash offer: ${offeredProd.title} + ${cashAmount} ${newOffer.currency} for ${requestedProd.title}`;
        break;
      case 'cash-only':
        systemMessageContent = `New cash offer: ${cashAmount} ${newOffer.currency} for ${requestedProd.title}`;
        break;
    }

    const systemMessage = new Message({
      chat: savedChat._id,
      sender: offeredBy,
      content: systemMessageContent,
      type: 'offer',
      offer: savedOffer._id
    });

    const savedMessage = await systemMessage.save();

    savedChat.lastMessage = savedMessage._id;
    savedChat.lastActivity = new Date();
    await savedChat.save();

    // Get sender info for notification
    const sender = await User.findById(offeredBy, 'name');
    
    // Create notification for offer recipient
    await createOfferNotification(
      savedOffer._id,
      offeredTo,
      offeredBy,
      offerType,
      requestedProd.title,
      sender.name
    );

    const populatedOffer = await Offer.findById(savedOffer._id)
      .populate('offeredBy', 'name email')
      .populate('offeredTo', 'name email')
      .populate('offeredProduct', 'title images')
      .populate('requestedProduct', 'title images exchangePreferences')
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