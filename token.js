const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const TokenSchema = new Schema({
  id: ObjectId,
  accessToken: String,
  refreshToken: String
});

module.exports = mongoose.model('Token', TokenSchema);