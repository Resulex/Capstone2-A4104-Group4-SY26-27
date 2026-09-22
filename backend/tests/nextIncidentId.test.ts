import { computeNextIncidentId } from "../src/shared/incident-id";

describe("computeNextIncidentId", () => {
  test("UT-07: generates the next sequential incident ID", () => {
    expect(computeNextIncidentId(2026, "INC-202600041")).toBe("INC-202600042");
  });

  test("UT-08: generates the first incident ID for a new year", () => {
    expect(computeNextIncidentId(2027, null)).toBe("INC-202700001");
  });
});