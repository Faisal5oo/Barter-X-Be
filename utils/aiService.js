const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('../models/Product');
const User = require('../models/User');

// Configure Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDso1cCz2jDpRpKGKT-HAf0vNQC04F476U";

class AIRecommendationService {
    constructor() {
        try {
            this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            this.isAvailable = true;
        } catch (error) {
            console.error('AI Service initialization error:', error);
            this.model = null;
            this.isAvailable = false;
        }
    }

    async generateProductRecommendations(userId, userPreferences, searchHistory, availableProducts) {
        try {
            // Enhanced category-based recommendations
            const categoryRecommendations = this.getCategoryBasedRecommendations(
                userId, 
                userPreferences, 
                searchHistory, 
                availableProducts
            );

            // Check if AI service is available for enhanced recommendations
            if (!this.isAvailable || !this.model) {
                console.log('AI service not available, using category-based recommendations');
                return categoryRecommendations;
            }

            // Prepare context for AI
            const context = this.prepareRecommendationContext(
                userPreferences, 
                searchHistory, 
                availableProducts
            );

            // Generate recommendations using Gemini
            const prompt = this.createRecommendationPrompt(context);
            const result = await this.model.generateContent(prompt);
            
            if (!result.response) {
                throw new Error('No response from AI model');
            }

            const response = await result.response;
            const aiRecommendations = this.parseAIResponse(userId, response.text(), availableProducts);

            // Combine AI recommendations with category-based ones
            const combinedRecommendations = this.combineRecommendations(aiRecommendations, categoryRecommendations);
            
            // Send notification about new recommendations
            this.sendRecommendationNotification(userId, combinedRecommendations.slice(0, 3));
            
            return combinedRecommendations;

        } catch (error) {
            console.error('AI Recommendation Error:', error);
            // Fallback to category-based recommendations if AI fails
            return this.getCategoryBasedRecommendations(userId, userPreferences, searchHistory, availableProducts);
        }
    }

    prepareRecommendationContext(preferences, searchHistory, products) {
        return {
            userPreferences: {
                favoriteCategories: preferences?.favoriteCategories || [],
                priceRange: preferences?.priceRange || {},
                location: preferences?.location || '',
                interests: preferences?.interests || []
            },
            searchStats: {
                searchesCount: searchHistory?.searches?.length || 0,
                topCategories: searchHistory?.topCategories || [],
                recentSearches: searchHistory?.recentSearches || []
            },
            availableProducts: products.slice(0, 50).map(product => ({
                id: product._id,
                title: product.title,
                description: product.description,
                category: product.category,
                condition: product.condition,
                location: product.location,
                isFree: product.isFree,
                specs: product.specs
            }))
        };
    }

    createRecommendationPrompt(context) {
        return `
        You are an expert product recommendation system for a barter exchange platform called BarterX.
        
        USER PROFILE:
        - Favorite Categories: ${context.userPreferences.favoriteCategories.join(', ') || 'Not specified'}
        - Price Range: ${JSON.stringify(context.userPreferences.priceRange)}
        - Location: ${context.userPreferences.location || 'Not specified'}
        - Interests: ${context.userPreferences.interests.join(', ') || 'Not specified'}
        
        SEARCH HISTORY:
        - Total Searches: ${context.searchStats.searchesCount}
        - Top Categories: ${context.searchStats.topCategories.join(', ') || 'Not specified'}
        - Recent Searches: ${context.searchStats.recentSearches.join(', ') || 'None'}
        
        AVAILABLE PRODUCTS:
        ${JSON.stringify(context.availableProducts, null, 2)}
        
        INSTRUCTIONS:
        1. Analyze the user's preferences and search history
        2. Match them with the most suitable products from the available list
        3. Consider category preferences, location proximity, and search patterns
        4. Provide a match percentage (0-100) for each recommended product
        5. Give a clear, personalized reason for each recommendation
        6. Only recommend products that truly match the user's interests
        7. Prioritize diversity in recommendations while staying true to preferences
        8. Consider if products are free or for trade
        
        RESPONSE FORMAT (JSON only, no other text):
        [
            {
                "product_id": "product_id_here",
                "match_percentage": 85,
                "reason": "This product matches your interest in electronics and is in your preferred location."
            }
        ]
        
        Recommend 5-10 products with match percentage above 60%. If no good matches exist, return empty array [].
        `;
    }

