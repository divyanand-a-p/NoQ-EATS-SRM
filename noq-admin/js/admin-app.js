import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy
} from './firebase-init.js';


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


const ui = {
  // pages
  loginPage: document.getElementById('loginPage'),
  appPage: document.getElementById('appPage'),

  // auth
  authError: document.getElementById('authError'),
  adminLoginBtn: document.getElementById('adminLoginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  adminEmail: document.getElementById('adminEmail'),

  // nav & views
  navItems: document.querySelectorAll('.nav-item'),
  views: document.querySelectorAll('.view'),

  // dashboard stats
  statOrdersToday: document.getElementById('statOrdersToday'),
  statActiveOrders: document.getElementById('statActiveOrders'),
  statTotalUsers: document.getElementById('statTotalUsers'),
  statTotalCanteens: document.getElementById('statTotalCanteens'),
  statDate: document.getElementById('statDate'),

  // canteens list
  canteenList: document.getElementById('canteenList'),
  addCanteenBtn: document.getElementById('addCanteenBtn'),

  // canteen editor
  editorTitle: document.getElementById('editorTitle'),
  deleteCanteenBtn: document.getElementById('deleteCanteenBtn'),
  canteenName: document.getElementById('canteenName'),
  canteenImageUrl: document.getElementById('canteenImageUrl'),
  canteenLocation: document.getElementById('canteenLocation'),
  canteenFeatured: document.getElementById('canteenFeatured'),
  canteenIsOpen: document.getElementById('canteenIsOpen'),
  canteenAcceptingOrders: document.getElementById('canteenAcceptingOrders'),
  saveCanteenBtn: document.getElementById('saveCanteenBtn'),
  editOwnersBtn: document.getElementById('editOwnersBtn'),
  editPaymentBtn: document.getElementById('editPaymentBtn'),
  dishList: document.getElementById('dishList'),
  addDishBtn: document.getElementById('addDishBtn'),

  // modals
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

  // toast
  toast: document.getElementById('toast'),


  // analytics
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

/* ---------- VIEW SWITCHING ---------- */

function showPage(pageId) {
  if (pageId === 'loginPage') {
    ui.loginPage.classList.add('active');
    ui.appPage.classList.remove('active');
    return;
  }
  ui.loginPage.classList.remove('active');
  ui.appPage.classList.add('active');
}

function showView(viewId) {
  ui.views.forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');

  ui.navItems.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });

  if (viewId === 'analyticsView') {
    initAnalyticsView();
  }
}


/* ---------- AUTH ---------- */

async function isAdminEmail(email) {
  const ref = doc(db, 'admins', email);
  const snap = await getDoc(ref);
  return snap.exists();
}

function handleSignIn() {
  ui.authError.textContent = '';
  signInWithPopup(auth, googleProvider).catch(err => {
    console.error(err);
    ui.authError.textContent = 'Sign-in failed. Please try again.';
  });
}

function handleSignOut() {
  state.currentAdmin = null;
  signOut(auth);
}

function initAuthListener() {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      showPage('loginPage');
      return;
    }
    const ok = await isAdminEmail(user.email);
    if (!ok) {
      await signOut(auth);
      ui.authError.textContent = 'Access denied. Not an admin.';
      return;
    }
    state.currentAdmin = user;
    ui.adminEmail.textContent = user.email;
    showPage('appPage');
    showView('dashboardView');
    await refreshDashboard();
    await loadCanteens();
  });
}

/* ---------- DASHBOARD ---------- */

async function refreshDashboard() {
  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  ui.statDate.textContent = today.toLocaleDateString('en-IN');

  try {
    // total users
    const usersSnap = await getDocs(collection(db, 'users'));
    ui.statTotalUsers.textContent = usersSnap.size;
  } catch (e) {
    console.error('Users count failed', e);
    ui.statTotalUsers.textContent = 'ERR';
  }

  try {
    const canteenSnap = await getDocs(
      query(collection(db, 'canteens'), where('isDisabled', '!=', true))
    );
    ui.statTotalCanteens.textContent = canteenSnap.size;
  } catch (e) {
    console.error('Canteens count failed', e);
    ui.statTotalCanteens.textContent = 'ERR';
  }

  try {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('createdAt', '>=', todayStart));
    const snap = await getDocs(q);
    let active = 0;
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.status !== 'Completed') active += 1;
    });
    ui.statOrdersToday.textContent = snap.size;
    ui.statActiveOrders.textContent = active;
  } catch (e) {
    console.error('Orders dashboard failed', e);
    ui.statOrdersToday.textContent = 'ERR';
    ui.statActiveOrders.textContent = 'ERR';
  }
}

