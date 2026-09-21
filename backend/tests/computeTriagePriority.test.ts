import { computeTriagePriority } from "../src/shared/triage";

describe("computeTriagePriority", () => {

  // UT-01
  test("UT-01: returns Critical when a critical keyword appears in the category", () => {
    const result = computeTriagePriority("Fire", "");
    expect(result).toBe("Critical");
  });

  // UT-02
  test("UT-02: Critical overrides lower-priority keywords in the same text", () => {
    const result = computeTriagePriority("Fire", "may sunog sa may likod ng tindahan");
    expect(result).toBe("Critical");
  });

  // UT-03
  test("UT-03: returns Low when no priority keyword matches", () => {
    const result = computeTriagePriority("Other", "nawawala ang aso ko");
    expect(result).toBe("Low");
  });

  // UT-04
  test("UT-04: prevents substring false positives using word boundaries", () => {
    const result = computeTriagePriority("Other", "may nasira sa likod ng bakod");
    expect(["Low", "Medium"]).toContain(result);
  });

  // UT-05
  test("UT-05: recognizes the multi-word Filipino keyword phrase 'walang malay'", () => {
    const result = computeTriagePriority("Medical Emergency", "nakita namin siyang walang malay");
    expect(result).toBe("Critical");
  });

  // UT-06
  test("UT-06: recognizes the Filipino high-priority keyword 'nakawan'", () => {
    const result = computeTriagePriority("Criminal Activity", "may nakawan sa tindahan");
    expect(result).toBe("High");
  });

});
