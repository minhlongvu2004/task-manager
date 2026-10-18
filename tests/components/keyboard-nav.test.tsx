import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KeyboardNav, handleProjectKeys } from "@/components/KeyboardNav";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function setup() {
  document.body.innerHTML = `
    <a href="/projects/1" data-project-row>One</a>
    <a href="/projects/2" data-project-row>Two</a>
    <a href="/projects/3" data-project-row>Three</a>
    <input id="box" />`;
  return Array.from(document.querySelectorAll<HTMLElement>("[data-project-row]"));
}

const key = (k: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) => {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(e, "target", { value: target });
  return e;
};

describe("handleProjectKeys", () => {
  it("moves focus down and up, clamping at the ends", () => {
    const rows = setup();
    const navigate = vi.fn();
    handleProjectKeys(key("ArrowDown"), { root: document, navigate });
    expect(document.activeElement).toBe(rows[0]);
    handleProjectKeys(key("ArrowDown", {}, rows[0]), { root: document, navigate });
    expect(document.activeElement).toBe(rows[1]);
    handleProjectKeys(key("ArrowUp", {}, rows[1]), { root: document, navigate });
    expect(document.activeElement).toBe(rows[0]);
    handleProjectKeys(key("ArrowUp", {}, rows[0]), { root: document, navigate });
    expect(document.activeElement).toBe(rows[0]);
  });

  it("navigates to ?new=project on N", () => {
    setup();
    const navigate = vi.fn();
    const e = key("n");
    handleProjectKeys(e, { root: document, navigate });
    expect(navigate).toHaveBeenCalledWith("?new=project");
    expect(e.defaultPrevented).toBe(true);
  });

  it("ignores keys while typing or with modifiers", () => {
    setup();
    const navigate = vi.fn();
    const box = document.getElementById("box")!;
    handleProjectKeys(key("n", {}, box), { root: document, navigate });
    handleProjectKeys(key("n", { ctrlKey: true }), { root: document, navigate });
    handleProjectKeys(key("N", { metaKey: true }), { root: document, navigate });
    handleProjectKeys(key("ArrowDown", {}, box), { root: document, navigate });
    expect(navigate).not.toHaveBeenCalled();
    expect(document.activeElement).not.toHaveAttribute("data-project-row");
  });
});

describe("KeyboardNav", () => {
  it("renders the hint line", () => {
    const { getByText } = render(<KeyboardNav />);
    expect(getByText(/Enter to open/)).toBeInTheDocument();
  });
});
