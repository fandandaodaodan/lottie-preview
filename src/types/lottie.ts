export interface LottieData {
  id: string;
  name: string;
  data: any;
  assets?: Map<string, string>;
  uploadedImages?: UploadedImage[];
  diagnostics: LottieDiagnostics;
}

export interface UploadedImage {
  name: string;
  path: string;
  keys: string[];
}

export interface LottieDiagnostics {
  unusedUploadedImages: string[];
  unusedDeclaredImages: string[];
  missingUsedImages: string[];
  warningCount: number;
}
