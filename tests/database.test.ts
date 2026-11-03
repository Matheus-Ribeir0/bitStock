import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { applyCommand, emptyStore } from "../src/lib/domain";
import type { Store, Command } from "../src/lib/types";
const uid = "00000000-0000-4000-8000-000000000001";
const id = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = "2026-11-03T15:00:00.000Z";
test("PostgreSQL: migração, autorização, integridade, concorrência otimista e idempotência", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls;",
    );
    await db.exec(
      await readFile("supabase/migrations/202611030001_bitstock.sql", "utf8"),
    );
    await db.query("insert into auth.users values ($1)", [uid]);
    await db.query("insert into public.staff values ($1,$2,true)", [
      uid,
      "Matheus",
    ]);
    await db.exec("set role service_role");
    const snapshot = async () =>
      (
        await db.query<{
          snapshot: { store: Store; revision: number; name: string };
        }>("select public.bitstock_snapshot($1) as snapshot", [uid])
      ).rows[0].snapshot;
    const commit = async (
      revision: number,
      store: Store,
      op: string,
      hash = op,
    ) =>
      (
        await db.query<{ result: string }>(
          "select public.bitstock_commit($1,$2,$3,$4,$5::jsonb) as result",
          [uid, op, hash, revision, JSON.stringify(store)],
        )
      ).rows[0].result;
    assert.deepEqual((await snapshot()).store, emptyStore());
    const command: Command = {
      kind: "product.save",
      data: {
        name: "SSD",
        code: "SSD-001",
        category: "Armazenamento",
        brand: "",
        description: "",
        minimum: 1,
        cost: null,
        price: null,
        expiry: "",
        initial: 3,
      },
    };
    const first = applyCommand(emptyStore(), command, "Matheus", now, id(1));
    assert.equal(await commit(0, first, id(1)), "committed");
    const saved = await snapshot();
    assert.equal(saved.revision, 1);
    assert.equal(saved.store.products[0].quantity, 3);
    assert.equal(saved.store.movements.length, 1);
    assert.equal(await commit(0, first, id(1)), "duplicate");
    assert.equal((await snapshot()).revision, 1);
    await assert.rejects(
      commit(1, first, id(1), "different"),
      /OPERATION_CONFLICT/,
    );
    const out: Command = {
      kind: "movement.create",
      data: {
        productId: id(1),
        type: "saida",
        quantity: 2,
        reason: "Venda",
        note: "",
      },
    };
    const candidate = applyCommand(saved.store, out, "Matheus", now, id(2));
    assert.equal(await commit(1, candidate, id(2)), "committed");
    assert.equal(await commit(1, candidate, id(3)), "retry");
    const latest = await snapshot();
    assert.equal(latest.store.products[0].quantity, 1);
    assert.throws(
      () => applyCommand(latest.store, out, "Matheus", now, id(3)),
      /insuficiente/,
    );
    // Restrições do banco rejeitam saldo negativo e código duplicado, sem alterar estado.
    const invalid = structuredClone(latest.store);
    invalid.products[0].quantity = -1;
    await assert.rejects(commit(2, invalid, id(4)), /check constraint/);
    assert.equal((await snapshot()).revision, 2);
    const duplicate = structuredClone(latest.store);
    duplicate.products.push({
      ...duplicate.products[0],
      id: id(5),
      code: " ssd-001 ",
    });
    await assert.rejects(commit(2, duplicate, id(5)), /unique constraint/);
    let orderStore = applyCommand(
      latest.store,
      {
        kind: "order.create",
        data: { equipment: "Notebook", issue: "Não liga" },
      },
      "Matheus",
      now,
      id(6),
    );
    assert.equal(await commit(2, orderStore, id(6)), "committed");
    orderStore = (await snapshot()).store;
    const delivered = applyCommand(
      orderStore,
      { kind: "order.status", id: id(6), status: "Entregue" },
      "Matheus",
      now,
      id(7),
    );
    assert.equal(await commit(3, delivered, id(7)), "committed");
    const done = await snapshot();
    assert.equal(done.store.orders[0].events.length, 2);
    assert.equal(done.store.orders[0].status, "Entregue");
    assert.equal(done.store.products[0].quantity, 1);
    const permissions = await db.query<{
      role: string;
      canread: boolean;
      canexecute: boolean;
    }>(
      `select r as role, has_table_privilege(r,'public.products','select') as canread, has_function_privilege(r,'public.bitstock_snapshot(uuid)','execute') as canexecute from unnest(array['anon','authenticated']) r`,
    );
    assert.ok(permissions.rows.every((r) => !r.canread && !r.canexecute));
    const rls = await db.query<{ enabled: boolean }>(
      `select bool_and(relrowsecurity) as enabled from pg_class where oid in ('public.staff'::regclass,'public.products'::regclass,'public.stock_movements'::regclass,'public.service_orders'::regclass,'public.service_order_events'::regclass,'public.operation_receipts'::regclass)`,
    );
    assert.equal(rls.rows[0].enabled, true);
    await db.query("update public.staff set authorized=false where id=$1", [
      uid,
    ]);
    await assert.rejects(snapshot(), /NOT_AUTHORIZED/);
    await assert.rejects(commit(4, done.store, id(8)), /NOT_AUTHORIZED/);
  } finally {
    await db.close();
  }
});
