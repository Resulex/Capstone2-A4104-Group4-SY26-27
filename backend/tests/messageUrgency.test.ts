import { detectMessageUrgency } from "../src/shared/messageUrgency";

describe("detectMessageUrgency", () => {
  test("UT-15: detects an urgent message containing an urgency keyword", () => {
    expect(detectMessageUrgency("Please help, there's a fire!")).toBe(true);
  });

  test("UT-16: does not flag a normal message as urgent", () => {
    expect(detectMessageUrgency("Salamat po sa update.")).toBe(false);
  });
});