import {describe,expect,it,vi} from "vitest";
import {sharingPageResponse} from "./sharingPage";
const token="B".repeat(32);
describe("sharing page server metadata",()=>{
  it.each([[1,"Shared workout"],[2,"Shared program"]])("serves type %i metadata without JavaScript",async(version,label)=>{
    const result=await sharingPageResponse(`/w/${token}`,async()=>({plan:{version}}));
    expect(result.status).toBe(200);
    expect(result.html).toContain(`<title>${label} · Lastrep</title>`);
    expect(result.html).toContain(`property="og:title" content="${label} · Lastrep"`);
    expect(result.html).toContain(`name="twitter:title" content="${label} · Lastrep"`);
    expect(result.html).not.toContain(token);
  });
  it("uses the same authorization lookup for legacy URLs",async()=>{
    const load=vi.fn().mockResolvedValue({plan:{version:1}});
    expect((await sharingPageResponse(`/shared-workout?token=${"a".repeat(64)}`,load)).status).toBe(200);
    expect(load).toHaveBeenCalledWith("a".repeat(64));
  });
  it("rejects malformed and ambiguous links without a database read",async()=>{
    const load=vi.fn();
    for(const url of [`/w/${token}?token=${token}`,`/w/<script>`,`/shared-workout?token=${token}&token=${token}`]){
      expect((await sharingPageResponse(url,load)).status).toBe(404);
    }
    expect(load).not.toHaveBeenCalled();
  });
  it("does not label revoked links as available or cache transient failures",async()=>{
    for(const [code,status] of [["not-found",404],["resource-exhausted",429],["internal",503]] as const){
      const result=await sharingPageResponse(`/w/${token}`,async()=>{throw {code};});
      expect(result.status).toBe(status);
      expect(result.html).not.toContain("Shared program · Lastrep");
    }
  });
});
