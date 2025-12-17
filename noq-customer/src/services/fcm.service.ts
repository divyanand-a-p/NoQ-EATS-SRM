import { getMessaging, getToken } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, firebaseApp } from "../config/firebase";

let messaging: ReturnType<typeof getMessaging> | null = null;

export async function registerFCMToken() {
  if (!auth.currentUser) return;

  if (!messaging) {
    messaging = getMessaging(firebaseApp);
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
  });

  if (!token) return;

  await setDoc(
    doc(db, "users", auth.currentUser.uid),
    { fcmToken: token },
    { merge: true }
  );
}
