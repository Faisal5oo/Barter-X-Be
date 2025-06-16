const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", productController.getAllProducts);
router.get("/free", productController.getFreeProducts);
router.get("/nearby", productController.getNearbyProducts);
router.get("/debug", productController.debugProducts);
router.get("/category/:categoryName", productController.getProductsByCategory);
router.get("/user/my-listings", authMiddleware, productController.getMyListings);
router.get("/user/favorites", authMiddleware, productController.getFavorites);
router.get("/:id/pricing", productController.getProductPricingInfo);
router.get("/:id/favorite-status", authMiddleware, productController.checkFavoriteStatus);
router.get("/:id", productController.getProductById);
router.post("/:id/view", productController.incrementViews);
router.post("/:id/favorite", authMiddleware, productController.toggleFavorite);

router.post("/", authMiddleware, productController.createProduct);
router.post("/fix-coordinates", authMiddleware, productController.fixProductCoordinates);
router.put("/:id", authMiddleware, productController.updateProduct);
router.delete("/:id", authMiddleware, productController.deleteProduct);

module.exports = router;