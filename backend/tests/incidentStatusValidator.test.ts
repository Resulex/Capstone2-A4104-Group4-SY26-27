import { validateIncidentStatusTransition } from "../src/shared/incidentStatusValidation";

describe("validateIncidentStatusTransition", () => {
  test("UT-11: rejects Closed status when remarks are missing", () => {
    expect(() => {
      validateIncidentStatusTransition("INC-202600042", "Closed", undefined, undefined);
    }).toThrow("Remarks are required when closing");
  });

  test("UT-12: rejects Duplicate status when duplicateOfIncidentId is missing", () => {
    expect(() => {
      validateIncidentStatusTransition("INC-202600042", "Duplicate", "dup report", undefined);
    }).toThrow("original incident is required");
  });

  test("UT-13: rejects an incident from referencing itself as a duplicate", () => {
    expect(() => {
      validateIncidentStatusTransition("INC-202600042", "Duplicate", "dup", "INC-202600042");
    }).toThrow("cannot be a duplicate of itself");
  });
});