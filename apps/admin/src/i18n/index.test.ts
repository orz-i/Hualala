import { createTranslator, resolveInitialLocale } from "./index";

describe("admin i18n", () => {
  it("prefers stored locale over navigator locale", () => {
    const storage = {
      getItem: vi.fn().mockReturnValue("en-US"),
      setItem: vi.fn(),
    } as unknown as Storage;

    expect(resolveInitialLocale(storage, "zh-CN")).toBe("en-US");
  });

  it("falls back to zh-CN for unsupported navigator locale", () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    } as unknown as Storage;

    expect(resolveInitialLocale(storage, "fr-FR")).toBe("zh-CN");
  });

  it("formats translated messages with placeholders", () => {
    const t = createTranslator("en-US");
    expect(t("budget.feedback.error", { message: "network down" })).toBe(
      "Budget update failed: network down",
    );
  });
});