    parseAIResponse(userId, aiResponse, availableProducts) {
        try {
            // Clean the response to extract JSON
            let responseText = aiResponse.trim();
            if (responseText.startsWith('```json')) {
                responseText = responseText.substring(7);
            }
            if (responseText.endsWith('```')) {
                responseText = responseText.slice(0, -3);
            }

            const aiRecommendations = JSON.parse(responseText);
            const recommendations = [];
            const productIds = new Map(availableProducts.map(p => [p._id.toString(), p]));

            for (const rec of aiRecommendations) {
                if (productIds.has(rec.product_id) && rec.match_percentage >= 60) {
                    recommendations.push({
                        userId,
                        productId: rec.product_id,
                        matchPercentage: rec.match_percentage,
                        reason: rec.reason,
                        createdAt: new Date()
                    });
                }
            }

            return recommendations;

        } catch (error) {
            console.error('Error parsing AI response:', error);
            console.error('AI Response:', aiResponse);
            return [];
        }
    }

    getCategoryBasedRecommendations(userId, preferences, searchHistory, availableProducts) {
        const recommendations = [];
        
        // Get user preferences and favorites for better matching
        const userPrefs = preferences?.preferences || {};
        const userFavorites = preferences?.favorites || [];
        
        // Score products based on favorites, preferences, category, condition, and market value
        for (const product of availableProducts) {
            let matchPercentage = 0;
            const reasons = [];

            // Favorites-based matching (highest priority)
            if (userFavorites.length > 0) {
                const favoriteCategories = [...new Set(userFavorites.map(fav => fav.category))];
                const favoriteBrands = [...new Set(userFavorites.map(fav => fav.specs?.brand).filter(Boolean))];
                
                if (favoriteCategories.includes(product.category)) {
                    matchPercentage += 30;
                    reasons.push(`Similar to your favorite ${product.category} items`);
                }
                
                if (favoriteBrands.includes(product.specs?.brand)) {
                    matchPercentage += 20;
                    reasons.push(`Same brand as your favorites`);
                }
            }

            // User preferences matching
            if (userPrefs.categories && userPrefs.categories.includes(product.category)) {
                matchPercentage += 25;
                reasons.push(`Matches your preferred category: ${product.category}`);
            }

            if (userPrefs.conditions && userPrefs.conditions.includes(product.condition)) {
                matchPercentage += 20;
                reasons.push(`Matches your preferred condition: ${product.condition}`);
            }

            if (userPrefs.brands && product.specs?.brand && userPrefs.brands.includes(product.specs.brand)) {
                matchPercentage += 15;
                reasons.push(`Preferred brand: ${product.specs.brand}`);
            }

            if (userPrefs.freeOnly && product.isFree) {
                matchPercentage += 30;
                reasons.push('Free item - matches your preference');
            }

            // Category matching (electronics priority)
            if (product.category === 'electronics') {
                matchPercentage += 40;
                
                // Brand and model analysis for electronics
                const productTitle = product.title.toLowerCase();
                const productDesc = product.description.toLowerCase();
                
                // iPhone analysis
                if (productTitle.includes('iphone') || productDesc.includes('iphone')) {
                    matchPercentage += 20;
                    reasons.push('Premium iPhone device');
                    
                    // Model year analysis
                    if (productTitle.includes('15') || productTitle.includes('14') || productTitle.includes('13')) {
                        matchPercentage += 15;
                        reasons.push('Latest model');
                    }
                }
                
                // Samsung analysis
                if (productTitle.includes('samsung') || productTitle.includes('galaxy') || productDesc.includes('samsung')) {
                    matchPercentage += 20;
                    reasons.push('Premium Samsung device');
                    
                    // Flagship models
                    if (productTitle.includes('s24') || productTitle.includes('s23') || productTitle.includes('ultra')) {
                        matchPercentage += 15;
                        reasons.push('Flagship model');
                    }
                }
                
                // Other premium brands
                const premiumBrands = ['sony', 'lg', 'oneplus', 'pixel', 'xiaomi'];
                for (const brand of premiumBrands) {
                    if (productTitle.includes(brand) || productDesc.includes(brand)) {
                        matchPercentage += 15;
                        reasons.push(`Quality ${brand} device`);
                        break;
                    }
                }
            }

            // Condition-based scoring (very important)
            if (product.condition) {
                const condition = product.condition.toLowerCase();
                if (condition === 'new' || condition === 'excellent') {
                    matchPercentage += 25;
                    reasons.push(`Excellent condition (${product.condition})`);
                } else if (condition === 'very good' || condition === 'good') {
                    matchPercentage += 15;
                    reasons.push(`Good condition (${product.condition})`);
                } else if (condition === 'fair') {
                    matchPercentage += 5;
                    reasons.push(`Fair condition - good for parts`);
                }
            }

            // Screen condition for electronics
            if (product.category === 'electronics' && product.screenCondition) {
                const screenCondition = product.screenCondition.toLowerCase();
                if (screenCondition === 'perfect' || screenCondition === 'excellent') {
                    matchPercentage += 15;
                    reasons.push('Perfect screen condition');
                } else if (screenCondition === 'good') {
                    matchPercentage += 10;
                    reasons.push('Good screen condition');
                }
            }

            // Market value estimation (based on specs and condition)
            if (product.category === 'electronics' && product.specs) {
                // High-value items
                const title = product.title.toLowerCase();
                if (title.includes('pro max') || title.includes('ultra') || title.includes('plus')) {
                    matchPercentage += 10;
                    reasons.push('High-end model');
                }
                
                // Storage consideration
                if (title.includes('256gb') || title.includes('512gb') || title.includes('1tb')) {
                    matchPercentage += 5;
                    reasons.push('Good storage capacity');
                }
            }

            // Warranty and accessories boost
            if (product.warranty && product.warranty.toLowerCase() !== 'no warranty') {
                matchPercentage += 10;
                reasons.push('Includes warranty');
            }

            if (product.boxAccessories && product.boxAccessories.toLowerCase().includes('complete')) {
                matchPercentage += 10;
                reasons.push('Complete box and accessories');
            }

            // Free products are always attractive
            if (product.isFree) {
                matchPercentage += 20;
                reasons.push('FREE item - amazing value!');
            }

            // Average rating boost
            if (product.averageRating >= 4.0) {
                matchPercentage += 15;
                reasons.push(`Highly rated (${product.averageRating.toFixed(1)}/5 stars)`);
            } else if (product.averageRating >= 3.0) {
                matchPercentage += 10;
                reasons.push(`Good rating (${product.averageRating.toFixed(1)}/5 stars)`);
            }

            // Location preference
            if (preferences?.location && product.location.toLowerCase().includes(preferences.location.toLowerCase())) {
                matchPercentage += 10;
                reasons.push(`Available in ${product.location}`);
            }

            if (userPrefs.locations && userPrefs.locations.some(loc => 
                product.location.toLowerCase().includes(loc.toLowerCase()))) {
                matchPercentage += 15;
                reasons.push(`Matches your preferred location`);
            }

            // Only recommend products with good match
            if (matchPercentage >= 30) {
                recommendations.push({
                    userId,
                    productId: product._id,
                    matchPercentage: Math.min(matchPercentage, 100),
                    reason: reasons.join(', ') || 'Good match for your interests',
                    createdAt: new Date(),
                    category: product.category,
                    title: product.title
                });
            }
        }

        // Sort by match percentage and return top recommendations
        return recommendations
            .sort((a, b) => b.matchPercentage - a.matchPercentage)
            .slice(0, 12);
    }

