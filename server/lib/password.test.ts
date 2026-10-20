import { describe, expect, it } from "vitest";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password.js";

describe("password", () => {
  it("gera hashes com sal diferente e verifica corretamente", async () => {
    const a = await hashPassword("segredo");
    const b = await hashPassword("segredo");
    expect(a).not.toBe(b);
    expect(await verifyPassword("segredo", a)).toBe(true);
    expect(await verifyPassword("outro", a)).toBe(false);
  });

  it("nunca aceita o hash de preenchimento nem formatos inválidos", async () => {
    expect(await verifyPassword("", DUMMY_HASH)).toBe(false);
    expect(await verifyPassword("x", "md5$abc")).toBe(false);
  });
});
