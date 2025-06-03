const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { r2Client, bucketName } = require('../config/r2');
const crypto = require('crypto');

const generateSignedUrls = async (req, res) => {
  try {
    const { count = 1 } = req.body;

    if (count > 10) {
      return res.status(400).json({ error: 'Maximum 10 images allowed' });
    }

    const signedUrls = [];

    for (let i = 0; i < count; i++) {
      const fileName = `${crypto.randomUUID()}-${Date.now()}.jpg`;
      const key = `public-images/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: 'image/jpeg',
      });

      const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 60 * 5 });
      const publicUrl = `https://pub-daf23a29f3b545799eae97159a0b83d6.r2.dev/${key}`;

      signedUrls.push({
        uploadUrl: signedUrl,
        publicUrl: publicUrl,
        fileName: fileName,
        key: key
      });
    }

    res.json({
      success: true,
      signedUrls: signedUrls
    });
  } catch (error) {
    console.error('Error generating signed URLs:', error);
    res.status(500).json({ error: 'Failed to generate signed URLs' });
  }
};

const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadPromises = req.files.map(async (file) => {
      const fileName = `${crypto.randomUUID()}-${Date.now()}.${file.originalname.split('.').pop()}`;
      const key = `public-images/${fileName}`;
      
      const uploadParams = {
        Bucket: bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      await r2Client.send(new PutObjectCommand(uploadParams));
      
      return `https://pub-${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.dev/${key}`;
    });

    const imageUrls = await Promise.all(uploadPromises);

    res.json({
      success: true,
      imageUrls: imageUrls
    });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
};

module.exports = {
  generateSignedUrls,
  uploadImages
}; 