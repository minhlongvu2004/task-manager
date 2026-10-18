import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

it("renders in jsdom with jest-dom matchers", () => {
  render(<p>hello</p>);
  expect(screen.getByText("hello")).toBeInTheDocument();
});
