import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LivePropsViews } from "@/components/shared/HalftimeLines";

describe("Props tab views", () => {
  it("shows only the pregame view when the game isn't live", () => {
    render(<LivePropsViews live={false} pregame={<p>pre</p>} halftime={<p>half</p>} />);
    expect(screen.getByText("pre")).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();
  });
  it("adds a Halftime live tab during the game", () => {
    render(<LivePropsViews live pregame={<p>pre</p>} halftime={<p>half</p>} />);
    fireEvent.click(screen.getByRole("tab", { name: "Halftime live" }));
    expect(screen.getByText("half")).toBeTruthy();
    expect(screen.queryByText("pre")).toBeNull();
  });
});
