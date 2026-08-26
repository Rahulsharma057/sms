// Creates the first Superadmin account. Run: npm run seed
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const email = process.argv[2] || "admin@school.com";
  const password = process.argv[3] || "Admin@123";
  const name = process.argv[4] || "Super Admin";

  const existing = await User.findOne({ email });
  if (existing) {
    console.log("A user with this email already exists:", email);
    process.exit(0);
  }

  await User.create({ name, email, password, role: "superadmin" });
  console.log("Superadmin created:");
  console.log("  Email:", email);
  console.log("  Password:", password);
  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
