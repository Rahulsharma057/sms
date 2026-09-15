require("dotenv").config();
const mongoose = require("mongoose");

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  const collection = mongoose.connection.collection("inspectionreports");

  // Find how many reports actually have the old singular `photo` field
  // so we know whether this migration is even needed.
  const affectedCount = await collection.countDocuments({
    "issues.photo.url": { $exists: true, $ne: "" },
  });
  console.log(`Found ${affectedCount} report(s) with old-style single "photo" fields.`);

  if (affectedCount === 0) {
    console.log("Nothing to migrate. Exiting.");
    await mongoose.disconnect();
    return;
  }

  const result = await collection.updateMany(
    { "issues.photo.url": { $exists: true, $ne: "" } },
    [
      {
        $set: {
          issues: {
            $map: {
              input: "$issues",
              as: "issue",
              in: {
                $mergeObjects: [
                  "$$issue",
                  {
                    photos: {
                      $cond: [
                        {
                          $and: [
                            { $ifNull: ["$$issue.photo.url", false] },
                            { $ne: ["$$issue.photo.url", ""] },
                          ],
                        },
                        {
                          $concatArrays: [
                            { $ifNull: ["$$issue.photos", []] },
                            [
                              {
                                url: "$$issue.photo.url",
                                publicId: { $ifNull: ["$$issue.photo.publicId", ""] },
                              },
                            ],
                          ],
                        },
                        { $ifNull: ["$$issue.photos", []] },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ],
  );

  console.log(`Migration complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});