    combineRecommendations(aiRecommendations, categoryRecommendations) {
        const combined = new Map();
        
        // Add AI recommendations first (higher priority)
        aiRecommendations.forEach(rec => {
            combined.set(rec.productId, {
                ...rec,
                source: 'ai',
                matchPercentage: Math.min(rec.matchPercentage + 10, 100) // Boost AI recommendations
            });
        });

        // Add category recommendations if not already included
        categoryRecommendations.forEach(rec => {
            if (!combined.has(rec.productId)) {
                combined.set(rec.productId, {
                    ...rec,
                    source: 'category'
                });
            }
        });

        return Array.from(combined.values())
            .sort((a, b) => b.matchPercentage - a.matchPercentage)
            .slice(0, 12);
    }

    sendRecommendationNotification(userId, recommendations) {
        // Add delay before showing notification
        setTimeout(() => {
            if (recommendations.length > 0) {
                const topMatch = recommendations[0];
                console.log('\n🎯 ┌─────────────────────────────────────────┐');
                console.log('   │           📦 New Recommendations        │');
                console.log('   │              Available                  │');
                console.log('   └─────────────────────────────────────────┘');
                console.log(`Found ${recommendations.length} items that match your interests!`);
                console.log(`Top match: ${topMatch.title} (${topMatch.matchPercentage}% match)`);
                console.log('');
                console.log('⏰ Just now');
                console.log('📱 Mark read');
                console.log('🔗 Click to view → /recommendations');
                console.log('✨ Reason: ' + topMatch.reason);
                console.log('─'.repeat(60));
            }
        }, 2000); // 2 second delay
    }

