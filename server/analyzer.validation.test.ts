import { describe, expect, it } from "vitest";
import { validatePublicUrl } from "./analyzer";

describe("validatePublicUrl", () => {
  it("normalizes a public hostname without a protocol", () => {
    expect(validatePublicUrl("example.com")).toBe("https://example.com");
  });

  it("allows HTTP and HTTPS only", () => {
    expect(() => validatePublicUrl("javascript:alert(1)")).toThrow("HTTP and HTTPS");
    expect(() => validatePublicUrl("file:///etc/passwd")).toThrow("HTTP and HTTPS");
  });

  it("blocks obvious internal and private destinations", () => {
    expect(() => validatePublicUrl("http://localhost:3000")).toThrow("Private and internal");
    expect(() => validatePublicUrl("http://127.0.0.1")).toThrow("Private and internal");
    expect(() => validatePublicUrl("http://192.168.1.10")).toThrow("Private and internal");
    expect(() => validatePublicUrl("http://metadata.google.internal")).toThrow("Private and internal");
  });
});
