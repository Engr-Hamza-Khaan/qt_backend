const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const WebsiteSetting = sequelize.define('WebsiteSetting', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'e.g. homepage_banners, notification_bar, footer_content'
  },
  value: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'JSON payload containing specific settings content'
  }
});

module.exports = WebsiteSetting;
