const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const ChatConversation = sequelize.define('ChatConversation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  customerSessionId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  customerEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  messages: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    comment: 'Array of message items: { sender: "bot|customer|agent", text: String, timestamp: Date }'
  },
  status: {
    type: DataTypes.ENUM('Open', 'Closed'),
    defaultValue: 'Open',
    allowNull: false
  },
  assignedTo: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'References the User ID of the support staff/admin'
  }
});

module.exports = ChatConversation;
