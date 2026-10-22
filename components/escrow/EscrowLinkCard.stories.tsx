import type { Meta, StoryObj } from "@storybook/react";

import EscrowLinkCard, { type EscrowLinkData } from "./EscrowLinkCard";

const sampleLink: EscrowLinkData = {
  title: "Escrow Agreement 1293",
  status: "Active",
  amount: 12450,
  escrowId: "1293",
  url: "https://trustlink.example.com/pay/1293",
};

const meta: Meta<typeof EscrowLinkCard> = {
  title: "Escrow/EscrowLinkCard",
  component: EscrowLinkCard,
  parameters: { layout: "centered" },
  args: { link: sampleLink },
  argTypes: {
    onCopySuccess: { action: "copy-success" },
    onCopyError: { action: "copy-error" },
    onRetry: { action: "retry" },
  },
};
export default meta;
type Story = StoryObj<typeof EscrowLinkCard>;

export const Active: Story = {};
export const Loading: Story = { args: { loading: true } };
export const Missing: Story = { args: { link: null } };
export const Error: Story = { args: { error: new globalThis.Error("Unable to load escrow.") } };
export const Expired: Story = {
  args: { link: { ...sampleLink, status: "Expired" } },
};
export const PendingPayout: Story = {
  args: {
    link: {
      title: "Handmade furniture",
      status: "Pending Payout",
      amount: 650,
      escrowId: "furniture-order",
      url: "https://trustlink.example.com/pay/furniture-order",
    },
  },
};
