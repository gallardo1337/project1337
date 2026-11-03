export const DEFAULT_THUMBNAIL_ENHANCEMENT = "supir";
export const SUPIR_THUMBNAIL_OUTPUT_NODE = "10";
export const SUPIR_THUMBNAIL_REQUIRED_NODES = Object.freeze([
  "LoadImage", "CheckpointLoaderSimple", "SUPIR_model_loader_v2",
  "ImageScale", "SUPIR_first_stage", "SUPIR_conditioner",
  "SUPIR_sample", "SUPIR_decode", "ThumbnailDenoise", "SaveImage",
]);

function choices(input) {
  return Array.isArray(input?.[0]) ? input[0] : input?.[1]?.options || [];
}

export function getSupirThumbnailSupport(nodeInfo) {
  const checkpoints = choices(
    nodeInfo.SUPIR_model_loader_v2?.input?.required?.supir_model
  );
  return {
    missingNodes: SUPIR_THUMBNAIL_REQUIRED_NODES.filter((name) => !nodeInfo[name]),
    supirModels: checkpoints.filter((name) => /supir/i.test(name)),
    sdxlModels: choices(
      nodeInfo.CheckpointLoaderSimple?.input?.required?.ckpt_name
    ).filter((name) => !/supir/i.test(name)),
  };
}

export function createSupirThumbnailPrompt({
  imageName,
  supirModel = "SUPIR-v0F_fp16.safetensors",
  sdxlModel = "sdxl\\AlbedoBaseXL.safetensors",
}) {
  if (!imageName || typeof imageName !== "string") {
    throw new Error("Für die Restaurierung fehlt das Eingabebild.");
  }
  // Same profile as the approved 1920x1080 ComfyUI comparison.
  return {
    "1": { class_type: "LoadImage", inputs: { image: imageName } },
    "2": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: sdxlModel } },
    "3": {
      class_type: "SUPIR_model_loader_v2",
      inputs: {
        model: ["2", 0], clip: ["2", 1], vae: ["2", 2],
        supir_model: supirModel, fp8_unet: false,
        diffusion_dtype: "bf16", high_vram: false,
      },
    },
    "4": {
      class_type: "ImageScale",
      inputs: {
        image: ["1", 0], upscale_method: "lanczos",
        width: 1920, height: 1088, crop: "disabled",
      },
    },
    "5": {
      class_type: "SUPIR_first_stage",
      inputs: {
        SUPIR_VAE: ["3", 1], image: ["4", 0], use_tiled_vae: true,
        encoder_tile_size: 512, decoder_tile_size: 512, encoder_dtype: "bf16",
      },
    },
    "6": {
      class_type: "SUPIR_conditioner",
      inputs: {
        SUPIR_model: ["3", 0], latents: ["5", 2],
        positive_prompt: "sharp focus, crisp clean edges, detailed photograph, natural skin texture, clear hair strands, accurate facial features, smooth tonal transitions, original composition",
        negative_prompt: "blurry, motion blur, double edges, jpeg artifacts, grain, oversharpened halos, distorted faces, deformed anatomy, painting, cartoon",
      },
    },
    "7": {
      class_type: "SUPIR_sample",
      inputs: {
        SUPIR_model: ["3", 0], latents: ["5", 2],
        positive: ["6", 0], negative: ["6", 1], seed: 1337, steps: 40,
        cfg_scale_start: 3, cfg_scale_end: 6, EDM_s_churn: 5, s_noise: 1.02,
        DPMPP_eta: 1, control_scale_start: 0.93, control_scale_end: 0.93,
        restore_cfg: -1, keep_model_loaded: false,
        sampler: "TiledRestoreEDMSampler",
        sampler_tile_size: 1024, sampler_tile_stride: 512,
      },
    },
    "8": {
      class_type: "SUPIR_decode",
      inputs: {
        SUPIR_VAE: ["5", 0], latents: ["7", 0],
        use_tiled_vae: true, decoder_tile_size: 512, decoder_dtype: "bf16",
      },
    },
    "9": {
      class_type: "ImageScale",
      inputs: {
        image: ["8", 0], upscale_method: "lanczos",
        width: 1920, height: 1080, crop: "disabled",
      },
    },
    "10": {
      class_type: "SaveImage",
      inputs: { images: ["11", 0], filename_prefix: "my1337-supir-restored-clean" },
    },
    "11": {
      class_type: "ThumbnailDenoise",
      inputs: { image: ["9", 0], strength: 0.65 },
    },
  };
}
