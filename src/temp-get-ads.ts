import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

async function run() {
  try {
    console.log("Fetching ads from Firestore database...");
    const colRef = collection(db, "ads");
    const snapshot = await getDocs(colRef);
    console.log(`Found ${snapshot.size} ads:`);
    snapshot.forEach((doc) => {
      console.log(`\n=== DOCUMENT ID: ${doc.id} ===`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
  } catch (err) {
    console.error("Error reading ads collection:", err);
  }
}

run();
