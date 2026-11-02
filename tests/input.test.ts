import { describe, expect, it } from "vitest";
import { InputController } from "../src/platform/input";

// InputController only needs a little of the DOM: stub just that, with the keyboard off.
const stubDom = (): HTMLCanvasElement => {
  (globalThis as unknown as { window: unknown }).window = { addEventListener() {}, removeEventListener() {} };
  return { style: {}, addEventListener() {}, removeEventListener() {} } as unknown as HTMLCanvasElement;
};

describe("outside input (a native shell or relay)", () => {
  it("head is passed to the game as given, and cleared with null", () => {
    const c = new InputController(stubDom(), { keyboard: "off", motion: false });
    expect(c.frame().head).toBeNull();
    c.head = { az: 123, el: -7 };
    expect(c.frame().head).toEqual({ az: 123, el: -7 });
    c.head = null;
    expect(c.frame().head).toBeNull();
  });
  it("the external trigger holds fire while set", () => {
    const c = new InputController(stubDom(), { keyboard: "off", motion: false });
    expect(c.frame().fire).toBe(false);
    c.externalFire = true;
    expect(c.frame().fire).toBe(true); expect(c.frame().fire).toBe(true);
    c.externalFire = false;
    expect(c.frame().fire).toBe(false);
  });
});
