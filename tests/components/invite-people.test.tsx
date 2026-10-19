import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ inviteAction: vi.fn(), removeInviteAction: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/actions/people", () => ({ inviteAction: mocks.inviteAction, removeInviteAction: mocks.removeInviteAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));

import { InvitePeople } from "@/components/InvitePeople";

beforeEach(() => vi.resetAllMocks());

const show = () => render(<InvitePeople ownerEmail="me@example.com" invited={["ann@example.com"]} />);

describe("InvitePeople", () => {
  it("shows the owner and the invited people", () => {
    show();
    expect(screen.getByText("me@example.com")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("ann@example.com")).toBeInTheDocument();
  });

  it("inviting adds the person to the list", async () => {
    mocks.inviteAction.mockResolvedValue({ ok: true, email: "bo@example.com" });
    show();
    await userEvent.type(screen.getByLabelText("Email"), "Bo@Example.com");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(mocks.inviteAction).toHaveBeenCalledWith("Bo@Example.com");
    expect(await screen.findByText("bo@example.com")).toBeInTheDocument();
  });

  it("shows the error and does not list the person when inviting fails", async () => {
    mocks.inviteAction.mockResolvedValue({ ok: false, error: "Enter a valid email address" });
    show();
    await userEvent.type(screen.getByLabelText("Email"), "x@y.zz");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid email address");
    expect(screen.queryByText("x@y.zz")).not.toBeInTheDocument();
  });

  it("removing takes the person off the list", async () => {
    mocks.removeInviteAction.mockResolvedValue({ ok: true });
    show();
    await userEvent.click(screen.getByRole("button", { name: "Remove ann@example.com" }));
    expect(mocks.removeInviteAction).toHaveBeenCalledWith("ann@example.com");
    await vi.waitFor(() => expect(screen.queryByText("ann@example.com")).not.toBeInTheDocument());
  });
});
