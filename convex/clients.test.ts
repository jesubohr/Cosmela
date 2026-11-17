import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { ClientInput } from "./clients";
import { errorCode, errorMessage, setupOrgs } from "./lib/fixtures.testing";

const PAGE = { numItems: 20, cursor: null };

async function create(actor: Awaited<ReturnType<typeof setupOrgs>>["asAna"], args: { client: ClientInput }) {
  const notice = await actor.query(api.clientAuthorizations.registrationNotice, {});
  return actor.mutation(api.clients.create, { ...args, adult: true, evidence: "Signed paper", policyHash: notice.policyHash, requestKey: crypto.randomUUID() });
}

describe("clients", () => {
  test("quick create needs only name and phone", async () => {
    const { asAna, t } = await setupOrgs();
    const id = await create(asAna, {
      client: { firstName: " Sofía ", lastName: "Pérez", phone: "+573104445566" },
    });
    const client = await t.run((ctx) => ctx.db.get(id));
    expect(client?.firstName).toBe("Sofía");
    expect(client?.searchText).toBe("sofia perez 3104445566");
    expect(client?.health.none).toEqual({ conditions: false, allergies: false, skin: false });
    expect(client?.fichaCompletedAt).toBeUndefined();
  });

  test("health data cannot be saved during registration", async () => {
    const { asAna } = await setupOrgs();
    const client = { firstName: "Ana", lastName: "Ruiz", phone: "+573104445566", health: { conditions: [], allergies: [], skinConditions: [], none: { conditions: false, allergies: false, skin: false } } };
    expect(await errorCode(create(asAna, { client }))).toBe("INVALID");
  });

  test("duplicate phone names the existing client", async () => {
    const { asAna, asSofi } = await setupOrgs();
    const duplicate = create(asSofi, {
      client: { firstName: "Otra", lastName: "", phone: "+573001234567" },
    });
    expect(await errorMessage(duplicate)).toBe("Este teléfono ya pertenece a Laura Prueba. Abre su ficha o usa otro número.");
    expect(
      await errorCode(create(asAna, { client: { firstName: "Otra", lastName: "", phone: "+573001234567" } })),
    ).toBe("DUPLICATE_PHONE");
  });

  test("the same phone is fine in another org", async () => {
    const { asBea } = await setupOrgs();
    await expect(
      create(asBea, { client: { firstName: "Laura", lastName: "B", phone: "+573001234567" } }),
    ).resolves.toBeDefined();
  });

  test("update rejects a phone that belongs to another client", async () => {
    const { asAna, ids } = await setupOrgs();
    const other = await create(asAna, { client: { firstName: "Paula", lastName: "", phone: "+573111111111" } });
    const result = asAna.mutation(api.clients.update, {
      clientId: other,
      client: { firstName: "Paula", lastName: "", phone: "+573001234567" },
    });
    expect(await errorCode(result)).toBe("DUPLICATE_PHONE");
    // Keeping its own phone is fine.
    await asAna.mutation(api.clients.update, { clientId: ids.clientA, client: { firstName: "Laura", lastName: "Prueba", phone: "+573001234567" } });
  });

  test("validates phone, email, and birth date", async () => {
    const { asAna } = await setupOrgs();
    const base = { firstName: "Eva", lastName: "", phone: "+573120000000" };
    expect(await errorMessage(create(asAna, { client: { ...base, phone: "+57300" } }))).toBe(
      "Escribe un teléfono de 10 dígitos.",
    );
    expect(await errorCode(create(asAna, { client: { ...base, email: "eva@" } }))).toBe("INVALID");
    expect(await errorCode(create(asAna, { client: { ...base, birthDate: "2999-01-01" } }))).toBe("INVALID");
    expect(await errorCode(create(asAna, { client: { ...base, firstName: " " } }))).toBe("INVALID");
  });

  test("archived clients leave the list and search but keep their record", async () => {
    const { asAna, ids } = await setupOrgs();
    await asAna.mutation(api.clients.archive, { clientId: ids.clientA });
    expect((await asAna.query(api.clients.list, { paginationOpts: PAGE })).page).toHaveLength(0);
    expect((await asAna.query(api.clients.list, { search: "laura", paginationOpts: PAGE })).page).toHaveLength(0);
    expect((await asAna.query(api.clients.get, { clientId: ids.clientA })).isArchived).toBe(true);
    await asAna.mutation(api.clients.restore, { clientId: ids.clientA });
    expect((await asAna.query(api.clients.list, { paginationOpts: PAGE })).page).toHaveLength(1);
  });

  test("search finds by name and by phone digits", async () => {
    const { asAna, ids } = await setupOrgs();
    const byName = await asAna.query(api.clients.list, { search: "Laura", paginationOpts: PAGE });
    expect(byName.page.map((c) => c._id)).toEqual([ids.clientA]);
    const byPhone = await asAna.query(api.clients.list, { search: "300 123", paginationOpts: PAGE });
    expect(byPhone.page.map((c) => c._id)).toEqual([ids.clientA]);
  });
});

describe("clients: cross-org isolation", () => {
  test("lists and search only show the caller's org", async () => {
    const { asAna, asBea, ids } = await setupOrgs();
    expect((await asAna.query(api.clients.list, { paginationOpts: PAGE })).page.map((c) => c._id)).toEqual([ids.clientA]);
    expect((await asAna.query(api.clients.list, { search: "maria", paginationOpts: PAGE })).page).toHaveLength(0);
    expect((await asBea.query(api.clients.pick, { search: "" })).map((c) => c._id)).toEqual([ids.clientB]);
  });

  test("cannot read, edit, or archive a client of another org", async () => {
    const { asAna, ids, t } = await setupOrgs();
    expect(await errorCode(asAna.query(api.clients.get, { clientId: ids.clientB }))).toBe("NOT_FOUND");
    expect(await errorCode(asAna.query(api.clients.summary, { clientId: ids.clientB }))).toBe("NOT_FOUND");
    expect(
      await errorCode(
        asAna.mutation(api.clients.update, { clientId: ids.clientB, client: { firstName: "X", lastName: "", phone: "+573009876543" } }),
      ),
    ).toBe("NOT_FOUND");
    expect(await errorCode(asAna.mutation(api.clients.archive, { clientId: ids.clientB }))).toBe("NOT_FOUND");
    expect((await t.run((ctx) => ctx.db.get(ids.clientB)))?.isArchived).toBe(false);
  });
});
