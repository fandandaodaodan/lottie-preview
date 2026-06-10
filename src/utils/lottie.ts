import { LottieData, LottieDiagnostics, UploadedImage } from '../types/lottie';

export const imageFilePattern = /\.(png|jpg|jpeg|gif|webp|svg)$/i;

export const isLottieJson = (data: any) =>
  data && data.v && data.fr && data.ip !== undefined && data.op !== undefined && Array.isArray(data.layers);

export const removeFileExtension = (fileName: string) => fileName.replace(/\.[^/.]+$/, '');

export const getZipQueueName = (fileName: string) => removeFileExtension(fileName.split('/').pop() || fileName);

export const getFolderQueueName = (files: File[]) => {
  const firstFile = files[0];
  if (!firstFile) return '本地文件夹';

  const rawPath = (firstFile.webkitRelativePath || (firstFile as any).path || firstFile.name).replace(/\\/g, '/').replace(/^\.?\//, '');
  const firstPart = rawPath.split('/')[0];

  return firstPart ? removeFileExtension(firstPart) : '本地文件夹';
};

export const getFrameRange = (data: any) => {
  const start = Math.round(Number(data?.ip) || 0);
  const end = Math.round(Number(data?.op) || 0);
  return {
    start,
    end,
    total: Math.max(0, end - start)
  };
};

export const formatDuration = (data: any) => {
  const { total } = getFrameRange(data);
  const frameRate = Number(data?.fr) || 0;
  if (!total || !frameRate) return '0.0s';
  return `${(total / frameRate).toFixed(1)}s`;
};

export const formatFrameTime = (frame: number, frameRate: number) => {
  if (!frameRate) return '0.000s';

  return `${(Math.max(0, frame) / frameRate).toFixed(3)}s`;
};

const normalizeAssetKey = (value = '') => value.replace(/\\/g, '/').replace(/^\.?\//, '');

export const uniqueValues = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const getAssetKeys = (assetPath: string, assetBase = '') => {
  const normalizedPath = normalizeAssetKey(assetPath);
  const normalizedBase = normalizeAssetKey(assetBase);
  const fullPath = normalizeAssetKey(`${normalizedBase}${normalizedPath}`);
  return uniqueValues([assetPath, normalizedPath, fullPath, normalizedPath.split('/').pop() || assetPath]);
};

const isEmbeddedOrRemoteAsset = (assetPath = '') => /^(data:|https?:|blob:)/i.test(assetPath);

export const emptyDiagnostics: LottieDiagnostics = {
  unusedUploadedImages: [],
  unusedDeclaredImages: [],
  missingUsedImages: [],
  warningCount: 0
};

export const createLottieEntry = (
  name: string,
  data: any,
  assets?: Map<string, string>,
  uploadedImages: UploadedImage[] = [],
  diagnostics = emptyDiagnostics
): LottieData => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name,
  data,
  assets,
  uploadedImages,
  diagnostics
});

export const registerImageAsset = (assets: Map<string, string>, fileName: string, filePath: string, objectUrl: string): UploadedImage => {
  const normalizedPath = normalizeAssetKey(filePath);
  const pathWithoutRoot = normalizedPath.split('/').slice(1).join('/');
  const keys = uniqueValues([...getAssetKeys(fileName), normalizedPath, pathWithoutRoot]);

  keys.forEach((key) => assets.set(key, objectUrl));

  return {
    name: fileName,
    path: pathWithoutRoot || normalizedPath || fileName,
    keys
  };
};

const collectReachableImageAssetIds = (data: any) => {
  const assetById = new Map<string, any>((data?.assets || []).filter((asset: any) => asset.id).map((asset: any) => [asset.id, asset]));
  const usedImageIds = new Set<string>();
  const visitedComps = new Set<string>();

  const visitLayers = (layers: any[] = []) => {
    layers.forEach((layer) => {
      if (!layer?.refId) return;

      const asset = assetById.get(layer.refId);
      if (!asset) return;

      if (Array.isArray(asset.layers)) {
        if (visitedComps.has(layer.refId)) return;
        visitedComps.add(layer.refId);
        visitLayers(asset.layers);
      } else {
        usedImageIds.add(layer.refId);
      }
    });
  };

  visitLayers(data?.layers || []);
  return usedImageIds;
};

export const analyzeLottieAssets = (data: any, uploadedImages: UploadedImage[]): LottieDiagnostics => {
  const usedImageIds = collectReachableImageAssetIds(data);
  const imageAssets = (data?.assets || []).filter((asset: any) => asset?.id && asset.p && !Array.isArray(asset.layers));
  const usedImageAssets = imageAssets.filter((asset: any) => usedImageIds.has(asset.id));
  const usedImageKeys = new Set<string>();
  const uploadedImageKeys = new Set<string>();

  usedImageAssets.forEach((asset: any) => {
    getAssetKeys(asset.p, asset.u).forEach((key) => usedImageKeys.add(key));
  });

  uploadedImages.forEach((image) => {
    image.keys.forEach((key) => uploadedImageKeys.add(key));
  });

  const unusedUploadedImages = uploadedImages
    .filter((image) => !image.keys.some((key) => usedImageKeys.has(key)))
    .map((image) => image.path);

  const unusedDeclaredImages = imageAssets
    .filter((asset: any) => !usedImageIds.has(asset.id))
    .map((asset: any) => asset.p);

  const missingUsedImages = uploadedImages.length === 0 ? [] : usedImageAssets
    .filter((asset: any) => !isEmbeddedOrRemoteAsset(asset.p))
    .filter((asset: any) => !getAssetKeys(asset.p, asset.u).some((key) => uploadedImageKeys.has(key)))
    .map((asset: any) => asset.p);

  const warningCount = unusedUploadedImages.length + unusedDeclaredImages.length + missingUsedImages.length;

  return {
    unusedUploadedImages,
    unusedDeclaredImages,
    missingUsedImages,
    warningCount
  };
};

export const patchAssetReferences = (lottieJsonFile: any, assets: Map<string, string>) => {
  if (!Array.isArray(lottieJsonFile.assets)) return lottieJsonFile;

  return {
    ...lottieJsonFile,
    assets: lottieJsonFile.assets.map((asset: any) => {
      if (!asset.p) return asset;

      const matchedKey = getAssetKeys(asset.p, asset.u).find((key) => assets.has(key));
      if (!matchedKey) return asset;

      return {
        ...asset,
        u: '',
        p: assets.get(matchedKey)
      };
    })
  };
};

export const summarizeDiagnostics = (diagnostics: LottieDiagnostics) => uniqueValues([
  diagnostics.unusedUploadedImages.length > 0 ? `冗余图片 ${diagnostics.unusedUploadedImages.length} 个` : '',
  diagnostics.unusedDeclaredImages.length > 0 ? `未使用 asset ${diagnostics.unusedDeclaredImages.length} 个` : '',
  diagnostics.missingUsedImages.length > 0 ? `缺失引用 ${diagnostics.missingUsedImages.length} 个` : ''
]).join(' · ');

export const previewDiagnosticFiles = (diagnostics: LottieDiagnostics) => [
  ...diagnostics.unusedUploadedImages,
  ...diagnostics.unusedDeclaredImages,
  ...diagnostics.missingUsedImages
].slice(0, 3).join(' / ');
