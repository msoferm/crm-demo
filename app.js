const STORAGE_KEY = "event-equipment-rental-manager-v1";

const WP_SYNC_LOG_LIMIT = 80;
const EXCEL_BOOTSTRAP_VERSION = "2026-03-12-finance-v1";

const DEFAULT_WORDPRESS_INTEGRATION = {
  siteUrl: "",
  consumerKey: "",
  consumerSecret: "",
  username: "",
  appPassword: "",
  autoSync: false,
  lastPullAt: "",
  lastPushAt: "",
  lastSyncAt: "",
  lastError: "",
  pendingDeleteProductIds: [],
  log: [],
};

function createDefaultWordPressIntegration() {
  return {
    ...DEFAULT_WORDPRESS_INTEGRATION,
    pendingDeleteProductIds: [],
    log: [],
  };
}

function createFinanceTableState() {
  return {
    sheetName: "",
    headers: [],
    rows: [],
  };
}

function createDefaultFinanceState() {
  return {
    incomes: createFinanceTableState(),
    openPayments: createFinanceTableState(),
    shortages: createFinanceTableState(),
    fixedExpenses: createFinanceTableState(),
    variableExpenses: createFinanceTableState(),
    monthlySummary2025: createFinanceTableState(),
    monthlySummary2026: createFinanceTableState(),
  };
}

function createDefaultFinanceViewState() {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 30);
  return {
    incomesFrom: dateToIso(fromDate),
    incomesTo: dateToIso(today),
  };
}

const DEFAULT_STATE = {
  settings: {
    currency: "ILS",
    vatPercent: 18,
  },
  counters: {
    order: 1,
  },
  equipment: [],
  clients: [],
  orders: [],
  integrations: {
    wordpress: createDefaultWordPressIntegration(),
  },
  finance: createDefaultFinanceState(),
  meta: {
    excelBootstrapVersion: "",
  },
};

const MONTH_NAMES_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const DAY_NAMES_HE   = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
const MONTH_INDEX_BY_HE = Object.fromEntries(MONTH_NAMES_HE.map((name, index) => [name, index]));

const FINANCE_INCOME_HEADERS = [
  "תאריך אספקה",
  "תאריך תשלום",
  "לקוח",
  "סכום לפני מע\"מ",
  "שולם בפועל",
  "סוג תשלום",
  "חזר",
  "הערות",
  "הוצאות צמודות",
];

const FINANCE_OPEN_PAYMENTS_HEADERS = [
  "תאריך: DD/MM/YYYY",
  "לקוח",
  "סכום לפני מע\"מ",
  "שולם בפועל",
  "סוג תשלום",
  "חזר",
  "הערות",
  "הוצאות צמודות",
  "יתרת תשלום",
];

const FINANCE_SHORTAGES_HEADERS = [
  "תאריך: DD/MM/YYYY",
  "לקוח",
  "סכום לפני מע\"מ",
  "שולם בפועל",
  "סוג תשלום",
  "חזר",
  "הערות",
  "הוצאות צמודות",
];

const FINANCE_FIXED_HEADERS = [
  "תאריך",
  "שכירות",
  "ארנונה",
  "חשמל",
  "מים",
  "באסם",
  "אחינועם (בסיס)",
  "בונוס+עלות מעסיק",
  "פיני",
  "סה\"כ",
  "ציפי",
  "תוספת פיני",
  "הערות",
];

const FINANCE_FIXED_COMPONENT_HEADERS = [
  "שכירות",
  "ארנונה",
  "חשמל",
  "מים",
  "באסם",
  "אחינועם (בסיס)",
  "בונוס+עלות מעסיק",
  "פיני",
  "ציפי",
  "תוספת פיני",
];

const FINANCE_VARIABLE_HEADERS = [
  "תאריך: DD/MM/YYYY",
  "קטגוריה",
  "פירוט",
  "סכום",
  "סכום אחרי מעמ",
  "הערות",
];

const categoryLabels = {
  sound: "סאונד",
  lighting: "תאורה",
  staging: "במה",
  video: "וידאו",
  furniture: "ריהוט",
  power: "חשמל",
  other: "אחר",
};

const statusLabels = {
  draft: "טיוטה",
  confirmed: "מאושרת",
  picked_up: "נאספה",
  returned: "הוחזרה",
  cancelled: "בוטלה",
};

const paymentStatusLabels = {
  unpaid: "לא שולם",
  partial: "שולם חלקית",
  paid: "שולם במלואו",
};

const paymentMethodLabels = {
  cash: "מזומן",
  credit: "אשראי",
  transfer: "העברה בנקאית",
  check: "צ׳ק",
  other: "אחר",
};

let state = loadState();
let financePendingEdits = {};
let financeViewState = createDefaultFinanceViewState();
let orderItemsDraft = [];
let isWordPressSyncRunning = false;
let calendarViewYear = new Date().getFullYear();
let calendarViewMonth = new Date().getMonth();

const el = {
  messageBox: document.getElementById("messageBox"),
  tabButtons: Array.from(document.querySelectorAll(".tab-btn")),
  tabPanels: Array.from(document.querySelectorAll(".tab-panel")),

  statEquipmentTypes: document.getElementById("statEquipmentTypes"),
  statInventoryUnits: document.getElementById("statInventoryUnits"),
  statActiveOrders: document.getElementById("statActiveOrders"),
  statRevenueMonth: document.getElementById("statRevenueMonth"),
  upcomingList: document.getElementById("upcomingList"),
  lowStockList: document.getElementById("lowStockList"),
  dashboardHighlights: document.getElementById("dashboardHighlights"),
  dashboardSearchInput: document.getElementById("dashboardSearchInput"),
  dashboardSearchBtn: document.getElementById("dashboardSearchBtn"),
  dashboardSearchResults: document.getElementById("dashboardSearchResults"),

  equipmentForm: document.getElementById("equipmentForm"),
  equipmentId: document.getElementById("equipmentId"),
  equipmentName: document.getElementById("equipmentName"),
  equipmentCategory: document.getElementById("equipmentCategory"),
  equipmentQuantity: document.getElementById("equipmentQuantity"),
  equipmentDailyPrice: document.getElementById("equipmentDailyPrice"),
  equipmentSku: document.getElementById("equipmentSku"),
  equipmentSize: document.getElementById("equipmentSize"),
  equipmentShelfLocation: document.getElementById("equipmentShelfLocation"),
  equipmentDamagedQty: document.getElementById("equipmentDamagedQty"),
  equipmentImageUrl: document.getElementById("equipmentImageUrl"),
  equipmentWpCategoryName: document.getElementById("equipmentWpCategoryName"),
  equipmentNotes: document.getElementById("equipmentNotes"),
  equipmentCancelBtn: document.getElementById("equipmentCancelBtn"),
  addEquipmentBtn: document.getElementById("addEquipmentBtn"),
  equipmentGrid: document.getElementById("equipmentGrid"),

  clientForm: document.getElementById("clientForm"),
  clientId: document.getElementById("clientId"),
  clientName: document.getElementById("clientName"),
  clientCompany: document.getElementById("clientCompany"),
  clientEmail: document.getElementById("clientEmail"),
  clientPhone: document.getElementById("clientPhone"),
  clientAddress: document.getElementById("clientAddress"),
  clientNotes: document.getElementById("clientNotes"),
  clientCancelBtn: document.getElementById("clientCancelBtn"),
  clientsTableBody: document.getElementById("clientsTableBody"),

  orderForm: document.getElementById("orderForm"),
  orderId: document.getElementById("orderId"),
  orderNumber: document.getElementById("orderNumber"),
  orderStatus: document.getElementById("orderStatus"),
  orderClientId: document.getElementById("orderClientId"),
  orderAddClientBtn: document.getElementById("orderAddClientBtn"),
  orderInlineClientForm: document.getElementById("orderInlineClientForm"),
  inlineClientName: document.getElementById("inlineClientName"),
  inlineClientPhone: document.getElementById("inlineClientPhone"),
  inlineClientEmail: document.getElementById("inlineClientEmail"),
  inlineClientCompany: document.getElementById("inlineClientCompany"),
  inlineClientSaveBtn: document.getElementById("inlineClientSaveBtn"),
  inlineClientCancelBtn: document.getElementById("inlineClientCancelBtn"),
  orderEventName: document.getElementById("orderEventName"),
  orderEventLocation: document.getElementById("orderEventLocation"),
  orderStartDate: document.getElementById("orderStartDate"),
  orderEndDate: document.getElementById("orderEndDate"),
  orderDiscount: document.getElementById("orderDiscount"),
  orderDeposit: document.getElementById("orderDeposit"),
  orderPaymentStatus: document.getElementById("orderPaymentStatus"),
  orderPaymentMethod: document.getElementById("orderPaymentMethod"),
  orderNotes: document.getElementById("orderNotes"),
  addOrderItemBtn: document.getElementById("addOrderItemBtn"),
  orderItemsBody: document.getElementById("orderItemsBody"),
  orderDays: document.getElementById("orderDays"),
  orderSubtotal: document.getElementById("orderSubtotal"),
  orderVat: document.getElementById("orderVat"),
  orderTotal: document.getElementById("orderTotal"),
  orderBalance: document.getElementById("orderBalance"),
  orderCancelBtn: document.getElementById("orderCancelBtn"),
  orderPrintDeliveryBtn: document.getElementById("orderPrintDeliveryBtn"),
  orderPrintReturnBtn: document.getElementById("orderPrintReturnBtn"),
  ordersSearchInput: document.getElementById("ordersSearchInput"),
  addOrderBtn: document.getElementById("addOrderBtn"),
  ordersCalendarGrid: document.getElementById("ordersCalendarGrid"),
  ordersCalMonthLabel: document.getElementById("ordersCalMonthLabel"),
  ordersCalPrevBtn: document.getElementById("ordersCalPrevBtn"),
  ordersCalNextBtn: document.getElementById("ordersCalNextBtn"),
  ordersActiveGrid: document.getElementById("ordersActiveGrid"),
  ordersFutureGrid: document.getElementById("ordersFutureGrid"),

  dayDetailDialog: document.getElementById("dayDetailDialog"),
  dayDetailTitle: document.getElementById("dayDetailTitle"),
  dayDetailBody: document.getElementById("dayDetailBody"),
  dayDetailCloseBtn: document.getElementById("dayDetailCloseBtn"),

  equipmentModal: document.getElementById("equipmentModal"),
  equipmentModalForm: document.getElementById("equipmentModalForm"),
  equipmentModalId: document.getElementById("equipmentModalId"),
  equipmentModalName: document.getElementById("equipmentModalName"),
  equipmentModalCategory: document.getElementById("equipmentModalCategory"),
  equipmentModalQuantity: document.getElementById("equipmentModalQuantity"),
  equipmentModalDailyPrice: document.getElementById("equipmentModalDailyPrice"),
  equipmentModalSku: document.getElementById("equipmentModalSku"),
  equipmentModalSize: document.getElementById("equipmentModalSize"),
  equipmentModalShelfLocation: document.getElementById("equipmentModalShelfLocation"),
  equipmentModalDamagedQty: document.getElementById("equipmentModalDamagedQty"),
  equipmentModalImageUrl: document.getElementById("equipmentModalImageUrl"),
  equipmentModalWpCategoryName: document.getElementById("equipmentModalWpCategoryName"),
  equipmentModalNotes: document.getElementById("equipmentModalNotes"),
  equipmentModalClose: document.getElementById("equipmentModalClose"),
  equipmentModalCancelBtn: document.getElementById("equipmentModalCancelBtn"),
  equipmentModalSyncBtn: document.getElementById("equipmentModalSyncBtn"),
  equipmentModalSaveAndSyncBtn: document.getElementById("equipmentModalSaveAndSyncBtn"),
  equipmentModalImagePreview: document.getElementById("equipmentModalImagePreview"),
  equipmentModalImageFile: document.getElementById("equipmentModalImageFile"),
  equipmentSearchInput: document.getElementById("equipmentSearchInput"),

  exportDataBtn: document.getElementById("exportDataBtn"),
  importDataInput: document.getElementById("importDataInput"),
  resetDataBtn: document.getElementById("resetDataBtn"),
  loadExcelBootstrapBtn: document.getElementById("loadExcelBootstrapBtn"),

  financeIncomesTable: document.getElementById("financeIncomesTable"),
  incomesFromDate: document.getElementById("incomesFromDate"),
  incomesToDate: document.getElementById("incomesToDate"),
  applyIncomesRangeBtn: document.getElementById("applyIncomesRangeBtn"),
  lastMonthIncomesBtn: document.getElementById("lastMonthIncomesBtn"),
  financeIncomesRangeSummary: document.getElementById("financeIncomesRangeSummary"),
  addIncomeRowBtn: document.getElementById("addIncomeRowBtn"),
  incomeForm: document.getElementById("incomeForm"),
  incomeDeliveryDate: document.getElementById("incomeDeliveryDate"),
  incomePaymentDate: document.getElementById("incomePaymentDate"),
  incomeClient: document.getElementById("incomeClient"),
  incomeAmountBeforeVat: document.getElementById("incomeAmountBeforeVat"),
  incomeAmountPaid: document.getElementById("incomeAmountPaid"),
  incomePaymentType: document.getElementById("incomePaymentType"),
  incomeReturned: document.getElementById("incomeReturned"),
  incomeAttachedExpenses: document.getElementById("incomeAttachedExpenses"),
  incomeNotes: document.getElementById("incomeNotes"),
  incomeCancelBtn: document.getElementById("incomeCancelBtn"),
  addOpenPaymentRowBtn: document.getElementById("addOpenPaymentRowBtn"),
  openPaymentForm: document.getElementById("openPaymentForm"),
  openPaymentDate: document.getElementById("openPaymentDate"),
  openPaymentClient: document.getElementById("openPaymentClient"),
  openPaymentAmountBeforeVat: document.getElementById("openPaymentAmountBeforeVat"),
  openPaymentAmountPaid: document.getElementById("openPaymentAmountPaid"),
  openPaymentBalance: document.getElementById("openPaymentBalance"),
  openPaymentType: document.getElementById("openPaymentType"),
  openPaymentReturned: document.getElementById("openPaymentReturned"),
  openPaymentAttachedExpenses: document.getElementById("openPaymentAttachedExpenses"),
  openPaymentNotes: document.getElementById("openPaymentNotes"),
  openPaymentCancelBtn: document.getElementById("openPaymentCancelBtn"),
  addShortageRowBtn: document.getElementById("addShortageRowBtn"),
  shortageForm: document.getElementById("shortageForm"),
  shortageDate: document.getElementById("shortageDate"),
  shortageClient: document.getElementById("shortageClient"),
  shortageAmountBeforeVat: document.getElementById("shortageAmountBeforeVat"),
  shortageAmountPaid: document.getElementById("shortageAmountPaid"),
  shortagePaymentType: document.getElementById("shortagePaymentType"),
  shortageReturned: document.getElementById("shortageReturned"),
  shortageAttachedExpenses: document.getElementById("shortageAttachedExpenses"),
  shortageNotes: document.getElementById("shortageNotes"),
  shortageCancelBtn: document.getElementById("shortageCancelBtn"),
  financeOpenPaymentsTable: document.getElementById("financeOpenPaymentsTable"),
  financeShortagesTable: document.getElementById("financeShortagesTable"),
  financeFixedExpensesTable: document.getElementById("financeFixedExpensesTable"),
  financeVariableExpensesTable: document.getElementById("financeVariableExpensesTable"),
  fixedExpenseForm: document.getElementById("fixedExpenseForm"),
  fixedMonthLabel: document.getElementById("fixedMonthLabel"),
  fixedRent: document.getElementById("fixedRent"),
  fixedArnona: document.getElementById("fixedArnona"),
  fixedElectric: document.getElementById("fixedElectric"),
  fixedWater: document.getElementById("fixedWater"),
  fixedBasam: document.getElementById("fixedBasam"),
  fixedAhinoam: document.getElementById("fixedAhinoam"),
  fixedBonus: document.getElementById("fixedBonus"),
  fixedPini: document.getElementById("fixedPini"),
  fixedTzippy: document.getElementById("fixedTzippy"),
  fixedPiniExtra: document.getElementById("fixedPiniExtra"),
  fixedNotes: document.getElementById("fixedNotes"),
  variableExpenseForm: document.getElementById("variableExpenseForm"),
  variableDate: document.getElementById("variableDate"),
  variableCategory: document.getElementById("variableCategory"),
  variableDetail: document.getElementById("variableDetail"),
  variableAmountBeforeVat: document.getElementById("variableAmountBeforeVat"),
  variableAmountAfterVat: document.getElementById("variableAmountAfterVat"),
  variableNotes: document.getElementById("variableNotes"),
  annualSummaryYear: document.getElementById("annualSummaryYear"),
  annualSummaryStats: document.getElementById("annualSummaryStats"),
  annualSummaryYearlyChart: document.getElementById("annualSummaryYearlyChart"),
  annualSummaryTableBody: document.getElementById("annualSummaryTableBody"),
  monthlySummary2025Table: document.getElementById("monthlySummary2025Table"),
  monthlySummary2026Table: document.getElementById("monthlySummary2026Table"),

  wpSyncForm: document.getElementById("wpSyncForm"),
  wpSiteUrl: document.getElementById("wpSiteUrl"),
  wpConsumerKey: document.getElementById("wpConsumerKey"),
  wpConsumerSecret: document.getElementById("wpConsumerSecret"),
  wpUsername: document.getElementById("wpUsername"),
  wpAppPassword: document.getElementById("wpAppPassword"),
  wpAutoSync: document.getElementById("wpAutoSync"),
  wpTestConnectionBtn: document.getElementById("wpTestConnectionBtn"),
  wpPullBtn: document.getElementById("wpPullBtn"),
  wpPushBtn: document.getElementById("wpPushBtn"),
  wpSyncBothBtn: document.getElementById("wpSyncBothBtn"),
  wpSyncStats: document.getElementById("wpSyncStats"),
  wpSyncLog: document.getElementById("wpSyncLog"),
};

init();

function init() {
  const bootstrapped = ensureExcelBootstrapData(false);
  if (bootstrapped) {
    saveState();
  }
  bindTabs();
  bindEquipmentHandlers();
  bindClientHandlers();
  bindOrderHandlers();
  bindBackupHandlers();
  bindWordPressSyncHandlers();
  bindFinanceHandlers();
  bindDashboardHandlers();
  bindEquipmentModalHandlers();
  resetEquipmentForm();
  resetClientForm();
  resetOrderForm();
  renderAll();
}

function bindTabs() {
  el.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (!tab) return;
      el.tabButtons.forEach((item) => item.classList.toggle("active", item === button));
      el.tabPanels.forEach((panel) => panel.classList.toggle("hidden", panel.id !== tab));
    });
  });
}

function bindEquipmentHandlers() {
  el.equipmentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const id = el.equipmentId.value.trim();
    const nowIso = new Date().toISOString();
    const payload = {
      id: id || uid(),
      name: el.equipmentName.value.trim(),
      category: el.equipmentCategory.value,
      quantity: toInt(el.equipmentQuantity.value),
      dailyPrice: toNumber(el.equipmentDailyPrice.value),
      sku: String(el.equipmentSku.value || "").trim(),
      size: String(el.equipmentSize.value || "").trim(),
      shelfLocation: String(el.equipmentShelfLocation.value || "").trim(),
      damagedQty: Math.max(0, toInt(el.equipmentDamagedQty.value)),
      imageUrl: String(el.equipmentImageUrl.value || "").trim(),
      wpCategoryName: String(el.equipmentWpCategoryName.value || "").trim(),
      wpCategoryId: null,
      notes: el.equipmentNotes.value.trim(),
      createdAt: nowIso,
      updatedAt: nowIso,
      wpProductId: null,
      wpLastRemoteModified: "",
      wpLastSyncedAt: "",
    };

    if (!payload.name) {
      showMessage("חובה להזין שם ציוד.", "error");
      return;
    }
    if (payload.quantity < 0 || payload.dailyPrice < 0) {
      showMessage("כמות ומחיר יומי לא יכולים להיות שליליים.", "error");
      return;
    }

    if (id) {
      const index = state.equipment.findIndex((item) => item.id === id);
      if (index === -1) {
        showMessage("פריט הציוד לא נמצא.", "error");
        return;
      }
      payload.createdAt = state.equipment[index].createdAt;
      payload.wpProductId = normalizeWpProductId(state.equipment[index].wpProductId);
      payload.wpLastRemoteModified = String(state.equipment[index].wpLastRemoteModified || "");
      payload.wpLastSyncedAt = String(state.equipment[index].wpLastSyncedAt || "");
      payload.wpCategoryId = normalizeWpTermId(state.equipment[index].wpCategoryId);
      const prevWpCategoryName = String(state.equipment[index].wpCategoryName || "").trim().toLowerCase();
      const nextWpCategoryName = String(payload.wpCategoryName || "").trim().toLowerCase();
      if (nextWpCategoryName && nextWpCategoryName !== prevWpCategoryName) {
        payload.wpCategoryId = null;
      }
      state.equipment[index] = payload;
      showMessage("פריט הציוד עודכן.", "success");
    } else {
      state.equipment.push(payload);
      showMessage("פריט הציוד נוצר.", "success");
    }

    saveState();
    resetEquipmentForm();
    renderAll();
    triggerWordPressAutoSync("ציוד נשמר מקומית.");
  });

  el.equipmentCancelBtn.addEventListener("click", resetEquipmentForm);

  el.addEquipmentBtn.addEventListener("click", () => {
    const isHidden = el.equipmentForm.classList.contains("hidden");
    if (isHidden) {
      resetEquipmentForm();
      el.equipmentForm.classList.remove("hidden");
      el.equipmentForm.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      el.equipmentForm.classList.add("hidden");
    }
  });

  el.equipmentGrid.addEventListener("click", (event) => {
    const target = event.target;

    if (target instanceof HTMLButtonElement) {
      const id = target.dataset.id;
      if (!id) return;

      if (target.dataset.action === "edit") {
        const item = state.equipment.find((entry) => entry.id === id);
        if (!item) return;
        openEquipmentModal(item);
        return;
      }

      if (target.dataset.action === "delete") {
        const used = state.orders.some((order) => order.items.some((line) => line.equipmentId === id));
        if (used) {
          showMessage("אי אפשר למחוק ציוד שמשויך להזמנות קיימות.", "error");
          return;
        }
        if (!window.confirm("למחוק את פריט הציוד הזה?")) return;
        const itemToDelete = state.equipment.find((item) => item.id === id);
        queueWordPressDelete(itemToDelete);
        state.equipment = state.equipment.filter((item) => item.id !== id);
        saveState();
        renderAll();
        showMessage("פריט הציוד נמחק.", "success");
        triggerWordPressAutoSync("פריט ציוד נמחק מקומית.");
        return;
      }

      if (target.dataset.action === "sync-item") {
        const item = state.equipment.find((entry) => entry.id === id);
        if (!item) return;
        syncSingleEquipmentItem(item);
        return;
      }
      return;
    }

    // לחיצה על כרטיס (לא על כפתור) פותחת את ה-modal
    if (!target.closest(".eq-card-actions")) {
      const card = target.closest(".eq-card[data-id]");
      if (card) {
        const item = state.equipment.find((entry) => entry.id === card.dataset.id);
        if (item) openEquipmentModal(item);
      }
    }
  });

  el.equipmentSearchInput.addEventListener("input", () => {
    renderEquipmentTable();
  });
}