    fallbackRecommendations(userId, preferences, availableProducts) {
        // This method is now replaced by getCategoryBasedRecommendations
        return this.getCategoryBasedRecommendations(userId, preferences, {}, availableProducts);
    }

    async generateChatResponse(userMessage, userContext, availableProducts) {
        if (!this.isAvailable || !this.model) {
            return this.generateFallbackChatResponse(userMessage, userContext, availableProducts);
        }

        try {
            // Check if user is asking for product recommendations
            const isProductQuery = this.isProductRelatedQuery(userMessage);
            
            let prompt;
            if (isProductQuery) {
                // Generate product recommendations along with chat response
                const recommendations = this.getCategoryBasedRecommendations(
                    userContext.userId || 'unknown',
                    { 
                        favoriteCategories: userContext.interests || [],
                        location: userContext.location 
                    },
                    { recentSearches: userContext.recentSearches || [] },
                    availableProducts
                );

                prompt = this.createProductChatPrompt(userMessage, userContext, availableProducts, recommendations);
            } else {
                prompt = this.createGeneralChatPrompt(userMessage, userContext, availableProducts);
            }

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const aiResponse = response.text().trim();

            // Send notification if AI suggested products
            if (isProductQuery && userContext.userId) {
                this.sendChatNotification(userContext.userId, userMessage, aiResponse);
            }

            return aiResponse;

        } catch (error) {
            console.error('AI Chat Error:', error);
            return this.generateFallbackChatResponse(userMessage, userContext, availableProducts);
        }
    }

    isProductRelatedQuery(message) {
        const productKeywords = [
            'recommend', 'suggest', 'looking for', 'need', 'want', 'find', 'search',
            'electronics', 'clothing', 'furniture', 'books', 'food', 'free', 'trade',
            'available', 'products', 'items', 'help me find', 'show me', 'nearby', 'near'
        ];
        
        const lowercaseMessage = message.toLowerCase();
        return productKeywords.some(keyword => lowercaseMessage.includes(keyword));
    }

