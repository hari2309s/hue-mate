export const HF_CONFIG = {
  API_URL: 'https://router.huggingface.co/hf-inference/models',
  TOKEN: process.env.HUGGINGFACE_API_KEY,
  MODELS: {
    MASK2FORMER: 'facebook/mask2former-swin-base-coco-panoptic',
    SEGFORMER: 'nvidia/segformer-b0-finetuned-ade-512-512',
  },
  RETRY_DELAY_MS: 20000,
} as const;
