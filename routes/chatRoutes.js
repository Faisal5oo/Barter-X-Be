const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, chatController.getChats);
router.get("/:id/messages", authMiddleware, chatController.getChatMessages);
router.post("/:id/messages", authMiddleware, chatController.sendMessage);
router.put("/messages/:id/read", authMiddleware, chatController.markMessageAsRead);
router.get("/messages/unread-count", authMiddleware, chatController.getUnreadCount);

module.exports = router; 