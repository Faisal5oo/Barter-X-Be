const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  searchQuery: {
    type: String,
    required: true,
    trim: true
  },
  searchType: {
    type: String,
    enum: ['text', 'category', 'location', 'filter'],
    default: 'text'
  },
  filters: {
    category: String,
    location: String,
    priceRange: {
      min: Number,
      max: Number
    },
    condition: String,
    isFree: Boolean
  },
  resultsCount: {
    type: Number,
    default: 0
  },
  clickedProducts: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    clickedAt: {
      type: Date,
      default: Date.now
    }
  }],
  sessionId: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance
searchHistorySchema.index({ user: 1, createdAt: -1 });
searchHistorySchema.index({ searchType: 1 });
searchHistorySchema.index({ 'filters.category': 1 });
searchHistorySchema.index({ sessionId: 1 });

// Static method to get user's search analytics
searchHistorySchema.statics.getUserSearchAnalytics = async function(userId) {
  const analytics = await this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalSearches: { $sum: 1 },
        categories: { $push: '$filters.category' },
        recentSearches: { $push: '$searchQuery' },
        avgResultsCount: { $avg: '$resultsCount' }
      }
    },
    {
      $project: {
        totalSearches: 1,
        topCategories: {
          $slice: [
            {
              $map: {
                input: {
                  $reduce: {
                    input: '$categories',
                    initialValue: [],
                    in: {
                      $cond: [
                        { $in: ['$$this', '$$value'] },
                        '$$value',
                        { $concatArrays: ['$$value', ['$$this']] }
                      ]
                    }
                  }
                },
                as: 'category',
                in: '$$category'
              }
            }, 10
          ]
        },
        recentSearches: { $slice: ['$recentSearches', -10] },
        avgResultsCount: { $round: ['$avgResultsCount', 1] }
      }
    }
  ]);

  return analytics[0] || {
    totalSearches: 0,
    topCategories: [],
    recentSearches: [],
    avgResultsCount: 0
  };
};

module.exports = mongoose.model('SearchHistory', searchHistorySchema); 