function bindClientHandlers() {
  el.clientForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const id = el.clientId.value.trim();
    const payload = {
      id: id || uid(),
      name: el.clientName.value.trim(),
      company: el.clientCompany.value.trim(),
      email: el.clientEmail.value.trim(),
      phone: el.clientPhone.value.trim(),
      address: el.clientAddress.value.trim(),
      notes: el.clientNotes.value.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!payload.name) {
      showMessage("חובה להזין שם לקוח.", "error");
      return;
    }

    if (id) {
      const index = state.clients.findIndex((item) => item.id === id);
      if (index === -1) {
        showMessage("הלקוח לא נמצא.", "error");
        return;
      }
      payload.createdAt = state.clients[index].createdAt;
      state.clients[index] = payload;
      showMessage("הלקוח עודכן.", "success");
    } else {
      state.clients.push(payload);
      showMessage("הלקוח נוצר.", "success");
    }

    saveState();
    resetClientForm();
    renderAll();
  });

  el.clientCancelBtn.addEventListener("click", resetClientForm);

  el.clientsTableBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const id = target.dataset.id;
    if (!id) return;

    if (target.dataset.action === "edit") {
      const item = state.clients.find((entry) => entry.id === id);
      if (!item) return;
      el.clientId.value = item.id;
      el.clientName.value = item.name;
      el.clientCompany.value = item.company || "";
      el.clientEmail.value = item.email || "";
      el.clientPhone.value = item.phone || "";
      el.clientAddress.value = item.address || "";
      el.clientNotes.value = item.notes || "";
      focusTab("clients");
      return;
    }

    if (target.dataset.action === "delete") {
      const hasOrders = state.orders.some((order) => order.clientId === id);
      if (hasOrders) {
        showMessage("אי אפשר למחוק לקוח עם הזמנות השכרה קיימות.", "error");
        return;
      }
      if (!window.confirm("למחוק את הלקוח הזה?")) return;
      state.clients = state.clients.filter((client) => client.id !== id);
      saveState();
      renderAll();
      showMessage("הלקוח נמחק.", "success");
    }
  });
}

function bindOrderHandlers() {
  el.orderForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (state.clients.length === 0) {
      showMessage("קודם צריך ליצור לפחות לקוח אחד.", "error");
      focusTab("clients");
      return;
    }

    if (orderItemsDraft.length === 0) {
      showMessage("צריך להוסיף לפחות שורת ציוד אחת להזמנה.", "error");
      return;
    }

    const id = el.orderId.value.trim();
    const startDate = el.orderStartDate.value;
    const endDate = el.orderEndDate.value;
    const status = el.orderStatus.value;
    const preparedItems = orderItemsDraft.map((item) => ({
      id: item.id || uid(),
      equipmentId: item.equipmentId,
      quantity: Math.max(1, toInt(item.quantity)),
      dailyPrice: Math.max(0, toNumber(item.dailyPrice)),
    }));

    if (!el.orderClientId.value) {
      showMessage("חובה לבחור לקוח.", "error");
      return;
    }

    if (!startDate || !endDate) {
      showMessage("חובה להזין תאריך התחלה וסיום.", "error");
      return;
    }

    if (toDate(startDate) > toDate(endDate)) {
      showMessage("תאריך סיום לא יכול להיות לפני תאריך התחלה.", "error");
      return;
    }

    for (const line of preparedItems) {
      const equipment = state.equipment.find((entry) => entry.id === line.equipmentId);
      if (!equipment) {
        showMessage("בכל שורה חייב להיות פריט ציוד תקין.", "error");
        return;
      }
      if (line.quantity > equipment.quantity) {
        showMessage(`הכמות המבוקשת עבור ${equipment.name} גדולה מהמלאי.`, "error");
        return;
      }
    }

    if (statusReservesInventory(status)) {
      for (const line of preparedItems) {
        const equipment = state.equipment.find((entry) => entry.id === line.equipmentId);
        const available = getAvailableForRange(line.equipmentId, startDate, endDate, id);
        if (line.quantity > available) {
          showMessage(
            `אין זמינות מספקת עבור ${equipment ? equipment.name : "פריט"} (${line.quantity} נדרשו, ${available} זמינים).`,
            "error",
          );
          return;
        }
      }
    }

    const payload = {
      id: id || uid(),
      orderNumber: el.orderNumber.value.trim() || generateOrderNumber(),
      status,
      clientId: el.orderClientId.value,
      eventName: el.orderEventName.value.trim(),
      eventLocation: el.orderEventLocation.value.trim(),
      startDate,
      endDate,
      discount: Math.max(0, toNumber(el.orderDiscount.value)),
      deposit: Math.max(0, toNumber(el.orderDeposit.value)),
      paymentStatus: el.orderPaymentStatus.value || "unpaid",
      paymentMethod: el.orderPaymentMethod.value || "",
      notes: el.orderNotes.value.trim(),
      items: preparedItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!payload.eventName || !payload.eventLocation) {
      showMessage("חובה להזין שם ומיקום אירוע.", "error");
      return;
    }

    if (id) {
      const index = state.orders.findIndex((item) => item.id === id);
      if (index === -1) {
        showMessage("ההזמנה לא נמצאה.", "error");
        return;
      }
      payload.createdAt = state.orders[index].createdAt;
      state.orders[index] = payload;
      showMessage("ההזמנה עודכנה.", "success");
    } else {
      state.orders.push(payload);
      state.counters.order += 1;
      showMessage("ההזמנה נוצרה.", "success");
    }

    saveState();
    resetOrderForm();
    renderAll();
  });

  el.addOrderItemBtn.addEventListener("click", () => {
    if (state.equipment.length === 0) {
      showMessage("צריך ליצור ציוד לפני שמוסיפים פריטים להזמנה.", "error");
      focusTab("equipment");
      return;
    }
    orderItemsDraft.push(createDraftItem());
    renderOrderItemsEditor();
    updateOrderTotalsPreview();
  });

  el.orderCancelBtn.addEventListener("click", resetOrderForm);

  el.orderPrintDeliveryBtn.addEventListener("click", () => {
    const id = el.orderPrintDeliveryBtn.dataset.id || el.orderId.value;
    const order = state.orders.find(o => o.id === id);
    if (order) printDeliveryNote(order);
  });

  el.orderPrintReturnBtn.addEventListener("click", () => {
    const id = el.orderPrintReturnBtn.dataset.id || el.orderId.value;
    const order = state.orders.find(o => o.id === id);
    if (order) printReturnNote(order);
  });

  el.orderAddClientBtn.addEventListener("click", () => {
    const hidden = el.orderInlineClientForm.classList.contains("hidden");
    if (hidden) {
      el.orderInlineClientForm.classList.remove("hidden");
      el.inlineClientName.focus();
    } else {
      el.orderInlineClientForm.classList.add("hidden");
      resetInlineClientForm();
    }
  });

  el.inlineClientCancelBtn.addEventListener("click", () => {
    el.orderInlineClientForm.classList.add("hidden");
    resetInlineClientForm();
  });

  el.inlineClientSaveBtn.addEventListener("click", () => {
    const name = el.inlineClientName.value.trim();
    if (!name) {
      el.inlineClientName.focus();
      showMessage("חובה להזין שם לקוח.", "error");
      return;
    }
    const newClient = {
      id: uid(),
      name,
      phone: el.inlineClientPhone.value.trim(),
      email: el.inlineClientEmail.value.trim(),
      company: el.inlineClientCompany.value.trim(),
      address: "",
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.clients.push(newClient);
    saveState();
    renderClientSelect();
    el.orderClientId.value = newClient.id;
    el.orderInlineClientForm.classList.add("hidden");
    resetInlineClientForm();
    showMessage(`הלקוח "${name}" נוסף בהצלחה.`, "success");
  });

  el.ordersSearchInput.addEventListener("input", renderOrdersCalendar);

  el.addOrderBtn.addEventListener("click", () => {
    const isHidden = el.orderForm.classList.contains("hidden");
    if (isHidden) {
      resetOrderForm();
      el.orderForm.classList.remove("hidden");
      el.orderForm.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      el.orderForm.classList.add("hidden");
    }
  });

  el.ordersCalPrevBtn.addEventListener("click", () => {
    calendarViewMonth -= 1;
    if (calendarViewMonth < 0) { calendarViewMonth = 11; calendarViewYear -= 1; }
    renderOrdersCalendar();
  });

  el.ordersCalNextBtn.addEventListener("click", () => {
    calendarViewMonth += 1;
    if (calendarViewMonth > 11) { calendarViewMonth = 0; calendarViewYear += 1; }
    renderOrdersCalendar();
  });

  el.orderStatus.addEventListener("change", () => {
    renderOrderItemsEditor();
    updateOrderTotalsPreview();
  });
  el.orderStartDate.addEventListener("change", () => {
    renderOrderItemsEditor();
    updateOrderTotalsPreview();
  });
  el.orderEndDate.addEventListener("change", () => {
    renderOrderItemsEditor();
    updateOrderTotalsPreview();
  });
  el.orderDiscount.addEventListener("input", updateOrderTotalsPreview);
  el.orderDeposit.addEventListener("input", updateOrderTotalsPreview);

  el.orderItemsBody.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    const index = toInt(target.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= orderItemsDraft.length) return;

    if (target.dataset.field === "equipmentId") {
      orderItemsDraft[index].equipmentId = target.value;
      const equipment = state.equipment.find((item) => item.id === target.value);
      if (equipment) {
        orderItemsDraft[index].dailyPrice = equipment.dailyPrice;
      }
    } else if (target.dataset.field === "quantity") {
      orderItemsDraft[index].quantity = Math.max(1, toInt(target.value));
    } else if (target.dataset.field === "dailyPrice") {
      orderItemsDraft[index].dailyPrice = Math.max(0, toNumber(target.value));
    }

    renderOrderItemsEditor();
    updateOrderTotalsPreview();
  });

  el.orderItemsBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    if (target.dataset.action !== "remove-item") return;
    const index = toInt(target.dataset.index);
    if (!Number.isInteger(index)) return;
    orderItemsDraft.splice(index, 1);
    renderOrderItemsEditor();
    updateOrderTotalsPreview();
  });

  function handleOrderTileClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const id = target.dataset.id;
    if (!id) return;

    if (target.dataset.action === "edit-order") {
      const order = state.orders.find((item) => item.id === id);
      if (!order) return;
      hydrateOrderForm(order);
      el.orderForm.classList.remove("hidden");
      el.orderForm.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (target.dataset.action === "delete-order") {
      if (!window.confirm("למחוק את הזמנת ההשכרה הזאת?")) return;
      state.orders = state.orders.filter((order) => order.id !== id);
      saveState();
      renderAll();
      showMessage("ההזמנה נמחקה.", "success");
      return;
    }

    if (target.dataset.action === "print-delivery") {
      const order = state.orders.find(o => o.id === id);
      if (order) printDeliveryNote(order);
      return;
    }

    if (target.dataset.action === "print-return") {
      const order = state.orders.find(o => o.id === id);
      if (order) printReturnNote(order);
      return;
    }
  }

  el.ordersActiveGrid.addEventListener("click", handleOrderTileClick);
  el.ordersFutureGrid.addEventListener("click", handleOrderTileClick);

  el.ordersCalendarGrid.addEventListener("click", (event) => {
    const target = event.target;

    // chip click → edit order directly
    if (target.classList.contains("cal-order-chip")) {
      const id = target.dataset.id;
      if (!id) return;
      const order = state.orders.find((item) => item.id === id);
      if (!order) return;
      hydrateOrderForm(order);
      el.orderForm.classList.remove("hidden");
      el.orderForm.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // cell click → open day detail dialog
    const cell = target.closest(".orders-cal-cell[data-date]");
    if (cell) {
      showDayDetail(cell.dataset.date);
    }
  });

  el.dayDetailCloseBtn.addEventListener("click", () => el.dayDetailDialog.close());
  el.dayDetailDialog.addEventListener("click", (e) => {
    if (e.target === el.dayDetailDialog) el.dayDetailDialog.close();
  });

  el.dayDetailBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const id = target.dataset.id;
    if (!id) return;

    if (target.dataset.action === "edit-order") {
      const order = state.orders.find((item) => item.id === id);
      if (!order) return;
      el.dayDetailDialog.close();
      hydrateOrderForm(order);
      el.orderForm.classList.remove("hidden");
      el.orderForm.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (target.dataset.action === "delete-order") {
      if (!window.confirm("למחוק את הזמנת ההשכרה הזאת?")) return;
      state.orders = state.orders.filter((order) => order.id !== id);
      saveState();
      el.dayDetailDialog.close();
      renderAll();
      showMessage("ההזמנה נמחקה.", "success");
      return;
    }

    if (target.dataset.action === "print-delivery") {
      const order = state.orders.find(o => o.id === id);
      if (order) printDeliveryNote(order);
      return;
    }

    if (target.dataset.action === "print-return") {
      const order = state.orders.find(o => o.id === id);
      if (order) printReturnNote(order);
      return;
    }
  });
}

