// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider, useSidebar } from "./SidebarContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const COLLAPSED_STORAGE_KEY = "paperclip.sidebar.collapsed";

// Mutable media state driving the matchMedia mock.
const mediaState = { mobile: false, hoverFine: true };

function act(callback: () => void) {
  flushSync(callback);
}

function setViewport({ mobile, hoverFine }: { mobile?: boolean; hoverFine?: boolean }) {
  if (typeof mobile === "boolean") mediaState.mobile = mobile;
  if (typeof hoverFine === "boolean") mediaState.hoverFine = hoverFine;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: mediaState.mobile ? 500 : 1280,
  });
}

let capturedValue: ReturnType<typeof useSidebar> | null = null;

function Capture() {
  capturedValue = useSidebar();
  return null;
}

function renderProvider(): { root: Root; host: HTMLDivElement } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      <SidebarProvider>
        <Capture />
      </SidebarProvider>,
    );
  });
  return { root, host };
}

describe("SidebarContext", () => {
  let active: { root: Root; host: HTMLDivElement } | null = null;

  beforeEach(() => {
    localStorage.clear();
    capturedValue = null;
    setViewport({ mobile: false, hoverFine: true });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => {
        const isHoverQuery = query.includes("(hover: hover)");
        const matches = isHoverQuery ? mediaState.hoverFine : mediaState.mobile;
        return {
          matches,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        };
      }),
    });
  });

  afterEach(() => {
    if (active) {
      act(() => active!.root.unmount());
      active.host.remove();
      active = null;
    }
    localStorage.clear();
  });

  describe("user pin and default", () => {
    it("defaults to expanded (collapsed=false) with no pin", () => {
      active = renderProvider();
      expect(capturedValue?.collapsed).toBe(false);
    });

    it("toggleCollapsed flips the effective mode and records a pin", () => {
      active = renderProvider();
      expect(capturedValue?.collapsed).toBe(false);

      act(() => capturedValue?.toggleCollapsed());
      expect(capturedValue?.collapsed).toBe(true);
      expect(localStorage.getItem(COLLAPSED_STORAGE_KEY)).toBe("1");

      act(() => capturedValue?.toggleCollapsed());
      expect(capturedValue?.collapsed).toBe(false);
      expect(localStorage.getItem(COLLAPSED_STORAGE_KEY)).toBe("0");
    });

  });

  describe("persistence round-trip", () => {
    it("writes '1'/'0' to localStorage on setCollapsed", () => {
      active = renderProvider();
      act(() => capturedValue?.setCollapsed(true));
      expect(localStorage.getItem(COLLAPSED_STORAGE_KEY)).toBe("1");
      act(() => capturedValue?.setCollapsed(false));
      expect(localStorage.getItem(COLLAPSED_STORAGE_KEY)).toBe("0");
    });

    it("reads the persisted pin synchronously on first paint (no flash)", () => {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, "1");
      active = renderProvider();
      // Collapsed is already true on the very first captured render.
      expect(capturedValue?.collapsed).toBe(true);
    });

    it("treats a missing/garbage value as unpinned", () => {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, "yes");
      active = renderProvider();
      expect(capturedValue?.collapsed).toBe(false);
    });
  });

  describe("mobile gating", () => {
    it("never reports collapsed on mobile even with a collapsed pin", () => {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, "1");
      setViewport({ mobile: true });
      active = renderProvider();
      expect(capturedValue?.isMobile).toBe(true);
      expect(capturedValue?.collapsed).toBe(false);
    });

    it("never reports peeking on mobile", () => {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, "1");
      setViewport({ mobile: true });
      active = renderProvider();
      act(() => capturedValue?.setPeeking(true));
      expect(capturedValue?.peeking).toBe(false);
    });
  });

  describe("peek gating", () => {
    it("peeks when collapsed on a hover-capable pointer", () => {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, "1");
      setViewport({ mobile: false, hoverFine: true });
      active = renderProvider();
      expect(capturedValue?.collapsed).toBe(true);
      act(() => capturedValue?.setPeeking(true));
      expect(capturedValue?.peeking).toBe(true);
    });

    it("does not peek when expanded", () => {
      setViewport({ mobile: false, hoverFine: true });
      active = renderProvider();
      expect(capturedValue?.collapsed).toBe(false);
      act(() => capturedValue?.setPeeking(true));
      expect(capturedValue?.peeking).toBe(false);
    });

    it("does not peek on a coarse/non-hover pointer", () => {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, "1");
      setViewport({ mobile: false, hoverFine: false });
      active = renderProvider();
      expect(capturedValue?.collapsed).toBe(true);
      act(() => capturedValue?.setPeeking(true));
      expect(capturedValue?.peeking).toBe(false);
    });

    // iPadOS Safari keeps the hover/pointer media query false even with a
    // trackpad attached (PAP-10725); a real cursor still emits "mouse" pointer
    // events, which must unlock peek at runtime.
    it("peeks once a mouse-type pointer event is seen (iPad + trackpad)", () => {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, "1");
      setViewport({ mobile: false, hoverFine: false });
      active = renderProvider();
      expect(capturedValue?.collapsed).toBe(true);

      // No cursor seen yet → peek stays gated despite the media query.
      act(() => capturedValue?.setPeeking(true));
      expect(capturedValue?.peeking).toBe(false);

      // A trackpad/mouse moves: a "mouse" pointer event unlocks peek.
      act(() => {
        const e = new Event("pointermove");
        (e as unknown as { pointerType: string }).pointerType = "mouse";
        window.dispatchEvent(e);
      });
      expect(capturedValue?.peeking).toBe(true);
    });

    it("ignores touch pointer events (touch-only stays gated)", () => {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, "1");
      setViewport({ mobile: false, hoverFine: false });
      active = renderProvider();

      act(() => capturedValue?.setPeeking(true));
      act(() => {
        const e = new Event("pointerover");
        (e as unknown as { pointerType: string }).pointerType = "touch";
        window.dispatchEvent(e);
      });
      expect(capturedValue?.peeking).toBe(false);
    });
  });

  describe("back-compat", () => {
    it("retains sidebarOpen/toggleSidebar for the drawer", () => {
      active = renderProvider();
      const initial = capturedValue?.sidebarOpen;
      expect(typeof initial).toBe("boolean");
      act(() => capturedValue?.toggleSidebar());
      expect(capturedValue?.sidebarOpen).toBe(!initial);
    });
  });
});