    createProductChatPrompt(userMessage, userContext, availableProducts, recommendations) {
        const topRecommendations = recommendations.slice(0, 3);
        const totalProducts = availableProducts.length;
        const freeItemsCount = availableProducts.filter(p => p.isFree).length;
        const categories = [...new Set(availableProducts.map(p => p.category))];
        
        return `
        You are BarterX AI, a smart assistant for a product exchange platform. The user is asking about products.
        
        USER CONTEXT:
        - Location: ${userContext?.location || 'Not specified'}
        - Recent searches: ${userContext?.recentSearches?.join(', ') || 'None'}
        - Interests: ${userContext?.interests?.join(', ') || 'Not specified'}
        
        USER MESSAGE: "${userMessage}"
        
        PLATFORM STATS:
        - Total products available: ${totalProducts}
        - Free items available: ${freeItemsCount}
        - Popular categories: ${categories.slice(0, 5).join(', ')}
        
        TOP 3 RECOMMENDATIONS FOR THIS USER:
        ${topRecommendations.map((rec, i) => {
            const product = availableProducts.find(p => p._id.toString() === rec.productId);
            return product ? `${i + 1}. ${product.title} (${product.category}) - ${rec.matchPercentage}% match` : '';
        }).filter(Boolean).join('\n')}
        
        AVAILABLE LINKS TO HELP USER:
        - Browse all products: http://localhost:8080/products
        - Find nearby items: http://localhost:8080/nearby
        - View recommendations: http://localhost:8080/recommendations
        - Browse free items: http://localhost:8080/free
        - Search by category: http://localhost:8080/categories
        
        INSTRUCTIONS:
        1. DON'T list all products - instead provide relevant links
        2. Mention only 2-3 top recommendations briefly
        3. Guide users to appropriate pages with links
        4. If they ask for "nearby" items, give them the nearby link
        5. If they ask for "recommendations", give them the recommendations link
        6. Keep responses under 150 words
        7. Be helpful and direct users to the right pages
        8. Include relevant emojis but don't overdo it
        
        Respond as a helpful guide that directs users to the right pages:
        `;
    }

    createGeneralChatPrompt(userMessage, userContext, availableProducts) {
        const totalProducts = availableProducts.length;
        const freeItemsCount = availableProducts.filter(p => p.isFree).length;
        
        return `
        You are BarterX AI, a friendly assistant for a product exchange and bartering platform.
        
        USER CONTEXT:
        - Location: ${userContext?.location || 'Not specified'}
        - Recent searches: ${userContext?.recentSearches?.join(', ') || 'None'}
        - Interests: ${userContext?.interests?.join(', ') || 'Not specified'}
        
        USER MESSAGE: "${userMessage}"
        
        PLATFORM INFO:
        - Users can trade, barter, or give away items for free
        - Categories include electronics, clothing, furniture, books, food, and more
        - Local exchanges are encouraged for safety
        - Currently ${totalProducts} products available (${freeItemsCount} free items)
        
        HELPFUL LINKS FOR USER:
        - Browse all products: http://localhost:8080/products
        - Find nearby items: http://localhost:8080/nearby
        - View your recommendations: http://localhost:8080/recommendations
        - Browse free items: http://localhost:8080/free
        - Search by category: http://localhost:8080/categories
        - How bartering works: http://localhost:8080/how-it-works
        
        INSTRUCTIONS:
        1. Be helpful and friendly but concise
        2. Always provide relevant links instead of listing items
        3. If they ask about nearby items, give them the nearby link
        4. If they ask about recommendations, give them the recommendations link
        5. If they ask about free items, give them the free items link
        6. If they ask about safety, mention public meetups and give safety tips
        7. Keep responses under 120 words
        8. Don't list products - direct to appropriate pages
        
        Respond as a helpful platform guide:
        `;
    }