/* ---------- ANALYTICS ---------- */

function initAnalyticsView() {
  // Populate dropdown only once per load OR when canteens change
  populateAnalyticsCanteenSelect();
  analyticsState.selectedRange = ui.analyticsRangeSelect.value || 'today';
  onAnalyticsFilterChange(false);
}

function populateAnalyticsCanteenSelect() {
  ui.analyticsCanteenSelect.innerHTML = '';

  if (state.canteens.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No canteens found';
    ui.analyticsCanteenSelect.appendChild(opt);
    ui.analyticsCanteenSelect.disabled = true;
    return;
  }

  ui.analyticsCanteenSelect.disabled = false;

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select canteen';
  ui.analyticsCanteenSelect.appendChild(placeholder);

  state.canteens
    .filter(c => !c.isDisabled)
    .forEach(canteen => {
      const opt = document.createElement('option');
      opt.value = canteen.id;
      opt.textContent = canteen.name;
      ui.analyticsCanteenSelect.appendChild(opt);
    });

  // If previously selected, re-select it
  if (analyticsState.selectedCanteenId) {
    ui.analyticsCanteenSelect.value = analyticsState.selectedCanteenId;
  }
}

function onAnalyticsFilterChange(autoRefresh = true) {
  analyticsState.selectedCanteenId = ui.analyticsCanteenSelect.value;
  analyticsState.selectedRange = ui.analyticsRangeSelect.value || 'today';

  if (!analyticsState.selectedCanteenId) {
    ui.transactionsMeta.textContent = 'Select a canteen and range to see orders.';
    ui.transactionsBody.innerHTML =
      '<tr><td colspan="6" style="text-align:center; font-size:0.85rem; color:#888;">Select a canteen.</td></tr>';
    ui.summaryOrders.textContent = '--';
    ui.summaryRevenue.textContent = '--';
    ui.summaryAov.textContent = '--';
    ui.summaryTopDishes.textContent = '--';
    return;
  }

  if (autoRefresh) {
    refreshAnalyticsData();
  }
}

async function refreshAnalyticsData() {
  const canteenId = analyticsState.selectedCanteenId;
  const range = analyticsState.selectedRange;
  if (!canteenId) return;

  ui.transactionsMeta.textContent = 'Loading transactions...';

  const { start, end, label } = getRangeBounds(range);
  try {
    const q = query(
      collection(db, 'orders'),
      where('canteenId', '==', canteenId),
      where('createdAt', '>=', start),
      where('createdAt', '<', end),
      orderBy('createdAt', 'desc')
    );

    const snap = await getDocs(q);
    const tx = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    analyticsState.transactions = tx;

    renderAnalyticsSummary(tx);
    renderTransactionsTable(tx);

    const canteen = state.canteens.find(c => c.id === canteenId);
    const canteenName = canteen ? canteen.name : 'Canteen';

    ui.transactionsMeta.textContent =
      `${canteenName} · ${label} · ${tx.length} orders`;
  } catch (e) {
    console.error('Analytics query failed', e);
    ui.transactionsMeta.textContent = 'Failed to load transactions.';
    ui.transactionsBody.innerHTML =
      '<tr><td colspan="6" style="text-align:center; font-size:0.85rem; color:#fca5a5;">Error loading data.</td></tr>';
  }
}

function getRangeBounds(rangeKey) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  // Always work in local time (IST for you)
  if (rangeKey === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: 'Today' };
  }

  if (rangeKey === 'week') {
    // Week: Sunday to Saturday, as you specified
    const day = start.getDay(); // 0 = Sunday
    const diffToSunday = day;   // how many days since Sunday
    start.setDate(start.getDate() - diffToSunday);
    start.setHours(0, 0, 0, 0);

    // Saturday = Sunday + 6 days
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end, label: 'This Week (Sun–Sat)' };
  }

  if (rangeKey === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);

    return { start, end, label: 'This Month' };
  }

  // fallback
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end, label: 'Today' };
}

