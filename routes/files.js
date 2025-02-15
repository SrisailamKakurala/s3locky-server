const express = require("express");
const File = require("../models/File");
const router = express.Router();
const { s3 } = require("../aws.config");
require("dotenv").config();

// 📌 Get all files for a specific user with Pre-Signed URLs
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const files = await File.find({ uploadedBy: userId }).sort({ createdAt: -1 });

    // Generate pre-signed URLs
    const filesWithSignedUrls = await Promise.all(
      files.map(async (file) => {
        if (!file.fileKey) {
          console.warn(`File missing fileKey: ${file.filename}`);
          return { ...file._doc, signedUrl: null };
        }

        const params = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: file.fileKey,
          Expires: 60, // URL valid for 60 seconds
        };

        try {
          const signedUrl = await s3.getSignedUrlPromise("getObject", params);
          return { ...file._doc, signedUrl };
        } catch (error) {
          console.error("Error generating pre-signed URL:", error);
          return { ...file._doc, signedUrl: null };
        }
      })
    );

    res.json(filesWithSignedUrls);
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({ message: "Failed to fetch files" });
  }
});

// 📌 Delete File from S3 & Database
router.delete("/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const file = await File.findById(fileId);

    if (!file) return res.status(404).json({ message: "File not found" });

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: file.fileKey,
    };

    await s3.deleteObject(params).promise();
    await File.findByIdAndDelete(fileId);

    res.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ message: "Failed to delete file" });
  }
});

module.exports = router;
