const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  filename: String,
  type: String,
  extension: String,
  fileKey: { type: String, required: true },
  downloadUrl: String,
  size: Number,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("File", fileSchema);