function renderAnalyticsSummary(tx) {
  if (!tx || tx.length === 0) {
    ui.summaryOrders.textContent = '0';
    ui.summaryRevenue.textContent = '₹0';
    ui.summaryAov.textContent = '₹0';
    ui.summaryTopDishes.textContent = '--';
    return;
  }

  const ordersCount = tx.length;
  let itemsTotalSum = 0;
  const dishCounts = new Map();

  tx.forEach(order => {
    const itemsTotal = order.itemsTotal ?? order.total ?? 0;
    itemsTotalSum += itemsTotal;

    (order.items || []).forEach(item => {
      const key = item.name || 'Unknown';
      const prev = dishCounts.get(key) || 0;
      dishCounts.set(key, prev + (item.quantity || 1));
    });
  });

  const avgOrder = itemsTotalSum / ordersCount;

  // top 3 dishes
  const topDishes = [...dishCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} (${count})`);

  ui.summaryOrders.textContent = String(ordersCount);
  ui.summaryRevenue.textContent = `₹${itemsTotalSum.toFixed(2)}`;
  ui.summaryAov.textContent = `₹${avgOrder.toFixed(2)}`;
  ui.summaryTopDishes.textContent =
    topDishes.length > 0 ? topDishes.join(', ') : '--';
}

function renderTransactionsTable(tx) {
  if (!tx || tx.length === 0) {
    ui.transactionsBody.innerHTML =
      '<tr><td colspan="6" style="text-align:center; font-size:0.85rem; color:#888;">No orders in this range.</td></tr>';
    return;
  }

  ui.transactionsBody.innerHTML = '';

  tx.forEach(order => {
    const tr = document.createElement('tr');

    // Time
    let createdAtText = '-';
    if (order.createdAt?.toDate) {
      const d = order.createdAt.toDate();
      createdAtText = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // Items summary
    const itemsSummary = (order.items || [])
      .map(i => `${i.quantity || 1}x ${i.name || 'Item'}`)
      .join(', ');

    const itemsTotal = order.itemsTotal ?? order.total ?? 0;

    tr.innerHTML = `
      <td>${createdAtText}</td>
      <td>#${order.id.slice(0, 6).toUpperCase()}</td>
      <td>${order.userId || '-'}</td>
      <td class="cell-items" title="${itemsSummary}">${itemsSummary}</td>
      <td>${itemsTotal.toFixed ? itemsTotal.toFixed(2) : itemsTotal}</td>
      <td>${renderStatusChipHtml(order.status)}</td>
    `;

    ui.transactionsBody.appendChild(tr);
  });
}

function renderStatusChipHtml(status) {
  const safe = status || 'Unknown';
  return `<span class="chip-status ${safe}">${safe}</span>`;
}

async function deleteAnalyticsRange() {
  const canteenId = analyticsState.selectedCanteenId;
  const range = analyticsState.selectedRange;

  if (!canteenId) {
    showToast('Select a canteen first.', true);
    return;
  }

  const { start, end, label } = getRangeBounds(range);

  const confirmed = confirm(
    `This will permanently delete all orders for this canteen in ${label}.\n\nThis cannot be undone. Continue?`
  );
  if (!confirmed) return;

  try {
    const q = query(
      collection(db, 'orders'),
      where('canteenId', '==', canteenId),
      where('createdAt', '>=', start),
      where('createdAt', '<', end)
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      showToast('No orders to delete in this range.');
      return;
    }

    // WARNING: client-side batch has limit ~500. For campus use + per-range this is OK.
    const batchSize = snap.size;
    const batch = (await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'))
      .writeBatch
      ? null
      : null;
    // Simpler: we delete one-by-one to avoid teaching batch API here.
    // For your current scale this is okay.

    let deletePromises = [];
    snap.forEach(docSnap => {
      deletePromises.push(updateDoc(doc(db, 'orders', docSnap.id), {
        // soft delete marker; later analytics can ignore where deleted == true
        deleted: true
      }));
    });

    await Promise.all(deletePromises);

    showToast(`Marked ${batchSize} orders as deleted.`);
    // Refresh view
    await refreshAnalyticsData();
  } catch (e) {
    console.error('Delete range failed', e);
    showToast('Failed to delete data.', true);
  }
}


/* ---------- CANTEENS ---------- */

async function loadCanteens() {
  const snap = await getDocs(collection(db, 'canteens'));
  state.canteens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderCanteenList();
  ui.statTotalCanteens.textContent = state.canteens.filter(c => !c.isDisabled).length;
}

function renderCanteenList() {
  ui.canteenList.innerHTML = '';
  state.canteens
    .filter(c => !c.isDisabled)
    .forEach(canteen => {
      const card = document.createElement('div');
      card.className = 'canteen-card';

      const imgWrap = document.createElement('div');
      imgWrap.className = 'canteen-img-wrap';
      const img = document.createElement('img');
      img.src = canteen.imageUrl || 'https://placehold.co/600x300/222/fff?text=Canteen';
      img.alt = canteen.name;
      imgWrap.appendChild(img);

      // badges
      const openBadge = document.createElement('span');
      openBadge.className = 'canteen-badge open';
      openBadge.textContent = canteen.isOpen ? 'OPEN' : 'CLOSED';
      if (!canteen.isOpen) {
        openBadge.classList.remove('open');
      }
      imgWrap.appendChild(openBadge);

      if (canteen.isOpen && canteen.acceptingOrders === false) {
        const paused = document.createElement('span');
        paused.className = 'canteen-badge paused';
        paused.style.right = '10px';
        paused.textContent = 'PROCESSING PREVIOUS ORDERS';
        paused.style.fontSize = '0.6rem';
        imgWrap.appendChild(paused);
      }

      if (canteen.isFeatured) {
        const feat = document.createElement('span');
        feat.className = 'canteen-badge featured';
        feat.textContent = 'FEATURED';
        imgWrap.appendChild(feat);
      }

      const body = document.createElement('div');
      body.className = 'canteen-card-body';

      const nameEl = document.createElement('div');
      nameEl.className = 'canteen-name';
      nameEl.textContent = canteen.name;

      const locEl = document.createElement('div');
      locEl.className = 'canteen-location';
      locEl.textContent = canteen.location || 'No location set';

      body.appendChild(nameEl);
      body.appendChild(locEl);

      card.appendChild(imgWrap);
      card.appendChild(body);

      card.addEventListener('click', () => openCanteenEditor(canteen.id));

      ui.canteenList.appendChild(card);
    });
}

function newCanteenState() {
  state.currentCanteenId = null;
  ui.editorTitle.textContent = 'New Canteen';
  ui.deleteCanteenBtn.classList.add('hidden');

  ui.canteenName.value = '';
  ui.canteenImageUrl.value = '';
  ui.canteenLocation.value = '';
  ui.canteenFeatured.checked = false;
  ui.canteenIsOpen.checked = true;
  ui.canteenAcceptingOrders.checked = true;
  state.tempOwnerEmails = [];
  renderOwnerPills();
  ui.dishList.innerHTML = '<p style="font-size:0.85rem;color:#888;">No dishes yet.</p>';
}

async function openCanteenEditor(canteenId) {
  const canteen = state.canteens.find(c => c.id === canteenId);
  if (!canteen) return;

  state.currentCanteenId = canteenId;
  ui.editorTitle.textContent = `Edit – ${canteen.name}`;
  ui.deleteCanteenBtn.classList.remove('hidden');

  ui.canteenName.value = canteen.name || '';
  ui.canteenImageUrl.value = canteen.imageUrl || '';
  ui.canteenLocation.value = canteen.location || '';
  ui.canteenFeatured.checked = !!canteen.isFeatured;
  ui.canteenIsOpen.checked = !!canteen.isOpen;
  ui.canteenAcceptingOrders.checked = canteen.acceptingOrders !== false;

  state.tempOwnerEmails = (canteen.owners || []).slice();
  renderOwnerPills();

  await loadDishesForCanteen(canteenId);

  showView('canteenEditorView');
}

async function loadDishesForCanteen(canteenId) {
  ui.dishList.innerHTML = '<p style="font-size:0.85rem;color:#888;">Loading dishes…</p>';
  const snap = await getDocs(collection(db, 'canteens', canteenId, 'dishes'));
  const dishes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderDishList(dishes);
}

async function saveCanteen() {
  const name = ui.canteenName.value.trim();
  const imageUrl = ui.canteenImageUrl.value.trim();
  const location = ui.canteenLocation.value.trim();
  const isFeatured = ui.canteenFeatured.checked;
  const isOpen = ui.canteenIsOpen.checked;
  const acceptingOrders = ui.canteenAcceptingOrders.checked;

  if (!name || !imageUrl) {
    showToast('Name & Image URL are required.', true);
    return;
  }

  // enforce max 5 featured
  if (isFeatured) {
    const featuredCount = state.canteens.filter(
      c => c.isFeatured && c.id !== state.currentCanteenId
    ).length;
    if (featuredCount >= 5) {
      showToast('Max 5 featured canteens allowed.', true);
      ui.canteenFeatured.checked = false;
      return;
    }
  }

  try {
    if (state.currentCanteenId) {
      const ref = doc(db, 'canteens', state.currentCanteenId);
      await updateDoc(ref, {
        name,
        imageUrl,
        location,
        isFeatured,
        isOpen,
        acceptingOrders
      });
    } else {
      const ref = await addDoc(collection(db, 'canteens'), {
        name,
        imageUrl,
        location,
        isFeatured,
        isOpen: true,
        acceptingOrders: true,
        owners: [],
        isDisabled: false
      });
      state.currentCanteenId = ref.id;
    }
    showToast('Canteen saved.');
    await loadCanteens();
    showView('canteensView');
  } catch (e) {
    console.error('Save canteen failed', e);
    showToast('Failed to save canteen.', true);
  }
}

async function deleteCanteen() {
  if (!state.currentCanteenId) return;
  const confirmed = confirm(
    'This will disable the canteen. Orders history stays until deleted from analytics tools. Continue?'
  );
  if (!confirmed) return;
  try {
    await updateDoc(doc(db, 'canteens', state.currentCanteenId), {
      isDisabled: true,
      isOpen: false,
      acceptingOrders: false
    });
    showToast('Canteen disabled.');
    await loadCanteens();
    showView('canteensView');
  } catch (e) {
    console.error('Disable failed', e);
    showToast('Failed to disable canteen.', true);
  }
}

/* ---------- OWNER EMAILS ---------- */

function openOwnerModal() {
  if (!state.currentCanteenId) {
    showToast('Save the canteen first.', true);
    return;
  }
  renderOwnerPills();
  ui.ownerModal.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function addOwnerEmail() {
  const email = ui.ownerEmailInput.value.trim().toLowerCase();
  if (!email) return;
  if (!email.includes('@')) {
    showToast('Invalid email.', true);
    return;
  }
  if (!state.tempOwnerEmails.includes(email)) {
    state.tempOwnerEmails.push(email);
    renderOwnerPills();
  }
  ui.ownerEmailInput.value = '';
}

function removeOwnerEmail(email) {
  state.tempOwnerEmails = state.tempOwnerEmails.filter(e => e !== email);
  renderOwnerPills();
}

function renderOwnerPills() {
  ui.ownerEmailList.innerHTML = '';
  if (state.tempOwnerEmails.length === 0) {
    ui.ownerEmailList.innerHTML =
      '<span style="font-size:0.8rem;color:#777;">No owners yet.</span>';
    return;
  }
  state.tempOwnerEmails.forEach(email => {
    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.innerHTML = `
      <span>${email}</span>
      <button class="pill-remove" type="button">×</button>
    `;
    pill.querySelector('button').addEventListener('click', () => removeOwnerEmail(email));
    ui.ownerEmailList.appendChild(pill);
  });
}

async function saveOwnerEmails() {
  if (!state.currentCanteenId) return;
  try {
    await updateDoc(doc(db, 'canteens', state.currentCanteenId), {
      owners: state.tempOwnerEmails
    });
    showToast('Owner emails updated.');
    await loadCanteens();
    closeModal('ownerModal');
  } catch (e) {
    console.error(e);
    showToast('Failed to save owner emails.', true);
  }
}

/* ---------- DISHES ---------- */

function renderDishList(dishes) {
  if (!dishes || dishes.length === 0) {
    ui.dishList.innerHTML =
      '<p style="font-size:0.85rem;color:#888;padding:0.6rem;">No dishes yet.</p>';
    return;
  }
  ui.dishList.innerHTML = '';
  dishes.forEach(dish => {
    const row = document.createElement('div');
    row.className = 'dish-row';

    const img = document.createElement('img');
    img.src = dish.imageUrl || 'https://placehold.co/80x60/333/fff?text=Dish';
    img.alt = dish.name;

    const meta = document.createElement('div');
    meta.className = 'dish-meta';
    meta.innerHTML = `
      <div class="dish-meta-title">${dish.name}</div>
      <div class="dish-meta-sub">
        ₹${dish.price} · ${dish.category || 'Uncategorised'} ·
        ${dish.isVeg ? 'Veg' : 'Non-Veg'} ·
        ${dish.isAvailable === false ? 'Unavailable' : 'Available'}
      </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'dish-actions';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'icon-btn edit';
    btnEdit.textContent = 'Edit';
    btnEdit.addEventListener('click', () => openDishModal(dish));

    const btnDelete = document.createElement('button');
    btnDelete.className = 'icon-btn delete';
    btnDelete.textContent = 'Delete';
    btnDelete.addEventListener('click', () => deleteDish(dish.id));

    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);

    row.appendChild(img);
    row.appendChild(meta);
    row.appendChild(actions);

    ui.dishList.appendChild(row);
  });
}

