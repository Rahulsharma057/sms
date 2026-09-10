const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// Upload buffer to Cloudinary
// resourceType:
// image = photos
// video = audio/voice notes
const uploadBufferToCloudinary = (
  buffer,
  { folder, resourceType = "image" }
) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// Delete file from Cloudinary
const deleteFromCloudinary = async (
  publicId,
  resourceType = "image"
) => {
  if (!publicId) return null;

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    console.log(
      `Cloudinary delete: ${publicId} -> ${result.result}`
    );

    return result;
  } catch (error) {
    console.error(
      `Cloudinary delete failed for ${publicId}:`,
      error.message
    );

    // Don't throw.
    // MongoDB report deletion should still continue.
    return null;
  }
};

module.exports = {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
};