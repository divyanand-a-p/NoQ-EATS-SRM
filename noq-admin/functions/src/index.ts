// ─────────────────────────────────────────
// 1️⃣ IMPORTS (ALL AT TOP)
// ─────────────────────────────────────────
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";


admin.initializeApp();
const db = admin.firestore();

const Razorpay = require("razorpay");

// ─────────────────────────────────────────
// 2️⃣ SECRETS
// ─────────────────────────────────────────
const RZP_TEST_KEY_ID = defineSecret("RAZORPAY_TEST_KEY_ID");
const RZP_TEST_KEY_SECRET = defineSecret("RAZORPAY_TEST_KEY_SECRET");
const RZP_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");

// ─────────────────────────────────────────
// 3️⃣ RAZORPAY CLIENT
// ─────────────────────────────────────────
function getRazorpayClient() {
  return new Razorpay({
    key_id: RZP_TEST_KEY_ID.value(),
    key_secret: RZP_TEST_KEY_SECRET.value(),
  });
}

// ─────────────────────────────────────────
// 4️⃣ FEES LOGIC
// ─────────────────────────────────────────
function getAppFee(itemsTotal: number): number {
  if (itemsTotal < 130) return 2;
  if (itemsTotal < 200) return 4;
  if (itemsTotal < 300) return 5;
  if (itemsTotal < 550) return 6;
  return 10;
}

function calculateFees(itemsTotal: number) {
  const gatewayFeeBase = itemsTotal * 0.02;
  const gatewayGst = gatewayFeeBase * 0.18;
  const backendFee = Math.ceil(itemsTotal * 0.005);
  const appFee = getAppFee(itemsTotal);

  const total =
    itemsTotal + gatewayFeeBase + gatewayGst + backendFee + appFee;

  return {
    gatewayFeeBase,
    gatewayGst,
    backendFee,
    appFee,
    finalPayable: Math.ceil(total),
  };
}

// ─────────────────────────────────────────
// 5️⃣ CREATE CHECKOUT ORDER
// ─────────────────────────────────────────
export const createCheckoutOrder = onCall(
  {
    region: "asia-south1",
    secrets: [RZP_TEST_KEY_ID, RZP_TEST_KEY_SECRET],
  },
  async ({ auth, data }) => {
    if (!auth) {
      throw new HttpsError("unauthenticated", "Login required");
    }

    const { items, eatingMode } = data;

    if (!Array.isArray(items) || items.length === 0) {
      throw new HttpsError("invalid-argument", "Cart empty");
    }

    let itemsTotal = 0;
    const ordersByCanteen: Record<string, any[]> = {};

    for (const item of items) {
      const dishSnap = await db.collection("dishes").doc(item.dishId).get();

      if (!dishSnap.exists) {
        throw new HttpsError("not-found", "Dish not found");
      }

      const dish = dishSnap.data()!;
      if (!dish.isAvailable) {
        throw new HttpsError(
          "failed-precondition",
          `${dish.name} unavailable`
        );
      }

      const price = dish.price;
      const qty = item.quantity;

      itemsTotal += price * qty;

      if (!ordersByCanteen[dish.canteenId]) {
        ordersByCanteen[dish.canteenId] = [];
      }

      ordersByCanteen[dish.canteenId].push({
        dishId: item.dishId,
        name: dish.name,
        price,
        quantity: qty,
        notes: item.notes || "",
        isVeg: dish.isVeg,
      });
    }

    if (itemsTotal >= 1000) {
      throw new HttpsError(
        "failed-precondition",
        "Items total exceeds ₹1000"
      );
    }

    const fees = calculateFees(itemsTotal);

    const razorpay = getRazorpayClient();
    const rzpOrder = await razorpay.orders.create({
      amount: fees.finalPayable * 100, // paise
      currency: "INR",
      receipt: `noq_${Date.now()}`,
    });

    const batch = db.batch();
    const createdAt = admin.firestore.FieldValue.serverTimestamp();
    const expiry = Date.now() + 10 * 60 * 1000;

    for (const canteenId of Object.keys(ordersByCanteen)) {
      const ref = db.collection("orders").doc();
      batch.set(ref, {
        uid: auth.uid,
        canteenId,
        items: ordersByCanteen[canteenId],
        itemsTotal,
        fees,
        eatingMode,
        status: "PendingPayment",
        razorpayOrderId: rzpOrder.id,
        expiresAt: expiry,
        createdAt,
        deleted: false,
      });
    }

    await batch.commit();

    return {
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: "INR",
      key: RZP_TEST_KEY_ID.value(),
    };
  }
);