    generateFallbackChatResponse(userMessage, userContext, availableProducts) {
        const message = userMessage.toLowerCase();
        const totalProducts = availableProducts.length;
        const freeItemsCount = availableProducts.filter(p => p.isFree).length;
        
        if (message.includes('recommend') || message.includes('suggest') || message.includes('looking for')) {
            return `🤖 I'd be happy to help you find products! 

**Quick Stats:**
📦 ${totalProducts} products available
🆓 ${freeItemsCount} free items available

**Check out these links:**
🎯 **Your Recommendations:** http://localhost:8080/recommendations
🔍 **Browse All Products:** http://localhost:8080/products
📍 **Nearby Items:** http://localhost:8080/nearby

What specific type of product are you looking for? I can guide you to the right page! 🎯`;
        }

        if (message.includes('nearby') || message.includes('near')) {
            return `📍 **Looking for nearby items?**

Check out products in your area: http://localhost:8080/nearby

🛡️ **Safety First:** We encourage meeting in public places like cafes or community centers for safe exchanges!

Need help finding something specific nearby? Let me know! 🗺️`;
        }

        if (message.includes('barter') || message.includes('trade') || message.includes('exchange')) {
            return `🔄 **How Bartering Works on BarterX:**

1. **List** your items → **Browse** others → **Make** offers → **Meet** safely

📚 **Learn More:** http://localhost:8080/how-it-works
🔍 **Start Browsing:** http://localhost:8080/products

🛡️ **Safety First:** Always meet in public places and inspect items before trading.

Ready to start your bartering journey? 🚀`;
        }

        if (message.includes('free')) {
            return `🎁 **Free Items Available: ${freeItemsCount} items**

🔗 **Browse Free Items:** http://localhost:8080/free

💝 **Give Back:** Consider listing items you no longer need as free to help others in your community!

Want to see what's available for free? Check the link above! 🎁`;
        }

        return `👋 Hello! I'm your BarterX AI assistant. I can help you navigate:

🎯 **Get Recommendations:** http://localhost:8080/recommendations
🔍 **Browse Products:** http://localhost:8080/products  
📍 **Find Nearby Items:** http://localhost:8080/nearby
🎁 **Free Items:** http://localhost:8080/free

What would you like to explore? Just ask! 😊`;
    }

    sendChatNotification(userId, userMessage, aiResponse) {
        // Mock notification system for chat interactions
        console.log(`💬 CHAT NOTIFICATION for User ${userId}:`);
        console.log(`❓ User asked: "${userMessage.substring(0, 50)}..."`);
        console.log(`🤖 AI provided product suggestions and advice`);
        console.log(`💡 Tip: Check out the recommended products mentioned in the chat!`);
        console.log('─'.repeat(60));
    }

    async generateUserInsights(userId, userStats, interactions) {
        if (!this.isAvailable || !this.model) {
            return "Keep exploring new products and making great exchanges!";
        }

        try {
            const prompt = `
            Analyze this user's activity on BarterX and provide personalized insights:
            
            USER STATISTICS:
            - Products Listed: ${userStats?.productsListed || 0}
            - Successful Trades: ${userStats?.successfulTrades || 0}
            - Products Viewed: ${userStats?.productsViewed || 0}
            - Favorite Categories: ${userStats?.favoriteCategories?.join(', ') || 'None specified'}
            - Free Items Given: ${userStats?.freeItemsGiven || 0}
            - Free Items Received: ${userStats?.freeItemsReceived || 0}
            
            RECENT INTERACTIONS:
            ${JSON.stringify(interactions?.slice(-10) || [], null, 2)}
            
            Provide 3-4 brief, encouraging insights about their trading habits, preferences, and suggestions for improvement.
            Keep it positive and motivational. Format as a simple paragraph.
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();

        } catch (error) {
            console.error('AI Insights Error:', error);
            return "Keep exploring new products and making great exchanges! Every interaction helps build a stronger community.";
        }
    }
}

// Global AI service instance
const aiService = new AIRecommendationService();

module.exports = aiService; 