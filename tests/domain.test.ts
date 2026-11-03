import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCommand,
  demoStore,
  emptyStore,
  expiryInfo,
} from "../src/lib/domain";
import type { Command, Store } from "../src/lib/types";

const now = "2026-05-01T15:00:00.000Z";
const create = (initial = 0): Extract<Command, { kind: "product.save" }> => ({
  kind: "product.save",
  data: {
    name: " SSD ",
    code: "S-1",
    category: "Armazenamento",
    brand: "",
    description: "",
    minimum: 2,
    cost: 1000,
    price: null,
    expiry: "",
    initial,
  },
});
test("empty store and product initial stock create immutable stock movement", () => {
  const empty = emptyStore(),
    saved = applyCommand(empty, create(4), " Ana ", now, "p1");
  assert.deepEqual(empty, { products: [], movements: [], orders: [] });
  assert.equal(saved.products[0].quantity, 4);
  assert.equal(saved.movements[0].after, 4);
  assert.equal(saved.movements[0].reason, "Estoque inicial");
});
test("stock movement is atomic and refuses insufficient quantity and archived products", () => {
  const one = applyCommand(emptyStore(), create(3), "Ana", now, "p1");
  assert.throws(
    () =>
      applyCommand(
        one,
        {
          kind: "movement.create",
          data: {
            productId: "p1",
            type: "saida",
            quantity: 4,
            reason: "Venda",
            note: "",
          },
        },
        "Ana",
        now,
        "m1",
      ),
    /insuficiente/i,
  );
  assert.equal(one.products[0].quantity, 3);
  assert.equal(one.movements.length, 1);
  const archived = applyCommand(
    one,
    { kind: "product.archive", id: "p1" },
    "Ana",
    now,
    "a1",
  );
  assert.throws(
    () =>
      applyCommand(
        archived,
        {
          kind: "movement.create",
          data: {
            productId: "p1",
            type: "entrada",
            quantity: 1,
            reason: "Devolução",
            note: "",
          },
        },
        "Ana",
        now,
        "m2",
      ),
    /arquivado/i,
  );
});
test("runtime payloads, code uniqueness and direct balance edits are rejected", () => {
  assert.throws(
    () =>
      applyCommand(
        emptyStore(),
        {
          kind: "product.save",
          data: { ...create().data, initial: 1.5 },
        } as never,
        "Ana",
        now,
        "p1",
      ),
    /inteiro/i,
  );
  const store = applyCommand(emptyStore(), create(), "Ana", now, "p1");
  assert.throws(
    () =>
      applyCommand(
        store,
        {
          kind: "product.save",
          data: { ...create().data, code: " s-1 " },
        } as never,
        "Ana",
        now,
        "p2",
      ),
    /código/i,
  );
  assert.throws(
    () =>
      applyCommand(
        store,
        {
          kind: "product.save",
          id: "p1",
          data: { ...create().data, initial: 2 },
        } as never,
        "Ana",
        now,
        "p3",
      ),
    /saldo/i,
  );
  assert.throws(
    () =>
      applyCommand(
        emptyStore(),
        {
          kind: "product.save",
          data: { ...create().data, expiry: "2026-02-30" },
        } as never,
        "Ana",
        now,
        "p",
      ),
    /ISO/i,
  );
  assert.throws(
    () =>
      applyCommand(
        emptyStore(),
        {
          kind: "movement.create",
          data: {
            productId: "x",
            type: "entrada",
            quantity: 1,
            reason: "inventado",
            note: "",
          },
        } as never,
        "Ana",
        now,
        "m",
      ),
    /encontrado/i,
  );
});
test("orders have collision-free numbers, status history and no stock effects", () => {
  const first = applyCommand(
    emptyStore(),
    { kind: "order.create", data: { equipment: "PC", issue: "Falha" } },
    "Ana",
    now,
    "x-1",
  );
  const second = applyCommand(
    first,
    { kind: "order.create", data: { equipment: "PC", issue: "Tela" } },
    "Ana",
    now,
    "x1",
  );
  assert.notEqual(first.orders[0].number, second.orders[1].number);
  const delivered = applyCommand(
    second,
    { kind: "order.status", id: "x-1", status: "Entregue" },
    "Ana",
    now,
    "event",
  );
  assert.equal(delivered.orders[0].deliveredAt, now);
  assert.equal(delivered.products.length, 0);
  assert.throws(
    () =>
      applyCommand(
        delivered,
        { kind: "order.status", id: "x-1", status: "Recebido" },
        "Ana",
        now,
        "reopen",
      ),
    /reaberta/i,
  );
});
test("expiry uses Sao Paulo civil date and inclusive 30 day threshold", () => {
  const instant = new Date("2026-05-01T02:00:00Z"); // ainda é 30/04 em São Paulo
  assert.deepEqual(expiryInfo("", instant), {
    kind: "none",
    days: null,
    label: "Sem validade",
  });
  assert.equal(expiryInfo("2026-04-30", instant).kind, "soon");
  assert.equal(expiryInfo("2026-04-30", instant).days, 0);
  assert.equal(expiryInfo("2026-05-30", instant).kind, "soon");
  assert.equal(expiryInfo("2026-05-31", instant).kind, "ok");
  assert.equal(expiryInfo("2026-04-29", instant).kind, "expired");
});
test("demo data contains eight products, four statuses and dates relative to now", () => {
  const store: Store = demoStore(new Date("2026-06-10T15:00:00Z"));
  assert.equal(store.products.length, 8);
  assert.equal(store.movements.length, 4);
  assert.equal(store.orders.length, 4);
  assert.deepEqual(
    new Set(store.orders.map((o) => o.status)),
    new Set(["Recebido", "Em manutenção", "Aguardando devolução", "Entregue"]),
  );
  assert.equal(store.products.find((p) => p.id === "p8")?.expiry, "2026-06-30");
});
