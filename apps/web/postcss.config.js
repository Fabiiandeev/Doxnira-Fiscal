const path = require("node:path");

const config = {
  plugins: {
    tailwindcss: {
      config: path.join(__dirname, "tailwind.config.js"),
    },
    autoprefixer: {},
  },
};

module.exports = config;
