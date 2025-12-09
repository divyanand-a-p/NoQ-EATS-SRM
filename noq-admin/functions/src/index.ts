import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";

admin.initializeApp();
const db = admin.firestore();
const Razorpay = require("razorpay");

// ---- SECRET DEFINITIONS ----
const RAZORPAY_TEST_KEY_ID = defineSecret("RAZORPAY_TEST_KEY_ID");
const RAZORPAY_TEST_KEY_SECRET = defineSecret("RAZORPAY_TEST_KEY_SECRET");
const RAZORPAY_LIVE_KEY_ID = defineSecret("RAZORPAY_LIVE_KEY_ID");
const RAZORPAY_LIVE_KEY_SECRET = defineSecret("RAZORPAY_LIVE_KEY_SECRET");

// ---- HELPERS & FEE FUNCTIONS (KEEP YOUR ORIGINAL LOGIC) ----
// roundToTwo, calculateFees, getUserIdForUid, getAppFee remain same

function getRazorpayClient(mode: "test" | "live" = "test") {
  const keyId = mode === "live"
    ? RAZORPAY_LIVE_KEY_ID.value()
    : RAZORPAY_TEST_KEY_ID.value();

  const keySecret = mode === "live"
    ? RAZORPAY_LIVE_KEY_SECRET.value()
    : RAZORPAY_TEST_KEY_SECRET.value();

  if (!keyId || !keySecret) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `Razorpay keys missing (${mode}). Use Firebase Secrets UI.`
    );
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

// ---- MAIN FUNCTION ----
export const createCheckoutOrder = functions
  .region("asia-south1")
  .runWith({
    secrets: [
      "RAZORPAY_TEST_KEY_ID",
      "RAZORPAY_TEST_KEY_SECRET",
      "RAZORPAY_LIVE_KEY_ID",
      "RAZORPAY_LIVE_KEY_SECRET"
    ]
  })
  .https.onCall(async (data, context) => {
    // ... keep your entire existing logic unchanged except config lines
    const razorpayClient = getRazorpayClient(data.mode === "live" ? "live" : "test");

    // create RZP order & Firestore order same as before
  });