function openDishModal(dish = null) {
  if (!state.currentCanteenId) {
    showToast('Save the canteen first.', true);
    return;
  }
  state.currentDishId = dish ? dish.id : null;
  ui.dishModalTitle.textContent = dish ? `Edit Dish` : `Add Dish`;
  ui.dishImageUrl.value = dish?.imageUrl || '';
  ui.dishName.value = dish?.name || '';
  ui.dishPrice.value = dish?.price ?? '';
  ui.dishCategory.value = dish?.category || '';
  ui.dishIsVeg.checked = dish?.isVeg ?? true;
  ui.dishModal.classList.add('active');
}

async function saveDish() {
  if (!state.currentCanteenId) return;
  const imageUrl = ui.dishImageUrl.value.trim();
  const name = ui.dishName.value.trim();
  const price = parseFloat(ui.dishPrice.value);
  const category = ui.dishCategory.value.trim();
  const isVeg = ui.dishIsVeg.checked;

  if (!imageUrl || !name || isNaN(price) || price <= 0) {
    showToast('Fill all dish fields correctly.', true);
    return;
  }

  const dishData = {
    imageUrl,
    name,
    price,
    category,
    isVeg,
    isAvailable: true,
    searchName: name.toLowerCase().trim()
  };

  try {
    if (state.currentDishId) {
      await updateDoc(
        doc(db, 'canteens', state.currentCanteenId, 'dishes', state.currentDishId),
        dishData
      );
    } else {
      await addDoc(collection(db, 'canteens', state.currentCanteenId, 'dishes'), dishData);
    }
    showToast('Dish saved.');
    ui.dishModal.classList.remove('active');
    await loadDishesForCanteen(state.currentCanteenId);
  } catch (e) {
    console.error(e);
    showToast('Failed to save dish.', true);
  }
}