function bindBackupHandlers() {
  el.exportDataBtn.addEventListener("click", () => {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const datePart = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `גיבוי-השכרה-${datePart}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showMessage("הגיבוי יוצא בהצלחה.", "success");
  });

  el.importDataInput.addEventListener("change", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.files || target.files.length === 0) return;
    const file = target.files[0];
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      state = sanitizeState(parsed);
      clearFinancePendingEdits();
      const bootstrapped = ensureExcelBootstrapData(false);
      if (bootstrapped) {
        appendWordPressLog("Excel bootstrap data merged after backup import.");
      }
      saveState();
      resetEquipmentForm();
      resetClientForm();
      resetOrderForm();
      renderAll();
      showMessage("הגיבוי יובא בהצלחה.", "success");
    } catch (error) {
      console.error(error);
      showMessage("קובץ גיבוי לא תקין.", "error");
    } finally {
      target.value = "";
    }
  });

  el.resetDataBtn.addEventListener("click", () => {
    if (!window.confirm("למחוק את כל הנתונים ולהתחיל מחדש?")) return;
    state = cloneDefaultState();
    clearFinancePendingEdits();
    ensureExcelBootstrapData(true);
    saveState();
    resetEquipmentForm();
    resetClientForm();
    resetOrderForm();
    renderAll();
    showMessage("כל הנתונים אופסו.", "success");
  });

  if (el.loadExcelBootstrapBtn) {
    el.loadExcelBootstrapBtn.addEventListener("click", () => {
      clearFinancePendingEdits();
      ensureExcelBootstrapData(true);
      saveState();
      renderAll();
      showMessage("נתוני האקסל נטענו למערכת.", "success");
    });
  }
}

function bindFinanceHandlers() {
  ensureFinanceRoot();
  syncIncomesRangeInputsFromViewState();

  if (el.applyIncomesRangeBtn) {
    el.applyIncomesRangeBtn.addEventListener("click", applyIncomesRangeFromInputs);
  }
  if (el.lastMonthIncomesBtn) {
    el.lastMonthIncomesBtn.addEventListener("click", () => {
      financeViewState = createDefaultFinanceViewState();
      syncIncomesRangeInputsFromViewState();
      renderFinancePanels();
    });
  }
  if (el.incomesFromDate) {
    el.incomesFromDate.addEventListener("change", applyIncomesRangeFromInputs);
  }
  if (el.incomesToDate) {
    el.incomesToDate.addEventListener("change", applyIncomesRangeFromInputs);
  }

  if (el.addIncomeRowBtn && el.incomeForm) {
    el.addIncomeRowBtn.addEventListener("click", () => {
      el.incomeForm.classList.remove("hidden");
      if (el.incomePaymentDate && !el.incomePaymentDate.value) {
        el.incomePaymentDate.value = dateToIso(new Date());
      }
      if (el.incomeClient) {
        el.incomeClient.focus();
      }
    });
  }

  if (el.incomeCancelBtn && el.incomeForm) {
    el.incomeCancelBtn.addEventListener("click", () => {
      el.incomeForm.reset();
      el.incomeForm.classList.add("hidden");
    });
  }

  if (el.incomeForm) {
    el.incomeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const paymentDateIso = String(el.incomePaymentDate?.value || "").trim();
      const client = String(el.incomeClient?.value || "").trim();
      if (!paymentDateIso || !client) {
        showMessage("יש להזין לפחות לקוח ותאריך תשלום.", "error");
        return;
      }

      ensureFinanceTableHeaders("incomes", FINANCE_INCOME_HEADERS);
      const row = createEmptyFinanceRow(state.finance.incomes.headers);
      const deliveryDateIso = String(el.incomeDeliveryDate?.value || "").trim();
      const amountBeforeVat = toNumber(el.incomeAmountBeforeVat?.value);
      const amountPaidInput = String(el.incomeAmountPaid?.value || "").trim();
      const amountPaid = amountPaidInput === "" ? amountBeforeVat : toNumber(amountPaidInput);

      row["תאריך אספקה"] = deliveryDateIso ? isoToDdMmYyyy(deliveryDateIso) : "";
      row["תאריך תשלום"] = isoToDdMmYyyy(paymentDateIso);
      row["לקוח"] = client;
      row['סכום לפני מע"מ'] = formatPlainNumber(amountBeforeVat);
      row["שולם בפועל"] = formatPlainNumber(amountPaid);
      row["סוג תשלום"] = String(el.incomePaymentType?.value || "").trim();
      row["חזר"] = String(el.incomeReturned?.value || "").trim();
      row["הערות"] = String(el.incomeNotes?.value || "").trim();
      row["הוצאות צמודות"] = String(el.incomeAttachedExpenses?.value || "").trim();

      state.finance.incomes.rows.push(row);
      saveState();
      el.incomeForm.reset();
      el.incomeForm.classList.add("hidden");
      renderAll();
      showMessage("הכנסה נוספה בהצלחה.", "success");
    });
  }

  if (el.addOpenPaymentRowBtn && el.openPaymentForm) {
    el.addOpenPaymentRowBtn.addEventListener("click", () => {
      el.openPaymentForm.classList.remove("hidden");
      if (el.openPaymentDate && !el.openPaymentDate.value) {
        el.openPaymentDate.value = dateToIso(new Date());
      }
      if (el.openPaymentClient) {
        el.openPaymentClient.focus();
      }
    });
  }

  if (el.openPaymentCancelBtn && el.openPaymentForm) {
    el.openPaymentCancelBtn.addEventListener("click", () => {
      el.openPaymentForm.reset();
      el.openPaymentForm.classList.add("hidden");
    });
  }

  if (el.openPaymentForm) {
    el.openPaymentForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const paymentDateIso = String(el.openPaymentDate?.value || "").trim();
      const client = String(el.openPaymentClient?.value || "").trim();
      if (!paymentDateIso || !client) {
        showMessage("יש להזין לפחות לקוח ותאריך במעקב תשלומים פתוחים.", "error");
        return;
      }

      ensureFinanceTableHeaders("openPayments", FINANCE_OPEN_PAYMENTS_HEADERS);
      const row = createEmptyFinanceRow(state.finance.openPayments.headers);
      const amountBeforeVat = toNumber(el.openPaymentAmountBeforeVat?.value);
      const amountPaidInput = String(el.openPaymentAmountPaid?.value || "").trim();
      const amountPaid = amountPaidInput === "" ? amountBeforeVat : toNumber(amountPaidInput);
      const balanceInput = String(el.openPaymentBalance?.value || "").trim();
      const paymentBalance = balanceInput === ""
        ? Math.max(0, amountBeforeVat - amountPaid)
        : toNumber(balanceInput);

      row["תאריך: DD/MM/YYYY"] = isoToDdMmYyyy(paymentDateIso);
      row["לקוח"] = client;
      row['סכום לפני מע"מ'] = formatPlainNumber(amountBeforeVat);
      row["שולם בפועל"] = formatPlainNumber(amountPaid);
      row["סוג תשלום"] = String(el.openPaymentType?.value || "").trim();
      row["חזר"] = String(el.openPaymentReturned?.value || "").trim();
      row["הערות"] = String(el.openPaymentNotes?.value || "").trim();
      row["הוצאות צמודות"] = String(el.openPaymentAttachedExpenses?.value || "").trim();
      row["יתרת תשלום"] = formatPlainNumber(paymentBalance);

      state.finance.openPayments.rows.push(row);
      saveState();
      el.openPaymentForm.reset();
      el.openPaymentForm.classList.add("hidden");
      renderAll();
      showMessage("רשומת תשלום פתוח נוספה בהצלחה.", "success");
    });
  }

  if (el.addShortageRowBtn && el.shortageForm) {
    el.addShortageRowBtn.addEventListener("click", () => {
      el.shortageForm.classList.remove("hidden");
      if (el.shortageDate && !el.shortageDate.value) {
        el.shortageDate.value = dateToIso(new Date());
      }
      if (el.shortageClient) {
        el.shortageClient.focus();
      }
    });
  }

  if (el.shortageCancelBtn && el.shortageForm) {
    el.shortageCancelBtn.addEventListener("click", () => {
      el.shortageForm.reset();
      el.shortageForm.classList.add("hidden");
    });
  }

  if (el.shortageForm) {
    el.shortageForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const shortageDateIso = String(el.shortageDate?.value || "").trim();
      const client = String(el.shortageClient?.value || "").trim();
      if (!shortageDateIso || !client) {
        showMessage("יש להזין לפחות לקוח ותאריך במעקב חוסרים.", "error");
        return;
      }

      ensureFinanceTableHeaders("shortages", FINANCE_SHORTAGES_HEADERS);
      const row = createEmptyFinanceRow(state.finance.shortages.headers);
      const amountBeforeVat = toNumber(el.shortageAmountBeforeVat?.value);
      const amountPaidInput = String(el.shortageAmountPaid?.value || "").trim();
      const amountPaid = amountPaidInput === "" ? amountBeforeVat : toNumber(amountPaidInput);

      row["תאריך: DD/MM/YYYY"] = isoToDdMmYyyy(shortageDateIso);
      row["לקוח"] = client;
      row['סכום לפני מע"מ'] = formatPlainNumber(amountBeforeVat);
      row["שולם בפועל"] = formatPlainNumber(amountPaid);
      row["סוג תשלום"] = String(el.shortagePaymentType?.value || "").trim();
      row["חזר"] = String(el.shortageReturned?.value || "").trim();
      row["הערות"] = String(el.shortageNotes?.value || "").trim();
      row["הוצאות צמודות"] = String(el.shortageAttachedExpenses?.value || "").trim();

      state.finance.shortages.rows.push(row);
      saveState();
      el.shortageForm.reset();
      el.shortageForm.classList.add("hidden");
      renderAll();
      showMessage("רשומת חוסר נוספה בהצלחה.", "success");
    });
  }

  if (el.fixedExpenseForm) {
    el.fixedExpenseForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const monthLabel = String(el.fixedMonthLabel.value || "").trim();
      if (!monthLabel) {
        showMessage("יש להזין חודש עבור הוצאה קבועה.", "error");
        return;
      }

      ensureFinanceTableHeaders("fixedExpenses", FINANCE_FIXED_HEADERS);
      const row = createEmptyFinanceRow(state.finance.fixedExpenses.headers);
      row["תאריך"] = monthLabel;
      row["שכירות"] = formatPlainNumber(toNumber(el.fixedRent.value));
      row["ארנונה"] = formatPlainNumber(toNumber(el.fixedArnona.value));
      row["חשמל"] = formatPlainNumber(toNumber(el.fixedElectric.value));
      row["מים"] = formatPlainNumber(toNumber(el.fixedWater.value));
      row["באסם"] = formatPlainNumber(toNumber(el.fixedBasam.value));
      row["אחינועם (בסיס)"] = formatPlainNumber(toNumber(el.fixedAhinoam.value));
      row["בונוס+עלות מעסיק"] = formatPlainNumber(toNumber(el.fixedBonus.value));
      row["פיני"] = formatPlainNumber(toNumber(el.fixedPini.value));
      row["ציפי"] = formatPlainNumber(toNumber(el.fixedTzippy.value));
      row["תוספת פיני"] = formatPlainNumber(toNumber(el.fixedPiniExtra.value));
      row["הערות"] = String(el.fixedNotes.value || "").trim();
      row['סה"כ'] = formatPlainNumber(
        toNumber(row["שכירות"]) +
          toNumber(row["ארנונה"]) +
          toNumber(row["חשמל"]) +
          toNumber(row["מים"]) +
          toNumber(row["באסם"]) +
          toNumber(row["אחינועם (בסיס)"]) +
          toNumber(row["בונוס+עלות מעסיק"]) +
          toNumber(row["פיני"]) +
          toNumber(row["ציפי"]) +
          toNumber(row["תוספת פיני"]),
      );

      state.finance.fixedExpenses.rows.push(row);
      saveState();
      el.fixedExpenseForm.reset();
      renderAll();
      showMessage("הוצאה קבועה נוספה.", "success");
    });
  }

  if (el.variableExpenseForm) {
    el.variableExpenseForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const dateInput = String(el.variableDate.value || "").trim();
      const category = String(el.variableCategory.value || "").trim();
      if (!dateInput || !category) {
        showMessage("יש להזין תאריך וקטגוריה להוצאה משתנה.", "error");
        return;
      }

      ensureFinanceTableHeaders("variableExpenses", FINANCE_VARIABLE_HEADERS);
      const row = createEmptyFinanceRow(state.finance.variableExpenses.headers);
      row["תאריך: DD/MM/YYYY"] = isoToDdMmYyyy(dateInput);
      row["קטגוריה"] = category;
      row["פירוט"] = String(el.variableDetail.value || "").trim();
      row["סכום"] = formatPlainNumber(toNumber(el.variableAmountBeforeVat.value));
      row["סכום אחרי מעמ"] = formatPlainNumber(toNumber(el.variableAmountAfterVat.value));
      row["הערות"] = String(el.variableNotes.value || "").trim();

      state.finance.variableExpenses.rows.push(row);
      saveState();
      el.variableExpenseForm.reset();
      renderAll();
      showMessage("הוצאה משתנה נוספה.", "success");
    });
  }

  bindFinanceTableInteractions(el.financeIncomesTable, "incomes", {
    allowInlineEdit: true,
    allowDelete: true,
  });
  bindFinanceTableInteractions(el.financeOpenPaymentsTable, "openPayments", {
    allowInlineEdit: true,
    allowDelete: true,
  });
  bindFinanceTableInteractions(el.financeShortagesTable, "shortages", {
    allowInlineEdit: true,
    allowDelete: true,
  });
  bindFinanceTableInteractions(el.financeFixedExpensesTable, "fixedExpenses", {
    allowInlineEdit: true,
    allowDelete: true,
  });
  bindFinanceTableInteractions(el.financeVariableExpensesTable, "variableExpenses", {
    allowInlineEdit: true,
    allowDelete: true,
  });

  if (el.annualSummaryYear) {
    el.annualSummaryYear.addEventListener("change", renderAnnualSummaryPanel);
  }
}

function ensureFinanceRoot() {
  if (!state.finance || typeof state.finance !== "object") {
    state.finance = createDefaultFinanceState();
  }
  const keys = [
    "incomes",
    "openPayments",
    "shortages",
    "fixedExpenses",
    "variableExpenses",
    "monthlySummary2025",
    "monthlySummary2026",
  ];
  keys.forEach((key) => {
    if (!state.finance[key] || typeof state.finance[key] !== "object") {
      state.finance[key] = createFinanceTableState();
    }
    if (!Array.isArray(state.finance[key].headers)) {
      state.finance[key].headers = [];
    }
    if (!Array.isArray(state.finance[key].rows)) {
      state.finance[key].rows = [];
    }
    state.finance[key].sheetName = String(state.finance[key].sheetName || "");
  });
  if (!state.meta || typeof state.meta !== "object") {
    state.meta = { excelBootstrapVersion: "" };
  }
  if (typeof state.meta.excelBootstrapVersion !== "string") {
    state.meta.excelBootstrapVersion = "";
  }
}

function ensureExcelBootstrapData(forceReload) {
  const shouldForce = Boolean(forceReload);
  const bootstrap = window.EXCEL_BOOTSTRAP_DATA;
  if (!bootstrap || typeof bootstrap !== "object") {
    return false;
  }

  ensureFinanceRoot();
  if (!shouldForce && state.meta.excelBootstrapVersion === EXCEL_BOOTSTRAP_VERSION) {
    return false;
  }

  clearFinancePendingEdits();
  state.finance.incomes = normalizeFinanceTable(bootstrap.incomes);
  state.finance.openPayments = normalizeFinanceTable(bootstrap.openPayments);
  state.finance.shortages = normalizeFinanceTable(bootstrap.shortages);
  state.finance.fixedExpenses = normalizeFinanceTable(bootstrap.fixedExpenses);
  state.finance.variableExpenses = normalizeFinanceTable(bootstrap.variableExpenses);
  state.finance.monthlySummary2025 = normalizeFinanceTable(bootstrap.monthlySummary2025);
  state.finance.monthlySummary2026 = normalizeFinanceTable(bootstrap.monthlySummary2026);
  state.meta.excelBootstrapVersion = EXCEL_BOOTSTRAP_VERSION;
  return true;
}

function normalizeFinanceTable(rawTable) {
  const table = createFinanceTableState();
  if (!rawTable || typeof rawTable !== "object") {
    return table;
  }

  table.sheetName = String(rawTable.sheetName || "");
  const sourceHeaders = Array.isArray(rawTable.headers)
    ? rawTable.headers.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  table.headers = sourceHeaders;

  const rawRows = Array.isArray(rawTable.rows) ? rawTable.rows : [];
  table.rows = rawRows
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const normalizedRow = {};
      if (table.headers.length > 0) {
        table.headers.forEach((header) => {
          normalizedRow[header] = String(row[header] ?? "").trim();
        });
      } else {
        Object.entries(row).forEach(([key, value]) => {
          normalizedRow[String(key || "").trim()] = String(value ?? "").trim();
        });
      }
      return normalizedRow;
    })
    .filter((row) => {
      const values = Object.values(row).map((value) => String(value || "").trim());
      if (values.every((value) => value === "")) return false;
      if (values.every((value) => value === "0" || value === "0.00" || value === "0,00")) return false;
      return true;
    });

  return table;
}

function createEmptyFinanceRow(headers) {
  const row = {};
  headers.forEach((header) => {
    row[header] = "";
  });
  return row;
}

function ensureFinanceTableHeaders(tableKey, fallbackHeaders) {
  ensureFinanceRoot();
  const table = state.finance[tableKey];
  if (!table || !Array.isArray(table.headers)) return;
  if (table.headers.length === 0) {
    table.headers = fallbackHeaders.slice();
    return;
  }
  fallbackHeaders.forEach((header) => {
    if (!table.headers.includes(header)) {
      table.headers.push(header);
    }
  });
}

function normalizeIsoDateInput(value) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function syncIncomesRangeInputsFromViewState() {
  if (el.incomesFromDate) {
    el.incomesFromDate.value = normalizeIsoDateInput(financeViewState.incomesFrom);
  }
  if (el.incomesToDate) {
    el.incomesToDate.value = normalizeIsoDateInput(financeViewState.incomesTo);
  }
}

function applyIncomesRangeFromInputs() {
  if (!el.incomesFromDate || !el.incomesToDate) return;
  let fromIso = normalizeIsoDateInput(el.incomesFromDate.value);
  let toIso = normalizeIsoDateInput(el.incomesToDate.value);
  if (fromIso && toIso && fromIso > toIso) {
    const temp = fromIso;
    fromIso = toIso;
    toIso = temp;
  }
  financeViewState.incomesFrom = fromIso;
  financeViewState.incomesTo = toIso;
  syncIncomesRangeInputsFromViewState();
  renderFinancePanels();
}

function financeParsedDateToIso(parsed) {
  if (!parsed || typeof parsed !== "object") return "";
  const year = toInt(parsed.year);
  const month = Math.max(1, Math.min(12, toInt(parsed.month) + 1));
  const day = Math.max(1, Math.min(31, toInt(parsed.day) || 1));
  if (year < 1900) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getIncomesDateIsoFromRow(row) {
  const parsed = parseAnyFinanceDate(
    getFinanceValue(row, ["תאריך תשלום", "תאריך אספקה", "תאריך: DD/MM/YYYY", "תאריך"]),
  );
  return financeParsedDateToIso(parsed);
}

function getFilteredIncomesViewData(table, fromIso, toIso) {
  const sourceTable = table && typeof table === "object" ? table : createFinanceTableState();
  const headers = Array.isArray(sourceTable.headers) ? sourceTable.headers : [];
  const rows = Array.isArray(sourceTable.rows) ? sourceTable.rows : [];
  const hasRange = Boolean(fromIso || toIso);
  const filteredRows = [];
  const rowIndexMap = [];
  let totalIncome = 0;
  let excludedMissingDate = 0;

  rows.forEach((row, index) => {
    const rowDateIso = getIncomesDateIsoFromRow(row);
    let include = true;
    if (hasRange) {
      if (!rowDateIso) {
        include = false;
        excludedMissingDate += 1;
      } else {
        if (fromIso && rowDateIso < fromIso) include = false;
        if (toIso && rowDateIso > toIso) include = false;
      }
    }
    if (!include) return;

    filteredRows.push(row);
    rowIndexMap.push(index);
    totalIncome += parseFinanceNumber(getFinanceValue(row, ["שולם בפועל", "סכום לפני מע\"מ", "סכום לפני מעמ", "סכום"]));
  });

  return {
    table: {
      sheetName: sourceTable.sheetName,
      headers,
      rows: filteredRows,
    },
    rowIndexMap,
    fromIso: normalizeIsoDateInput(fromIso),
    toIso: normalizeIsoDateInput(toIso),
    totalRows: rows.length,
    visibleRows: filteredRows.length,
    excludedMissingDate,
    totalIncome,
  };
}

function renderIncomesRangeSummary(viewData) {
  if (!el.financeIncomesRangeSummary) return;
  const data = viewData || {};
  const totalRows = Number.isFinite(data.totalRows) ? data.totalRows : 0;
  const visibleRows = Number.isFinite(data.visibleRows) ? data.visibleRows : 0;
  const totalIncome = Number.isFinite(data.totalIncome) ? data.totalIncome : 0;
  const fromIso = normalizeIsoDateInput(data.fromIso);
  const toIso = normalizeIsoDateInput(data.toIso);
  const hasRange = Boolean(fromIso || toIso);

  if (totalRows === 0) {
    el.financeIncomesRangeSummary.textContent = "אין נתוני הכנסות להצגה.";
    return;
  }

  const fromLabel = fromIso ? formatDate(fromIso) : "התחלה";
  const toLabel = toIso ? formatDate(toIso) : "היום";
  let text = `מציג ${visibleRows} מתוך ${totalRows} רשומות.`;
  if (hasRange) {
    text += ` תקופה: ${fromLabel} עד ${toLabel}.`;
  }
  text += ` סה"כ הכנסות לתקופה: ${formatCurrency(totalIncome)}.`;

  if (hasRange && Number.isFinite(data.excludedMissingDate) && data.excludedMissingDate > 0) {
    text += ` (${data.excludedMissingDate} רשומות ללא תאריך לא נכללו)`;
  }

  el.financeIncomesRangeSummary.textContent = text;
}

function clearFinancePendingEdits() {
  financePendingEdits = {};
}

function getPendingFinanceRow(tableKey, rowIndex) {
  const tablePending = financePendingEdits[String(tableKey || "")];
  if (!tablePending || typeof tablePending !== "object") return null;
  const rowPending = tablePending[String(rowIndex)];
  return rowPending && typeof rowPending === "object" ? rowPending : null;
}

function hasPendingFinanceRow(tableKey, rowIndex) {
  const rowPending = getPendingFinanceRow(tableKey, rowIndex);
  return !!rowPending && Object.keys(rowPending).length > 0;
}

function getPendingFinanceCellValue(tableKey, rowIndex, header, fallbackValue) {
  const rowPending = getPendingFinanceRow(tableKey, rowIndex);
  if (!rowPending) return String(fallbackValue || "");
  if (!Object.prototype.hasOwnProperty.call(rowPending, header)) {
    return String(fallbackValue || "");
  }
  return String(rowPending[header] || "");
}

function setPendingFinanceCellValue(tableKey, rowIndex, header, nextValue, baseValue) {
  const safeTableKey = String(tableKey || "");
  const safeHeader = String(header || "");
  const safeNext = String(nextValue || "");
  const safeBase = String(baseValue || "");
  if (!safeTableKey || !safeHeader) return;

  if (!financePendingEdits[safeTableKey] || typeof financePendingEdits[safeTableKey] !== "object") {
    financePendingEdits[safeTableKey] = {};
  }
  const rowKey = String(rowIndex);
  if (!financePendingEdits[safeTableKey][rowKey] || typeof financePendingEdits[safeTableKey][rowKey] !== "object") {
    financePendingEdits[safeTableKey][rowKey] = {};
  }
  const rowPending = financePendingEdits[safeTableKey][rowKey];

  if (safeNext === safeBase) {
    delete rowPending[safeHeader];
  } else {
    rowPending[safeHeader] = safeNext;
  }

  if (Object.keys(rowPending).length === 0) {
    delete financePendingEdits[safeTableKey][rowKey];
  }
  if (Object.keys(financePendingEdits[safeTableKey]).length === 0) {
    delete financePendingEdits[safeTableKey];
  }
}

function clearPendingFinanceRow(tableKey, rowIndex) {
  const safeTableKey = String(tableKey || "");
  const tablePending = financePendingEdits[safeTableKey];
  if (!tablePending || typeof tablePending !== "object") return;
  delete tablePending[String(rowIndex)];
  if (Object.keys(tablePending).length === 0) {
    delete financePendingEdits[safeTableKey];
  }
}

function shiftPendingFinanceRowsAfterDelete(tableKey, deletedRowIndex) {
  const safeTableKey = String(tableKey || "");
  const tablePending = financePendingEdits[safeTableKey];
  if (!tablePending || typeof tablePending !== "object") return;

  const nextPending = {};
  Object.entries(tablePending).forEach(([rowKey, pendingValues]) => {
    const rowIndex = toInt(rowKey);
    if (rowIndex < deletedRowIndex) {
      nextPending[String(rowIndex)] = pendingValues;
      return;
    }
    if (rowIndex > deletedRowIndex) {
      nextPending[String(rowIndex - 1)] = pendingValues;
    }
  });

  if (Object.keys(nextPending).length > 0) {
    financePendingEdits[safeTableKey] = nextPending;
  } else {
    delete financePendingEdits[safeTableKey];
  }
}

function isFixedExpenseComponentHeader(header) {
  const normalizedHeader = normalizeFinanceHeaderKey(header);
  return FINANCE_FIXED_COMPONENT_HEADERS.some((entry) => normalizeFinanceHeaderKey(entry) === normalizedHeader);
}

function bindFinanceTableInteractions(container, tableKey, options) {
  if (!container) return;
  const settings = options || {};
  const allowDelete = Boolean(settings.allowDelete);
  const allowInlineEdit = Boolean(settings.allowInlineEdit);

  container.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const index = toInt(target.dataset.index);
    if (index < 0) return;

    if (target.dataset.action === "save-finance-row") {
      const pending = getPendingFinanceRow(tableKey, index);
      if (!pending || Object.keys(pending).length === 0) {
        showMessage("אין שינויים לשמירה בשורה זו.", "info");
        return;
      }

      ensureFinanceRoot();
      const table = state.finance[tableKey];
      if (!table || !Array.isArray(table.rows) || index >= table.rows.length) return;
      const row = table.rows[index];
      if (!row || typeof row !== "object") return;

      const changedHeaders = Object.keys(pending);
      changedHeaders.forEach((header) => {
        row[header] = String(pending[header] || "");
      });

      if (tableKey === "fixedExpenses" && changedHeaders.some((header) => isFixedExpenseComponentHeader(header))) {
        recalculateFixedExpenseRowTotal(row, "");
      }

      clearPendingFinanceRow(tableKey, index);
      saveState();
      renderFinancePanels();
      showMessage("השינויים נשמרו.", "success");
      return;
    }

    if (target.dataset.action !== "delete-finance-row" || !allowDelete) return;
    ensureFinanceRoot();
    const table = state.finance[tableKey];
    if (!table || !Array.isArray(table.rows) || index >= table.rows.length) return;
    if (!window.confirm("למחוק את השורה הזו?")) return;
    table.rows.splice(index, 1);
    shiftPendingFinanceRowsAfterDelete(tableKey, index);
    saveState();
    renderFinancePanels();
    showMessage("השורה נמחקה.", "success");
  });

  if (!allowInlineEdit) return;

  container.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.financeEditable !== "1") return;
    target.dataset.originalValue = target.textContent || "";
  });

  container.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.financeEditable !== "1") return;

    if (event.key === "Enter") {
      event.preventDefault();
      target.blur();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      target.textContent = target.dataset.originalValue || "";
      target.blur();
    }
  });

  container.addEventListener("focusout", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.financeEditable !== "1") return;

    const rowIndex = toInt(target.dataset.rowIndex);
    if (rowIndex < 0) return;

    let header = "";
    const encodedHeader = String(target.dataset.headerKey || "");
    try {
      header = decodeURIComponent(encodedHeader);
    } catch {
      header = encodedHeader;
    }
    header = String(header || "").trim();
    if (!header) return;

    ensureFinanceRoot();
    const table = state.finance[tableKey];
    if (!table || !Array.isArray(table.rows) || rowIndex >= table.rows.length) return;
    const row = table.rows[rowIndex];
    if (!row || typeof row !== "object") return;

    const nextValue = normalizeInlineFinanceCellValue(target.textContent);
    const baseValue = String(row[header] ?? "");
    setPendingFinanceCellValue(tableKey, rowIndex, header, nextValue, baseValue);
    target.textContent = getPendingFinanceCellValue(tableKey, rowIndex, header, baseValue);

    const rowElement = target.closest("tr");
    if (!rowElement) return;
    const isDirty = hasPendingFinanceRow(tableKey, rowIndex);
    rowElement.classList.toggle("finance-row-dirty", isDirty);
    const saveButton = rowElement.querySelector('button[data-action="save-finance-row"]');
    if (saveButton instanceof HTMLButtonElement) {
      saveButton.disabled = !isDirty;
      saveButton.classList.toggle("btn-secondary", !isDirty);
    }
  });
}

function normalizeInlineFinanceCellValue(value) {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}

function recalculateFixedExpenseRowTotal(row, changedHeader) {
  if (!row || typeof row !== "object") return;
  const normalizedChanged = normalizeFinanceHeaderKey(changedHeader);
  const totalKey = Object.keys(row).find((key) => {
    const normalized = normalizeFinanceHeaderKey(key);
    return normalized === normalizeFinanceHeaderKey('סה"כ') || normalized === normalizeFinanceHeaderKey("סה״כ");
  });
  const normalizedTotal = normalizeFinanceHeaderKey(totalKey || 'סה"כ');
  if (normalizedChanged === normalizedTotal) return;

  const total = FINANCE_FIXED_COMPONENT_HEADERS.reduce((sum, header) => {
    return sum + parseFinanceNumber(getFinanceValue(row, [header]));
  }, 0);
  row[totalKey || 'סה"כ'] = formatPlainNumber(total);
}

function renderFinancePanels() {
  ensureFinanceRoot();
  const incomesViewData = getFilteredIncomesViewData(
    state.finance.incomes,
    financeViewState.incomesFrom,
    financeViewState.incomesTo,
  );
  renderFinanceTableInContainer(el.financeIncomesTable, state.finance.incomes, {
    tableKey: "incomes",
    rowLimit: 5000,
    editableCells: true,
    includeDeleteAction: true,
    includeSaveAction: true,
    rowIndexMap: incomesViewData.rowIndexMap,
    tableOverride: incomesViewData.table,
  });
  renderIncomesRangeSummary(incomesViewData);
  renderFinanceTableInContainer(el.financeOpenPaymentsTable, state.finance.openPayments, {
    tableKey: "openPayments",
    rowLimit: 5000,
    editableCells: true,
    includeDeleteAction: true,
    includeSaveAction: true,
  });
  renderFinanceTableInContainer(el.financeShortagesTable, state.finance.shortages, {
    tableKey: "shortages",
    rowLimit: 5000,
    editableCells: true,
    includeDeleteAction: true,
    includeSaveAction: true,
  });
  renderFinanceTableInContainer(el.financeFixedExpensesTable, state.finance.fixedExpenses, {
    tableKey: "fixedExpenses",
    rowLimit: 5000,
    includeDeleteAction: true,
    editableCells: true,
    includeSaveAction: true,
  });
  renderFinanceTableInContainer(el.financeVariableExpensesTable, state.finance.variableExpenses, {
    tableKey: "variableExpenses",
    rowLimit: 5000,
    includeDeleteAction: true,
    editableCells: true,
    includeSaveAction: true,
  });
  renderAnnualSummaryPanel();
  renderFinanceTableInContainer(el.monthlySummary2025Table, state.finance.monthlySummary2025, { rowLimit: 100 });
  renderFinanceTableInContainer(el.monthlySummary2026Table, state.finance.monthlySummary2026, { rowLimit: 100 });
}

