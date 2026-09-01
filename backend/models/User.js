
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["teacher", "superadmin"],
      default: "teacher",
    },

    centre: {
      type: String,
      default: "",
    },

    active: {
      type: Boolean,
      default: true,
    },

    // ==========================================
    // WEB PUSH SUBSCRIPTION
    // ==========================================
    pushSubscription: {
      endpoint: {
        type: String,
        default: null,
      },

      keys: {
        p256dh: {
          type: String,
          default: null,
        },

        auth: {
          type: String,
          default: null,
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);

  next();
});

userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("User", userSchema);