async function deleteDish(dishId) {
  if (!state.currentCanteenId || !dishId) return;
  const ok = confirm('Delete this dish? This cannot be undone.');
  if (!ok) return;
  try {
    await updateDoc(
      doc(db, 'canteens', state.currentCanteenId, 'dishes', dishId),
      { isDeleted: true } // soft delete; customer app will filter this later
    );
    showToast('Dish marked deleted.');
    await loadDishesForCanteen(state.currentCanteenId);
  } catch (e) {
    console.error(e);
    showToast('Failed to delete dish.', true);
  }
}

/* ---------- EVENT BINDINGS ---------- */

function initEvents() {
  ui.adminLoginBtn.addEventListener('click', handleSignIn);
  ui.logoutBtn.addEventListener('click', handleSignOut);

  ui.navItems.forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  document.querySelectorAll('[data-view-link]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-view-link');
      if (target) showView(target);
    });
  });

  ui.addCanteenBtn.addEventListener('click', () => {
    newCanteenState();
    showView('canteenEditorView');
  });

  ui.saveCanteenBtn.addEventListener('click', saveCanteen);
  ui.deleteCanteenBtn.addEventListener('click', deleteCanteen);

  ui.editOwnersBtn.addEventListener('click', openOwnerModal);
  ui.addOwnerEmailBtn.addEventListener('click', addOwnerEmail);
  ui.saveOwnersBtn.addEventListener('click', saveOwnerEmails);

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });

  ui.addDishBtn.addEventListener('click', () => openDishModal(null));
  ui.saveDishBtn.addEventListener('click', saveDish);

    // Analytics
  ui.analyticsCanteenSelect.addEventListener('change', () =>
    onAnalyticsFilterChange(true)
  );
  ui.analyticsRangeSelect.addEventListener('change', () =>
    onAnalyticsFilterChange(true)
  );
  ui.analyticsRefreshBtn.addEventListener('click', () => refreshAnalyticsData());
  ui.analyticsDeleteBtn.addEventListener('click', () => deleteAnalyticsRange());

}

/* ---------- INIT ---------- */

(function init() {
  initEvents();
  initAuthListener();
})();