function renderFinanceTableInContainer(container, table, options) {
  if (!container) return;
  const settings = options || {};
  const tableKey = String(settings.tableKey || "");
  const rowLimit = Number.isFinite(settings.rowLimit) ? Math.max(1, settings.rowLimit) : 300;
  const includeDeleteAction = Boolean(settings.includeDeleteAction);
  const editableCells = Boolean(settings.editableCells);
  const includeSaveAction = Boolean(settings.includeSaveAction) && editableCells && Boolean(tableKey);
  const includeActionColumn = includeDeleteAction || includeSaveAction;
  const tableOverride = settings.tableOverride && typeof settings.tableOverride === "object" ? settings.tableOverride : null;
  const sourceTable = tableOverride || (table && typeof table === "object" ? table : createFinanceTableState());
  const headers = Array.isArray(sourceTable.headers) ? sourceTable.headers : [];
  const rows = Array.isArray(sourceTable.rows) ? sourceTable.rows : [];
  const sourceRowIndexMap = Array.isArray(settings.rowIndexMap) ? settings.rowIndexMap : [];

  if (headers.length === 0) {
    container.innerHTML = `<p class="empty-state">אין נתונים להצגה.</p>`;
    return;
  }

  const visibleRows = rows.slice(0, rowLimit);
  const visibleSourceIndexes =
    sourceRowIndexMap.length > 0
      ? sourceRowIndexMap.slice(0, visibleRows.length).map((value, index) => {
          const mapped = toInt(value);
          return mapped >= 0 ? mapped : index;
        })
      : visibleRows.map((_, index) => index);
  const headHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const actionHeadHtml = includeActionColumn ? "<th>פעולה</th>" : "";
  const bodyHtml =
    visibleRows.length === 0
      ? `<tr><td colspan="${headers.length + (includeActionColumn ? 1 : 0)}">אין רשומות.</td></tr>`
      : visibleRows
          .map((row, index) => {
            const sourceIndex = visibleSourceIndexes[index] ?? index;
            const hasPending = includeSaveAction ? hasPendingFinanceRow(tableKey, sourceIndex) : false;
            const rowClasses = [];
            if (editableCells) rowClasses.push("finance-editable-row");
            if (hasPending) rowClasses.push("finance-row-dirty");
            const rowClass = rowClasses.length > 0 ? ` class="${rowClasses.join(" ")}"` : "";
            const cells = headers
              .map((header) => {
                const rawValue = String(row[header] || "");
                const displayValue = includeSaveAction
                  ? getPendingFinanceCellValue(tableKey, sourceIndex, header, rawValue)
                  : rawValue;
                if (!editableCells) {
                  return `<td>${escapeHtml(displayValue)}</td>`;
                }
                const encodedHeader = encodeURIComponent(header);
                return `<td class="finance-editable-cell" contenteditable="true" spellcheck="false" data-finance-editable="1" data-row-index="${sourceIndex}" data-header-key="${encodedHeader}">${escapeHtml(displayValue)}</td>`;
              })
              .join("");
            const saveButton = includeSaveAction
              ? `<button class="btn ${hasPending ? "" : "btn-secondary"}" data-action="save-finance-row" data-index="${sourceIndex}" ${hasPending ? "" : "disabled"}>שמירה</button>`
              : "";
            const deleteButton = includeDeleteAction
              ? `<button class="btn btn-danger" data-action="delete-finance-row" data-index="${sourceIndex}">מחיקה</button>`
              : "";
            const actionCell = includeActionColumn ? `<td class="actions">${saveButton}${deleteButton}</td>` : "";
            return `<tr${rowClass}>${cells}${actionCell}</tr>`;
          })
          .join("");

  const limitNote =
    rows.length > rowLimit
      ? `<p class="muted-text finance-note">מוצגות ${rowLimit} מתוך ${rows.length} רשומות.</p>`
      : "";
  const editHint = editableCells
    ? `<p class="muted-text finance-note">אפשר לערוך תאים ישירות בטבלה. השינויים נשמרים רק בלחיצה על כפתור שמירה.</p>`
    : "";

  container.innerHTML = `
    ${editHint}
    ${limitNote}
    <table>
      <thead><tr>${headHtml}${actionHeadHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  `;
}

function renderAnnualSummaryPanel() {
  if (!el.annualSummaryTableBody || !el.annualSummaryStats || !el.annualSummaryYear) return;
  const years = collectFinanceYears();
  if (years.length === 0) {
    el.annualSummaryYear.innerHTML = `<option value="">אין נתונים</option>`;
    el.annualSummaryTableBody.innerHTML = `<tr><td colspan="5">אין נתונים זמינים.</td></tr>`;
    el.annualSummaryStats.innerHTML = `<p class="muted-text">אין נתונים לסיכום שנתי.</p>`;
    renderAnnualYearlyChart([]);
    return;
  }

  const currentValue = Number.parseInt(el.annualSummaryYear.value, 10);
  const selectedYear = years.includes(currentValue) ? currentValue : years[0];
  el.annualSummaryYear.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
  el.annualSummaryYear.value = String(selectedYear);
  renderAnnualYearlyChart(years);

  const monthly = calculateAnnualSummary(selectedYear);
  el.annualSummaryTableBody.innerHTML = monthly
    .map((entry) => {
      const profitClass = entry.profit >= 0 ? "availability-ok" : "availability-bad";
      return `<tr>
        <td>${escapeHtml(MONTH_NAMES_HE[entry.monthIndex])}</td>
        <td>${formatCurrency(entry.income)}</td>
        <td>${formatCurrency(entry.fixed)}</td>
        <td>${formatCurrency(entry.variable)}</td>
        <td class="${profitClass}">${formatCurrency(entry.profit)}</td>
      </tr>`;
    })
    .join("");

  const totalIncome = monthly.reduce((sum, row) => sum + row.income, 0);
  const totalFixed = monthly.reduce((sum, row) => sum + row.fixed, 0);
  const totalVariable = monthly.reduce((sum, row) => sum + row.variable, 0);
  const totalProfit = totalIncome - totalFixed - totalVariable;

  el.annualSummaryStats.innerHTML = `
    <p>סה"כ הכנסות: <strong>${formatCurrency(totalIncome)}</strong></p>
    <p>סה"כ הוצאות קבועות: <strong>${formatCurrency(totalFixed)}</strong></p>
    <p>סה"כ הוצאות משתנות: <strong>${formatCurrency(totalVariable)}</strong></p>
    <p>רווח שנתי: <strong class="${totalProfit >= 0 ? "availability-ok" : "availability-bad"}">${formatCurrency(totalProfit)}</strong></p>
  `;
}

function buildYearlyFinanceSeries(years) {
  const normalizedYears = Array.from(
    new Set((Array.isArray(years) ? years : []).map((year) => toInt(year)).filter((year) => year > 0)),
  ).sort((a, b) => a - b);

  return normalizedYears
    .map((year) => {
      const monthly = calculateAnnualSummary(year);
      let income = monthly.reduce((sum, row) => sum + row.income, 0);
      let fixed = monthly.reduce((sum, row) => sum + row.fixed, 0);
      let variable = monthly.reduce((sum, row) => sum + row.variable, 0);

      if (income <= 0 && fixed <= 0 && variable <= 0) {
        const fallbackTotals = buildFallbackYearTotalsFromMonthlySummary(year);
        if (fallbackTotals) {
          income = fallbackTotals.income;
          fixed = fallbackTotals.fixed;
          variable = fallbackTotals.variable;
        }
      }

      const expenses = fixed + variable;
      return {
        year,
        income,
        fixed,
        variable,
        expenses,
        profit: income - expenses,
      };
    })
    .filter((entry) => entry.income > 0 || entry.expenses > 0);
}

function buildFallbackYearTotalsFromMonthlySummary(year) {
  const summaryTables = [state.finance?.monthlySummary2025, state.finance?.monthlySummary2026];
  let income = 0;
  let fixed = 0;
  let variable = 0;
  let hasRows = false;

  summaryTables.forEach((table) => {
    const rows = Array.isArray(table?.rows) ? table.rows : [];
    rows.forEach((row) => {
      const monthCell = getFinanceValue(row, ["חודש", "תאריך"]);
      const parsedDate = parseAnyFinanceDate(monthCell);
      if (!parsedDate || parsedDate.year !== year) return;
      hasRows = true;
      income += parseFinanceNumber(getFinanceValue(row, ["הכנסות", "הכנסה"]));
      fixed += parseFinanceNumber(getFinanceValue(row, ["הוצאות קבועות", "הוצאה קבועה"]));
      variable += parseFinanceNumber(getFinanceValue(row, ["הוצאות משתנות", "הוצאה משתנה"]));
    });
  });

  if (!hasRows) return null;
  return { income, fixed, variable };
}

function renderAnnualYearlyChart(years) {
  if (!el.annualSummaryYearlyChart) return;
  const series = buildYearlyFinanceSeries(years);
  if (series.length === 0) {
    el.annualSummaryYearlyChart.innerHTML = `<p class="muted-text">אין מספיק נתונים להצגת גרף שנתי.</p>`;
    return;
  }

  const width = Math.max(760, series.length * 170 + 220);
  const height = 430;
  const margin = { top: 34, right: 28, bottom: 82, left: 90 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const bottomY = margin.top + innerHeight;
  const maxValue = Math.max(1, ...series.map((entry) => Math.max(entry.income, entry.expenses)));
  const groupWidth = innerWidth / series.length;
  const barWidth = Math.max(16, Math.min(34, groupWidth * 0.24));
  const pairGap = Math.max(8, Math.min(18, groupWidth * 0.15));
  const showValueLabels = series.length <= 7;

  const toY = (value) => margin.top + innerHeight - (Math.max(0, value) / maxValue) * innerHeight;

  const gridLines = Array.from({ length: 6 }, (_, index) => {
    const value = (maxValue / 5) * index;
    const y = toY(value);
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="annual-chart-grid-line" />
      <text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" class="annual-chart-axis-label">${escapeHtml(formatCurrencyShort(value))}</text>
    `;
  }).join("");

  const bars = series
    .map((entry, index) => {
      const centerX = margin.left + groupWidth * index + groupWidth / 2;
      const incomeX = centerX - pairGap / 2 - barWidth;
      const expenseX = centerX + pairGap / 2;

      const incomeY = toY(entry.income);
      const incomeHeight = Math.max(0, bottomY - incomeY);

      const expenseY = toY(entry.expenses);
      const expenseHeight = Math.max(0, bottomY - expenseY);
      const variableHeight = entry.expenses > 0 ? (entry.variable / entry.expenses) * expenseHeight : 0;

      const yearLabelY = height - 28;
      const incomeLabelY = Math.max(margin.top + 12, incomeY - 8);
      const expenseLabelY = Math.max(margin.top + 12, expenseY - 8);
      const annualTitle = `${entry.year}\nהכנסות: ${formatCurrency(entry.income)}\nהוצאות קבועות: ${formatCurrency(entry.fixed)}\nהוצאות משתנות: ${formatCurrency(entry.variable)}\nסה\"כ הוצאות: ${formatCurrency(entry.expenses)}\nרווח: ${formatCurrency(entry.profit)}`;

      return `
        <g class="annual-chart-year-group">
          <rect x="${incomeX}" y="${incomeY}" width="${barWidth}" height="${incomeHeight}" rx="9" class="annual-chart-income-bar">
            <title>${escapeHtml(annualTitle)}</title>
          </rect>
          <rect x="${expenseX}" y="${expenseY}" width="${barWidth}" height="${expenseHeight}" rx="9" class="annual-chart-fixed-bar">
            <title>${escapeHtml(annualTitle)}</title>
          </rect>
          ${
            variableHeight > 1
              ? `<rect x="${expenseX}" y="${expenseY}" width="${barWidth}" height="${variableHeight}" rx="9" class="annual-chart-variable-bar"><title>${escapeHtml(annualTitle)}</title></rect>`
              : ""
          }
          <text x="${centerX}" y="${yearLabelY}" text-anchor="middle" class="annual-chart-year-label">${entry.year}</text>
          ${
            showValueLabels
              ? `<text x="${incomeX + barWidth / 2}" y="${incomeLabelY}" text-anchor="middle" class="annual-chart-value-label">${escapeHtml(formatCurrencyShort(entry.income))}</text>
                 <text x="${expenseX + barWidth / 2}" y="${expenseLabelY}" text-anchor="middle" class="annual-chart-value-label">${escapeHtml(formatCurrencyShort(entry.expenses))}</text>`
              : ""
          }
        </g>
      `;
    })
    .join("");

  const totalIncome = series.reduce((sum, entry) => sum + entry.income, 0);
  const totalExpenses = series.reduce((sum, entry) => sum + entry.expenses, 0);
  const totalProfit = totalIncome - totalExpenses;

  el.annualSummaryYearlyChart.innerHTML = `
    <div class="annual-chart-legend">
      <span><i class="annual-chart-dot annual-chart-dot-income"></i>הכנסות</span>
      <span><i class="annual-chart-dot annual-chart-dot-fixed"></i>הוצאות קבועות</span>
      <span><i class="annual-chart-dot annual-chart-dot-variable"></i>הוצאות משתנות</span>
    </div>
    <div class="annual-chart-svg-wrap">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="גרף הכנסות והוצאות לפי שנים" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="annualIncomeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#22b37d" />
            <stop offset="100%" stop-color="#0b7f59" />
          </linearGradient>
          <linearGradient id="annualFixedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f0a24d" />
            <stop offset="100%" stop-color="#be6a19" />
          </linearGradient>
          <linearGradient id="annualVariableGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#e05b2b" />
            <stop offset="100%" stop-color="#b33d18" />
          </linearGradient>
        </defs>
        ${gridLines}
        <line x1="${margin.left}" y1="${bottomY}" x2="${width - margin.right}" y2="${bottomY}" class="annual-chart-axis-line" />
        ${bars}
      </svg>
    </div>
    <p class="annual-chart-caption">
      סה"כ הכנסות רב-שנתי: <strong>${formatCurrency(totalIncome)}</strong> |
      סה"כ הוצאות רב-שנתי: <strong>${formatCurrency(totalExpenses)}</strong> |
      רווח מצטבר: <strong class="${totalProfit >= 0 ? "availability-ok" : "availability-bad"}">${formatCurrency(totalProfit)}</strong>
    </p>
  `;
}

function collectFinanceYears() {
  ensureFinanceRoot();
  const years = new Set();

  state.finance.incomes.rows.forEach((row) => {
    const parsed = parseAnyFinanceDate(getFinanceValue(row, ["תאריך תשלום", "תאריך אספקה", "תאריך: DD/MM/YYYY", "תאריך"]));
    if (parsed) years.add(parsed.year);
  });
  state.finance.variableExpenses.rows.forEach((row) => {
    const parsed = parseAnyFinanceDate(getFinanceValue(row, ["תאריך: DD/MM/YYYY", "תאריך"]));
    if (parsed) years.add(parsed.year);
  });
  state.finance.fixedExpenses.rows.forEach((row) => {
    const parsed = parseAnyFinanceDate(getFinanceValue(row, ["תאריך", "חודש"]));
    if (parsed) years.add(parsed.year);
  });
  state.finance.monthlySummary2025.rows.forEach((row) => {
    const parsed = parseAnyFinanceDate(getFinanceValue(row, ["חודש"]));
    if (parsed) years.add(parsed.year);
  });
  state.finance.monthlySummary2026.rows.forEach((row) => {
    const parsed = parseAnyFinanceDate(getFinanceValue(row, ["חודש"]));
    if (parsed) years.add(parsed.year);
  });

  return Array.from(years).sort((a, b) => b - a);
}

function calculateAnnualSummary(year) {
  const result = Array.from({ length: 12 }, (_, monthIndex) => ({
    monthIndex,
    income: 0,
    fixed: 0,
    variable: 0,
    profit: 0,
  }));

  state.finance.incomes.rows.forEach((row) => {
    const parsedDate = parseAnyFinanceDate(getFinanceValue(row, ["תאריך תשלום", "תאריך אספקה", "תאריך"]));
    if (!parsedDate || parsedDate.year !== year) return;
    const amount = parseFinanceNumber(getFinanceValue(row, ["שולם בפועל", "סכום לפני מע\"מ", "סכום לפני מעמ", "סכום"]));
    result[parsedDate.month].income += amount;
  });

  state.finance.fixedExpenses.rows.forEach((row) => {
    const parsedDate = parseAnyFinanceDate(getFinanceValue(row, ["תאריך", "חודש"]));
    if (!parsedDate || parsedDate.year !== year) return;
    const amountFromTotal = parseFinanceNumber(getFinanceValue(row, ['סה"כ', "סה״כ"]));
    const amount =
      amountFromTotal > 0
        ? amountFromTotal
        : parseFinanceNumber(row["שכירות"]) +
          parseFinanceNumber(row["ארנונה"]) +
          parseFinanceNumber(row["חשמל"]) +
          parseFinanceNumber(row["מים"]) +
          parseFinanceNumber(row["באסם"]) +
          parseFinanceNumber(row["אחינועם (בסיס)"]) +
          parseFinanceNumber(row["בונוס+עלות מעסיק"]) +
          parseFinanceNumber(row["פיני"]) +
          parseFinanceNumber(row["ציפי"]) +
          parseFinanceNumber(row["תוספת פיני"]);
    result[parsedDate.month].fixed += amount;
  });

  state.finance.variableExpenses.rows.forEach((row) => {
    const parsedDate = parseAnyFinanceDate(getFinanceValue(row, ["תאריך: DD/MM/YYYY", "תאריך"]));
    if (!parsedDate || parsedDate.year !== year) return;
    const amount = parseFinanceNumber(getFinanceValue(row, ["סכום אחרי מעמ", "סכום אחרי מע\"מ", "סכום"]));
    result[parsedDate.month].variable += amount;
  });

  result.forEach((entry) => {
    entry.profit = entry.income - entry.fixed - entry.variable;
  });
  return result;
}

function getFinanceValue(row, candidates) {
  if (!row || typeof row !== "object") return "";
  for (const candidate of candidates) {
    const key = String(candidate || "").trim();
    if (!key) continue;
    if (row[key] !== undefined) return String(row[key] || "").trim();

    const normalizedCandidate = normalizeFinanceHeaderKey(key);
    const dynamicKey = Object.keys(row).find((existing) => normalizeFinanceHeaderKey(existing) === normalizedCandidate);
    if (dynamicKey) {
      return String(row[dynamicKey] || "").trim();
    }
  }
  return "";
}

function normalizeFinanceHeaderKey(value) {
  return String(value || "")
    .replaceAll('"', "")
    .replaceAll("״", "")
    .replaceAll("'", "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function parseAnyFinanceDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const monthYear = parseHebrewMonthYear(raw);
  if (monthYear) return monthYear;

  const ddmmyyyyMatch = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (ddmmyyyyMatch) {
    const day = toInt(ddmmyyyyMatch[1]);
    const month = toInt(ddmmyyyyMatch[2]);
    let year = toInt(ddmmyyyyMatch[3]);
    if (year < 100) year += 2000;
    if (day > 0 && month >= 1 && month <= 12 && year >= 2000) {
      return { year, month: month - 1, day };
    }
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = toInt(isoMatch[1]);
    const month = toInt(isoMatch[2]);
    const day = toInt(isoMatch[3]);
    if (year > 0 && month >= 1 && month <= 12) {
      return { year, month: month - 1, day };
    }
  }

  return null;
}

function parseHebrewMonthYear(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  for (const [monthName, monthIndex] of Object.entries(MONTH_INDEX_BY_HE)) {
    if (!raw.startsWith(monthName)) continue;
    const yearMatch = raw.match(/(\d{4})/);
    if (!yearMatch) continue;
    return { year: toInt(yearMatch[1]), month: monthIndex, day: 1 };
  }
  return null;
}

function parseFinanceNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,.\-]/g, "");
  if (!cleaned) return 0;

  const commaCount = (cleaned.match(/,/g) || []).length;
  const dotCount = (cleaned.match(/\./g) || []).length;
  let normalized = cleaned;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (commaCount > 0 && dotCount === 0) {
    if (commaCount > 1) {
      normalized = cleaned.replace(/,/g, "");
    } else {
      const parts = cleaned.split(",");
      normalized = parts[1] && parts[1].length === 3 ? parts.join("") : parts.join(".");
    }
  } else if (dotCount > 1 && commaCount === 0) {
    const parts = cleaned.split(".");
    const last = parts.pop();
    normalized = `${parts.join("")}.${last}`;
  }

  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
}

function formatPlainNumber(num) {
  const value = Number.isFinite(num) ? num : 0;
  if (Math.abs(value % 1) < 0.000001) {
    return String(Math.round(value));
  }
  return String(Math.round(value * 100) / 100);
}

function isoToDdMmYyyy(isoValue) {
  const raw = String(isoValue || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function bindWordPressSyncHandlers() {
  if (!el.wpSyncForm) return;

  el.wpSyncForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveWordPressSettingsFromForm();
    showMessage("הגדרות WordPress נשמרו.", "success");
  });

  el.wpTestConnectionBtn.addEventListener("click", async () => {
    saveWordPressSettingsFromForm();
    try {
      setWordPressSyncBusy(true);
      await testWordPressConnection();
      showMessage("החיבור ל-WordPress תקין.", "success");
    } catch (error) {
      console.error(error);
      showMessage(`בדיקת חיבור נכשלה: ${error.message || error}`, "error");
    } finally {
      setWordPressSyncBusy(false);
      renderWordPressSyncPanel();
    }
  });

  el.wpPullBtn.addEventListener("click", async () => {
    saveWordPressSettingsFromForm();
    await syncWordPress("pull");
  });

  el.wpPushBtn.addEventListener("click", async () => {
    saveWordPressSettingsFromForm();
    await syncWordPress("push");
  });

  el.wpSyncBothBtn.addEventListener("click", async () => {
    saveWordPressSettingsFromForm();
    await syncWordPress("both");
  });
}

function openEquipmentModal(item) {
  el.equipmentModalId.value = item.id;
  el.equipmentModalName.value = item.name;
  el.equipmentModalCategory.value = item.category;
  el.equipmentModalQuantity.value = String(item.quantity);
  el.equipmentModalDailyPrice.value = String(item.dailyPrice);
  el.equipmentModalSku.value = item.sku || "";
  el.equipmentModalSize.value = item.size || "";
  el.equipmentModalShelfLocation.value = item.shelfLocation || "";
  el.equipmentModalDamagedQty.value = String(item.damagedQty ?? 0);
  el.equipmentModalImageUrl.value = item.imageUrl && !item.imageUrl.startsWith("data:") ? item.imageUrl : "";
  el.equipmentModalWpCategoryName.value = item.wpCategoryName || "";
  el.equipmentModalNotes.value = item.notes || "";
  el.equipmentModalImageFile.value = "";
  el.equipmentModalImageFile.dataset.pendingDataUrl = "";
  updateModalImagePreview(item.imageUrl);
  el.equipmentModal.showModal();
}

function closeEquipmentModal() {
  el.equipmentModalImageFile.value = "";
  el.equipmentModalImageFile.dataset.pendingDataUrl = "";
  el.equipmentModal.close();
}

