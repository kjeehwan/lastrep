import {describe,expect,it,vi} from "vitest";
import {deletionRequestDetails,setupDeletionCopy} from "../../hosting/workout-sharing/legal.mjs";
function fixture(kind) {
  let click;
  const button={dataset:{copyRequest:kind},addEventListener:(_,handler)=>{click=handler;}};
  const status={textContent:""},fallback={hidden:true,value:"",focus:vi.fn(),select:vi.fn()};
  const doc={querySelectorAll:()=>[button],getElementById:id=>id==="request-copy-status"?status:fallback};
  return {doc,status,fallback,click:()=>click()};
}
describe("deletion email fallback",()=>{
  it("distinguishes account deletion from selected-data requests",()=>{
    expect(deletionRequestDetails("account")).toContain("Subject: Account Deletion Request");
    expect(deletionRequestDetails("data")).toContain("Subject: Data Deletion Request");
    expect(deletionRequestDetails("data")).toContain("Please keep my account and records outside this request.");
    expect(()=>deletionRequestDetails("other")).toThrow();
  });
  it("copies the complete request details without opening or sending email",async()=>{
    const ui=fixture("account"),clipboard={writeText:vi.fn().mockResolvedValue(undefined)};
    setupDeletionCopy(ui.doc,clipboard);await ui.click();
    expect(clipboard.writeText).toHaveBeenCalledWith(deletionRequestDetails("account"));
    expect(ui.status.textContent).toContain("Email details copied");
    expect(ui.fallback.hidden).toBe(true);
  });
  it("shows selectable details when clipboard permission is denied",async()=>{
    const ui=fixture("data");
    setupDeletionCopy(ui.doc,{writeText:vi.fn().mockRejectedValue(new Error("Denied"))});await ui.click();
    expect(ui.fallback.hidden).toBe(false);
    expect(ui.fallback.value).toBe(deletionRequestDetails("data"));
    expect(ui.fallback.select).toHaveBeenCalled();
    expect(ui.status.textContent).toContain("Copy the selected details");
  });
});
