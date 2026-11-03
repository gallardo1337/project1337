import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_THUMBNAIL_ENHANCEMENT,
  SUPIR_THUMBNAIL_OUTPUT_NODE,
  SUPIR_THUMBNAIL_REQUIRED_NODES,
  createSupirThumbnailPrompt,
  getSupirThumbnailSupport,
} from "../lib/thumbnailComfyWorkflow.mjs";

test("the default avoids generative reconstruction while the manual SUPIR profile remains available", () => {
  assert.equal(DEFAULT_THUMBNAIL_ENHANCEMENT, "upscale");
  const p = createSupirThumbnailPrompt({ imageName: "fresh-upload.jpg" });
  assert.equal(p["1"].inputs.image, "fresh-upload.jpg");
  assert.equal(p["3"].inputs.supir_model, "SUPIR-v0F_fp16.safetensors");
  assert.equal(p["2"].inputs.ckpt_name, "sdxl\\AlbedoBaseXL.safetensors");
  assert.equal(p["7"].inputs.steps, 40);
  assert.equal(p["7"].inputs.seed, 1337);
  assert.equal(p["7"].inputs.control_scale_end, 0.93);
  assert.equal(p["7"].inputs.s_noise, 1.02);
  assert.equal(p["7"].inputs.cfg_scale_start, 3);
  assert.equal(p["7"].inputs.cfg_scale_end, 6);
  assert.equal(p["7"].inputs.sampler, "TiledRestoreEDMSampler");
  const save = p[SUPIR_THUMBNAIL_OUTPUT_NODE];
  assert.equal(save.class_type, "SaveImage");
  const denoise = p[save.inputs.images[0]];
  assert.equal(denoise.class_type, "ThumbnailDenoise");
  assert.equal(denoise.inputs.strength, 0.65);
  const resize = p[denoise.inputs.image[0]];
  assert.equal(resize.inputs.width, 1920);
  assert.equal(resize.inputs.height, 1080);
  assert.equal(p[resize.inputs.image[0]].class_type, "SUPIR_decode");
  assert.ok(!Object.values(p).some((n) => /NAFNet|SUPIR_Upscale/.test(n.class_type)));
});

test("all links resolve, the graph is acyclic, and the decode node is never overwritten by SaveImage", () => {
  const p = createSupirThumbnailPrompt({ imageName: "new-source.jpg" });
  const visited = new Set(), visiting = new Set();
  function visit(id) {
    assert.ok(p[id], `missing input node ${id}`);
    assert.ok(!visiting.has(id), `cycle through node ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const value of Object.values(p[id].inputs)) {
      if (Array.isArray(value)) {
        assert.ok(Number.isInteger(value[1]) && value[1] >= 0);
        visit(value[0]);
      }
    }
    visiting.delete(id); visited.add(id);
  }
  visit(SUPIR_THUMBNAIL_OUTPUT_NODE);
  assert.equal(visited.size, Object.keys(p).length);
  assert.equal(p["8"].class_type, "SUPIR_decode");
});

test("a missing denoiser or an old SUPIR-only installation cannot appear ready", () => {
  const info = Object.fromEntries(SUPIR_THUMBNAIL_REQUIRED_NODES.map((n) => [n, {}]));
  info.SUPIR_model_loader_v2 = { input: { required: {
    supir_model: [["SUPIR-v0F_fp16.safetensors", "SUPIR-v0Q_fp16.safetensors"]],
  } } };
  info.CheckpointLoaderSimple = { input: { required: {
    ckpt_name: ["COMBO", { options: ["SUPIR-v0F_fp16.safetensors", "sdxl\\AlbedoBaseXL.safetensors"] }],
  } } };
  assert.deepEqual(getSupirThumbnailSupport(info).missingNodes, []);
  assert.deepEqual(getSupirThumbnailSupport(info).sdxlModels, ["sdxl\\AlbedoBaseXL.safetensors"]);
  delete info.ThumbnailDenoise;
  assert.deepEqual(getSupirThumbnailSupport(info).missingNodes, ["ThumbnailDenoise"]);
  assert.ok(getSupirThumbnailSupport({ SUPIR_Upscale: {} }).missingNodes.includes("SUPIR_model_loader_v2"));
});

test("a new upload and selected checkpoints are passed through without reusing another source", () => {
  const a = createSupirThumbnailPrompt({ imageName: "one.jpg" });
  const b = createSupirThumbnailPrompt({ imageName: "two.jpg", supirModel: "custom-f.safetensors", sdxlModel: "other.safetensors" });
  assert.equal(a["1"].inputs.image, "one.jpg");
  assert.equal(b["1"].inputs.image, "two.jpg");
  assert.equal(b["3"].inputs.supir_model, "custom-f.safetensors");
  assert.equal(b["2"].inputs.ckpt_name, "other.safetensors");
  assert.throws(() => createSupirThumbnailPrompt({}), /Eingabebild/);
});
