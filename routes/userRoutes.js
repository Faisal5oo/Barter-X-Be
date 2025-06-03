const express = require("express");
const router = express.Router();
const { getUserProfile, updateUserProfile, updateProfileImage } = require("../controllers/userController");

router.get("/:id", getUserProfile);
router.put("/:id", updateUserProfile);
router.put("/:id/profile-image", updateProfileImage);

module.exports = router;
