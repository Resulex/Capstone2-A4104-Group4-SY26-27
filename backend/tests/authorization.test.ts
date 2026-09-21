import { assertOwnResidentRef } from "../src/shared/authorization";

describe("assertOwnResidentRef", () => {

  // UT-09
  test("UT-09: rejects a resident attempting to use another resident's ID", () => {
    const auth = { userId: "R1", role: "resident" as const };

    expect(() => {
      assertOwnResidentRef(auth, "R2");
    }).toThrow();
  });

  // UT-10
  test("UT-10: allows a resident to reference their own ID", () => {
    const auth = { userId: "R1", role: "resident" as const };

    expect(() => {
      assertOwnResidentRef(auth, "R1");
    }).not.toThrow();
  });

});
