const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Page = sequelize.define('Page', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Published'),
    defaultValue: 'Draft',
    allowNull: false
  },
  isSystemPage: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'If true, prevents deletion of core pages'
  }
});

module.exports = Page;
