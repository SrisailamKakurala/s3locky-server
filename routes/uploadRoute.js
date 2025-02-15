const express = require("express");
const AWS = require("aws-sdk");
const File = require("../models/File");
const User = require("../models/User");
const mongoose = require("mongoose");
const {s3} = require("../aws.config");
require("dotenv").config();

const router = express.Router();



// 📌 Route: Get Pre-Signed URL
router.get("/get-presigned-url", async (req, res) => {
  try {
    const { filename, fileType, userId } = req.query;

    if (!filename || !fileType || !userId) {
      return res.status(400).json({ message: "Missing parameters" });
    }

    const fileKey = `uploads/${Date.now()}_${filename}`;

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
      ContentType: fileType,
      Expires: 60*15, // URL expires in 15 minutes
    };

    console.log("AWS S3 Params:", params); // Debugging

    const presignedUrl = await s3.getSignedUrlPromise("putObject", params);

    res.json({ presignedUrl, fileKey });
  } catch (error) {
    console.error("Error generating pre-signed URL:", error);
    res.status(500).json({ message: "Failed to generate URL", error });
  }
});

// 📌 Route: Save File Metadata After Upload
router.post("/save-file", async (req, res) => {
  try {
    const { filename, fileType, fileKey, size, userId } = req.body;

    if (!filename || !fileType || !fileKey || !size || !userId) {
      return res.status(400).json({ message: "Missing parameters" });
    }

    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;

    // Check if file already exists
    const existingFile = await File.findOne({ downloadUrl: fileUrl });

    if (existingFile) {
      return res.status(400).json({ message: "File already exists in the system." });
    }

    // Transaction to prevent partial failures
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const newFile = new File({
        filename,
        type: fileType,
        extension: filename.split(".").pop(),
        fileKey,
        downloadUrl: fileUrl,
        size,
        uploadedBy: userId,
      });

      await newFile.save({ session });
      await User.findByIdAndUpdate(userId, { $push: { files: newFile._id } }, { session });

      await session.commitTransaction();
      session.endSession();

      res.json({ message: "File metadata saved", file: newFile });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error saving file:", error);
      res.status(500).json({ message: "Failed to save file" });
    }
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
