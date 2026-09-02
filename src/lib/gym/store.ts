import { useSyncExternalStore } from "react";
import { buildSeed, uid, iso } from "./seed";
import { configureCalendarSystem } from "./calendar";
import type {
  Activity,
  ActivityType,
  GymState,
  Member,
  Membership,
  Payment,
  PaymentMethod,
  Plan,
  Product,
  Sale,
  Expense,
  Settings,
} from "./types";

const DB_KEY = "ironvault.db.v1";
const SESSION_KEY = "ironvault.session.v1";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

let state: GymState | null = null;
const listeners = new Set<() => void>();

const isBrowser = () => typeof window !== "undefined";
const normalizedPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
};

function persist() {
  if (!isBrowser() || !state) return;
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable — keep in-memory state */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function init() {
  if (state || !isBrowser()) return;
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GymState;
      if (parsed && parsed.version === 1) {
        state = { ...parsed, expenses: parsed.expenses ?? [] };
        configureCalendarSystem(state.settings.calendarSystem);
        purgeOldTrash();
        return;
      }
    }
  } catch {
    /* corrupt payload — fall through to a fresh seed */
  }
  state = buildSeed();
  configureCalendarSystem(state.settings.calendarSystem);
  persist();
}

function setState(updater: (s: GymState) => GymState) {
  if (!state) init();
  if (!state) return;
  state = updater(state);
  configureCalendarSystem(state.settings.calendarSystem);
  persist();
  emit();
}

