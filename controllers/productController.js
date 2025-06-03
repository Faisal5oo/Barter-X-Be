const Product = require("../models/Product");
const User = require("../models/User");

exports.createProduct = async (req, res) => {
  try {
    const { images, ...productData } = req.body;
    
    // Validate image URLs if provided
    if (images && Array.isArray(images)) {
      const validImageUrls = images.filter(url => 
        typeof url === 'string' && 
        (url.startsWith('http') || url.startsWith('https'))
      );
      productData.images = validImageUrls;
    } else {
      productData.images = [];
    }
    
    const newProduct = new Product({
      ...productData,
      listedBy: req.user.id
    });
    
    const savedProduct = await newProduct.save();
    await savedProduct.populate("listedBy", "name email");
    res.status(201).json(savedProduct);
  } catch (err) {
    res.status(500).json({ message: "Failed to create product", error: err.message });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      location,
      search,
      condition,
      cashOption,
      canShip,
      sortBy = 'createdAt',
      minValue,
      maxValue
    } = req.query;

    const filter = { isActive: true, isApproved: true };
    
    if (category) filter.category = category;
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (condition) filter.condition = condition;
    if (cashOption !== undefined) filter['exchangePreferences.cashOption'] = cashOption === 'true';
    if (canShip !== undefined) filter['shippingOptions.canShip'] = canShip === 'true';
    if (minValue || maxValue) {
      filter['exchangePreferences.estimatedValue'] = {};
      if (minValue) filter['exchangePreferences.estimatedValue'].$gte = Number(minValue);
      if (maxValue) filter['exchangePreferences.estimatedValue'].$lte = Number(maxValue);
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const sortOptions = {};
    switch (sortBy) {
      case 'newest':
        sortOptions.createdAt = -1;
        break;
      case 'oldest':
        sortOptions.createdAt = 1;
        break;
      case 'views':
        sortOptions.views = -1;
        break;
      case 'featured':
        sortOptions.isFeatured = -1;
        break;
      default:
        sortOptions.createdAt = -1;
    }

    const skip = (page - 1) * limit;
    
    const products = await Product.find(filter)
      .populate("listedBy", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(filter);
    
    res.status(200).json({
      products,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalProducts: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch products", error: err.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("listedBy", "name email");
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.status(200).json(product);
  } catch (err) {
    res.status(500).json({ message: "Error fetching product", error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    
    if (product.listedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to update this product" });
    }

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate("listedBy", "name email");
    
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update product", error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    
    if (product.listedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to delete this product" });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete product", error: err.message });
  }
};

exports.getMyListings = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const products = await Product.find({ listedBy: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments({ listedBy: req.user.id });

    res.status(200).json({
      products,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalProducts: total
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch your listings", error: err.message });
  }
};

exports.toggleFavorite = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const userId = req.user.id;
    const isFavorited = product.favorites.includes(userId);

    if (isFavorited) {
      product.favorites.pull(userId);
    } else {
      product.favorites.push(userId);
    }

    await product.save();
    
    res.status(200).json({ 
      message: isFavorited ? "Removed from favorites" : "Added to favorites",
      isFavorited: !isFavorited
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to toggle favorite", error: err.message });
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const products = await Product.find({ 
      favorites: req.user.id,
      isActive: true 
    })
      .populate("listedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments({ 
      favorites: req.user.id,
      isActive: true 
    });

    res.status(200).json({
      products,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalProducts: total
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch favorites", error: err.message });
  }
};

exports.incrementViews = async (req, res) => {
  try {
    await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } }
    );
    res.status(200).json({ message: "View count updated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update views", error: err.message });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const { categoryName } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt' } = req.query;
    
    const skip = (page - 1) * limit;
    
    const sortOptions = {};
    switch (sortBy) {
      case 'newest':
        sortOptions.createdAt = -1;
        break;
      case 'oldest':
        sortOptions.createdAt = 1;
        break;
      case 'views':
        sortOptions.views = -1;
        break;
      default:
        sortOptions.createdAt = -1;
    }

    const products = await Product.find({ 
      category: categoryName,
      isActive: true,
      isApproved: true 
    })
      .populate("listedBy", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments({ 
      category: categoryName,
      isActive: true,
      isApproved: true 
    });

    res.status(200).json({
      products,
      category: categoryName,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalProducts: total
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch products by category", error: err.message });
  }
};

exports.getNearbyProducts = async (req, res) => {
  try {
    const { 
      latitude, 
      longitude, 
      radius = 10, 
      page = 1, 
      limit = 20,
      category,
      condition,
      sortBy = 'distance'
    } = req.query;
    
    console.log('🔍 Nearby Products Request:', { latitude, longitude, radius, category, condition });
    
    if (!latitude || !longitude) {
      return res.status(400).json({ 
        message: "Latitude and longitude are required" 
      });
    }

    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);
    const searchRadius = parseFloat(radius);

    console.log('📍 Parsed Values:', { userLat, userLng, searchRadius });

    if (isNaN(userLat) || isNaN(userLng) || isNaN(searchRadius)) {
      return res.status(400).json({ 
        message: "Invalid latitude, longitude, or radius values" 
      });
    }

    if (userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
      return res.status(400).json({ 
        message: "Invalid coordinate ranges. Latitude: -90 to 90, Longitude: -180 to 180" 
      });
    }

    const filter = { isActive: true, isApproved: true };
    if (category) filter.category = category;
    if (condition) filter.condition = condition;

    console.log('📊 Database Filter:', filter);

    const allProducts = await Product.find(filter)
      .populate("listedBy", "name email")
      .lean();

    console.log(`📦 Total Products Found: ${allProducts.length}`);
    
    // Function to extract coordinates from product (handles both old and new format)
    const getProductCoordinates = (product) => {
      // New format: direct latitude/longitude fields
      if (product.latitude && product.longitude) {
        return {
          lat: parseFloat(product.latitude),
          lng: parseFloat(product.longitude),
          format: 'new'
        };
      }
      
      // Old format: coordinates object with coordinates array [lng, lat]
      if (product.coordinates && product.coordinates.coordinates && 
          Array.isArray(product.coordinates.coordinates) && 
          product.coordinates.coordinates.length === 2) {
        return {
          lat: parseFloat(product.coordinates.coordinates[1]), // latitude is second
          lng: parseFloat(product.coordinates.coordinates[0]), // longitude is first
          format: 'old'
        };
      }
      
      return null;
    };
    
    // Check how many products have coordinates (either format)
    const productsWithCoords = allProducts.filter(p => getProductCoordinates(p) !== null);
    console.log(`📍 Products with Coordinates: ${productsWithCoords.length}`);
    
    if (productsWithCoords.length === 0) {
      return res.status(200).json({
        products: [],
        userLocation: { latitude: userLat, longitude: userLng },
        searchRadius: searchRadius,
        message: "No products found with location coordinates.",
        debug: {
          totalProducts: allProducts.length,
          productsWithCoords: 0,
          productsWithinRadius: 0
        },
        pagination: {
          currentPage: Number(page),
          totalPages: 0,
          totalProducts: 0,
          hasNext: false,
          hasPrev: false
        }
      });
    }

    // Calculate distances and filter by radius
    const productsWithDistance = [];
    
    allProducts.forEach(product => {
      const coords = getProductCoordinates(product);
      if (!coords) {
        console.log(`❌ Product "${product.title}" - No coordinates found`);
        return;
      }
      
      const distance = calculateDistance(userLat, userLng, coords.lat, coords.lng);
      
      console.log(`📏 Product: "${product.title}" - Distance: ${distance.toFixed(2)} miles (${coords.format} format)`);
      console.log(`🎯 User Location: ${userLat}, ${userLng} | Product Location: ${coords.lat}, ${coords.lng}`);
      
      // STRICT RADIUS FILTERING - Only include if within radius
      if (distance <= searchRadius) {
        console.log(`✅ INCLUDED - Within ${searchRadius} mile radius`);
        productsWithDistance.push({
          ...product,
          distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
          latitude: coords.lat,
          longitude: coords.lng
        });
      } else {
        console.log(`❌ EXCLUDED - Outside ${searchRadius} mile radius (${distance.toFixed(2)} miles away)`);
      }
    });

    console.log(`🎯 Products within ${searchRadius} miles: ${productsWithDistance.length}`);
    console.log(`🔍 Filtering Summary: ${allProducts.length} total → ${productsWithCoords.length} with coords → ${productsWithDistance.length} within radius`);

    // Sort the filtered products
    let sortedProducts = [...productsWithDistance];
    switch (sortBy) {
      case 'distance':
        sortedProducts.sort((a, b) => a.distance - b.distance);
        console.log('📊 Sorted by distance (closest first)');
        break;
      case 'newest':
        sortedProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        console.log('📊 Sorted by newest first');
        break;
      case 'oldest':
        sortedProducts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        console.log('📊 Sorted by oldest first');
        break;
      case 'views':
        sortedProducts.sort((a, b) => b.views - a.views);
        console.log('📊 Sorted by most views');
        break;
      default:
        sortedProducts.sort((a, b) => a.distance - b.distance);
        console.log('📊 Default sort by distance');
    }

    // Apply pagination
    const totalProducts = sortedProducts.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedProducts = sortedProducts.slice(startIndex, endIndex);

    console.log(`📄 Pagination: Page ${page}, Showing ${startIndex + 1}-${Math.min(endIndex, totalProducts)} of ${totalProducts}`);

    res.status(200).json({
      products: paginatedProducts,
      userLocation: { latitude: userLat, longitude: userLng },
      searchRadius: searchRadius,
      debug: {
        totalProductsInDB: allProducts.length,
        productsWithCoords: productsWithCoords.length,
        productsWithinRadius: totalProducts,
        radiusFilterWorking: true
      },
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts: totalProducts,
        hasNext: endIndex < totalProducts,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('❌ Error in getNearbyProducts:', err);
    res.status(500).json({ message: "Failed to fetch nearby products", error: err.message });
  }
};

// Enhanced Haversine formula for accurate distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  // Convert latitude and longitude from degrees to radians
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  // Ensure we return a valid number
  return isNaN(distance) ? 0 : distance;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

exports.debugProducts = async (req, res) => {
  try {
    const allProducts = await Product.find({}).lean();
    
    // Function to extract coordinates (same as in getNearbyProducts)
    const getProductCoordinates = (product) => {
      // New format: direct latitude/longitude fields
      if (product.latitude && product.longitude) {
        return {
          lat: product.latitude,
          lng: product.longitude,
          format: 'new'
        };
      }
      
      // Old format: coordinates object with coordinates array [lng, lat]
      if (product.coordinates && product.coordinates.coordinates && 
          Array.isArray(product.coordinates.coordinates) && 
          product.coordinates.coordinates.length === 2) {
        return {
          lat: product.coordinates.coordinates[1], // latitude is second
          lng: product.coordinates.coordinates[0], // longitude is first
          format: 'old'
        };
      }
      
      return null;
    };
    
    const productsWithCoords = allProducts.filter(p => getProductCoordinates(p) !== null);
    const productsWithoutCoords = allProducts.filter(p => getProductCoordinates(p) === null);
    
    res.status(200).json({
      summary: {
        totalProducts: allProducts.length,
        productsWithCoords: productsWithCoords.length,
        productsWithoutCoords: productsWithoutCoords.length
      },
      productsWithoutCoords: productsWithoutCoords.map(p => ({
        id: p._id,
        title: p.title,
        location: p.location,
        hasDirectLatLng: !!(p.latitude && p.longitude),
        hasCoordinatesObject: !!(p.coordinates && p.coordinates.coordinates)
      })),
      productsWithCoords: productsWithCoords.map(p => {
        const coords = getProductCoordinates(p);
        return {
          id: p._id,
          title: p.title,
          location: p.location,
          latitude: coords.lat,
          longitude: coords.lng,
          format: coords.format
        };
      })
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to debug products", error: err.message });
  }
};

exports.fixProductCoordinates = async (req, res) => {
  try {
    const { productId, latitude, longitude } = req.body;
    
    if (!productId || !latitude || !longitude) {
      return res.status(400).json({ 
        message: "productId, latitude, and longitude are required" 
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    product.latitude = parseFloat(latitude);
    product.longitude = parseFloat(longitude);
    await product.save();

    res.status(200).json({
      message: "Product coordinates updated successfully",
      product: {
        id: product._id,
        title: product.title,
        location: product.location,
        latitude: product.latitude,
        longitude: product.longitude
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fix product coordinates", error: err.message });
  }
};