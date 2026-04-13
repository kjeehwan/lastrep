const fs = require("fs");

if (!process.env.GOOGLE_SERVICES_JSON) {
  console.error("GOOGLE_SERVICES_JSON env variable is missing");
  process.exit(1);
}

fs.writeFileSync(
  "google-services.json",
  process.env.GOOGLE_SERVICES_JSON,
  "utf8"
);

console.log("google-services.json created");