function updateModalImagePreview(url) {
  const trimmed = String(url || "").trim();
  el.equipmentModalImagePreview.innerHTML = trimmed
    ? `<img src="${escapeHtml(trimmed)}" alt="תמונת מוצר" />`
    : "";
}

function bindEquipmentModalHandlers() {
  el.equipmentModalClose.addEventListener("click", closeEquipmentModal);
  el.equipmentModalCancelBtn.addEventListener("click", closeEquipmentModal);

  el.equipmentModal.addEventListener("click", (event) => {
    if (event.target === el.equipmentModal) closeEquipmentModal();
  });

  el.equipmentModalImageUrl.addEventListener("input", () => {
    updateModalImagePreview(el.equipmentModalImageUrl.value);
  });

  el.equipmentModalImageFile.addEventListener("change", () => {
    const file = el.equipmentModalImageFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      el.equipmentModalImageUrl.value = "";
      updateModalImagePreview(dataUrl);
      // Store data URL temporarily in a data attribute so submit handler can pick it up
      el.equipmentModalImageFile.dataset.pendingDataUrl = dataUrl;
    };
    reader.readAsDataURL(file);
  });

  function saveEquipmentFromModal() {
    const id = el.equipmentModalId.value.trim();
    const index = state.equipment.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const existing = state.equipment[index];
    const nowIso = new Date().toISOString();
    const prevWpCategoryName = String(existing.wpCategoryName || "").trim().toLowerCase();
    const nextWpCategoryName = String(el.equipmentModalWpCategoryName.value || "").trim().toLowerCase();

    const pendingDataUrl = el.equipmentModalImageFile.dataset.pendingDataUrl || "";
    const imageUrlValue = pendingDataUrl || String(el.equipmentModalImageUrl.value || "").trim();

    state.equipment[index] = {
      ...existing,
      name: el.equipmentModalName.value.trim(),
      category: el.equipmentModalCategory.value,
      quantity: Math.max(0, toInt(el.equipmentModalQuantity.value)),
      dailyPrice: Math.max(0, toNumber(el.equipmentModalDailyPrice.value)),
      sku: String(el.equipmentModalSku.value || "").trim(),
      size: String(el.equipmentModalSize.value || "").trim(),
      shelfLocation: String(el.equipmentModalShelfLocation.value || "").trim(),
      damagedQty: Math.max(0, toInt(el.equipmentModalDamagedQty.value)),
      imageUrl: imageUrlValue,
      wpCategoryName: String(el.equipmentModalWpCategoryName.value || "").trim(),
      wpCategoryId: nextWpCategoryName && nextWpCategoryName !== prevWpCategoryName ? null : existing.wpCategoryId,
      notes: el.equipmentModalNotes.value.trim(),
      updatedAt: nowIso,
    };
    el.equipmentModalImageFile.dataset.pendingDataUrl = "";
    saveState();
    renderAll();
    return state.equipment[index];
  }

  el.equipmentModalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const saved = saveEquipmentFromModal();
    if (!saved) return;
    showMessage("פריט הציוד עודכן.", "success");
    closeEquipmentModal();
    triggerWordPressAutoSync("ציוד נשמר מקומית.");
  });

  el.equipmentModalSaveAndSyncBtn.addEventListener("click", () => {
    const saved = saveEquipmentFromModal();
    if (!saved) return;
    showMessage("פריט הציוד עודכן.", "success");
    closeEquipmentModal();
    syncSingleEquipmentItem(saved);
  });

  el.equipmentModalSyncBtn.addEventListener("click", () => {
    const id = el.equipmentModalId.value.trim();
    const item = state.equipment.find((entry) => entry.id === id);
    if (!item) return;
    syncSingleEquipmentItem(item);
  });
}

function bindDashboardHandlers() {
  el.upcomingList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    if (target.dataset.action !== "edit-upcoming") return;
    const id = target.dataset.id;
    if (!id) return;
    const order = state.orders.find((item) => item.id === id);
    if (!order) return;
    hydrateOrderForm(order);
    focusTab("orders");
  });

  if (el.dashboardHighlights) {
    el.dashboardHighlights.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest('button[data-action="dashboard-open-tab"]');
      if (!(button instanceof HTMLButtonElement)) return;
      const tab = String(button.dataset.tab || "").trim();
      if (!tab) return;
      focusTab(tab);
    });
  }

  el.dashboardSearchBtn.addEventListener("click", runDashboardSearch);
  el.dashboardSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runDashboardSearch();
    if (e.key === "Escape") {
      el.dashboardSearchInput.value = "";
      el.dashboardSearchResults.innerHTML = "";
      el.dashboardSearchResults.classList.add("hidden");
    }
  });
  let searchDebounceTimer = 0;
  el.dashboardSearchInput.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(runDashboardSearch, 180);
  });

  el.dashboardSearchResults.addEventListener("click", (event) => {
    const item = event.target.closest(".search-result-item[data-type]");
    if (!item) return;
    const { type, id } = item.dataset;
    if (type === "equipment") {
      focusTab("equipment");
      const eq = state.equipment.find((e) => e.id === id);
      if (eq) openEquipmentModal(eq);
    } else if (type === "client") {
      focusTab("clients");
    } else if (type === "order") {
      const order = state.orders.find((o) => o.id === id);
      if (order) { hydrateOrderForm(order); focusTab("orders"); }
    }
  });
}

function runDashboardSearch() {
  const query = String(el.dashboardSearchInput.value || "").trim().toLowerCase();
  const resultsEl = el.dashboardSearchResults;

  if (!query) {
    resultsEl.innerHTML = "";
    resultsEl.classList.add("hidden");
    return;
  }

  const eqResults = state.equipment.filter(
    (e) => e.name.toLowerCase().includes(query) || String(e.sku || "").toLowerCase().includes(query) || String(e.notes || "").toLowerCase().includes(query),
  );

  const clientResults = state.clients.filter(
    (c) => c.name.toLowerCase().includes(query) || String(c.company || "").toLowerCase().includes(query) || String(c.phone || "").toLowerCase().includes(query) || String(c.email || "").toLowerCase().includes(query),
  );

  const orderResults = state.orders.filter(
    (o) => String(o.orderNumber || "").toLowerCase().includes(query) || String(o.eventName || "").toLowerCase().includes(query) || String(o.eventLocation || "").toLowerCase().includes(query) || getClientName(o.clientId).toLowerCase().includes(query),
  );

  const total = eqResults.length + clientResults.length + orderResults.length;

  if (total === 0) {
    resultsEl.innerHTML = `<div class="dashboard-search-results"><p class="search-no-results">לא נמצאו תוצאות עבור "<strong>${escapeHtml(query)}</strong>"</p></div>`;
    resultsEl.classList.remove("hidden");
    return;
  }

  const sections = [];

  if (eqResults.length > 0) {
    sections.push(`
      <div class="search-results-section">
        <h4>🎛️ ציוד (${eqResults.length})</h4>
        <div class="eq-search-grid">
        ${eqResults.map((e) => {
          const imgHtml = e.imageUrl && !e.imageUrl.startsWith("data:")
            ? `<img class="eq-search-img" src="${escapeHtml(e.imageUrl)}" alt="${escapeHtml(e.name)}" loading="lazy" />`
            : e.imageUrl && e.imageUrl.startsWith("data:")
              ? `<img class="eq-search-img" src="${escapeHtml(e.imageUrl)}" alt="${escapeHtml(e.name)}" />`
              : `<div class="eq-search-img eq-search-img-placeholder">📦</div>`;
          const today = dateToIso(new Date());
          const reserved = getReservedForRange(e.id, today, today, "");
          const available = Math.max(0, e.quantity - reserved);
          const availClass = available === 0 ? "availability-bad" : available <= 2 ? "availability-low" : "availability-ok";
          return `
          <div class="search-result-item eq-search-card" data-type="equipment" data-id="${e.id}">
            ${imgHtml}
            <div class="eq-search-info">
              <div class="search-result-main">${escapeHtml(e.name)}</div>
              <div class="search-result-sub">${e.sku ? 'מק\u0022ט: ' + escapeHtml(e.sku) : 'ללא מק\u0022ט'}</div>
              <div class="eq-search-meta">
                <span>₪${e.dailyPrice}/יום</span>
                <span class="${availClass}">${available} זמין</span>
              </div>
            </div>
          </div>`;
        }).join("")}
        </div>
      </div>`);
  }

  if (clientResults.length > 0) {
    sections.push(`
      <div class="search-results-section">
        <h4>👤 לקוחות (${clientResults.length})</h4>
        ${clientResults.map((c) => `
          <div class="search-result-item" data-type="client" data-id="${c.id}">
            <span class="search-result-icon">👤</span>
            <div>
              <div class="search-result-main">${escapeHtml(c.name)}</div>
              <div class="search-result-sub">${[c.company, c.phone, c.email].filter(Boolean).map(escapeHtml).join(" · ")}</div>
            </div>
          </div>`).join("")}
      </div>`);
  }

  if (orderResults.length > 0) {
    sections.push(`
      <div class="search-results-section">
        <h4>📋 הזמנות (${orderResults.length})</h4>
        ${orderResults.map((o) => `
          <div class="search-result-item" data-type="order" data-id="${o.id}">
            <span class="search-result-icon">📋</span>
            <div>
              <div class="search-result-main">${escapeHtml(o.orderNumber)} — ${escapeHtml(o.eventName)}</div>
              <div class="search-result-sub">${escapeHtml(getClientName(o.clientId))} · <span class="chip ${escapeHtml(o.status)}">${escapeHtml(statusLabels[o.status] || o.status)}</span> · ${formatDate(o.startDate)} עד ${formatDate(o.endDate)}</div>
            </div>
          </div>`).join("")}
      </div>`);
  }

  resultsEl.innerHTML = `<div class="dashboard-search-results">${sections.join("")}</div>`;
  resultsEl.classList.remove("hidden");
}

function renderWordPressSyncPanel() {
  if (!el.wpSyncForm) return;

  const wp = getWordPressIntegration();
  el.wpSiteUrl.value = String(wp.siteUrl || "");
  el.wpConsumerKey.value = String(wp.consumerKey || "");
  el.wpConsumerSecret.value = String(wp.consumerSecret || "");
  el.wpUsername.value = String(wp.username || "");
  el.wpAppPassword.value = String(wp.appPassword || "");
  el.wpAutoSync.checked = Boolean(wp.autoSync);

  const linkedCount = state.equipment.filter((item) => normalizeWpProductId(item.wpProductId)).length;
  const statsParts = [
    `Linked products: ${linkedCount}/${state.equipment.length}`,
    `Last pull: ${formatDateTime(wp.lastPullAt)}`,
    `Last push: ${formatDateTime(wp.lastPushAt)}`,
    `Last full sync: ${formatDateTime(wp.lastSyncAt)}`,
  ];
  if (wp.lastError) {
    statsParts.push(`Last error: ${wp.lastError}`);
  }
  el.wpSyncStats.textContent = statsParts.join(" | ");

  const logLines = Array.isArray(wp.log) ? wp.log.slice(-WP_SYNC_LOG_LIMIT) : [];
  el.wpSyncLog.textContent = logLines.length > 0 ? logLines.join("\n") : "No sync logs yet.";
}

function saveWordPressSettingsFromForm() {
  const wp = getWordPressIntegration();
  wp.siteUrl = normalizeSiteUrl(el.wpSiteUrl.value);
  wp.consumerKey = String(el.wpConsumerKey.value || "").trim();
  wp.consumerSecret = String(el.wpConsumerSecret.value || "").trim();
  wp.username = String(el.wpUsername.value || "").trim();
  wp.appPassword = String(el.wpAppPassword.value || "").trim();
  wp.autoSync = Boolean(el.wpAutoSync.checked);
  saveState();
  renderWordPressSyncPanel();
}

function triggerWordPressAutoSync(reason) {
  const wp = getWordPressIntegration();
  if (!wp.autoSync || isWordPressSyncRunning) return;
  if (!wp.siteUrl || !wp.consumerKey || !wp.consumerSecret) return;
  appendWordPressLog(`${reason} הופעל auto-sync (push).`);
  saveState();
  syncWordPress("push", { silent: true }).catch((error) => {
    console.error(error);
  });
}

function queueWordPressDelete(item) {
  if (!item) return;
  const wpId = normalizeWpProductId(item.wpProductId);
  if (!wpId) return;
  const wp = getWordPressIntegration();
  if (!Array.isArray(wp.pendingDeleteProductIds)) {
    wp.pendingDeleteProductIds = [];
  }
  if (!wp.pendingDeleteProductIds.includes(wpId)) {
    wp.pendingDeleteProductIds.push(wpId);
    appendWordPressLog(`Product #${wpId} queued for remote delete.`);
  }
}

async function syncWordPress(direction, options) {
  const syncOptions = options || {};
  const wp = getWordPressIntegration();
  if (isWordPressSyncRunning) {
    if (!syncOptions.silent) {
      showMessage("סנכרון WordPress כבר רץ כרגע.", "error");
    }
    return;
  }
  if (!wp.siteUrl || !wp.consumerKey || !wp.consumerSecret) {
    showMessage("חסרות הגדרות WordPress (URL / key / secret).", "error");
    focusTab("wordpressSync");
    return;
  }

  let pullSummary = null;
  let pushSummary = null;
  const startedAt = new Date().toISOString();
  appendWordPressLog(`Sync started (${direction}).`);
  setWordPressSyncBusy(true);
  try {
    if (direction === "pull" || direction === "both") {
      pullSummary = await pullWordPressProductsToLocal();
    }
    if (direction === "push" || direction === "both") {
      pushSummary = await pushLocalEquipmentToWordPress();
    }

    wp.lastSyncAt = startedAt;
    wp.lastError = "";
    saveState();
    renderAll();

    if (!syncOptions.silent) {
      const summaryText = [
        pullSummary
          ? `Pull: +${pullSummary.created} created / ${pullSummary.updated} updated / ${pullSummary.skipped} skipped`
          : "",
        pushSummary
          ? `Push: +${pushSummary.created} created / ${pushSummary.updated} updated / ${pushSummary.deleted} deleted / ${pushSummary.failed} failed`
          : "",
      ]
        .filter(Boolean)
        .join(" | ");
      showMessage(`הסנכרון הסתיים בהצלחה. ${summaryText}`, "success");
    }
  } catch (error) {
    wp.lastError = String(error.message || error);
    appendWordPressLog(`Sync failed: ${wp.lastError}`);
    saveState();
    renderWordPressSyncPanel();
    if (!syncOptions.silent) {
      showMessage(`שגיאת סנכרון: ${wp.lastError}`, "error");
    }
  } finally {
    setWordPressSyncBusy(false);
    renderWordPressSyncPanel();
  }
}

function setWordPressSyncBusy(isBusy) {
  isWordPressSyncRunning = isBusy;
  if (!el.wpSyncForm) return;
  const controls = [
    el.wpTestConnectionBtn,
    el.wpPullBtn,
    el.wpPushBtn,
    el.wpSyncBothBtn,
    el.wpSiteUrl,
    el.wpConsumerKey,
    el.wpConsumerSecret,
    el.wpAutoSync,
  ];
  const submitButton = el.wpSyncForm.querySelector('button[type="submit"]');
  if (submitButton) {
    controls.push(submitButton);
  }
  controls.forEach((control) => {
    if (control) {
      control.disabled = isBusy;
    }
  });
}

function appendWordPressLog(message) {
  const wp = getWordPressIntegration();
  if (!Array.isArray(wp.log)) {
    wp.log = [];
  }
  const stamp = new Date().toLocaleString("he-IL");
  wp.log.push(`[${stamp}] ${message}`);
  if (wp.log.length > WP_SYNC_LOG_LIMIT) {
    wp.log = wp.log.slice(-WP_SYNC_LOG_LIMIT);
  }
}

function getWordPressIntegration() {
  if (!state.integrations || typeof state.integrations !== "object") {
    state.integrations = {};
  }
  if (!state.integrations.wordpress || typeof state.integrations.wordpress !== "object") {
    state.integrations.wordpress = createDefaultWordPressIntegration();
  }
  const wp = state.integrations.wordpress;
  if (!Array.isArray(wp.pendingDeleteProductIds)) {
    wp.pendingDeleteProductIds = [];
  }
  if (!Array.isArray(wp.log)) {
    wp.log = [];
  }
  return wp;
}

async function testWordPressConnection() {
  const response = await wordPressRequest("/products", {
    params: { per_page: 1, page: 1, context: "edit" },
  });
  if (!Array.isArray(response.data)) {
    throw new Error("תגובה לא צפויה מה-API.");
  }
  appendWordPressLog("Connection test passed.");
  const wp = getWordPressIntegration();
  wp.lastError = "";
  saveState();
}

