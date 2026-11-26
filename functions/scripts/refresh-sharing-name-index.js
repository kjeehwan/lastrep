// Run build first. Uses operator credentials; never prints directory identities.
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {refreshSharingNameIndex} = require("../lib/sharingSearchMigration");
const args = process.argv.slice(2);
const projectId = args.find(arg => arg.startsWith("--project="))?.slice(10);
if (!projectId || !(projectId === "lastrep-ebac5" || projectId.startsWith("demo-"))) throw Error("Explicit Lastrep or demo project required");
initializeApp({projectId});
refreshSharingNameIndex(getFirestore(), args.includes("--apply"))
  .then(counts => console.log(JSON.stringify({projectId, mode:args.includes("--apply")?"apply":"dry-run",...counts})))
  .catch(error => {console.error(error.message);process.exitCode=1;});
