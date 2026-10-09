// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import OrdersSummary, { hourLabel } from "./OrdersSummary";

const hours = Array.from({ length: 24 }, () => 0);
hours[10] = 1;
hours[13] = 2;

describe("OrdersSummary", () => {
  it("shows the period's numbers and charts", () => {
    render(
      <OrdersSummary
        summary={{ orders: 3, sales: 1160, average: 386.67, waiting: 2, unpaid: 1000 }}
        top={[
          { name: "Black Forest Pastry", qty: 3 },
          { name: "Choco Truffle Cake", qty: 2 },
        ]}
        modes={[
          { mode: "table", count: 2 },
          { mode: "counter", count: 1 },
        ]}
        hours={hours}
      />,
    );

    expect(screen.getByText("Orders").nextSibling).toHaveTextContent("3");
    expect(screen.getByText("Sales").nextSibling).toHaveTextContent("₹1,160");
    expect(screen.getByText("Average order").nextSibling).toHaveTextContent("₹387");
    expect(screen.getByText("Waiting now").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("Still to collect").nextSibling).toHaveTextContent("₹1,000");
    expect(screen.getByText("Black Forest Pastry")).toBeInTheDocument();
    expect(screen.getByText("At a table")).toBeInTheDocument();
    expect(screen.getByText("2 · 67%")).toBeInTheDocument();
    // The chart runs from the first to the last busy hour: 10am to 1pm.
    expect(screen.getByRole("img", { name: /orders by hour/i }).children).toHaveLength(4);
    expect(screen.getByTitle("1 order")).toBeInTheDocument();
    expect(screen.getByTitle("2 orders")).toBeInTheDocument();
  });

  it("skips the charts until there are orders", () => {
    render(
      <OrdersSummary
        summary={{ orders: 0, sales: 0, average: 0, waiting: 0, unpaid: 0 }}
        top={[]}
        modes={[]}
        hours={Array.from({ length: 24 }, () => 0)}
      />,
    );
    expect(screen.queryByText("Top items")).not.toBeInTheDocument();
  });
});

describe("hourLabel", () => {
  it.each([
    [0, "12a"],
    [9, "9a"],
    [12, "12p"],
    [13, "1p"],
    [23, "11p"],
  ])("labels %i as %s", (hour, label) => {
    expect(hourLabel(hour)).toBe(label);
  });
});
