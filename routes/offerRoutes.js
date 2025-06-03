const express = require("express");
const router = express.Router();
const offerController = require("../controllers/offerController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, offerController.createOffer);
router.get("/sent", authMiddleware, offerController.getSentOffers);
router.get("/received", authMiddleware, offerController.getReceivedOffers);
router.put("/:id/accept", authMiddleware, offerController.acceptOffer);
router.put("/:id/reject", authMiddleware, offerController.rejectOffer);
router.put("/:id/cancel", authMiddleware, offerController.cancelOffer);

module.exports = router; 