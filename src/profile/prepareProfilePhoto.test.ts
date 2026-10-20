import { beforeEach, expect, it, vi } from "vitest";
import { prepareProfilePhotoUpload, profilePhotoPreparation } from "./prepareProfilePhoto";

const fake = vi.hoisted(() => ({
  crop: vi.fn(), resize: vi.fn(), render: vi.fn(), save: vi.fn(), releaseImage: vi.fn(), releaseContext: vi.fn(), remove: vi.fn(),
}));
vi.mock("react-native", () => ({ Image: { getSize: (_uri: string, success: (width: number, height: number) => void) => success(2400, 3200) } }));
vi.mock("expo-file-system/legacy", () => ({ deleteAsync: fake.remove }));
vi.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: { manipulate: () => ({ crop: fake.crop, resize: fake.resize, renderAsync: fake.render, release: fake.releaseContext }) },
}));
beforeEach(() => {
  vi.resetAllMocks();
  fake.crop.mockReturnValue({ resize: fake.resize });
  fake.render.mockResolvedValue({ saveAsync: fake.save, release: fake.releaseImage });
  fake.save.mockResolvedValue({ uri: "file:///prepared.jpg", base64: "anBlZw==" });
  fake.remove.mockResolvedValue(undefined);
});
it.each([[2400, 3200, 0, 400, 2400, 512], [3200, 2400, 400, 0, 2400, 512], [100, 80, 10, 0, 80, 80]])("preserves center crop and never enlarges %sx%s", (width, height, x, y, side, size) => {
  expect(profilePhotoPreparation(width, height)).toEqual({ crop: { originX: x, originY: y, width: side, height: side }, size });
});
it.each([[0, 512], [Infinity, 512], [10000, 10000]])("rejects unsafe dimensions %sx%s", (width, height) => {
  expect(() => profilePhotoPreparation(width, height)).toThrow();
});
it("produces a small JPEG and removes only its temporary file", async () => {
  expect(await prepareProfilePhotoUpload("file:///selected.jpg")).toBe("anBlZw==");
  expect(fake.crop).toHaveBeenCalledWith({ originX: 0, originY: 400, width: 2400, height: 2400 });
  expect(fake.resize).toHaveBeenCalledWith({ width: 512, height: 512 });
  expect(fake.save).toHaveBeenCalledWith({ format: "jpeg", compress: 0.9, base64: true });
  expect(fake.remove).toHaveBeenCalledExactlyOnceWith("file:///prepared.jpg", { idempotent: true });
  expect(fake.releaseContext).toHaveBeenCalledOnce();
  expect(fake.releaseImage).toHaveBeenCalledOnce();
});
it("preserves the selected source and releases native resources on preparation failure", async () => {
  fake.save.mockRejectedValue(new Error("Decoder failed"));
  await expect(prepareProfilePhotoUpload("file:///selected.jpg")).rejects.toThrow("Decoder failed");
  expect(fake.remove).not.toHaveBeenCalled();
  expect(fake.releaseContext).toHaveBeenCalledOnce();
  expect(fake.releaseImage).toHaveBeenCalledOnce();
});
