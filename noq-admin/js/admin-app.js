import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy
} from './firebase-init.js';

/* ---------- STATE ---------- */

const state = {
  currentAdmin: null,
  canteens: [],
  currentCanteenId: null,
  currentDishId: null,
  tempOwnerEmails: []
};

const analyticsState = {
  selectedCanteenId: '',
  selectedRange: 'today',
  transactions: []
};

/* ---------- UI ---------- */

const ui = {
  loginPage: document.getElementById('loginPage'),
  appPage: document.getElementById('appPage'),

  authError: document.getElementById('authError'),
  adminLoginBtn: document.getElementById('adminLoginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  adminEmail: document.getElementById('adminEmail'),

  navItems: document.querySelectorAll('.nav-item'),
  views: document.querySelectorAll('.view'),

  statOrdersToday: document.getElementById('statOrdersToday'),
  statActiveOrders: document.getElementById('statActiveOrders'),
  statTotalUsers: document.getElementById('statTotalUsers'),
  statTotalCanteens: document.getElementById('statTotalCanteens'),
  statDate: document.getElementById('statDate'),

  canteenList: document.getElementById('canteenList'),
  addCanteenBtn: document.getElementById('addCanteenBtn'),

  editorTitle: document.getElementById('editorTitle'),
  deleteCanteenBtn: document.getElementById('deleteCanteenBtn'),
  canteenName: document.getElementById('canteenName'),
  canteenImageUrl: document.getElementById('canteenImageUrl'),
  canteenLocation: document.getElementById('canteenLocation'),
  canteenOrderPrefix: document.getElementById('canteenOrderPrefix'), // ✅
  canteenFeatured: document.getElementById('canteenFeatured'),
  canteenIsOpen: document.getElementById('canteenIsOpen'),
  canteenAcceptingOrders: document.getElementById('canteenAcceptingOrders'),
  saveCanteenBtn: document.getElementById('saveCanteenBtn'),

  editOwnersBtn: document.getElementById('editOwnersBtn'),
  dishList: document.getElementById('dishList'),
  addDishBtn: document.getElementById('addDishBtn'),

  ownerModal: document.getElementById('ownerModal'),
  ownerEmailInput: document.getElementById('ownerEmailInput'),
  addOwnerEmailBtn: document.getElementById('addOwnerEmailBtn'),
  ownerEmailList: document.getElementById('ownerEmailList'),
  saveOwnersBtn: document.getElementById('saveOwnersBtn'),

  dishModal: document.getElementById('dishModal'),
  dishModalTitle: document.getElementById('dishModalTitle'),
  dishImageUrl: document.getElementById('dishImageUrl'),
  dishName: document.getElementById('dishName'),
  dishPrice: document.getElementById('dishPrice'),
  dishCategory: document.getElementById('dishCategory'),
  dishIsVeg: document.getElementById('dishIsVeg'),
  saveDishBtn: document.getElementById('saveDishBtn'),

  toast: document.getElementById('toast'),

  analyticsCanteenSelect: document.getElementById('analyticsCanteenSelect'),
  analyticsRangeSelect: document.getElementById('analyticsRangeSelect'),
  analyticsRefreshBtn: document.getElementById('analyticsRefreshBtn'),
  analyticsDeleteBtn: document.getElementById('analyticsDeleteBtn'),
  summaryOrders: document.getElementById('summaryOrders'),
  summaryRevenue: document.getElementById('summaryRevenue'),
  summaryAov: document.getElementById('summaryAov'),
  summaryTopDishes: document.getElementById('summaryTopDishes'),
  transactionsBody: document.getElementById('transactionsBody'),
  transactionsMeta: document.getElementById('transactionsMeta')
};

/* ---------- TOAST ---------- */

function showToast(message, isError = false) {
  ui.toast.textContent = message;
  ui.toast.classList.toggle('error', isError);
  ui.toast.classList.add('show');
  setTimeout(() => ui.toast.classList.remove('show'), 2600);
}

/* ---------- HELPERS ---------- */

function validateOrderPrefix(prefix) {
  if (!prefix) {
    showToast('Order prefix is required.', true);
    return null;
  }
  if (!/^[A-Z]{2,4}$/.test(prefix)) {
    showToast('Prefix must be 2–4 uppercase letters.', true);
    return null;
  }
  return prefix;
}

/* ---------- AUTH ---------- */

async function isAdminEmail(email) {
  const snap = await getDoc(doc(db, 'admins', email));
  return snap.exists();
}

function handleSignIn() {
  signInWithPopup(auth, googleProvider).catch(() => {
    ui.authError.textContent = 'Sign-in failed.';
  });
}

function handleSignOut() {
  signOut(auth);
}

/* ---------- CANTEENS ---------- */

async function saveCanteen() {
  const name = ui.canteenName.value.trim();
  const imageUrl = ui.canteenImageUrl.value.trim();
  const location = ui.canteenLocation.value.trim();

  const orderPrefix = validateOrderPrefix(
    ui.canteenOrderPrefix.value.trim().toUpperCase()
  );
  if (!orderPrefix) return;

  const isFeatured = ui.canteenFeatured.checked;
  const isOpen = ui.canteenIsOpen.checked;
  const acceptingOrders = ui.canteenAcceptingOrders.checked;

  try {
    if (state.currentCanteenId) {
      await updateDoc(doc(db, 'canteens', state.currentCanteenId), {
        name,
        imageUrl,
        location,
        orderPrefix,
        isFeatured,
        isOpen,
        acceptingOrders
      });
    } else {
      const ref = await addDoc(collection(db, 'canteens'), {
        name,
        imageUrl,
        location,
        orderPrefix,
        isFeatured,
        isOpen: true,
        acceptingOrders: true,
        owners: [],
        isDisabled: false
      });
      state.currentCanteenId = ref.id;
    }

    showToast('Canteen saved.');
  } catch (e) {
    console.error(e);
    showToast('Save failed.', true);
  }
}

/* ---------- INIT ---------- */

function initEvents() {
  ui.adminLoginBtn.addEventListener('click', handleSignIn);
  ui.logoutBtn.addEventListener('click', handleSignOut);
  ui.saveCanteenBtn.addEventListener('click', saveCanteen);
}

(function init() {
  initEvents();
})();
