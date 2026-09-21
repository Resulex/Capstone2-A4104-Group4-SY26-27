import { buildIdOrCustomIdQuery } from "../src/shared/handler";

describe("buildIdOrCustomIdQuery", () => {

  // UT-17
  test("UT-17: builds a custom-id-only query when id is not a valid ObjectId", () => {
    const result = buildIdOrCustomIdQuery("ann-001", "announcementId");
    expect(result).toEqual({ announcementId: "ann-001" });
  });

  // UT-18
  test("UT-18: builds an $or query with _id when id is a valid ObjectId", () => {
    const validObjectId = "64f1a2b3c4d5e6f7a8b9c0d1";
    const result = buildIdOrCustomIdQuery(validObjectId, "announcementId");
    expect(result).toEqual({
      $or: [{ _id: validObjectId }, { announcementId: validObjectId }],
    });
  });

});
