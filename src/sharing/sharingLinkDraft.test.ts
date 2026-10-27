import { describe, expect, it } from "vitest";
import { sharingDraftMessage, sharingEmailDraftUrl } from "./sharingLinkDraft";

describe("sharing email draft", () => {
  it("keeps the workout title and short link in the encoded mail body", () => {
    const link = `https://lastrep.web.app/w/${"a".repeat(32)}`;
    const uri = new URL(sharingEmailDraftUrl("Bench + Back", link));
    expect(uri.protocol).toBe("mailto:");
    expect(uri.searchParams.get("subject")).toBe("Bench + Back");
    expect(uri.searchParams.get("body")).toBe(
      sharingDraftMessage("Bench + Back", link),
    );
    expect(uri.searchParams.get("body")).not.toContain("?token=");
  });
});
