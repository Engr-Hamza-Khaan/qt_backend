const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  parentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'categories',
      key: 'id'
    },
    onDelete: 'SET NULL'
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'e.g. PlayStation, Xbox, Nintendo, PC'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

module.exports = Category;
