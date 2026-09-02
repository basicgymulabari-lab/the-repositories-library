import assert from "node:assert/strict";
import { createServer } from "vite";

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }

  removeItem(key) {
    this.#values.delete(key);
  }

  clear() {
    this.#values.clear();
  }
}

globalThis.window = {
  localStorage: new MemoryStorage(),
  sessionStorage: new MemoryStorage(),
};

const vite = await createServer({
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const store = await vite.ssrLoadModule("/src/lib/gym/store.ts");
  const selectors = await vite.ssrLoadModule("/src/lib/gym/selectors.ts");

  const assertIntegrity = (state) => {
    const unique = (items, label) => {
      const ids = items.map((item) => item.id);
      assert.equal(new Set(ids).size, ids.length, `${label} IDs must be unique`);
    };

    unique(state.members, "member");
    unique(state.memberships, "membership");
    unique(state.payments, "payment");
    unique(state.plans, "plan");
    unique(state.products, "product");
    unique(state.sales, "sale");
    unique(state.expenses ?? [], "expense");

    const memberIds = new Set(state.members.map((item) => item.id));
    const planIds = new Set(state.plans.map((item) => item.id));
    const membershipIds = new Set(state.memberships.map((item) => item.id));
    const saleIds = new Set(state.sales.map((item) => item.id));

    state.memberships.forEach((item) => {
      assert(memberIds.has(item.memberId), `membership ${item.id} has a missing member`);
      assert(planIds.has(item.planId), `membership ${item.id} has a missing plan`);
      assert(item.price >= 0 && item.discount >= 0 && item.discount <= item.price);
      assert((item.joiningFee ?? 0) >= 0);
      assert(new Date(item.endDate) >= new Date(item.startDate));
    });
    state.payments.forEach((item) => {
      assert(item.amount > 0, `payment ${item.id} must be positive`);
      if (item.memberId) assert(memberIds.has(item.memberId));
      if (item.membershipId) assert(membershipIds.has(item.membershipId));
      if (item.saleId) assert(saleIds.has(item.saleId));
    });
    state.sales.forEach((item) => {
      if (item.memberId) assert(memberIds.has(item.memberId));
      assert(item.qty > 0 && item.total >= 0);
      assert(selectors.salePaid(state, item) <= item.total);
    });
    state.products.forEach((item) => {
      assert(item.stock >= 0 && item.cost >= 0 && item.price >= 0);
    });
    state.plans.forEach((item) => assert((item.joiningFee ?? 0) >= 0));

    assert.equal(
      selectors.totalRevenue(state),
      state.payments.reduce((sum, payment) => sum + payment.amount, 0),
    );
    assert(selectors.totalDue(state) >= 0);
  };

  store.setupTemplateData();
  let state = store.getState();
  assertIntegrity(state);
  assert(state.expenses.length > 0, "starter data must exercise expense reporting");
  assert.equal(selectors.rangeWindow("monthly").start.getDate(), 1);

  assert.equal(await store.login("admin@ironvault.gym", "wrong-password"), false);
  assert.equal(await store.login("admin@ironvault.gym", "admin123"), true);
  assert.equal(store.isLoggedIn(), true);
  window.localStorage.setItem(
    "ironvault.session.v1",
    JSON.stringify({ at: 1, expiresAt: 2, email: state.auth.email }),
  );
  window.sessionStorage.clear();
  assert.equal(store.isLoggedIn(), false, "expired sessions must be rejected");

  const memberCount = state.members.length;
  store.addMember({
    name: "Logic Test Member",
    email: "logic@example.com",
    phone: "+91 90000 00000",
    gender: "other",
    dob: "1995-01-01T00:00:00.000Z",
    address: "Test address",
    emergencyContact: "+91 91111 11111",
    planId: "plan_monthly",
    startDate: "2030-01-10T00:00:00.000Z",
    joiningFee: 750,
    discount: 100,
    paidNow: 500,
    paymentMethod: "upi",
  });
  state = store.getState();
  assert.equal(state.members.length, memberCount + 1);
  const testMember = state.members.find((item) => item.email === "logic@example.com");
  assert(testMember);
  assert.equal(selectors.dueFor(state, testMember.id), 1650);

  const membership = selectors.currentMembership(state, testMember.id);
  assert(membership);
  assert.equal(membership.startDate.slice(0, 10), "2030-01-10");
  assert.equal(
    Math.round(
      (new Date(membership.endDate).getTime() - new Date(membership.startDate).getTime()) /
        selectors.DAY,
    ),
    state.plans.find((plan) => plan.id === membership.planId).durationDays,
  );
  assert.equal(
    state.payments.find((payment) => payment.membershipId === membership.id)?.method,
    "upi",
  );
  store.addPayment({
    memberId: testMember.id,
    membershipId: membership.id,
    amount: 1650,
    method: "cash",
  });
  assert.equal(selectors.dueFor(store.getState(), testMember.id), 0);
  assert.equal(
    store.addPayment({
      memberId: testMember.id,
      membershipId: membership.id,
      amount: 1,
      method: "cash",
    }),
    false,
    "overpayments must be rejected",
  );

  store.renewMembership(testMember.id, "plan_quarterly", 1000, 200);
  assert.equal(selectors.membershipHistory(store.getState(), testMember.id).length, 2);
  assert.equal(
    store.deletePlanPermanently("plan_quarterly"),
    false,
    "plans referenced by membership history must be retained",
  );

  state = store.getState();
  const frozenMembership = selectors.currentMembership(state, testMember.id);
  const oldEnd = new Date(frozenMembership.endDate).getTime();
  const modified = structuredClone(state);
  const target = modified.memberships.find((item) => item.id === frozenMembership.id);
  target.frozen = true;
  target.frozenAt = new Date(Date.now() - 2 * selectors.DAY).toISOString();
  store.restoreBackup(JSON.stringify(modified));
  store.toggleFreeze(frozenMembership.id);
  const extended = selectors.currentMembership(store.getState(), testMember.id);
  assert.equal(extended.frozen, false);
  assert(new Date(extended.endDate).getTime() >= oldEnd + 2 * selectors.DAY - 5_000);

  state = store.getState();
  const product = selectors.liveProducts(state).find((item) => item.stock >= 2);
  assert(product);
  const stockBefore = product.stock;
  store.sellProduct(product.id, 2, testMember.name, testMember.id, {
    discount: 50,
    amountPaid: 100,
    paymentMethod: "card",
  });
  state = store.getState();
  assert.equal(state.products.find((item) => item.id === product.id).stock, stockBefore - 2);
  const sale = state.sales[0];
  assert.equal(state.payments.find((payment) => payment.saleId === sale.id)?.method, "card");
  assert.equal(selectors.saleDue(state, sale), sale.total - 100);
  assert.equal(
    selectors.profitOfSales({ ...state, sales: [sale] }),
    sale.total - sale.unitCost * sale.qty,
  );
  const remainingSaleBalance = selectors.saleDue(state, sale);
  assert.equal(store.addSalePayment(sale.id, remainingSaleBalance, "card"), true);
  assert.equal(selectors.saleDue(store.getState(), sale), 0);
  assert.equal(store.addSalePayment(sale.id, 1, "cash"), false);
  store.updateMember(testMember.id, {
    phone: "+91 98888 77665",
    address: "Updated regular member address",
  });
  state = store.getState();
  assert.equal(state.members.find((item) => item.id === testMember.id).phone, "+91 98888 77665");
  assert.equal(
    state.members.find((item) => item.id === testMember.id).address,
    "Updated regular member address",
  );
  assert.equal(state.sales.find((item) => item.id === sale.id).buyerPhone, "+91 98888 77665");
  assert.equal(
    state.sales.find((item) => item.id === sale.id).buyerAddress,
    "Updated regular member address",
  );

  state = store.getState();
  const walkInProduct = selectors.liveProducts(state).find((item) => item.stock >= 2);
  assert(walkInProduct);
  const peopleBeforeWalkIn = selectors.activeMembers(state).length;
  store.sellProduct(walkInProduct.id, 1, "Manoj", null, {
    buyerPhone: "+91 99578 53542",
    buyerEmail: "manoj@example.com",
    amountPaid: 100,
  });
  state = store.getState();
  const walkIn = state.members.find((item) => item.phone === "+91 99578 53542");
  assert(walkIn);
  assert.equal(walkIn.type, "walk_in");
  assert.equal(selectors.activeMembers(state).length, peopleBeforeWalkIn + 1);
  assert.equal(
    selectors.gymMembers(state).some((item) => item.id === walkIn.id),
    false,
  );
  const firstWalkInSale = state.sales[0];
  assert.equal(firstWalkInSale.memberId, walkIn.id);
  assert.equal(selectors.outstandingFor(state, walkIn.id), firstWalkInSale.total - 100);

  store.sellProduct(walkInProduct.id, 1, "Manoj Kumar", null, {
    buyerPhone: "9957853542",
    buyerAddress: "Updated address",
  });
  state = store.getState();
  assert.equal(
    state.members.filter(
      (item) =>
        item.type === "walk_in" && item.phone.replace(/\D/g, "").slice(-10) === "9957853542",
    ).length,
    1,
    "normalized mobile numbers must reuse the same walk-in profile",
  );
  assert.equal(state.members.find((item) => item.id === walkIn.id).name, "Manoj Kumar");
  assert.equal(selectors.salesFor(state, walkIn.id).length, 2);
  assert(selectors.outstandingFor(state, walkIn.id) > 0);
  store.updateMember(walkIn.id, {
    name: "Manoj Updated",
    phone: "+91 90000 12345",
    email: "updated@example.com",
    address: "Updated customer address",
  });
  state = store.getState();
  const updatedWalkIn = state.members.find((item) => item.id === walkIn.id);
  assert.equal(updatedWalkIn.phone, "+91 90000 12345");
  assert.equal(updatedWalkIn.address, "Updated customer address");
  selectors.salesFor(state, walkIn.id).forEach((linkedSale) => {
    assert.equal(linkedSale.buyer, "Manoj Updated");
    assert.equal(linkedSale.buyerPhone, "+91 90000 12345");
    assert.equal(linkedSale.buyerEmail, "updated@example.com");
    assert.equal(linkedSale.buyerAddress, "Updated customer address");
  });

  store.addExpense({
    title: "Logic test expense",
    category: "Other",
    amount: 250,
    date: new Date().toISOString(),
    method: "cash",
  });
  state = store.getState();
  const expense = state.expenses.find((item) => item.title === "Logic test expense");
  assert(expense);
  store.updateExpense(expense.id, { amount: 300 });
  assert.equal(store.getState().expenses.find((item) => item.id === expense.id).amount, 300);
  store.trashExpense(expense.id);
  assert(store.getState().expenses.find((item) => item.id === expense.id).deletedAt);
  store.restoreExpense(expense.id);
  assert.equal(store.getState().expenses.find((item) => item.id === expense.id).deletedAt, null);

  const backup = store.exportBackup();
  const invalidExpenseBackup = JSON.parse(backup);
  invalidExpenseBackup.expenses = [{ ...invalidExpenseBackup.expenses[0], amount: -1 }];
  assert.throws(() => store.restoreBackup(JSON.stringify(invalidExpenseBackup)));
  const settingsBeforeReset = structuredClone(store.getState().settings);
  store.resetData();
  state = store.getState();
  assert.deepEqual(state.settings, settingsBeforeReset);
  for (const key of [
    "members",
    "plans",
    "memberships",
    "payments",
    "products",
    "sales",
    "activities",
    "expenses",
    "readNotifications",
  ]) {
    assert.equal(state[key].length, 0, `${key} must be empty after reset`);
  }
  assert.equal(state.invoiceSeq, 0);
  store.setupTemplateData();
  state = store.getState();
  assert.deepEqual(state.settings, settingsBeforeReset);
  assert(state.members.length > 0 && state.plans.length > 0 && state.products.length > 0);
  assertIntegrity(state);
  store.restoreBackup(backup);
  assert.equal(
    store.getState().members.some((item) => item.id === testMember.id),
    true,
  );

  state = store.getState();
  const linkedMembershipIds = new Set(
    state.memberships.filter((item) => item.memberId === testMember.id).map((item) => item.id),
  );
  const linkedSaleIds = new Set(
    state.sales.filter((item) => item.memberId === testMember.id).map((item) => item.id),
  );
  store.deleteMemberPermanently(testMember.id);
  state = store.getState();
  assert.equal(
    state.members.some((item) => item.id === testMember.id),
    false,
  );
  assert.equal(
    state.memberships.some((item) => item.memberId === testMember.id),
    false,
  );
  assert.equal(
    state.payments.some(
      (item) =>
        item.memberId === testMember.id ||
        linkedMembershipIds.has(item.membershipId) ||
        linkedSaleIds.has(item.saleId),
    ),
    false,
  );
  assert.equal(
    state.sales.some((item) => item.memberId === testMember.id),
    false,
  );
  assertIntegrity(state);

  console.log("Business logic verification passed.");
} finally {
  await vite.close();
}