async function pullWordPressProductsToLocal() {
  const wp = getWordPressIntegration();
  const nowIso = new Date().toISOString();
  const products = await fetchAllWordPressProducts();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    const mapped = mapWordPressProductToLocalEquipment(product);
    if (!mapped.name) {
      skipped += 1;
      continue;
    }

    const existing = findLocalEquipmentByWordPressProduct(product);
    if (existing) {
      const localChangedAfterSync = existing.wpLastSyncedAt && existing.updatedAt > existing.wpLastSyncedAt;
      const remoteChangedAfterLastPull =
        !existing.wpLastRemoteModified || mapped.wpLastRemoteModified > existing.wpLastRemoteModified;
      const needsBackfill = hasMissingWordPressMappedFields(existing, mapped);
      if (localChangedAfterSync && !remoteChangedAfterLastPull && !needsBackfill) {
        skipped += 1;
        continue;
      }
      const didApply = applyWordPressMappedFieldsToEquipment(existing, mapped, {
        nowIso,
        overwriteAll: remoteChangedAfterLastPull || !localChangedAfterSync,
      });
      if (didApply) {
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    state.equipment.push({
      id: uid(),
      name: mapped.name,
      category: mapped.category,
      quantity: mapped.quantity,
      dailyPrice: mapped.dailyPrice,
      sku: String(mapped.sku || "").startsWith("crm-") ? "" : mapped.sku,
      size: mapped.size,
      imageUrl: mapped.imageUrl,
      wpCategoryName: mapped.wpCategoryName,
      wpCategoryId: mapped.wpCategoryId,
      notes: mapped.notes,
      createdAt: nowIso,
      updatedAt: nowIso,
      wpProductId: mapped.wpProductId,
      wpLastRemoteModified: mapped.wpLastRemoteModified,
      wpLastSyncedAt: nowIso,
    });
    created += 1;
  }

  wp.lastPullAt = nowIso;
  wp.lastError = "";
  appendWordPressLog(
    `Pull completed. Fetched ${products.length} products (${created} created, ${updated} updated, ${skipped} skipped).`,
  );
  saveState();
  renderAll();
  return { total: products.length, created, updated, skipped };
}

async function pushLocalEquipmentToWordPress() {
  const wp = getWordPressIntegration();
  const nowIso = new Date().toISOString();
  const categoryCache = new Map();
  let created = 0;
  let updated = 0;
  let deleted = 0;
  let failed = 0;
  let skipped = 0;

  const pendingDeletes = Array.from(
    new Set((wp.pendingDeleteProductIds || []).map((value) => normalizeWpProductId(value)).filter(Boolean)),
  );
  const remainingDeletes = [];

  for (const wpId of pendingDeletes) {
    try {
      await wordPressRequest(`/products/${wpId}`, {
        method: "DELETE",
        params: { force: true },
      });
      deleted += 1;
    } catch (error) {
      const message = String(error.message || error);
      if (message.includes("404")) {
        deleted += 1;
        continue;
      }
      remainingDeletes.push(wpId);
      failed += 1;
      appendWordPressLog(`Delete failed for product #${wpId}: ${message}`);
    }
  }
  wp.pendingDeleteProductIds = remainingDeletes;

  for (const item of state.equipment) {
    if (!item.name) {
      skipped += 1;
      continue;
    }

    const wpId = normalizeWpProductId(item.wpProductId);
    const localChangedSinceLastSync = !item.wpLastSyncedAt || item.updatedAt > item.wpLastSyncedAt;
    if (wpId && !localChangedSinceLastSync) {
      skipped += 1;
      continue;
    }

    const payload = await mapLocalEquipmentToWordPressPayload(item, { categoryCache });
    try {
      let responseData = null;
      if (wpId) {
        const response = await wordPressRequest(`/products/${wpId}`, { method: "PUT", body: payload });
        responseData = response.data;
        updated += 1;
      } else {
        const response = await wordPressRequest("/products", { method: "POST", body: payload });
        responseData = response.data;
        created += 1;
      }

      applyPushResponseToItem(item, responseData, nowIso);
    } catch (error) {
      failed += 1;
      appendWordPressLog(`Push failed for "${item.name}": ${error.message || error}`);
    }
  }

  wp.lastPushAt = nowIso;
  appendWordPressLog(
    `Push completed (${created} created, ${updated} updated, ${deleted} deleted, ${failed} failed, ${skipped} skipped).`,
  );
  saveState();
  renderAll();
  return { created, updated, deleted, failed, skipped };
}

async function findWordPressProductIdByName(name) {
  try {
    const response = await wordPressRequest("/products", {
      params: { search: name, per_page: 5, status: "any" },
    });
    const products = Array.isArray(response.data) ? response.data : [];
    const match = products.find(
      (p) => String(p.name || "").trim().toLowerCase() === String(name || "").trim().toLowerCase(),
    );
    return normalizeWpProductId(match?.id) || null;
  } catch {
    return null;
  }
}

async function findWordPressProductBySku(sku) {
  if (!sku) return null;
  try {
    const response = await wordPressRequest("/products", {
      params: { sku, per_page: 5, status: "any" },
    });
    const products = Array.isArray(response.data) ? response.data : [];
    const match = products.find(
      (p) => String(p.sku || "").trim().toLowerCase() === String(sku || "").trim().toLowerCase(),
    );
    return normalizeWpProductId(match?.id) || null;
  } catch {
    return null;
  }
}

async function syncSingleEquipmentItem(item) {
  const wp = getWordPressIntegration();
  if (!wp.siteUrl || !wp.consumerKey || !wp.consumerSecret) {
    showMessage("חסרות הגדרות WordPress. הגדר URL / key / secret בטאב WordPress Sync.", "error");
    focusTab("wordpressSync");
    return;
  }
  if (isWordPressSyncRunning) {
    showMessage("סנכרון WordPress כבר רץ כרגע.", "error");
    return;
  }

  const nowIso = new Date().toISOString();
  const categoryCache = new Map();
  setWordPressSyncBusy(true);
  try {
    const payload = await mapLocalEquipmentToWordPressPayload(item, { categoryCache });
    const wpId = normalizeWpProductId(item.wpProductId);
    let responseData = null;
    if (wpId) {
      const response = await wordPressRequest(`/products/${wpId}`, { method: "PUT", body: payload });
      responseData = response.data;
      showMessage(`"${item.name}" עודכן ב-WordPress בהצלחה.`, "success");
    } else {
      let postResponse;
      try {
        postResponse = await wordPressRequest("/products", { method: "POST", body: payload });
      } catch (postError) {
        if (String(postError.message || "").toLowerCase().includes("sku")) {
          // מוצר כנראה כבר קיים ב-WP מניסיון קודם — מחפשים לפי SKU ומקשרים
          const skuSent = String(payload.sku || "");
          appendWordPressLog(`SKU כפול ("${skuSent}") — מחפש מוצר קיים ב-WP...`);
          const existingId = await findWordPressProductBySku(skuSent) || await findWordPressProductIdByName(item.name);
          if (existingId) {
            appendWordPressLog(`נמצא WP #${existingId} — מעדכן במקום ליצור.`);
            item.wpProductId = existingId;
            saveState();
            postResponse = await wordPressRequest(`/products/${existingId}`, { method: "PUT", body: payload });
          } else {
            throw postError;
          }
        } else {
          throw postError;
        }
      }
      responseData = postResponse.data;
      showMessage(`"${item.name}" סונכרן ב-WordPress בהצלחה.`, "success");
    }
    applyPushResponseToItem(item, responseData, nowIso);
    item.updatedAt = nowIso;
    wp.lastPushAt = nowIso;
    appendWordPressLog(`Single sync for "${item.name}": ${wpId ? "updated" : "created/linked"} WP #${item.wpProductId}.`);
    saveState();
    renderAll();
  } catch (error) {
    const msg = String(error.message || error);
    appendWordPressLog(`Single sync failed for "${item.name}": ${msg}`);
    showMessage(`שגיאת סנכרון עבור "${item.name}": ${msg}`, "error");
  } finally {
    setWordPressSyncBusy(false);
    renderWordPressSyncPanel();
  }
}

async function fetchAllWordPressProducts() {
  const perPage = 100;
  const products = [];
  let page = 1;

  while (true) {
    const response = await wordPressRequest("/products", {
      params: {
        per_page: perPage,
        page,
        status: "any",
        context: "edit",
      },
    });

    const rows = Array.isArray(response.data) ? response.data : [];
    products.push(...rows);
    if (rows.length < perPage) {
      break;
    }

    const totalPagesHeader = toInt(response.headers.get("x-wp-totalpages"));
    if (totalPagesHeader > 0 && page >= totalPagesHeader) {
      break;
    }

    page += 1;
    if (page > 100) {
      break;
    }
  }

  return products;
}

function findLocalEquipmentByWordPressProduct(product) {
  const productId = normalizeWpProductId(product?.id);
  const productSku = resolveWordPressSku(product).toLowerCase();
  if (productId) {
    const direct = state.equipment.find((item) => normalizeWpProductId(item.wpProductId) === productId);
    if (direct) {
      if (productSku) {
        const directSku = String(direct.sku || "").trim().toLowerCase();
        const skuMatch =
          state.equipment.find((item) => String(item.sku || "").trim().toLowerCase() === productSku) || null;
        if (skuMatch && skuMatch !== direct && directSku !== productSku) {
          return skuMatch;
        }
      }
      return direct;
    }
  }

  if (productSku && !productSku.startsWith("crm-")) {
    const bySku = state.equipment.find((item) => String(item.sku || "").trim().toLowerCase() === productSku);
    if (bySku) return bySku;
  }

  const productName = String(product?.name || "").trim().toLowerCase();
  if (!productName) return null;
  return (
    state.equipment.find(
      (item) => !normalizeWpProductId(item.wpProductId) && String(item.name || "").trim().toLowerCase() === productName,
    ) || null
  );
}

function hasMissingWordPressMappedFields(localItem, mapped) {
  if (!localItem || !mapped) return false;
  return (
    (isBlankOrPlaceholderSku(localItem.sku) && !isBlankOrPlaceholderSku(mapped.sku)) ||
    (isBlankText(localItem.size) && !isBlankText(mapped.size)) ||
    (!hasUsableImageUrl(localItem.imageUrl) && hasUsableImageUrl(mapped.imageUrl)) ||
    (isBlankText(localItem.wpCategoryName) && !isBlankText(mapped.wpCategoryName)) ||
    (!normalizeWpTermId(localItem.wpCategoryId) && normalizeWpTermId(mapped.wpCategoryId)) ||
    (isBlankOrPlaceholderText(localItem.notes) && !isBlankOrPlaceholderText(mapped.notes)) ||
    (toNumber(localItem.dailyPrice) <= 0 && toNumber(mapped.dailyPrice) > 0) ||
    (toInt(localItem.quantity) <= 0 && toInt(mapped.quantity) > 0)
  );
}

function applyWordPressMappedFieldsToEquipment(target, mapped, options) {
  const opts = options || {};
  const overwriteAll = Boolean(opts.overwriteAll);
  const nowIso = String(opts.nowIso || new Date().toISOString());
  let changed = false;

  const setText = (key, nextValue, fallbackCondition) => {
    const value = String(nextValue || "").trim();
    if (isBlankText(value)) return;
    const current = String(target[key] || "");
    if (overwriteAll || fallbackCondition(current)) {
      if (current !== value) {
        target[key] = value;
        changed = true;
      }
    }
  };

  const setNumber = (key, nextValue, fallbackCondition) => {
    const value = Number(nextValue);
    if (!Number.isFinite(value)) return;
    const current = Number(target[key]);
    if (overwriteAll || fallbackCondition(current)) {
      if (!Number.isFinite(current) || current !== value) {
        target[key] = value;
        changed = true;
      }
    }
  };

  setText("name", mapped.name, (current) => isBlankText(current));
  // לא כותבים חזרה SKU אוטומטי שנוצר על ידי המערכת
  if (!String(mapped.sku || "").startsWith("crm-")) {
    setText("sku", mapped.sku, (current) => isBlankOrPlaceholderSku(current));
  }
  setText("size", mapped.size, (current) => isBlankText(current));
  setText("imageUrl", mapped.imageUrl, (current) => !hasUsableImageUrl(current));
  setText("wpCategoryName", mapped.wpCategoryName, (current) => isBlankText(current));
  setText("notes", mapped.notes, (current) => isBlankOrPlaceholderText(current));
  setNumber("dailyPrice", mapped.dailyPrice, (current) => !Number.isFinite(current) || current <= 0);
  setNumber("quantity", mapped.quantity, (current) => !Number.isFinite(current) || current <= 0);

  if (overwriteAll || String(target.category || "other") === "other") {
    if (target.category !== mapped.category) {
      target.category = mapped.category;
      changed = true;
    }
  }

  const mappedCategoryId = normalizeWpTermId(mapped.wpCategoryId);
  const currentCategoryId = normalizeWpTermId(target.wpCategoryId);
  if (mappedCategoryId && (overwriteAll || !currentCategoryId) && mappedCategoryId !== currentCategoryId) {
    target.wpCategoryId = mappedCategoryId;
    changed = true;
  }

  const mappedProductId = normalizeWpProductId(mapped.wpProductId);
  const currentProductId = normalizeWpProductId(target.wpProductId);
  if (mappedProductId && mappedProductId !== currentProductId) {
    target.wpProductId = mappedProductId;
    changed = true;
  }

  if (String(target.wpLastRemoteModified || "") !== String(mapped.wpLastRemoteModified || "")) {
    target.wpLastRemoteModified = String(mapped.wpLastRemoteModified || "");
    changed = true;
  }

  if (String(target.wpLastSyncedAt || "") !== nowIso) {
    target.wpLastSyncedAt = nowIso;
    changed = true;
  }
  if (changed) {
    target.updatedAt = nowIso;
  }
  return changed;
}

function mapWordPressProductToLocalEquipment(product) {
  const stockQuantity = resolveWordPressStockQuantity(product);
  const regularPrice = resolveWordPressPrice(product);
  const wpModified = String(product?.date_modified_gmt || product?.date_modified || new Date().toISOString());
  const wpPrimaryCategory = Array.isArray(product?.categories) && product.categories.length > 0 ? product.categories[0] : null;

  return {
    name: String(product?.name || "").trim(),
    category: mapWordPressCategoryToLocal(product?.categories),
    quantity: stockQuantity,
    dailyPrice: Math.max(0, toNumber(regularPrice)),
    sku: resolveWordPressSku(product),
    size: extractSizeFromWordPressProduct(product),
    imageUrl: extractImageFromWordPressProduct(product),
    wpCategoryName: String(wpPrimaryCategory?.name || ""),
    wpCategoryId: normalizeWpTermId(wpPrimaryCategory?.id),
    notes: resolveWordPressDescription(product),
    wpProductId: normalizeWpProductId(product?.id),
    wpLastRemoteModified: wpModified,
  };
}

async function uploadImageToWordPress(dataUrl, filename) {
  const wp = getWordPressIntegration();
  if (!wp.siteUrl) throw new Error("חסר WordPress Site URL.");

  const base64Index = dataUrl.indexOf(",");
  if (base64Index === -1) throw new Error("Invalid data URL for image upload.");
  const base64Data = dataUrl.substring(base64Index + 1);
  const mimeMatch = dataUrl.match(/^data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

  const byteChars = atob(base64Data);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArr[i] = byteChars.charCodeAt(i);
  }

  const siteUrl = String(wp.siteUrl).replace(/\/$/, "");
  const uploadUrl = `${siteUrl}/wp-json/wp/v2/media`;
  const safeFilename = (filename || "image.jpg").replace(/[^\w.\-]/g, "_");

  // בונים רשימת אפשרויות אותנטיקציה לניסיון
  const credSources = [];
  if (wp.username && wp.appPassword) {
    // Application Password — רווחים מוסרים (כך WP מצפה ב-Basic Auth)
    credSources.push({
      label: "App Password",
      creds: btoa(`${wp.username}:${String(wp.appPassword).replace(/\s+/g, "")}`),
    });
    // ניסיון נוסף עם הרווחים (לגרסאות ישנות)
    credSources.push({
      label: "App Password (with spaces)",
      creds: btoa(`${wp.username}:${wp.appPassword}`),
    });
  }
  if (wp.consumerKey && wp.consumerSecret) {
    // Consumer Key/Secret — כמה שרתי WooCommerce מקבלים זאת גם ב-WP REST API
    credSources.push({
      label: "Consumer Key",
      creds: btoa(`${wp.consumerKey}:${wp.consumerSecret}`),
    });
  }

  if (credSources.length === 0) {
    throw new Error("חסרים פרטי אותנטיקציה להעלאת תמונה (הגדר Username/Application Password בטאב WordPress Sync).");
  }

  const lastErrors = [];

  for (const { label, creds } of credSources) {
    // שיטה א׳ — raw binary (WP REST API standard)
    try {
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${creds}`,
          "Content-Type": mimeType,
          "Content-Disposition": `attachment; filename="${safeFilename}"`,
        },
        body: byteArr.buffer,
      });
      if (res.ok) {
        const data = await res.json();
        appendWordPressLog(`תמונה הועלתה (raw binary / ${label}).`);
        return String(data.source_url || data.guid?.rendered || "");
      }
      const errText = await res.text().catch(() => "");
      lastErrors.push(`${label} raw: ${res.status} ${errText.slice(0, 120)}`);
    } catch (e) {
      lastErrors.push(`${label} raw: ${e.message}`);
    }

    // שיטה ב׳ — multipart/form-data (תאימות עם שרתים שחוסמים raw binary)
    try {
      const blob = new Blob([byteArr], { type: mimeType });
      const form = new FormData();
      form.append("file", blob, safeFilename);
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { Authorization: `Basic ${creds}` },
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        appendWordPressLog(`תמונה הועלתה (FormData / ${label}).`);
        return String(data.source_url || data.guid?.rendered || "");
      }
      const errText = await res.text().catch(() => "");
      lastErrors.push(`${label} form: ${res.status} ${errText.slice(0, 120)}`);
    } catch (e) {
      lastErrors.push(`${label} form: ${e.message}`);
    }
  }

  throw new Error(`העלאת תמונה נכשלה בכל השיטות:\n${lastErrors.join("\n")}`);
}

async function mapLocalEquipmentToWordPressPayload(item, context) {
  const payload = {
    name: String(item.name || "").trim(),
    type: "simple",
    regular_price: String(Math.max(0, toNumber(item.dailyPrice))),
    manage_stock: true,
    stock_quantity: Math.max(0, toInt(item.quantity)),
    status: "publish",
  };

  const sku = String(item.sku || "").trim();
  if (sku) {
    payload.sku = sku;
  } else {
    // WooCommerce דורש מק"ט ייחודי — שולחים מק"ט סטבילי מבוסס ID, ללא שמירה מקומית
    payload.sku = `crm-${item.id.slice(0, 12)}`;
  }

  const notes = String(item.notes || "").trim();
  if (notes) {
    payload.description = notes;
    payload.short_description = notes;
  }

  const size = String(item.size || "").trim();
  if (size) {
    payload.attributes = [{ name: "Size", visible: true, variation: false, options: [size] }];
  }

  let imageUrl = String(item.imageUrl || "").trim();
  if (imageUrl.startsWith("data:")) {
    try {
      appendWordPressLog(`מעלה תמונה של "${item.name}" ל-WordPress Media Library...`);
      const ext = imageUrl.match(/^data:image\/(\w+);/)?.[1] || "jpg";
      const filename = `${String(item.name || "product").replace(/[^a-zA-Z0-9]/g, "-")}.${ext}`;
      const uploadedUrl = await uploadImageToWordPress(imageUrl, filename);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
        const index = state.equipment.findIndex((e) => e.id === item.id);
        if (index !== -1) {
          state.equipment[index].imageUrl = uploadedUrl;
          saveState();
        }
        appendWordPressLog(`תמונה הועלתה בהצלחה: ${uploadedUrl}`);
      }
    } catch (uploadError) {
      appendWordPressLog(`אזהרה: כישלון העלאת תמונה של "${item.name}": ${uploadError.message} — ממשיך סנכרון ללא תמונה.`);
      imageUrl = "";
    }
  }
  if (imageUrl && !imageUrl.startsWith("data:")) {
    payload.images = [{ src: imageUrl }];
  }

  const wpCategoryName = String(item.wpCategoryName || "").trim();
  const fallbackCategoryName = String(categoryLabels[item.category] || item.category || "Other").trim();
  const categoryNameToUse = wpCategoryName || fallbackCategoryName;
  if (categoryNameToUse) {
    const categoryId = await ensureWordPressCategory(categoryNameToUse, context?.categoryCache);
    if (categoryId) {
      payload.categories = [{ id: categoryId }];
    }
  }

  return payload;
}

// מעדכן פריט מקומי לאחר push ל-WP — לא דורס מק"ט ריק ולא דורס imageUrl ב-data URL
function applyPushResponseToItem(item, responseData, nowIso) {
  item.wpProductId = normalizeWpProductId(responseData?.id) || item.wpProductId || null;
  item.wpLastRemoteModified = String(responseData?.date_modified_gmt || responseData?.date_modified || nowIso);

  // מק"ט: רק אם המשתמש הגדיר מקומית ולא כפול של ה-SKU האוטומטי שלנו
  const responseSku = String(responseData?.sku || "").trim();
  const localSku = String(item.sku || "").trim();
  if (!localSku && responseSku.startsWith("crm-")) {
    // SKU אוטומטי שלנו — לא נשמר מקומית
  } else if (responseSku && responseSku !== localSku) {
    item.sku = responseSku;
  }

  item.size = extractSizeFromWordPressProduct(responseData) || item.size || "";

  // תמונה: מ-WP רק אם המוצר המקומי כבר לא מחזיק תמונה תקינה
  const wpImage = extractImageFromWordPressProduct(responseData);
  const localImage = String(item.imageUrl || "").trim();
  if (wpImage && (!localImage || localImage.startsWith("data:"))) {
    item.imageUrl = wpImage;
  }

  const responseCategory = Array.isArray(responseData?.categories) ? responseData.categories[0] : null;
  item.wpCategoryId = normalizeWpTermId(responseCategory?.id) || normalizeWpTermId(item.wpCategoryId);
  item.wpCategoryName = String(responseCategory?.name || item.wpCategoryName || "");
  item.wpLastSyncedAt = nowIso;
}

function resolveWordPressPrice(product) {
  const regularPrice = String(product?.regular_price || "").trim();
  if (regularPrice) return regularPrice;
  const activePrice = String(product?.price || "").trim();
  if (activePrice) return activePrice;
  const metaPrice = extractWordPressMetaValue(product, ["_price", "price"]);
  if (!isBlankText(metaPrice)) return metaPrice;
  return "0";
}

function resolveWordPressStockQuantity(product) {
  const direct = product?.stock_quantity;
  if (direct !== null && direct !== undefined && direct !== "") {
    return Math.max(0, toInt(direct));
  }

  const metaStock = extractWordPressMetaValue(product, ["_stock", "stock_quantity", "stock"]);
  if (!isBlankText(metaStock)) {
    return Math.max(0, toInt(metaStock));
  }

  if (String(product?.stock_status || "").toLowerCase() === "instock") {
    return 1;
  }
  return 0;
}

function resolveWordPressSku(product) {
  const directSku = String(product?.sku || "").trim();
  if (directSku) return directSku;
  const metaSku = extractWordPressMetaValue(product, ["_sku", "sku"]);
  return String(metaSku || "").trim();
}

function resolveWordPressDescription(product) {
  const longDescription = stripHtml(String(product?.description || ""));
  if (!isBlankText(longDescription)) return longDescription;
  return stripHtml(String(product?.short_description || ""));
}

function extractWordPressMetaValue(product, keys) {
  const metaEntries = Array.isArray(product?.meta_data) ? product.meta_data : [];
  const normalizedKeys = Array.isArray(keys) ? keys.map((key) => String(key || "").trim().toLowerCase()) : [];
  if (normalizedKeys.length === 0) return "";

  for (const entry of metaEntries) {
    const key = String(entry?.key || "").trim().toLowerCase();
    if (!normalizedKeys.includes(key)) continue;
    if (entry?.value === null || entry?.value === undefined) continue;
    const raw = typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value);
    const text = String(raw || "").trim();
    if (text) return text;
  }
  return "";
}

function isBlankText(value) {
  return String(value || "").trim() === "";
}

function isBlankOrPlaceholderText(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "" || normalized === "-" || normalized === "n/a" || normalized === "na" || normalized === "null" || normalized === "undefined";
}

function isBlankOrPlaceholderSku(value) {
  const sku = String(value || "").trim();
  if (isBlankOrPlaceholderText(sku)) return true;
  return sku.toLowerCase().startsWith("crm-");
}

function hasUsableImageUrl(value) {
  const url = String(value || "").trim();
  if (isBlankOrPlaceholderText(url)) return false;
  return /^https?:\/\//i.test(url) || /^data:image\//i.test(url);
}

function mapWordPressCategoryToLocal(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return "other";
  const label = `${categories[0].slug || ""} ${categories[0].name || ""}`.toLowerCase();
  if (label.includes("sound") || label.includes("audio") || label.includes("סאונד")) return "sound";
  if (label.includes("light") || label.includes("תאורה")) return "lighting";
  if (label.includes("stage") || label.includes("במה")) return "staging";
  if (label.includes("video") || label.includes("וידאו")) return "video";
  if (label.includes("furn") || label.includes("ריהוט")) return "furniture";
  if (label.includes("power") || label.includes("electric") || label.includes("חשמל")) return "power";
  return "other";
}

function extractSizeFromWordPressProduct(product) {
  const attributes = Array.isArray(product?.attributes) ? product.attributes : [];
  for (const attribute of attributes) {
    const name = String(attribute?.name || "").trim().toLowerCase();
    const slug = String(attribute?.slug || "").trim().toLowerCase();
    if (!name && !slug) continue;
    const isSizeField =
      name.includes("size") ||
      name.includes("גודל") ||
      name.includes("מידה") ||
      slug.includes("size") ||
      slug.includes("pa_size");
    if (!isSizeField) continue;

    if (Array.isArray(attribute?.options) && attribute.options.length > 0) {
      return String(attribute.options[0] || "").trim();
    }
    if (typeof attribute?.option === "string") {
      return String(attribute.option || "").trim();
    }
  }

  const defaultAttributes = Array.isArray(product?.default_attributes) ? product.default_attributes : [];
  for (const attribute of defaultAttributes) {
    const name = String(attribute?.name || "").trim().toLowerCase();
    const option = String(attribute?.option || "").trim();
    if (!option) continue;
    if (name.includes("size") || name.includes("גודל") || name.includes("מידה") || name.includes("pa_size")) {
      return option;
    }
  }

  const metaSize = extractWordPressMetaValue(product, [
    "size",
    "_size",
    "pa_size",
    "attribute_pa_size",
    "גודל",
    "מידה",
  ]);
  return String(metaSize || "").trim();
}

function extractImageFromWordPressProduct(product) {
  const images = Array.isArray(product?.images) ? product.images : [];
  const firstImage = images.find((image) => image && typeof image === "object" && image.src);
  if (firstImage?.src) {
    return String(firstImage.src || "").trim();
  }
  if (product?.image && typeof product.image === "object" && product.image.src) {
    return String(product.image.src || "").trim();
  }
  return "";
}

async function ensureWordPressCategory(categoryName, categoryCache) {
  const normalizedName = String(categoryName || "").trim();
  if (!normalizedName) return null;

  const cache = categoryCache instanceof Map ? categoryCache : null;
  const key = normalizedName.toLowerCase();
  if (cache && cache.has(key)) {
    return cache.get(key);
  }

  const searchResponse = await wordPressRequest("/products/categories", {
    params: { search: normalizedName, per_page: 100 },
  });
  const categories = Array.isArray(searchResponse.data) ? searchResponse.data : [];
  const exactMatch =
    categories.find((category) => String(category?.name || "").trim().toLowerCase() === key) || categories[0];
  if (exactMatch && normalizeWpTermId(exactMatch.id)) {
    const existingId = normalizeWpTermId(exactMatch.id);
    if (cache) cache.set(key, existingId);
    return existingId;
  }

  try {
    const createResponse = await wordPressRequest("/products/categories", {
      method: "POST",
      body: { name: normalizedName },
    });
    const createdId = normalizeWpTermId(createResponse.data?.id);
    if (cache) cache.set(key, createdId);
    return createdId;
  } catch (error) {
    const message = String(error?.message || error);
    if (!message.includes("term_exists")) {
      throw error;
    }

    const retryResponse = await wordPressRequest("/products/categories", {
      params: { search: normalizedName, per_page: 100 },
    });
    const retryCategories = Array.isArray(retryResponse.data) ? retryResponse.data : [];
    const retryMatch =
      retryCategories.find((category) => String(category?.name || "").trim().toLowerCase() === key) ||
      retryCategories[0];
    const retryId = normalizeWpTermId(retryMatch?.id);
    if (cache) cache.set(key, retryId);
    return retryId;
  }
}

function stripHtml(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function wordPressRequest(path, options) {
  const requestOptions = options || {};
  const method = String(requestOptions.method || "GET").toUpperCase();
  const url = buildWordPressApiUrl(path, requestOptions.params || {});
  const fetchOptions = { method };

  if (requestOptions.body !== undefined) {
    fetchOptions.headers = { "Content-Type": "application/json" };
    fetchOptions.body = JSON.stringify(requestOptions.body);
  }

  const response = await fetch(url, fetchOptions);
  const rawBody = await response.text();
  let parsedBody = null;
  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (error) {
      parsedBody = rawBody;
    }
  }

  if (!response.ok) {
    let apiMessage = response.statusText || "Unknown WordPress API error";
    if (parsedBody && typeof parsedBody === "object") {
      if (parsedBody.message) apiMessage = parsedBody.message;
      if (parsedBody.data?.params) {
        const paramErrors = Object.entries(parsedBody.data.params).map(([k, v]) => `${k}: ${v}`).join(", ");
        apiMessage += ` [${paramErrors}]`;
      }
    } else if (typeof parsedBody === "string" && parsedBody) {
      apiMessage = parsedBody.slice(0, 300);
    }
    throw new Error(`WordPress API (${response.status}): ${apiMessage}`);
  }

  return {
    data: parsedBody,
    headers: response.headers,
  };
}

function buildWordPressApiUrl(path, params) {
  const wp = getWordPressIntegration();
  if (!wp.siteUrl || !wp.consumerKey || !wp.consumerSecret) {
    throw new Error("WordPress settings are incomplete.");
  }
  const normalizedPath = String(path || "").startsWith("/") ? String(path) : `/${String(path || "")}`;
  const url = new URL(`/wp-json/wc/v3${normalizedPath}`, wp.siteUrl);
  url.searchParams.set("consumer_key", wp.consumerKey);
  url.searchParams.set("consumer_secret", wp.consumerSecret);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

function normalizeSiteUrl(siteUrl) {
  const trimmed = String(siteUrl || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
}

function normalizeWpTermId(value) {
  const id = toInt(value);
  return id > 0 ? id : null;
}

function normalizeWpProductId(value) {
  const id = toInt(value);
  return id > 0 ? id : null;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("he-IL");
}

function renderAll() {
  renderClientSelect();
  renderEquipmentTable();
  renderClientsTable();
  renderOrdersCalendar();
  renderDashboard();
  renderFinancePanels();
  renderOrderItemsEditor();
  updateOrderTotalsPreview();
  renderWordPressSyncPanel();
}

function renderDashboard() {
  const now = new Date();
  const today = dateToIso(now);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekIso = dateToIso(nextWeek);

  const equipmentTypes = state.equipment.length;
  const inventoryUnits = state.equipment.reduce((sum, item) => sum + item.quantity, 0);
  const activeOrders = state.orders.filter((order) => statusReservesInventory(order.status)).length;

  const monthRevenue = state.orders
    .filter((order) => {
      if (!["confirmed", "picked_up", "returned"].includes(order.status)) return false;
      const start = toDate(order.startDate);
      return start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth();
    })
    .reduce((sum, order) => sum + calcOrderTotals(order).finalTotal, 0);

  el.statEquipmentTypes.textContent = String(equipmentTypes);
  el.statInventoryUnits.textContent = String(inventoryUnits);
  el.statActiveOrders.textContent = String(activeOrders);
  el.statRevenueMonth.textContent = formatCurrency(monthRevenue);

  const dashboardDateEl = document.getElementById("dashboardDate");
  if (dashboardDateEl) {
    dashboardDateEl.textContent = now.toLocaleDateString("he-IL", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }

  const upcoming = state.orders
    .filter((order) => ["confirmed", "picked_up"].includes(order.status))
    .filter((order) => {
      const startsInWindow = order.startDate >= today && order.startDate <= nextWeekIso;
      const endsInWindow = order.endDate >= today && order.endDate <= nextWeekIso;
      return startsInWindow || endsInWindow;
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (upcoming.length === 0) {
    el.upcomingList.innerHTML = `<li class="upcoming-item"><div class="upcoming-details"><div class="upcoming-meta">אין איסופים או החזרות בשבעת הימים הקרובים.</div></div></li>`;
  } else {
    el.upcomingList.innerHTML = upcoming
      .map((order) => {
        const client = getClientName(order.clientId);
        const isPickup = order.startDate >= today;
        const actionLabel = isPickup ? "🚚 איסוף" : "🔙 החזרה";
        const actionDate = isPickup ? order.startDate : order.endDate;
        return `<li class="upcoming-item">
          <div class="upcoming-dot ${escapeHtml(order.status)}"></div>
          <div class="upcoming-details">
            <div class="upcoming-title">${escapeHtml(order.eventName)} <span class="chip ${escapeHtml(order.status)}">${escapeHtml(statusLabels[order.status] || order.status)}</span></div>
            <div class="upcoming-meta">${escapeHtml(client)} · ${actionLabel} ${formatDate(actionDate)}</div>
          </div>
          <div class="upcoming-actions">
            <button class="btn btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.55rem;" data-action="edit-upcoming" data-id="${order.id}">עריכה</button>
          </div>
        </li>`;
      })
      .join("");
  }

  const lowStock = state.equipment
    .map((item) => {
      const reserved = getReservedForRange(item.id, today, today, "");
      const available = Math.max(0, item.quantity - reserved);
      return { item, available };
    })
    .filter(({ item, available }) => item.quantity > 0 && available / item.quantity <= 0.25)
    .sort((a, b) => a.available - b.available);

  if (lowStock.length === 0) {
    el.lowStockList.innerHTML = `<li class="stock-item"><div class="stock-item-info"><div class="stock-item-name" style="color:var(--ok)">✅ רמות המלאי תקינות.</div></div></li>`;
  } else {
    el.lowStockList.innerHTML = lowStock
      .map(({ item, available }) => {
        const pct = Math.round((available / item.quantity) * 100);
        const barColor = pct === 0 ? "var(--danger)" : pct <= 10 ? "#c4610a" : "var(--warn)";
        const countClass = pct === 0 ? "availability-bad" : "availability-low";
        return `<li class="stock-item">
          <div class="stock-item-info">
            <div class="stock-item-name">${escapeHtml(item.name)}</div>
            <div class="stock-bar-wrap">
              <div class="stock-bar-fill" style="width:${pct}%;background:${barColor}"></div>
            </div>
          </div>
          <span class="stock-count ${countClass}">${available}/${item.quantity}</span>
        </li>`;
      })
      .join("");
  }

  renderDashboardHighlights({
    now,
    todayIso: today,
    activeOrders,
  });
}

function renderDashboardHighlights(context) {
  if (!el.dashboardHighlights) return;
  ensureFinanceRoot();

  const now = context?.now instanceof Date ? context.now : new Date();
  const todayIso = normalizeIsoDateInput(context?.todayIso) || dateToIso(now);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoIso = dateToIso(thirtyDaysAgo);
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAgoIso = dateToIso(ninetyDaysAgo);

  const incomesLast30Days = state.finance.incomes.rows.reduce((sum, row) => {
    const rowDateIso = getIncomesDateIsoFromRow(row);
    if (!rowDateIso || rowDateIso < thirtyDaysAgoIso || rowDateIso > todayIso) return sum;
    return sum + parseFinanceNumber(getFinanceValue(row, ["שולם בפועל", "סכום לפני מע\"מ", "סכום לפני מעמ", "סכום"]));
  }, 0);

  const variableExpensesLast30Days = state.finance.variableExpenses.rows.reduce((sum, row) => {
    const parsedDate = parseAnyFinanceDate(getFinanceValue(row, ["תאריך: DD/MM/YYYY", "תאריך"]));
    const rowDateIso = financeParsedDateToIso(parsedDate);
    if (!rowDateIso || rowDateIso < thirtyDaysAgoIso || rowDateIso > todayIso) return sum;
    return sum + parseFinanceNumber(getFinanceValue(row, ["סכום אחרי מעמ", "סכום אחרי מע\"מ", "סכום"]));
  }, 0);

  const openPaymentsRows = state.finance.openPayments.rows;
  const openPaymentsTotal = openPaymentsRows.reduce((sum, row) => {
    return (
      sum +
      parseFinanceNumber(
        getFinanceValue(row, ["סכום פתוח", "יתרה", "יתרה לתשלום", "יתרת תשלום", "חוב", "סכום לתשלום", "סכום"]),
      )
    );
  }, 0);

  const activeClientsLast90Days = new Set(
    state.orders
      .filter((order) => order.status !== "cancelled")
      .filter((order) => order.startDate >= ninetyDaysAgoIso && order.startDate <= todayIso)
      .map((order) => String(order.clientId || "").trim())
      .filter(Boolean),
  ).size;

  const unpaidOrders = state.orders.filter(
    (order) => order.status !== "cancelled" && String(order.paymentStatus || "unpaid") !== "paid",
  );
  const unpaidOrdersBalance = unpaidOrders.reduce((sum, order) => {
    const totals = calcOrderTotals(order);
    const paid = Math.max(0, toNumber(order.deposit));
    return sum + Math.max(0, totals.finalTotal - paid);
  }, 0);

  const activeOrders = Number.isFinite(context?.activeOrders) ? context.activeOrders : 0;

  const cards = [
    {
      title: "לקוחות פעילים",
      value: `${activeClientsLast90Days}/${state.clients.length}`,
      sub: "לקוחות עם פעילות ב-90 הימים האחרונים",
      tab: "clients",
      tabLabel: "לקוחות",
      tone: "dashboard-mini-teal",
    },
    {
      title: "מצב הזמנות",
      value: `${activeOrders} פעילות`,
      sub: `סה"כ יתרת גבייה מהזמנות: ${formatCurrency(unpaidOrdersBalance)}`,
      tab: "orders",
      tabLabel: "הזמנות",
      tone: "dashboard-mini-blue",
    },
    {
      title: "הכנסות 30 ימים",
      value: formatCurrency(incomesLast30Days),
      sub: `הוצאות משתנות 30 ימים: ${formatCurrency(variableExpensesLast30Days)}`,
      tab: "financeIncomes",
      tabLabel: "הכנסות",
      tone: "dashboard-mini-green",
    },
    {
      title: "תשלומים פתוחים",
      value: `${openPaymentsRows.length} רשומות`,
      sub: `סה"כ פתוח: ${formatCurrency(openPaymentsTotal)}`,
      tab: "financeOpenPayments",
      tabLabel: "תשלומים פתוחים",
      tone: openPaymentsRows.length > 0 ? "dashboard-mini-orange" : "dashboard-mini-teal",
    },
  ];

  el.dashboardHighlights.innerHTML = cards
    .map((card) => {
      return `<article class="dashboard-mini-card ${escapeHtml(card.tone)}">
        <div class="dashboard-mini-title">${escapeHtml(card.title)}</div>
        <div class="dashboard-mini-value">${escapeHtml(card.value)}</div>
        <p class="dashboard-mini-sub">${escapeHtml(card.sub)}</p>
        <button class="btn btn-secondary dashboard-mini-btn" data-action="dashboard-open-tab" data-tab="${escapeHtml(card.tab)}">פתח ${escapeHtml(card.tabLabel)}</button>
      </article>`;
    })
    .join("");
}

function renderEquipmentTable() {
  if (state.equipment.length === 0) {
    el.equipmentGrid.innerHTML = `<p class="empty-state">עדיין לא נוסף ציוד. לחץ על "+ הוספת מוצר חדש" כדי להתחיל.</p>`;
    return;
  }

  const today = dateToIso(new Date());
  const query = String(el.equipmentSearchInput?.value || "").trim().toLowerCase();

  const filtered = state.equipment
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((item) => {
      if (!query) return true;
      return (
        String(item.name || "").toLowerCase().includes(query) ||
        String(item.sku || "").toLowerCase().includes(query)
      );
    });

  if (filtered.length === 0) {
    el.equipmentGrid.innerHTML = `<p class="empty-state">לא נמצאו תוצאות לחיפוש.</p>`;
    return;
  }

  el.equipmentGrid.innerHTML = filtered
    .map((item) => {
      const reservedNow = getReservedForRange(item.id, today, today, "");
      const availableNow = Math.max(0, item.quantity - reservedNow);
      const imgHtml = item.imageUrl
        ? `<img class="eq-card-img" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
        : `<div class="eq-card-img-placeholder">📦</div>`;
      const catLabel = escapeHtml(item.wpCategoryName || categoryLabels[item.category] || item.category);
      const syncTitle = item.wpProductId ? `מסונכרן (WP #${item.wpProductId})` : "לא מסונכרן";
      const syncClass = item.wpProductId ? "synced" : "unsynced";
      return `<div class="eq-card" data-id="${item.id}">
        ${imgHtml}
        <div class="eq-card-body">
          <div class="eq-card-name">${escapeHtml(item.name)}</div>
          <div class="eq-card-meta">
            <span>${catLabel}</span>
            ${item.sku ? `<span class="eq-card-sku">מק&quot;ט: ${escapeHtml(item.sku)}</span>` : ""}
          </div>
          <div class="eq-card-stock">
            <span>מלאי: ${item.quantity}</span>
            <span>זמין: ${availableNow}</span>
            <span>${formatCurrency(item.dailyPrice)}/יום</span>
          </div>
          ${item.shelfLocation ? `<div class="eq-card-shelf">📦 ${escapeHtml(item.shelfLocation)}</div>` : ""}
          ${item.damagedQty > 0 ? `<div class="eq-card-damaged">⚠️ פגומים: ${item.damagedQty}</div>` : ""}
          <div class="eq-card-sync ${syncClass}" title="${escapeHtml(syncTitle)}">
            ${item.wpProductId ? "✅ מסונכרן" : "⚠️ לא מסונכרן"}
          </div>
          <div class="eq-card-actions">
            <button class="btn btn-secondary" data-action="edit" data-id="${item.id}">עריכה</button>
            <button class="btn btn-secondary" data-action="sync-item" data-id="${item.id}" title="${escapeHtml(syncTitle)}">🔄 WP</button>
            <button class="btn btn-danger" data-action="delete" data-id="${item.id}">מחיקה</button>
          </div>
        </div>
      </div>`;
    })
    .join("");
}

function renderClientsTable() {
  if (state.clients.length === 0) {
    el.clientsTableBody.innerHTML = `<tr><td colspan="5">עדיין לא נוספו לקוחות.</td></tr>`;
    return;
  }

  el.clientsTableBody.innerHTML = state.clients
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((client) => {
      return `<tr>
        <td>${escapeHtml(client.name)}</td>
        <td>${escapeHtml(client.company || "-")}</td>
        <td>${escapeHtml(client.email || "-")}</td>
        <td>${escapeHtml(client.phone || "-")}</td>
        <td class="actions">
          <button class="btn btn-secondary" data-action="edit" data-id="${client.id}">עריכה</button>
          <button class="btn btn-danger" data-action="delete" data-id="${client.id}">מחיקה</button>
        </td>
      </tr>`;
    })
    .join("");
}

function renderClientSelect() {
  const currentValue = el.orderClientId.value;
  if (state.clients.length === 0) {
    el.orderClientId.innerHTML = `<option value="">אין לקוחות זמינים</option>`;
    return;
  }

  el.orderClientId.innerHTML = state.clients
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((client) => `<option value="${client.id}">${escapeHtml(client.name)}</option>`)
    .join("");

  if (state.clients.some((client) => client.id === currentValue)) {
    el.orderClientId.value = currentValue;
  } else {
    el.orderClientId.value = state.clients[0].id;
  }
}

function renderOrderItemsEditor() {
  if (orderItemsDraft.length === 0) {
    el.orderItemsBody.innerHTML = `<tr><td colspan="6">אין פריטים. לחץ על "הוסף פריט".</td></tr>`;
    return;
  }

  const startDate = el.orderStartDate.value;
  const endDate = el.orderEndDate.value;
  const status = el.orderStatus.value;
  const excludeOrderId = el.orderId.value.trim();
  const days = calculateRentalDays(startDate, endDate);

  el.orderItemsBody.innerHTML = orderItemsDraft
    .map((line, index) => {
      const options = state.equipment
        .map((equipment) => {
          const selected = equipment.id === line.equipmentId ? "selected" : "";
          return `<option value="${equipment.id}" ${selected}>${escapeHtml(equipment.name)}</option>`;
        })
        .join("");

      const quantity = Math.max(1, toInt(line.quantity));
      const dailyPrice = Math.max(0, toNumber(line.dailyPrice));
      const lineTotal = quantity * dailyPrice * days;
      const available =
        startDate && endDate ? getAvailableForRange(line.equipmentId, startDate, endDate, excludeOrderId) : 0;
      const wouldReserve = statusReservesInventory(status);
      const availabilityClass = !wouldReserve
        ? "availability-ok"
        : quantity > available
          ? "availability-bad"
          : available - quantity <= 1
            ? "availability-low"
            : "availability-ok";
      const availabilityText = !wouldReserve
        ? "לא רלוונטי (הסטטוס לא שומר מלאי)"
        : `${available} זמינים`;

      return `<tr>
        <td>
          <select data-field="equipmentId" data-index="${index}">
            ${options}
          </select>
        </td>
        <td>
          <input type="number" min="1" value="${quantity}" data-field="quantity" data-index="${index}" />
        </td>
        <td>
          <input type="number" min="0" value="${dailyPrice}" data-field="dailyPrice" data-index="${index}" />
        </td>
        <td class="${availabilityClass}">${availabilityText}</td>
        <td>${formatCurrency(lineTotal)}</td>
        <td>
          <button type="button" class="btn btn-danger" data-action="remove-item" data-index="${index}">הסר</button>
        </td>
      </tr>`;
    })
    .join("");
}

function renderOrdersCalendar() {
  renderCalendarGrid();
  renderOrderTiles();
}

function renderCalendarGrid() {
  const year  = calendarViewYear;
  const month = calendarViewMonth;
  el.ordersCalMonthLabel.textContent = `${MONTH_NAMES_HE[month]} ${year}`;

  const firstDow  = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const today     = dateToIso(new Date());

  let html = `<div class="orders-cal-header">${DAY_NAMES_HE.map(d => `<div class="orders-cal-dow">${d}</div>`).join("")}</div><div class="orders-cal-body">`;

  for (let i = 0; i < firstDow; i++) html += `<div class="orders-cal-cell empty"></div>`;

  for (let day = 1; day <= totalDays; day++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isToday = iso === today;
    const dayOrders = state.orders.filter(o => o.startDate <= iso && o.endDate >= iso && o.status !== "cancelled");
    const chips = dayOrders.slice(0, 2).map(o =>
      `<div class="cal-order-chip ${o.status}" data-action="edit-order" data-id="${o.id}" title="${escapeHtml(o.eventName)}">${escapeHtml(o.eventName.length > 10 ? o.eventName.slice(0, 10) + "…" : o.eventName)}</div>`
    ).join("");
    const more = dayOrders.length > 2 ? `<div class="cal-order-more">+${dayOrders.length - 2} נוספות</div>` : "";
    html += `<div class="orders-cal-cell${isToday ? " today" : ""}" data-date="${iso}"><span class="orders-cal-day-num">${day}</span><div class="orders-cal-chips">${chips}${more}</div></div>`;
  }

  html += `</div>`;
  el.ordersCalendarGrid.innerHTML = html;
}

function orderTileHtml(order) {
  const totals = calcOrderTotals(order);
  return `<div class="order-tile ${order.status}" data-id="${order.id}">
    <div class="order-tile-head">
      <span class="order-tile-num">${escapeHtml(order.orderNumber)}</span>
      <span class="chip ${order.status}">${escapeHtml(statusLabels[order.status] || order.status)}</span>
    </div>
    <div class="order-tile-event">${escapeHtml(order.eventName)}</div>
    <div class="order-tile-meta">
      <span>👤 ${escapeHtml(getClientName(order.clientId))}</span>
      <span>📍 ${escapeHtml(order.eventLocation || "-")}</span>
    </div>
    <div class="order-tile-dates">📅 ${formatDate(order.startDate)} – ${formatDate(order.endDate)}</div>
    <div class="order-tile-total">${formatCurrency(totals.finalTotal)}</div>
    <div class="order-tile-payment">
      <span class="payment-chip ${order.paymentStatus || "unpaid"}">${paymentStatusLabels[order.paymentStatus] || "לא שולם"}</span>
      ${order.paymentMethod ? `<span class="payment-method">💳 ${paymentMethodLabels[order.paymentMethod] || order.paymentMethod}</span>` : ""}
    </div>
    <div class="order-tile-actions">
      <button class="btn btn-secondary" data-action="edit-order" data-id="${order.id}">עריכה</button>
      <button class="btn btn-secondary" data-action="print-delivery" data-id="${order.id}" title="תעודת משלוח">🖨️ משלוח</button>
      <button class="btn btn-secondary" data-action="print-return" data-id="${order.id}" title="תעודת החזרה">🖨️ החזרה</button>
      <button class="btn btn-danger" data-action="delete-order" data-id="${order.id}">מחיקה</button>
    </div>
  </div>`;
}

function renderOrderTiles() {
  const today = dateToIso(new Date());
  const query = (el.ordersSearchInput.value || "").trim().toLowerCase();

  let collection = state.orders.slice();
  if (query) {
    collection = collection.filter(o => {
      const client = getClientName(o.clientId).toLowerCase();
      return o.orderNumber.toLowerCase().includes(query) ||
        o.eventName.toLowerCase().includes(query) ||
        (o.eventLocation || "").toLowerCase().includes(query) ||
        client.includes(query);
    });
  }

  const active = collection
    .filter(o => o.startDate <= today && o.endDate >= today && !["cancelled", "returned"].includes(o.status))
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  const future = collection
    .filter(o => o.startDate > today && o.status !== "cancelled")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  el.ordersActiveGrid.innerHTML = active.length === 0
    ? `<p class="empty-state">אין הזמנות פעילות כרגע.</p>`
    : active.map(orderTileHtml).join("");

  el.ordersFutureGrid.innerHTML = future.length === 0
    ? `<p class="empty-state">אין הזמנות עתידיות.</p>`
    : future.map(orderTileHtml).join("");
}

function buildPrintDoc(title, bodyHtml) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 20px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  h2 { font-size: 15px; color: #444; margin-bottom: 14px; }
  h3 { font-size: 13px; margin-bottom: 8px; color: #222; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; border-bottom: 2px solid #111; padding-bottom: 12px; }
  .doc-meta { font-size: 11px; color: #555; text-align: left; }
  .doc-meta p { margin-bottom: 2px; }
  .section { margin-bottom: 18px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 10px; }
  .info-row { display: flex; gap: 6px; }
  .info-label { font-weight: bold; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #bbb; padding: 5px 7px; text-align: right; vertical-align: middle; }
  th { background: #f0f0f0; font-weight: bold; font-size: 12px; }
  td { font-size: 12px; }
  .cb { width: 44px; text-align: center; font-size: 16px; }
  .notes-col { min-width: 100px; }
  .sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; border-top: 1px solid #ccc; padding-top: 16px; }
  .sig-box { border: 1px solid #bbb; border-radius: 6px; padding: 12px; min-height: 100px; }
  .sig-box p { margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
  .sig-box p:last-child { border-bottom: none; }
  .notes-area { border: 1px solid #ccc; border-radius: 4px; min-height: 60px; margin-top: 6px; }
  @media print { body { padding: 0; } @page { margin: 1.5cm; } .no-print { display: none !important; } }
</style></head><body>
<div class="no-print" style="margin-bottom:14px">
  <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#2563eb;color:#fff;border:none;border-radius:6px">🖨️ הדפס</button>
  <button onclick="window.close()" style="padding:8px 16px;font-size:14px;cursor:pointer;background:#eee;border:1px solid #ccc;border-radius:6px;margin-right:8px">סגור</button>
</div>
<div class="doc-header">
  <div><h1>מערכת ניהול השכרת ציוד לאירועים</h1><h2>${title}</h2></div>
  <div class="doc-meta"><p>תאריך הפקה: ${dateStr}</p><p>שעה: ${timeStr}</p></div>
</div>
${bodyHtml}
</body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (w) setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function printDeliveryNote(order) {
  const client = getClientName(order.clientId);
  const totals = calcOrderTotals(order);
  const itemRows = order.items.map((line, i) => {
    const eq = state.equipment.find(e => e.id === line.equipmentId);
    const name = eq ? eq.name : "(ציוד לא נמצא)";
    const sku  = eq ? (eq.sku || "-") : "-";
    const shelf = eq ? (eq.shelfLocation || "-") : "-";
    const damaged = eq && eq.damagedQty > 0 ? `⚠️ ${eq.damagedQty} פגומים` : "";
    return `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${name}</td>
      <td>${sku}</td>
      <td>${shelf}</td>
      <td style="text-align:center">${line.quantity}</td>
      <td class="cb">☐</td>
      <td class="cb">☐</td>
      <td class="notes-col">${damaged}</td>
    </tr>`;
  }).join("");

  const body = `
<div class="section">
  <h3>פרטי הזמנה</h3>
  <div class="info-grid">
    <div class="info-row"><span class="info-label">מספר הזמנה:</span> ${order.orderNumber}</div>
    <div class="info-row"><span class="info-label">סטטוס:</span> ${statusLabels[order.status] || order.status}</div>
    <div class="info-row"><span class="info-label">לקוח:</span> ${client}</div>
    <div class="info-row"><span class="info-label">שם אירוע:</span> ${order.eventName}</div>
    <div class="info-row"><span class="info-label">מיקום:</span> ${order.eventLocation || "-"}</div>
    <div class="info-row"><span class="info-label">תאריך אסיפה:</span> ${formatDate(order.startDate)}</div>
    <div class="info-row"><span class="info-label">תאריך החזרה:</span> ${formatDate(order.endDate)}</div>
    <div class="info-row"><span class="info-label">סה״כ:</span> ${formatCurrency(totals.finalTotal)}</div>
    <div class="info-row"><span class="info-label">סטטוס תשלום:</span> ${paymentStatusLabels[order.paymentStatus] || "לא שולם"}</div>
    <div class="info-row"><span class="info-label">אמצעי תשלום:</span> ${paymentMethodLabels[order.paymentMethod] || "לא צוין"}</div>
  </div>
</div>
<div class="section">
  <h3>רשימת ציוד להכנה</h3>
  <table>
    <thead><tr>
      <th>#</th><th>שם פריט</th><th>מק"ט</th><th>מיקום מחסן</th><th>כמות</th>
      <th class="cb">נארז ✓</th><th class="cb">חסר / פגום</th><th class="notes-col">הערות</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
</div>
<div class="sig-section">
  <div class="sig-box">
    <h3>חתימת מחסנאי</h3>
    <p>שם מלא: _______________________</p>
    <p>חתימה: _______________________</p>
    <p>תאריך: _______________________</p>
  </div>
  <div class="sig-box">
    <h3>הערות כלליות</h3>
    <div class="notes-area"></div>
  </div>
</div>`;
  buildPrintDoc("תעודת משלוח / הכנת הזמנה", body);
}

function printReturnNote(order) {
  const client = getClientName(order.clientId);
  const totals = calcOrderTotals(order);
  const itemRows = order.items.map((line, i) => {
    const eq = state.equipment.find(e => e.id === line.equipmentId);
    const name = eq ? eq.name : "(ציוד לא נמצא)";
    const sku  = eq ? (eq.sku || "-") : "-";
    return `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${name}</td>
      <td>${sku}</td>
      <td style="text-align:center">${line.quantity}</td>
      <td style="text-align:center"></td>
      <td class="cb">☐ תקין</td>
      <td class="cb">☐ פגום</td>
      <td class="cb">☐ חסר</td>
      <td class="notes-col"></td>
    </tr>`;
  }).join("");

  const body = `
<div class="section">
  <h3>פרטי הזמנה</h3>
  <div class="info-grid">
    <div class="info-row"><span class="info-label">מספר הזמנה:</span> ${order.orderNumber}</div>
    <div class="info-row"><span class="info-label">סטטוס:</span> ${statusLabels[order.status] || order.status}</div>
    <div class="info-row"><span class="info-label">לקוח:</span> ${client}</div>
    <div class="info-row"><span class="info-label">שם אירוע:</span> ${order.eventName}</div>
    <div class="info-row"><span class="info-label">מיקום:</span> ${order.eventLocation || "-"}</div>
    <div class="info-row"><span class="info-label">תאריך אסיפה:</span> ${formatDate(order.startDate)}</div>
    <div class="info-row"><span class="info-label">תאריך החזרה:</span> ${formatDate(order.endDate)}</div>
    <div class="info-row"><span class="info-label">סה״כ:</span> ${formatCurrency(totals.finalTotal)}</div>
    <div class="info-row"><span class="info-label">סטטוס תשלום:</span> ${paymentStatusLabels[order.paymentStatus] || "לא שולם"}</div>
    <div class="info-row"><span class="info-label">אמצעי תשלום:</span> ${paymentMethodLabels[order.paymentMethod] || "לא צוין"}</div>
  </div>
</div>
<div class="section">
  <h3>בדיקת החזרת ציוד</h3>
  <table>
    <thead><tr>
      <th>#</th><th>שם פריט</th><th>מק"ט</th><th>כמות שנשלחה</th><th>כמות שחזרה</th>
      <th class="cb">תקין</th><th class="cb">פגום</th><th class="cb">חסר</th><th class="notes-col">הערות</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
</div>
<div class="sig-section">
  <div class="sig-box">
    <h3>חתימת מחסנאי</h3>
    <p>שם מלא: _______________________</p>
    <p>חתימה: _______________________</p>
    <p>תאריך: _______________________</p>
  </div>
  <div class="sig-box">
    <h3>חתימת לקוח / נהג</h3>
    <p>שם מלא: _______________________</p>
    <p>חתימה: _______________________</p>
    <p>תאריך: _______________________</p>
  </div>
</div>`;
  buildPrintDoc("תעודת החזרה", body);
}

function showDayDetail(iso) {
  const date = new Date(iso + "T00:00:00");
  const dow   = DAY_NAMES_HE[date.getDay()];
  const day   = date.getDate();
  const month = MONTH_NAMES_HE[date.getMonth()];
  const year  = date.getFullYear();
  el.dayDetailTitle.textContent = `${dow}, ${day} ב${month} ${year}`;

  const dayOrders = state.orders.filter(o => o.startDate <= iso && o.endDate >= iso && o.status !== "cancelled");

  if (dayOrders.length === 0) {
    el.dayDetailBody.innerHTML = `<div class="day-detail-empty">📭 אין אירועים ביום זה</div>`;
  } else {
    el.dayDetailBody.innerHTML = dayOrders.map(o => {
      const totals = calcOrderTotals(o);
      return `<div class="day-detail-card ${o.status}">
        <div class="day-detail-card-head">
          <span class="order-tile-num">${escapeHtml(o.orderNumber)}</span>
          <span class="chip ${o.status}">${escapeHtml(statusLabels[o.status] || o.status)}</span>
        </div>
        <div class="day-detail-card-event">${escapeHtml(o.eventName)}</div>
        <div class="day-detail-card-meta">
          <span>👤 ${escapeHtml(getClientName(o.clientId))}</span>
          <span>📍 ${escapeHtml(o.eventLocation || "-")}</span>
        </div>
        <div class="day-detail-card-dates">📅 ${formatDate(o.startDate)} – ${formatDate(o.endDate)}</div>
        <div class="day-detail-card-total">${formatCurrency(totals.finalTotal)}</div>
        <div class="order-tile-payment">
          <span class="payment-chip ${o.paymentStatus || "unpaid"}">${paymentStatusLabels[o.paymentStatus] || "לא שולם"}</span>
          ${o.paymentMethod ? `<span class="payment-method">💳 ${paymentMethodLabels[o.paymentMethod] || o.paymentMethod}</span>` : ""}
        </div>
        <div class="day-detail-card-actions">
          <button class="btn btn-secondary" data-action="edit-order" data-id="${o.id}">עריכה</button>
          <button class="btn btn-secondary" data-action="print-delivery" data-id="${o.id}">🖨️ משלוח</button>
          <button class="btn btn-secondary" data-action="print-return" data-id="${o.id}">🖨️ החזרה</button>
          <button class="btn btn-danger" data-action="delete-order" data-id="${o.id}">מחיקה</button>
        </div>
      </div>`;
    }).join("");
  }

  el.dayDetailDialog.showModal();
}

function updateOrderTotalsPreview() {
  const draftOrder = {
    startDate: el.orderStartDate.value,
    endDate: el.orderEndDate.value,
    discount: Math.max(0, toNumber(el.orderDiscount.value)),
    deposit: Math.max(0, toNumber(el.orderDeposit.value)),
    items: orderItemsDraft.map((item) => ({
      quantity: Math.max(1, toInt(item.quantity)),
      dailyPrice: Math.max(0, toNumber(item.dailyPrice)),
    })),
  };

  const totals = calcOrderTotals(draftOrder);
  el.orderDays.textContent = String(totals.days);
  el.orderSubtotal.textContent = formatCurrency(totals.subtotal);
  el.orderVat.textContent = formatCurrency(totals.vat);
  el.orderTotal.textContent = formatCurrency(totals.finalTotal);
  el.orderBalance.textContent = formatCurrency(Math.max(0, totals.finalTotal - draftOrder.deposit));
}

function calcOrderTotals(orderLike) {
  const days = calculateRentalDays(orderLike.startDate, orderLike.endDate);
  const subtotal = (orderLike.items || []).reduce(
    (sum, item) => sum + Math.max(1, toInt(item.quantity)) * Math.max(0, toNumber(item.dailyPrice)) * days,
    0,
  );
  const discount = Math.max(0, toNumber(orderLike.discount || 0));
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const vat = (discountedSubtotal * state.settings.vatPercent) / 100;
  const finalTotal = discountedSubtotal + vat;
  return { days, subtotal, vat, finalTotal };
}

function getReservedForRange(equipmentId, startDate, endDate, excludeOrderId) {
  if (!equipmentId || !startDate || !endDate) return 0;
  return state.orders
    .filter((order) => order.id !== excludeOrderId)
    .filter((order) => statusReservesInventory(order.status))
    .filter((order) => rangesOverlap(startDate, endDate, order.startDate, order.endDate))
    .reduce((sum, order) => {
      const lineQty = order.items
        .filter((line) => line.equipmentId === equipmentId)
        .reduce((lineSum, line) => lineSum + Math.max(0, toInt(line.quantity)), 0);
      return sum + lineQty;
    }, 0);
}

function getAvailableForRange(equipmentId, startDate, endDate, excludeOrderId) {
  const equipment = state.equipment.find((item) => item.id === equipmentId);
  if (!equipment) return 0;
  const reserved = getReservedForRange(equipmentId, startDate, endDate, excludeOrderId);
  return Math.max(0, equipment.quantity - reserved);
}

function statusReservesInventory(status) {
  return status === "confirmed" || status === "picked_up";
}

function createDraftItem() {
  const firstEquipment = state.equipment[0];
  return {
    id: uid(),
    equipmentId: firstEquipment ? firstEquipment.id : "",
    quantity: 1,
    dailyPrice: firstEquipment ? firstEquipment.dailyPrice : 0,
  };
}

function hydrateOrderForm(order) {
  el.orderId.value = order.id;
  el.orderNumber.value = order.orderNumber;
  el.orderStatus.value = order.status;
  el.orderClientId.value = order.clientId;
  el.orderEventName.value = order.eventName;
  el.orderEventLocation.value = order.eventLocation;
  el.orderStartDate.value = order.startDate;
  el.orderEndDate.value = order.endDate;
  el.orderDiscount.value = String(order.discount || 0);
  el.orderDeposit.value = String(order.deposit || 0);
  el.orderPaymentStatus.value = order.paymentStatus || "unpaid";
  el.orderPaymentMethod.value = order.paymentMethod || "";
  el.orderNotes.value = order.notes || "";
  orderItemsDraft = order.items.map((item) => ({
    id: item.id || uid(),
    equipmentId: item.equipmentId,
    quantity: item.quantity,
    dailyPrice: item.dailyPrice,
  }));
  renderOrderItemsEditor();
  updateOrderTotalsPreview();
  el.orderPrintDeliveryBtn.classList.remove("hidden");
  el.orderPrintReturnBtn.classList.remove("hidden");
  el.orderPrintDeliveryBtn.dataset.id = order.id;
  el.orderPrintReturnBtn.dataset.id = order.id;
}

function resetEquipmentForm() {
  el.equipmentId.value = "";
  el.equipmentForm.reset();
  el.equipmentCategory.value = "sound";
  el.equipmentQuantity.value = "1";
  el.equipmentDailyPrice.value = "0";
  el.equipmentSku.value = "";
  el.equipmentSize.value = "";
  el.equipmentShelfLocation.value = "";
  el.equipmentDamagedQty.value = "0";
  el.equipmentImageUrl.value = "";
  el.equipmentWpCategoryName.value = "";
  el.equipmentForm.classList.add("hidden");
}

function resetClientForm() {
  el.clientId.value = "";
  el.clientForm.reset();
}

function resetInlineClientForm() {
  el.inlineClientName.value = "";
  el.inlineClientPhone.value = "";
  el.inlineClientEmail.value = "";
  el.inlineClientCompany.value = "";
}

function resetOrderForm() {
  el.orderId.value = "";
  el.orderForm.reset();
  el.orderNumber.value = generateOrderNumber();
  el.orderStatus.value = "draft";
  el.orderDiscount.value = "0";
  el.orderDeposit.value = "0";
  el.orderPaymentStatus.value = "unpaid";
  el.orderPaymentMethod.value = "";

  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + 1);
  el.orderStartDate.value = dateToIso(today);
  el.orderEndDate.value = dateToIso(end);

  if (state.clients.length > 0) {
    el.orderClientId.value = state.clients[0].id;
  }

  orderItemsDraft = state.equipment.length > 0 ? [createDraftItem()] : [];
  renderOrderItemsEditor();
  updateOrderTotalsPreview();
  el.orderForm.classList.add("hidden");
  el.orderPrintDeliveryBtn.classList.add("hidden");
  el.orderPrintReturnBtn.classList.add("hidden");
  el.orderInlineClientForm.classList.add("hidden");
  resetInlineClientForm();
}

function generateOrderNumber() {
  return `הז-${String(state.counters.order).padStart(4, "0")}`;
}

function focusTab(tabId) {
  const button = el.tabButtons.find((entry) => entry.dataset.tab === tabId);
  if (button) button.click();
}

function getClientName(clientId) {
  return state.clients.find((client) => client.id === clientId)?.name || "-";
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaultState();
    const parsed = JSON.parse(raw);
    return sanitizeState(parsed);
  } catch (error) {
    console.error(error);
    return cloneDefaultState();
  }
}

function sanitizeState(input) {
  const base = cloneDefaultState();
  const data = input && typeof input === "object" ? input : {};
  base.settings.currency = typeof data.settings?.currency === "string" ? data.settings.currency : "ILS";
  base.settings.vatPercent = Number.isFinite(data.settings?.vatPercent)
    ? Math.max(0, Number(data.settings.vatPercent))
    : 18;
  base.counters.order = Number.isInteger(data.counters?.order) && data.counters.order > 0 ? data.counters.order : 1;
  base.equipment = Array.isArray(data.equipment) ? data.equipment : [];
  base.clients = Array.isArray(data.clients) ? data.clients : [];
  base.orders = Array.isArray(data.orders) ? data.orders : [];
  const rawWordPress = data.integrations?.wordpress;
  const wp = base.integrations.wordpress;
  wp.siteUrl = normalizeSiteUrl(rawWordPress?.siteUrl);
  wp.consumerKey = String(rawWordPress?.consumerKey || "");
  wp.consumerSecret = String(rawWordPress?.consumerSecret || "");
  wp.username = String(rawWordPress?.username || "");
  wp.appPassword = String(rawWordPress?.appPassword || "");
  wp.autoSync = Boolean(rawWordPress?.autoSync);
  wp.lastPullAt = String(rawWordPress?.lastPullAt || "");
  wp.lastPushAt = String(rawWordPress?.lastPushAt || "");
  wp.lastSyncAt = String(rawWordPress?.lastSyncAt || "");
  wp.lastError = String(rawWordPress?.lastError || "");
  wp.pendingDeleteProductIds = Array.isArray(rawWordPress?.pendingDeleteProductIds)
    ? rawWordPress.pendingDeleteProductIds.map((value) => normalizeWpProductId(value)).filter(Boolean)
    : [];
  wp.log = Array.isArray(rawWordPress?.log)
    ? rawWordPress.log.map((entry) => String(entry || "")).filter(Boolean).slice(-WP_SYNC_LOG_LIMIT)
    : [];

  base.equipment = base.equipment
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: String(item.id || uid()),
      name: String(item.name || "").trim(),
      category: String(item.category || "other"),
      quantity: Math.max(0, toInt(item.quantity)),
      dailyPrice: Math.max(0, toNumber(item.dailyPrice)),
      sku: String(item.sku || ""),
      size: String(item.size || ""),
      shelfLocation: String(item.shelfLocation || ""),
      damagedQty: Math.max(0, toInt(item.damagedQty)),
      imageUrl: String(item.imageUrl || ""),
      wpCategoryName: String(item.wpCategoryName || ""),
      wpCategoryId: normalizeWpTermId(item.wpCategoryId),
      notes: String(item.notes || ""),
      createdAt: String(item.createdAt || new Date().toISOString()),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
      wpProductId: normalizeWpProductId(item.wpProductId),
      wpLastRemoteModified: String(item.wpLastRemoteModified || ""),
      wpLastSyncedAt: String(item.wpLastSyncedAt || ""),
    }))
    .filter((item) => item.name);

  base.clients = base.clients
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: String(item.id || uid()),
      name: String(item.name || "").trim(),
      company: String(item.company || ""),
      email: String(item.email || ""),
      phone: String(item.phone || ""),
      address: String(item.address || ""),
      notes: String(item.notes || ""),
      createdAt: String(item.createdAt || new Date().toISOString()),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
    }))
    .filter((item) => item.name);

  base.orders = base.orders
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: String(item.id || uid()),
      orderNumber: String(item.orderNumber || generateFallbackOrderNumber()),
      status: String(item.status || "draft"),
      clientId: String(item.clientId || ""),
      eventName: String(item.eventName || "").trim(),
      eventLocation: String(item.eventLocation || "").trim(),
      startDate: String(item.startDate || ""),
      endDate: String(item.endDate || ""),
      discount: Math.max(0, toNumber(item.discount)),
      deposit: Math.max(0, toNumber(item.deposit)),
      paymentStatus: ["unpaid","partial","paid"].includes(item.paymentStatus) ? item.paymentStatus : "unpaid",
      paymentMethod: String(item.paymentMethod || ""),
      notes: String(item.notes || ""),
      createdAt: String(item.createdAt || new Date().toISOString()),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
      items: Array.isArray(item.items)
        ? item.items
            .filter((line) => line && typeof line === "object")
            .map((line) => ({
              id: String(line.id || uid()),
              equipmentId: String(line.equipmentId || ""),
              quantity: Math.max(1, toInt(line.quantity)),
              dailyPrice: Math.max(0, toNumber(line.dailyPrice)),
            }))
        : [],
    }))
    .filter((item) => item.orderNumber && item.clientId && item.eventName && item.startDate && item.endDate);

  const maxOrderFromData = Math.max(
    0,
    ...base.orders.map((order) => {
      const match = /(\d+)/.exec(order.orderNumber);
      return match ? Number(match[1]) : 0;
    }),
  );
  base.counters.order = Math.max(base.counters.order, maxOrderFromData + 1);

  base.finance.incomes = normalizeFinanceTable(data.finance?.incomes);
  base.finance.openPayments = normalizeFinanceTable(data.finance?.openPayments);
  base.finance.shortages = normalizeFinanceTable(data.finance?.shortages);
  base.finance.fixedExpenses = normalizeFinanceTable(data.finance?.fixedExpenses);
  base.finance.variableExpenses = normalizeFinanceTable(data.finance?.variableExpenses);
  base.finance.monthlySummary2025 = normalizeFinanceTable(data.finance?.monthlySummary2025);
  base.finance.monthlySummary2026 = normalizeFinanceTable(data.finance?.monthlySummary2026);
  base.meta.excelBootstrapVersion = String(data.meta?.excelBootstrapVersion || "");

  return base;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function generateFallbackOrderNumber() {
  return `הז-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
}

function calculateRentalDays(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const start = toDate(startDate);
  const end = toDate(endDate);
  const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return Number.isFinite(diff) && diff > 0 ? diff : 1;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return !(aEnd < bStart || aStart > bEnd);
}

function toDate(value) {
  return new Date(`${value}T00:00:00`);
}

function dateToIso(date) {
  return date.toISOString().slice(0, 10);
}

function toInt(value) {
  const num = Number.parseInt(String(value || "0"), 10);
  return Number.isFinite(num) ? num : 0;
}

function toNumber(value) {
  const num = Number.parseFloat(String(value || "0"));
  return Number.isFinite(num) ? num : 0;
}

function formatCurrency(amount) {
  const formatter = new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: state.settings.currency || "ILS",
    maximumFractionDigits: 0,
  });
  return formatter.format(Number.isFinite(amount) ? amount : 0);
}

function formatCurrencyShort(amount) {
  const value = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const shortMillions = abs >= 10_000_000 ? Math.round(abs / 1_000_000) : Math.round((abs / 1_000_000) * 10) / 10;
    return `${sign}₪${shortMillions}M`;
  }
  if (abs >= 1_000) {
    return `${sign}₪${Math.round(abs / 1_000)}K`;
  }
  return `${sign}₪${Math.round(abs)}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("he-IL");
}

function showMessage(text, type) {
  el.messageBox.textContent = text;
  el.messageBox.className = `message ${type || "info"}`;
  window.clearTimeout(showMessage.timeoutId);
  showMessage.timeoutId = window.setTimeout(() => {
    el.messageBox.className = "message hidden";
    el.messageBox.textContent = "";
  }, 3000);
}

showMessage.timeoutId = 0;

function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
