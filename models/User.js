const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  files: [{ type: mongoose.Schema.Types.ObjectId, ref: "File" }], // Array of file references
});

const User = mongoose.model("User", UserSchema);
module.exports = User;
