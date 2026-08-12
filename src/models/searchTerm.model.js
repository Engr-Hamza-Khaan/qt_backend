const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const SearchTerm = sequelize.define('SearchTerm', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  term: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  searchCount: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false
  },
  resultsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  isPinned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Admin pinned popular/trending search term'
  },
  lastSearchedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  indexes: [
    { fields: ['term'] },
    { fields: ['search_count'] },
    { fields: ['is_pinned'] },
    { fields: ['last_searched_at'] }
  ]
});

module.exports = SearchTerm;