// ─────────────────────────────────────────
// 6️⃣ CLEANUP UNPAID ORDERS
// ─────────────────────────────────────────
export const cleanupUnpaidOrders = onSchedule(
  {
    region: "asia-south1",
    schedule: "every 5 minutes",
  },
  async () => {
    const now = Date.now();
    const snap = await db
      .collection("orders")
      .where("status", "==", "PendingPayment")
      .where("expiresAt", "<=", now)
      .get();

    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
);

// ─────────────────────────────────────────
// 7️⃣ RAZORPAY WEBHOOK 
// ─────────────────────────────────────────
export const razorpayWebhook = onRequest(
  {
    region: "asia-south1",
    secrets: [RZP_WEBHOOK_SECRET],
  },
  async (req, res): Promise<void> => {
    try {
      // Firebase v2 gives raw body as Buffer automatically
      const signature = req.headers["x-razorpay-signature"] as string;

      if (!signature) {
        res.status(400).send("Missing signature");
        return;
      }

      const rawBody = (req as any).rawBody as Buffer;

      if (!rawBody) {
        res.status(400).send("Missing raw body");
        return;
      }

      const expectedSignature = crypto
        .createHmac("sha256", RZP_WEBHOOK_SECRET.value())
        .update(rawBody)
        .digest("hex");

      if (signature !== expectedSignature) {
        res.status(401).send("Invalid signature");
        return;
      }

      const event = JSON.parse(rawBody.toString());

      if (event.event === "payment.captured") {
        const payment = event.payload.payment.entity;
        const razorpayOrderId = payment.order_id;

        const snap = await db
          .collection("orders")
          .where("razorpayOrderId", "==", razorpayOrderId)
          .where("status", "==", "PendingPayment")
          .get();

        const batch = db.batch();
        snap.docs.forEach(doc => {
          batch.update(doc.ref, {
            status: "Paid",
            paymentId: payment.id,
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        await batch.commit();
      }

      res.status(200).send("OK");
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).send("Webhook error");
    }
  }

  const messaging = admin.messaging();

export const notifyOrderReady = onDocumentUpdated(
  {
    region: "asia-south1",
    document: "orders/{orderId}",
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // 🔒 Trigger ONLY on transition → Ready
    if (before.status === "Ready" || after.status !== "Ready") return;

    const uid = after.uid;
    if (!uid) return;

    const userSnap = await admin.firestore().collection("users").doc(uid).get();
    if (!userSnap.exists) return;

    const token = userSnap.data()?.fcmToken;
    if (!token) return;

    await messaging.send({
      token,
      notification: {
        title: "Order Ready 🍔",
        body: `Your order ${after.userId} is ready for pickup`,
      },
      data: {
        orderId: event.params.orderId,
        canteenId: after.canteenId,
      },
    });
    export const createOrderWithId = onCall(
  { region: "asia-south1" },
  async (request) => {
    const { canteenId, customerEmail, amount } = request.data;

    if (!canteenId || !customerEmail || !amount) {
      throw new HttpsError(
        "invalid-argument",
        "canteenId, customerEmail, and amount are required"
      );
    }

    const canteenRef = db.collection("canteens").doc(canteenId);
    const ordersRef = db.collection("orders");

    return await db.runTransaction(async (tx) => {
      const canteenSnap = await tx.get(canteenRef);

      if (!canteenSnap.exists) {
        throw new HttpsError("not-found", "Canteen not found");
      }

      const canteen = canteenSnap.data()!;
      const prefix = canteen.orderPrefix;

      if (!prefix) {
        throw new HttpsError(
          "failed-precondition",
          "Canteen orderPrefix not set"
        );
      }

      const currentCounter = canteen.orderCounter || 0;
      const nextCounter = currentCounter + 1;

      const padded = String(nextCounter).padStart(4, "0");
      const orderId = `${prefix}-${padded}`;

      const newOrderRef = ordersRef.doc();

      tx.set(newOrderRef, {
        orderId,
        canteenId,
        customerEmail,
        amount,
        status: "PAID",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      tx.update(canteenRef, {
        orderCounter: nextCounter
      });

      return {
        firestoreOrderId: newOrderRef.id,
        orderId
      };
    });
  }
);
