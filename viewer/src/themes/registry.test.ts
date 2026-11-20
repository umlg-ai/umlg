import { describe, expect, it } from "vitest";
import { ThemeManager } from "./registry";
import type { ThemeContext } from "./types";

const context: ThemeContext = { world: "R", phaseProgress: 1 };

describe("ThemeManager theme registry", () => {
  it("registers industrial, minimal and tactile themes", () => {
    const manager = new ThemeManager("industrial-v1");
    const ids = manager.getAvailableThemes().map((theme) => theme.id);
    expect(ids).toContain("industrial-v1");
    expect(ids).toContain("minimal-v0");
    expect(ids).toContain("tactile-minimal-v1");
  });

  it("switches the graphics-gpu plugin together with the theme", () => {
    const manager = new ThemeManager("industrial-v1");
    expect(manager.getPlugin("graphics-gpu")?.label).toContain("Graphics Pipeline");

    expect(manager.setTheme("tactile-minimal-v1")).toBe(true);
    expect(manager.getPlugin("graphics-gpu")?.label).toContain("Tactile Minimal");

    expect(manager.setTheme("industrial-v1")).toBe(true);
    expect(manager.getPlugin("graphics-gpu")?.label).toContain("Graphics Pipeline");
  });

  it("keeps an explicit profile choice across theme switches", () => {
    const manager = new ThemeManager("industrial-v1");
    manager.setProfileEnabled("graphics-gpu", false);

    manager.setTheme("tactile-minimal-v1");
    expect(manager.isProfileEnabled("graphics-gpu")).toBe(false);

    manager.setTheme("industrial-v1");
    expect(manager.isProfileEnabled("graphics-gpu")).toBe(false);

    manager.setProfileEnabled("graphics-gpu", true);
    expect(manager.isProfileEnabled("graphics-gpu")).toBe(true);
  });

  it("falls back to Core primitives when the domain profile is disabled", () => {
    const manager = new ThemeManager("tactile-minimal-v1");
    expect(manager.getActiveTheme().id).toBe("tactile-minimal-v1");

    const withProfile = manager.createEntity("gpu:Buffer", context);
    expect(withProfile.userData.domainProfile).toBe("graphics-gpu");

    manager.setProfileEnabled("graphics-gpu", false);
    const withoutProfile = manager.createEntity("gpu:Buffer", context);
    expect(withoutProfile.userData.domainProfile).toBeUndefined();
    expect(withoutProfile.userData.coreKind).toBe("Store");
  });

  it("removes theme plugins when switching to a theme without a profile", () => {
    const manager = new ThemeManager("tactile-minimal-v1");
    manager.setTheme("minimal-v0");
    expect(manager.getPlugin("graphics-gpu")).toBeUndefined();
    const fallback = manager.createEntity("gpu:ShaderStage", context);
    expect(fallback.userData.coreKind).toBe("Process");
  });
});