function subscribe(listener: () => void) {
  init();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGym(): GymState | null {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
}

export function getState(): GymState {
  if (!state) init();
  return state ?? buildSeed();
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function login(email: string, password: string) {
  const s = getState();
  const hash = await sha256(password);
  const ok =
    email.trim().toLowerCase() === s.auth.email.toLowerCase() && hash === s.auth.passwordHash;
  if (ok && isBrowser()) {
    const session = JSON.stringify({
      at: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
      email: email.trim().toLowerCase(),
    });
    window.sessionStorage.setItem(SESSION_KEY, session);
    window.localStorage.setItem(SESSION_KEY, session);
    emit();
  }
  return ok;
}

export function logout() {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(SESSION_KEY);
  emit();
}

export function isLoggedIn() {
  if (!isBrowser()) return false;
  const raw =
    window.sessionStorage.getItem(SESSION_KEY) || window.localStorage.getItem(SESSION_KEY);
  if (!raw) return false;
  try {
    const session = JSON.parse(raw) as { at?: unknown; expiresAt?: unknown; email?: unknown };
    const at = typeof session.at === "number" ? session.at : 0;
    const expiresAt =
      typeof session.expiresAt === "number" ? session.expiresAt : at + SESSION_TTL_MS;
    const valid =
      typeof session.email === "string" &&
      session.email.toLowerCase() === getState().auth.email.toLowerCase() &&
      at > 0 &&
      expiresAt > Date.now();
    if (valid) return true;
  } catch {
    // Invalid or tampered session payloads are removed below.
  }
  logout();
  return false;
}

export async function changePassword(current: string, next: string) {
  const s = getState();
  if ((await sha256(current)) !== s.auth.passwordHash) return false;
  const hash = await sha256(next);
  setState((st) => ({ ...st, auth: { ...st.auth, passwordHash: hash } }));
  return true;
}

/* ------------------------------------------------------------------ */
/* Activity log                                                        */
/* ------------------------------------------------------------------ */

function log(st: GymState, type: ActivityType, title: string, description: string): GymState {
  const activity: Activity = {
    id: uid("act"),
    type,
    title,
    description,
    date: iso(new Date()),
  };
  return { ...st, activities: [activity, ...st.activities].slice(0, 300) };
}

function nextInvoice(st: GymState): [GymState, string] {
  const seq = st.invoiceSeq + 1;
  const used = new Set([
    ...st.payments.map((payment) => payment.invoiceNo),
    ...st.sales.map((sale) => sale.invoiceNo),
  ]);
  let n = seq;
  let no = `${st.settings.invoicePrefix}-${String(n).padStart(6, "0")}`;
  while (used.has(no)) {
    n += 1;
    no = `${st.settings.invoicePrefix}-${String(n).padStart(6, "0")}`;
  }
  return [{ ...st, invoiceSeq: n }, no];
}

/* ------------------------------------------------------------------ */
/* Members                                                             */
/* ------------------------------------------------------------------ */

export type NewMemberInput = Omit<
  Member,
  "id" | "notes" | "measurements" | "deletedAt" | "deletedBy" | "joinDate"
> & {
  joinDate?: string;
  planId?: string;
  startDate?: string;
  paidNow?: number;
  discount?: number;
  joiningFee?: number;
  paymentMethod?: PaymentMethod;
};

export function addMember(input: NewMemberInput) {
  setState((st) => {
    const id = uid("mem");
    const member: Member = {
      id,
      type: "member",
      name: input.name,
      email: input.email,
      phone: input.phone,
      gender: input.gender,
      dob: input.dob,
      address: input.address,
      photo: input.photo ?? null,
      emergencyContact: input.emergencyContact,
      joinDate: input.joinDate ?? iso(new Date()),
      notes: [],
      measurements: [],
      deletedAt: null,
      deletedBy: null,
    };
    let next: GymState = { ...st, members: [member, ...st.members] };
    next = log(next, "member_added", "New member registered", `${member.name} joined the gym`);

    if (input.planId) {
      const plan = next.plans.find((p) => p.id === input.planId);
      if (plan) {
        const start = input.startDate ? new Date(input.startDate) : new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + plan.durationDays);
        const membership: Membership = {
          id: uid("mship"),
          memberId: id,
          planId: plan.id,
          startDate: iso(start),
          endDate: iso(end),
          price: plan.price,
          discount: Math.min(Math.max(0, Math.round(input.discount ?? 0)), plan.price),
          joiningFee: Math.max(0, Math.round(input.joiningFee ?? plan.joiningFee ?? 1000)),
          frozen: false,
          createdAt: iso(new Date()),
        };
        next = { ...next, memberships: [membership, ...next.memberships] };
        const payable = membership.price - membership.discount + (membership.joiningFee ?? 0);
        const paidNow = Math.min(Math.max(0, Math.round(input.paidNow ?? 0)), payable);
        if (paidNow > 0) {
          const [withSeq, invoiceNo] = nextInvoice(next);
          const payment: Payment = {
            id: uid("pay"),
            invoiceNo,
            memberId: id,
            membershipId: membership.id,
            kind: "membership",
            amount: paidNow,
            method: input.paymentMethod ?? "cash",
            date: iso(new Date()),
            note: `${plan.name} — joining payment`,
          };
          next = { ...withSeq, payments: [payment, ...withSeq.payments] };
          next = log(
            next,
            "payment_received",
            "Payment received",
            `₹${paidNow.toLocaleString("en-IN")} from ${member.name}`,
          );
          next = log(
            next,
            "invoice_generated",
            "Invoice generated",
            `${invoiceNo} for ${member.name}`,
          );
        }
      }
    }
    return next;
  });
}

export function updateMember(id: string, patch: Partial<Member>) {
  setState((st) => {
    const current = st.members.find((member) => member.id === id);
    if (!current) return st;
    const updated = { ...current, ...patch };
    return {
      ...st,
      members: st.members.map((member) => (member.id === id ? updated : member)),
      sales: st.sales.map((sale) =>
        sale.memberId === id
          ? {
              ...sale,
              buyer: updated.name,
              buyerPhone: updated.phone,
              buyerEmail: updated.email || undefined,
              buyerAddress: updated.address || undefined,
            }
          : sale,
      ),
    };
  });
}

export function trashMember(id: string, by: string) {
  setState((st) => {
    const member = st.members.find((m) => m.id === id);
    const next = {
      ...st,
      members: st.members.map((m) =>
        m.id === id ? { ...m, deletedAt: iso(new Date()), deletedBy: by } : m,
      ),
    };
    return log(
      next,
      "member_trashed",
      "Member moved to trash",
      `${member?.name ?? "Member"} moved to trash`,
    );
  });
}

export function restoreMember(id: string) {
  setState((st) => {
    const member = st.members.find((m) => m.id === id);
    const next = {
      ...st,
      members: st.members.map((m) =>
        m.id === id ? { ...m, deletedAt: null, deletedBy: null } : m,
      ),
    };
    return log(
      next,
      "member_restored",
      "Member restored",
      `${member?.name ?? "Member"} restored from trash`,
    );
  });
}

export function deleteMemberPermanently(id: string) {
  setState((st) => {
    const member = st.members.find((m) => m.id === id);
    const membershipIds = new Set(st.memberships.filter((m) => m.memberId === id).map((m) => m.id));
    const saleIds = new Set(st.sales.filter((sale) => sale.memberId === id).map((sale) => sale.id));
    const next: GymState = {
      ...st,
      members: st.members.filter((m) => m.id !== id),
      memberships: st.memberships.filter((m) => m.memberId !== id),
      payments: st.payments.filter(
        (payment) =>
          payment.memberId !== id &&
          !membershipIds.has(payment.membershipId ?? "") &&
          !saleIds.has(payment.saleId ?? ""),
      ),
      sales: st.sales.filter((sale) => sale.memberId !== id),
    };
    return log(
      next,
      "member_deleted",
      "Member permanently deleted",
      `${member?.name ?? "Member"} was permanently removed`,
    );
  });
}

function purgeOldTrash() {
  if (!state) return;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const expired = state.members.filter(
    (m) => m.deletedAt && new Date(m.deletedAt).getTime() < cutoff,
  );
  if (expired.length === 0) {
    purgeOldTrashedPlans();
    return;
  }
  const ids = new Set(expired.map((m) => m.id));
  const membershipIds = new Set(
    state.memberships.filter((m) => ids.has(m.memberId)).map((m) => m.id),
  );
  const saleIds = new Set(
    state.sales.filter((sale) => ids.has(sale.memberId ?? "")).map((sale) => sale.id),
  );
  state = {
    ...state,
    members: state.members.filter((m) => !ids.has(m.id)),
    memberships: state.memberships.filter((m) => !ids.has(m.memberId)),
    payments: state.payments.filter(
      (payment) =>
        !ids.has(payment.memberId ?? "") &&
        !membershipIds.has(payment.membershipId ?? "") &&
        !saleIds.has(payment.saleId ?? ""),
    ),
    sales: state.sales.filter((sale) => !ids.has(sale.memberId ?? "")),
  };
  purgeOldTrashedPlans();
  persist();
}

function purgeOldTrashedPlans() {
  if (!state) return;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const referencedPlanIds = new Set(state.memberships.map((membership) => membership.planId));
  const keep = state.plans.filter(
    (p) =>
      referencedPlanIds.has(p.id) || !(p.deletedAt && new Date(p.deletedAt).getTime() < cutoff),
  );
  const keepProducts = state.products.filter(
    (p) => !(p.deletedAt && new Date(p.deletedAt).getTime() < cutoff),
  );
  const keepExpenses = (state.expenses ?? []).filter(
    (e) => !(e.deletedAt && new Date(e.deletedAt).getTime() < cutoff),
  );
  if (
    keep.length === state.plans.length &&
    keepProducts.length === state.products.length &&
    keepExpenses.length === (state.expenses ?? []).length
  )
    return;
  state = { ...state, plans: keep, products: keepProducts, expenses: keepExpenses };
  persist();
}

export function addNote(memberId: string, title: string, note: string) {
  setState((st) => ({
    ...st,
    members: st.members.map((m) =>
      m.id === memberId
        ? { ...m, notes: [{ id: uid("note"), date: iso(new Date()), title, note }, ...m.notes] }
        : m,
    ),
  }));
}

export function addMeasurement(
  memberId: string,
  data: Omit<Member["measurements"][number], "id" | "date">,
) {
  setState((st) => ({
    ...st,
    members: st.members.map((m) =>
      m.id === memberId
        ? {
            ...m,
            measurements: [{ id: uid("msr"), date: iso(new Date()), ...data }, ...m.measurements],
          }
        : m,
    ),
  }));
}

/* ------------------------------------------------------------------ */
/* Plans & memberships                                                 */
/* ------------------------------------------------------------------ */

export function savePlan(plan: Omit<Plan, "id"> & { id?: string }) {
  setState((st) =>
    plan.id
      ? { ...st, plans: st.plans.map((p) => (p.id === plan.id ? ({ ...p, ...plan } as Plan) : p)) }
      : { ...st, plans: [...st.plans, { ...plan, id: uid("plan") } as Plan] },
  );
}

export function deletePlan(id: string) {
  trashPlan(id);
}

export function trashPlan(id: string) {
  setState((st) => ({
    ...st,
    plans: st.plans.map((p) =>
      p.id === id && !p.locked ? { ...p, deletedAt: iso(new Date()) } : p,
    ),
  }));
}

export function restorePlan(id: string) {
  setState((st) => ({
    ...st,
    plans: st.plans.map((p) => (p.id === id ? { ...p, deletedAt: null } : p)),
  }));
}

export function deletePlanPermanently(id: string) {
  const inUse = getState().memberships.some((membership) => membership.planId === id);
  if (inUse) return false;
  setState((st) => ({ ...st, plans: st.plans.filter((p) => p.id !== id) }));
  return true;
}

export function renewMembership(memberId: string, planId: string, paidNow: number, discount = 0) {
  setState((st) => {
    const plan = st.plans.find((p) => p.id === planId);
    const member = st.members.find((m) => m.id === memberId);
    if (!plan || !member) return st;
    const current = st.memberships
      .filter((m) => m.memberId === memberId)
      .sort((a, b) => +new Date(b.endDate) - +new Date(a.endDate))[0];
    const base =
      current && new Date(current.endDate) > new Date() ? new Date(current.endDate) : new Date();
    const end = new Date(base);
    end.setDate(end.getDate() + plan.durationDays);
    const membership: Membership = {
      id: uid("mship"),
      memberId,
      planId,
      startDate: iso(base),
      endDate: iso(end),
      price: plan.price,
      discount: Math.min(Math.max(0, Math.round(discount)), plan.price),
      joiningFee: 0,
      frozen: false,
      createdAt: iso(new Date()),
    };
    const payable = membership.price - membership.discount + (membership.joiningFee ?? 0);
    const collected = Math.min(Math.max(0, Math.round(paidNow)), payable);
    let next: GymState = { ...st, memberships: [membership, ...st.memberships] };
    next = log(
      next,
      "membership_renewed",
      "Membership renewed",
      `${member.name} renewed ${plan.name} · ${plan.durationDays} days`,
    );
    if (collected > 0) {
      const [withSeq, invoiceNo] = nextInvoice(next);
      next = {
        ...withSeq,
        payments: [
          {
            id: uid("pay"),
            invoiceNo,
            memberId,
            membershipId: membership.id,
            kind: "membership",
            amount: collected,
            method: "cash",
            date: iso(new Date()),
            note: `${plan.name} — renewal payment`,
          },
          ...withSeq.payments,
        ],
      };
      next = log(
        next,
        "payment_received",
        "Payment received",
        `₹${collected.toLocaleString("en-IN")} from ${member.name}`,
      );
    }
    return next;
  });
}

export function toggleFreeze(membershipId: string) {
  setState((st) => ({
    ...st,
    memberships: st.memberships.map((m) => {
      if (m.id !== membershipId) return m;
      const now = new Date();
      if (!m.frozen) return { ...m, frozen: true, frozenAt: iso(now) };

      const frozenAt = m.frozenAt ? new Date(m.frozenAt) : now;
      const frozenMs = Math.max(0, now.getTime() - frozenAt.getTime());
      const extendedEnd = new Date(new Date(m.endDate).getTime() + frozenMs);
      return { ...m, frozen: false, frozenAt: null, endDate: iso(extendedEnd) };
    }),
  }));
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

export function addPayment(input: {
  memberId: string;
  membershipId?: string | null;
  amount: number;
  method: Payment["method"];
  date?: string;
  note?: string;
}) {
  const state = getState();
  const member = state.members.find((item) => item.id === input.memberId && !item.deletedAt);
  const membership = input.membershipId
    ? state.memberships.find(
        (item) => item.id === input.membershipId && item.memberId === input.memberId,
      )
    : undefined;
  const amount = Math.round(input.amount);
  if (!member || !membership || !Number.isFinite(amount) || amount <= 0) return false;
  const alreadyPaid = state.payments
    .filter((payment) => payment.membershipId === membership.id)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = Math.max(
    0,
    membership.price - membership.discount + (membership.joiningFee ?? 0) - alreadyPaid,
  );
  if (amount > remaining) return false;

  setState((st) => {
    const [withSeq, invoiceNo] = nextInvoice(st);
    const payment: Payment = {
      id: uid("pay"),
      invoiceNo,
      memberId: input.memberId,
      membershipId: input.membershipId ?? null,
      kind: "membership",
      amount,
      method: input.method,
      date: input.date ?? iso(new Date()),
      note: input.note ?? "Manual payment entry",
    };
    let next: GymState = { ...withSeq, payments: [payment, ...withSeq.payments] };
    next = log(
      next,
      "payment_received",
      "Payment received",
      `₹${amount.toLocaleString("en-IN")} from ${member.name}`,
    );
    next = log(
      next,
      "invoice_generated",
      "Invoice generated",
      `${invoiceNo} created · ₹${amount.toLocaleString("en-IN")}`,
    );
    return next;
  });
  return true;
}

export function addSalePayment(
  saleId: string,
  amountInput: number,
  method: Payment["method"],
  note?: string,
) {
  const state = getState();
  const sale = state.sales.find((item) => item.id === saleId);
  const amount = Math.round(amountInput);
  if (!sale || !Number.isFinite(amount) || amount <= 0) return false;

  const alreadyPaid = state.payments
    .filter((payment) => payment.saleId === sale.id)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = Math.max(0, sale.total - alreadyPaid);
  if (amount > remaining) return false;

  setState((st) => {
    const payment: Payment = {
      id: uid("pay"),
      invoiceNo: sale.invoiceNo,
      memberId: sale.memberId ?? null,
      saleId: sale.id,
      kind: "product",
      amount,
      method,
      date: iso(new Date()),
      note: note?.trim() || `${sale.productName} — balance payment`,
    };
    let next: GymState = { ...st, payments: [payment, ...st.payments] };
    next = log(
      next,
      "payment_received",
      "Payment received",
      `₹${amount.toLocaleString("en-IN")} from ${sale.buyer}`,
    );
    return next;
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* Products & sales                                                    */
/* ------------------------------------------------------------------ */

export function saveProduct(product: Omit<Product, "id" | "createdAt"> & { id?: string }) {
  setState((st) => {
    if (product.id) {
      return {
        ...st,
        products: st.products.map((p) =>
          p.id === product.id ? ({ ...p, ...product } as Product) : p,
        ),
      };
    }
    const created: Product = { ...product, id: uid("prd"), createdAt: iso(new Date()) } as Product;
    const next = { ...st, products: [created, ...st.products] };
    return log(next, "product_added", "Product added", `${created.name} added to inventory`);
  });
}

export function deleteProduct(id: string) {
  trashProduct(id);
}

export function trashProduct(id: string) {
  setState((st) => ({
    ...st,
    products: st.products.map((p) =>
      p.id === id && !p.locked ? { ...p, deletedAt: iso(new Date()) } : p,
    ),
  }));
}

export function restoreProduct(id: string) {
  setState((st) => ({
    ...st,
    products: st.products.map((p) => (p.id === id ? { ...p, deletedAt: null } : p)),
  }));
}

export function deleteProductPermanently(id: string) {
  setState((st) => ({ ...st, products: st.products.filter((p) => p.id !== id) }));
}

export function adjustStock(id: string, delta: number) {
  setState((st) => ({
    ...st,
    products: st.products.map((p) =>
      p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p,
    ),
  }));
}

export function sellProduct(
  productId: string,
  qty: number,
  buyer: string,
  memberId?: string | null,
  extra?: {
    discount?: number;
    buyerPhone?: string;
    buyerEmail?: string;
    buyerAddress?: string;
    /** Amount collected now; defaults to the full payable total. */
    amountPaid?: number;
    paymentMethod?: PaymentMethod;
  },
) {
  setState((st) => {
    const product = st.products.find((p) => p.id === productId);
    if (!product || qty <= 0 || !Number.isInteger(qty) || product.stock < qty) return st;
    const gross = product.price * qty;
    const discount = Math.min(Math.max(0, Math.round(extra?.discount ?? 0)), gross);
    const total = gross - discount;
    const paid = Math.min(Math.max(0, Math.round(extra?.amountPaid ?? total)), total);
    let saleMemberId = memberId ?? null;
    let saleBuyer = buyer || "Walk-in customer";
    let saleState = st;
    if (!saleMemberId) {
      const phoneKey = normalizedPhone(extra?.buyerPhone ?? "");
      const existing = phoneKey
        ? st.members.find(
            (member) =>
              !member.deletedAt &&
              member.type === "walk_in" &&
              normalizedPhone(member.phone) === phoneKey,
          )
        : undefined;
      if (existing) {
        saleMemberId = existing.id;
        saleBuyer = existing.name;
        saleState = {
          ...st,
          members: st.members.map((member) =>
            member.id === existing.id
              ? {
                  ...member,
                  name: buyer.trim() || member.name,
                  email: extra?.buyerEmail?.trim() || member.email,
                  address: extra?.buyerAddress?.trim() || member.address,
                }
              : member,
          ),
        };
        saleBuyer = buyer.trim() || existing.name;
      } else {
        const walkIn: Member = {
          id: uid("mem"),
          type: "walk_in",
          name: saleBuyer,
          email: extra?.buyerEmail?.trim() ?? "",
          phone: extra?.buyerPhone?.trim() ?? "",
          gender: "other",
          dob: "",
          address: extra?.buyerAddress?.trim() ?? "",
          photo: null,
          joinDate: iso(new Date()),
          emergencyContact: "",
          notes: [],
          measurements: [],
          deletedAt: null,
          deletedBy: null,
        };
        saleMemberId = walkIn.id;
        saleState = { ...st, members: [walkIn, ...st.members] };
      }
    }
    const [withSeq, invoiceNo] = nextInvoice(saleState);
    const sale: Sale = {
      id: uid("sale"),
      invoiceNo,
      productId,
      productName: product.name,
      qty,
      unitPrice: product.price,
      unitCost: product.cost,
      discount,
      total,
      paid,
      buyer: saleBuyer,
      buyerPhone: extra?.buyerPhone,
      buyerEmail: extra?.buyerEmail,
      buyerAddress: extra?.buyerAddress,
      memberId: saleMemberId,
      date: iso(new Date()),
    };
    let next: GymState = {
      ...withSeq,
      sales: [sale, ...withSeq.sales],
      products: withSeq.products.map((p) =>
        p.id === productId ? { ...p, stock: p.stock - qty } : p,
      ),
      payments:
        paid > 0
          ? [
              {
                id: uid("pay"),
                invoiceNo,
                saleId: sale.id,
                memberId: saleMemberId,
                kind: "product" as const,
                amount: paid,
                method: extra?.paymentMethod ?? "cash",
                date: sale.date,
                note: `${product.name} × ${qty}`,
              },
              ...withSeq.payments,
            ]
          : withSeq.payments,
    };
    next = log(
      next,
      "product_sold",
      "Product sold",
      `${product.name} × ${qty} sold to ${sale.buyer}`,
    );
    next = log(
      next,
      "invoice_generated",
      "Invoice generated",
      `${invoiceNo} created for ${sale.buyer} · ₹${sale.total.toLocaleString("en-IN")}`,
    );
    return next;
  });
}

/* ------------------------------------------------------------------ */
/* Settings, notifications, backup                                     */
/* ------------------------------------------------------------------ */

export function updateSettings(patch: Partial<Settings>) {
  setState((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
}

export function markNotificationsRead(ids: string[]) {
  setState((st) => ({
    ...st,
    readNotifications: Array.from(new Set([...st.readNotifications, ...ids])).slice(-500),
  }));
}

export function exportBackup() {
  return JSON.stringify(getState(), null, 2);
}

export function restoreBackup(json: string) {
  const parsed = JSON.parse(json) as GymState;
  const expenses = parsed?.expenses ?? [];
  const arrays = [
    parsed?.members,
    parsed?.plans,
    parsed?.memberships,
    parsed?.payments,
    parsed?.products,
    parsed?.sales,
    parsed?.activities,
    expenses,
    parsed?.readNotifications,
  ];
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !parsed.auth ||
    !parsed.settings ||
    !arrays.every(Array.isArray) ||
    !Number.isFinite(parsed.invoiceSeq)
  ) {
    throw new Error("Invalid backup file");
  }

  const memberIds = new Set(parsed.members.map((member) => member.id));
  const planIds = new Set(parsed.plans.map((plan) => plan.id));
  const membershipIds = new Set(parsed.memberships.map((membership) => membership.id));
  const saleIds = new Set(parsed.sales.map((sale) => sale.id));
  const valid =
    parsed.memberships.every(
      (membership) => memberIds.has(membership.memberId) && planIds.has(membership.planId),
    ) &&
    parsed.payments.every(
      (payment) =>
        Number.isFinite(payment.amount) &&
        payment.amount > 0 &&
        (!payment.memberId || memberIds.has(payment.memberId)) &&
        (!payment.membershipId || membershipIds.has(payment.membershipId)) &&
        (!payment.saleId || saleIds.has(payment.saleId)),
    ) &&
    parsed.sales.every((sale) => !sale.memberId || memberIds.has(sale.memberId)) &&
    expenses.every((expense) => Number.isFinite(expense.amount) && expense.amount > 0);
  if (!valid) throw new Error("Backup contains broken record references");

  setState(() => ({ ...parsed, expenses, version: 1 }));
}

export function resetData() {
  setState((st) => ({
    ...st,
    members: [],
    plans: [],
    memberships: [],
    payments: [],
    products: [],
    sales: [],
    activities: [],
    expenses: [],
    readNotifications: [],
    invoiceSeq: 0,
  }));
}

export function setupTemplateData() {
  setState((st) => {
    const template = buildSeed();
    return {
      ...template,
      auth: st.auth,
      settings: st.settings,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Expenses                                                            */
/* ------------------------------------------------------------------ */

export type ExpenseInput = {
  title: string;
  category: Expense["category"];
  amount: number;
  date: string;
  method: Expense["method"];
  notes?: string;
  attachment?: Expense["attachment"];
};

function nextExpenseNo(list: Expense[]) {
  const max = list.reduce((n, e) => {
    const num = Number(String(e.expenseNo).split("-").pop());
    return Number.isFinite(num) ? Math.max(n, num) : n;
  }, 0);
  return `EXP-${String(max + 1).padStart(6, "0")}`;
}

export function addExpense(input: ExpenseInput) {
  setState((st) => {
    const list = st.expenses ?? [];
    const expense: Expense = {
      id: uid("exp"),
      expenseNo: nextExpenseNo(list),
      title: input.title.trim(),
      category: input.category,
      amount: Math.max(0, Math.round(input.amount)),
      date: input.date,
      method: input.method,
      notes: input.notes?.trim() ?? "",
      attachment: input.attachment ?? null,
      createdAt: iso(new Date()),
      deletedAt: null,
    };
    const next: GymState = { ...st, expenses: [expense, ...list] };
    return log(
      next,
      "expense_added",
      "Expense recorded",
      `${expense.title} — ₹${expense.amount.toLocaleString("en-IN")}`,
    );
  });
}

export function updateExpense(id: string, patch: Partial<ExpenseInput>) {
  setState((st) => {
    const next: GymState = {
      ...st,
      expenses: (st.expenses ?? []).map((e) =>
        e.id === id
          ? {
              ...e,
              ...patch,
              title: patch.title !== undefined ? patch.title.trim() : e.title,
              amount: patch.amount !== undefined ? Math.max(0, Math.round(patch.amount)) : e.amount,
              notes: patch.notes !== undefined ? patch.notes.trim() : e.notes,
              attachment: patch.attachment !== undefined ? patch.attachment : e.attachment,
            }
          : e,
      ),
    };
    const updated = next.expenses?.find((e) => e.id === id);
    return log(
      next,
      "expense_updated",
      "Expense updated",
      `${updated?.title ?? "Expense"} — ₹${(updated?.amount ?? 0).toLocaleString("en-IN")}`,
    );
  });
}

export function trashExpense(id: string) {
  setState((st) => {
    const target = (st.expenses ?? []).find((e) => e.id === id);
    const next: GymState = {
      ...st,
      expenses: (st.expenses ?? []).map((e) =>
        e.id === id ? { ...e, deletedAt: iso(new Date()) } : e,
      ),
    };
    return log(
      next,
      "expense_trashed",
      "Expense moved to trash",
      `${target?.title ?? "Expense"} moved to trash`,
    );
  });
}

export function restoreExpense(id: string) {
  setState((st) => ({
    ...st,
    expenses: (st.expenses ?? []).map((e) => (e.id === id ? { ...e, deletedAt: null } : e)),
  }));
}

export function deleteExpensePermanently(id: string) {
  setState((st) => ({ ...st, expenses: (st.expenses ?? []).filter((e) => e.id !== id) }));
}
