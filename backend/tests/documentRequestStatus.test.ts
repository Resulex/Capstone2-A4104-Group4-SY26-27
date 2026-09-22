import { validateDocumentRequestStatusTransition } from "../src/shared/documentRequestValidation";

describe("validateDocumentRequestStatusTransition", () => {
  test("UT-14: rejects Rejected status when remarks are missing", () => {
    expect(() => {
      validateDocumentRequestStatusTransition("Rejected", undefined);
    }).toThrow("Remarks are required when rejecting a document request.");
  });
});