import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';
import JSZip from 'jszip';
import sample404Animation from '../../assets/404-sample.json';
import { LottieData, UploadedImage } from '../../types/lottie';
import {
  analyzeLottieAssets,
  createLottieEntry,
  emptyDiagnostics,
  formatDuration,
  formatFrameTime,
  getFolderQueueName,
  getFrameRange,
  getZipQueueName,
  imageFilePattern,
  isLottieJson,
  patchAssetReferences,
  previewDiagnosticFiles,
  registerImageAsset,
  removeFileExtension,
  summarizeDiagnostics
} from '../../utils/lottie';
import './LottieUploader.css';

const canvasBackgrounds = {
  light: '#f3f6fa',
  dark: '#0f1624'
};

type CanvasBackground = keyof typeof canvasBackgrounds;

const sampleLottie = createLottieEntry(
  '404 Sample Motion',
  sample404Animation,
  undefined,
  [],
  analyzeLottieAssets(sample404Animation, [])
);

const LottieUploader: React.FC = () => {
  const [lottieFiles, setLottieFiles] = useState<LottieData[]>([sampleLottie]);
  const [currentLottie, setCurrentLottie] = useState<LottieData | null>(sampleLottie);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [shouldLoop, setShouldLoop] = useState(true);
  const [shouldAutoplay, setShouldAutoplay] = useState(false);
  const [canvasBackground, setCanvasBackground] = useState<CanvasBackground>('light');
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const lottieFilesRef = useRef<LottieData[]>([]);
  const shouldLoopRef = useRef(true);

  const frameRange = useMemo(() => getFrameRange(currentLottie?.data), [currentLottie]);
  const frameRate = Number(currentLottie?.data?.fr) || 0;
  const assetCount = currentLottie?.uploadedImages?.length || 0;
  const currentDiagnostics = currentLottie?.diagnostics || emptyDiagnostics;
  const effectiveCanvasBackground = canvasBackgrounds[canvasBackground];

  const activateLottie = useCallback((entry: LottieData, play = shouldAutoplay) => {
    setCurrentLottie(entry);
    setCurrentFrame(0);
    setSpeed(1);
    setShouldLoop(false);
    setIsPlaying(play);

    requestAnimationFrame(() => {
      lottieRef.current?.setSpeed(1);
      if (play) {
        lottieRef.current?.goToAndPlay(0, true);
      } else {
        lottieRef.current?.goToAndStop(0, true);
      }
    });
  }, [shouldAutoplay]);

  const addLottieEntry = useCallback((entry: LottieData, play = shouldAutoplay) => {
    setLottieFiles((prev) => [...prev, entry]);
    activateLottie(entry, play);
  }, [activateLottie, shouldAutoplay]);

  const processFilesAsFolder = useCallback(async (files: File[]) => {
    try {
      const assets = new Map<string, string>();
      const uploadedImages: UploadedImage[] = [];
      let lottieJsonFile: any = null;
      const folderName = getFolderQueueName(files);

      for (const file of files) {
        if (!file.name.endsWith('.json')) continue;

        try {
          const jsonData = JSON.parse(await file.text());
          if (isLottieJson(jsonData)) {
            lottieJsonFile = jsonData;
            break;
          }
        } catch {
          // Ignore JSON files that are not animation payloads.
        }
      }

      if (!lottieJsonFile) {
        alert('在文件夹中未找到有效的 Lottie JSON 文件');
        return;
      }

      files.forEach((file) => {
        if (!imageFilePattern.test(file.name)) return;

        const objectUrl = URL.createObjectURL(file);
        const relativePath = file.webkitRelativePath || file.name;
        uploadedImages.push(registerImageAsset(assets, file.name, relativePath, objectUrl));
      });

      const diagnostics = analyzeLottieAssets(lottieJsonFile, uploadedImages);
      const patchedData = patchAssetReferences(lottieJsonFile, assets);
      addLottieEntry(createLottieEntry(folderName, patchedData, assets, uploadedImages, diagnostics));
    } catch (error) {
      alert(`处理文件夹时出错: ${(error as Error).message}`);
    }
  }, [addLottieEntry]);

  const processZipFile = useCallback(async (file: File) => {
    try {
      const zip = await JSZip.loadAsync(file);
      const assets = new Map<string, string>();
      const uploadedImages: UploadedImage[] = [];
      let lottieJsonFile: any = null;
      const zipFileName = getZipQueueName(file.name);

      for (const filename of Object.keys(zip.files)) {
        if (!filename.endsWith('.json') || filename.includes('__MACOSX')) continue;

        try {
          const jsonData = JSON.parse(await zip.files[filename].async('string'));
          if (isLottieJson(jsonData)) {
            lottieJsonFile = jsonData;
            break;
          }
        } catch {
          // Ignore JSON files that are not animation payloads.
        }
      }

      if (!lottieJsonFile) {
        alert('在压缩包中未找到有效的 Lottie JSON 文件');
        return;
      }

      await Promise.all(Object.keys(zip.files).map(async (filename) => {
        const zipEntry = zip.files[filename];
        if (zipEntry.dir || filename.includes('__MACOSX') || !imageFilePattern.test(filename)) return;

        const blob = await zipEntry.async('blob');
        const objectUrl = URL.createObjectURL(blob);
        const fileName = filename.split('/').pop() || filename;
        uploadedImages.push(registerImageAsset(assets, fileName, filename, objectUrl));
      }));

      const diagnostics = analyzeLottieAssets(lottieJsonFile, uploadedImages);
      const patchedData = patchAssetReferences(lottieJsonFile, assets);
      addLottieEntry(createLottieEntry(zipFileName, patchedData, assets, uploadedImages, diagnostics));
    } catch (error) {
      alert(`处理压缩包时出错: ${(error as Error).message}`);
    }
  }, [addLottieEntry]);

  const processJsonFile = useCallback(async (file: File) => {
    try {
      const lottieData = JSON.parse(await file.text());
      if (!isLottieJson(lottieData)) {
        alert('无法解析 Lottie 文件，请确保是有效的 Lottie JSON');
        return;
      }

      const diagnostics = analyzeLottieAssets(lottieData, []);
      addLottieEntry(createLottieEntry(removeFileExtension(file.name), lottieData, undefined, [], diagnostics));
    } catch {
      alert('无法解析 Lottie 文件，请确保是有效的 JSON 格式');
    }
  }, [addLottieEntry]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const hasJson = acceptedFiles.some((file) => file.name.endsWith('.json'));
    const hasImages = acceptedFiles.some((file) => imageFilePattern.test(file.name));
    const hasZip = acceptedFiles.some((file) => file.name.endsWith('.zip'));

    if (acceptedFiles.length > 1 && hasJson && hasImages && !hasZip) {
      await processFilesAsFolder(acceptedFiles);
      return;
    }

    for (const file of acceptedFiles) {
      const isJson = file.type === 'application/json' || file.name.endsWith('.json');
      const isZip = file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || file.name.endsWith('.zip');

      if (isZip) {
        await processZipFile(file);
      } else if (isJson) {
        await processJsonFile(file);
      }
    }
  }, [processFilesAsFolder, processJsonFile, processZipFile]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'image/svg+xml': ['.svg']
    },
    multiple: true
  });

  useEffect(() => {
    lottieFilesRef.current = lottieFiles;
  }, [lottieFiles]);

  useEffect(() => {
    lottieRef.current?.setSpeed(speed);
  }, [speed, currentLottie]);

  useEffect(() => {
    shouldLoopRef.current = shouldLoop;

    const animationItem = (lottieRef.current as any)?.animationItem;
    if (animationItem) {
      animationItem.loop = shouldLoop;
    }
  }, [shouldLoop, currentLottie]);

  const togglePlay = () => {
    if (!currentLottie) return;

    if (isPlaying) {
      lottieRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (currentFrame >= frameRange.total) {
        lottieRef.current?.goToAndPlay(0, true);
        setCurrentFrame(0);
      } else {
        lottieRef.current?.play();
      }
      setIsPlaying(true);
    }
  };

  const replayAnimation = () => {
    if (!currentLottie) return;
    lottieRef.current?.goToAndPlay(0, true);
    setCurrentFrame(0);
    setIsPlaying(true);
  };

  const handleFrameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const frame = Number(event.target.value);
    setCurrentFrame(frame);
    lottieRef.current?.goToAndStop(frame, true);
    setIsPlaying(false);
  };

  const handleSelectFolder = () => {
    folderInputRef.current?.click();
  };

  const handleFolderInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      await processFilesAsFolder(files);
    }
    event.target.value = '';
  };

  const handleDelete = (id: string) => {
    const lottieToDelete = lottieFiles.find((lottie) => lottie.id === id);
    new Set(lottieToDelete?.assets?.values()).forEach((url) => URL.revokeObjectURL(url));

    const remainingFiles = lottieFiles.filter((lottie) => lottie.id !== id);
    setLottieFiles(remainingFiles);

    if (currentLottie?.id === id) {
      const nextLottie = remainingFiles[0] || null;
      if (nextLottie) {
        activateLottie(nextLottie, false);
      } else {
        setCurrentLottie(null);
        setCurrentFrame(0);
        setIsPlaying(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      lottieFilesRef.current.forEach((lottie) => {
        new Set(lottie.assets?.values()).forEach((url) => URL.revokeObjectURL(url));
      });
    };
  }, []);

  return (
    <main className="lottie-uploader">
      <input
        ref={folderInputRef}
        className="folder-input"
        type="file"
        multiple
        onChange={handleFolderInput}
        {...({ webkitdirectory: '', directory: '' } as any)}
      />

      <section className="left-rail" aria-label="Lottie asset panel">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 44 44" fill="none">
              <rect x="13" y="4.5" width="18" height="35" rx="5.5" fill="#111827" />
              <rect x="15" y="8" width="14" height="28" rx="3" fill="#F8FBFF" />
              <rect x="19" y="6.5" width="6" height="2" rx="1" fill="#050914" />
              <path d="M18 27.5c3.3-8.2 10.3-3.8 9.6-10.5" stroke="#2D7FF9" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="18" cy="27.5" r="2.4" fill="#24A898" />
              <circle cx="27.5" cy="17" r="2.4" fill="#2D7FF9" />
              <rect x="19.5" y="33.5" width="5" height="1.3" rx="0.65" fill="#C9D4E2" />
            </svg>
          </span>
          <div>
            <h1>Lottie Preview</h1>
            <p>Local mobile motion bench</p>
          </div>
        </div>

        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <div className="dropzone-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 4v11m0-11 4 4m-4-4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 15v2.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <p className="dropzone-title">{isDragActive ? '释放后开始解析' : '拖入 JSON、ZIP 或资源文件夹'}</p>
          <p className="dropzone-copy">本地解析动画与图片资源，不上传到服务器。</p>
        </div>

        <div className="upload-actions">
          <button type="button" onClick={handleSelectFolder}>选择文件夹</button>
          <button type="button" onClick={open}>选择文件</button>
        </div>

        <div className="queue-panel">
          <div className="queue-header">
            <span>Queue</span>
            <strong>{lottieFiles.length}</strong>
          </div>

          <div className="file-list">
            {lottieFiles.length === 0 ? (
              <div className="empty-queue">等待载入动画</div>
            ) : (
              lottieFiles.map((lottie) => (
                <div
                  key={lottie.id}
                  className={`file-item ${currentLottie?.id === lottie.id ? 'active' : ''}`}
                  onClick={() => activateLottie(lottie, false)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      activateLottie(lottie, false);
                    }
                  }}
                >
                  <span className="file-index">{String(lottieFiles.indexOf(lottie) + 1).padStart(2, '0')}</span>
                  <span className="file-meta">
                    <strong>{lottie.name}</strong>
                    <small>
                      {formatDuration(lottie.data)} · {Math.round(Number(lottie.data?.fr) || 0)}fps
                      {lottie.diagnostics.warningCount > 0 ? ` · WARN ${lottie.diagnostics.warningCount}` : ''}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="delete-btn"
                    aria-label={`删除 ${lottie.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(lottie.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDelete(lottie.id);
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="stage-shell" aria-label="Lottie preview stage">
        <div className="stage-topbar">
          <div>
            <span className="eyebrow">375 × 812 iPhone canvas</span>
            <h2>{currentLottie?.name || 'Ready for preview'}</h2>
          </div>
          <div className="status-strip">
            <span>{frameRange.total} frames</span>
            <span>{assetCount} assets</span>
            {currentDiagnostics.warningCount > 0 && (
              <span className="warning-pill">WARN {currentDiagnostics.warningCount}</span>
            )}
            <span className="playback-pill">{isPlaying ? 'Playing' : 'Paused'}</span>
          </div>
        </div>

        {currentLottie && currentDiagnostics.warningCount > 0 && (
          <div className="audit-banner" role="status">
            <div>
              <strong>素材检查</strong>
              <span>{summarizeDiagnostics(currentDiagnostics)}</span>
            </div>
            <small>{previewDiagnosticFiles(currentDiagnostics)}</small>
          </div>
        )}

        <div className="phone-stage">
          <div className="phone-frame">
            <div className="phone-island" aria-hidden="true" />
            <div className="phone-status" aria-hidden="true">
              <span>9:41</span>
              <span className="status-dots">● ● ●</span>
            </div>
            <div
              className="lottie-wrapper"
              style={{ '--canvas-background': effectiveCanvasBackground } as React.CSSProperties}
            >
              {currentLottie ? (
                <Lottie
                  key={currentLottie.id}
                  lottieRef={lottieRef}
                  animationData={currentLottie.data}
                  loop={shouldLoop}
                  autoplay={isPlaying}
                  className="lottie-animation"
                  onEnterFrame={() => {
                    const animationItem = (lottieRef.current as any)?.animationItem;
                    if (!animationItem) return;

                    const rawFrame = Math.max(0, Math.round(animationItem.currentFrame));
                    const nextFrame = shouldLoopRef.current && frameRange.total > 0
                      ? rawFrame % frameRange.total
                      : rawFrame;
                    setCurrentFrame(Math.min(nextFrame, frameRange.total));
                  }}
                  onComplete={() => {
                    if (shouldLoopRef.current) {
                      lottieRef.current?.goToAndPlay(0, true);
                    } else {
                      setCurrentFrame(frameRange.total);
                      setIsPlaying(false);
                    }
                  }}
                />
              ) : (
                <div className="empty-state">
                  <span className="empty-code">drop</span>
                  <p>载入 Lottie JSON、ZIP 或导出文件夹后在这里预览。</p>
                </div>
              )}
            </div>
            <div className="home-indicator" aria-hidden="true" />
          </div>
        </div>

        <div className="transport">
          <div className="transport-buttons" aria-label="Playback controls">
            <button type="button" className="icon-btn" onClick={togglePlay} disabled={!currentLottie} title={isPlaying ? '暂停' : '播放'}>
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 11 7-11 7z" /></svg>
              )}
            </button>
            <button type="button" className="icon-btn secondary" onClick={replayAnimation} disabled={!currentLottie} title="重播">
              <svg viewBox="0 0 24 24" fill="none"><path d="M5 9a7 7 0 1 1 1.4 8.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /><path d="M5 4v5h5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>

          <div className="timeline">
            <div className="timeline-labels">
              <span>
                {currentFrame}f
                <small>{formatFrameTime(currentFrame, frameRate)}</small>
              </span>
              <span>
                {frameRange.total}f
                <small>{formatFrameTime(frameRange.total, frameRate)}</small>
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={frameRange.total}
              value={Math.min(currentFrame, frameRange.total)}
              onChange={handleFrameChange}
              className="frame-slider"
              disabled={!currentLottie}
              style={{ '--progress': `${frameRange.total ? (currentFrame / frameRange.total) * 100 : 0}%` } as React.CSSProperties}
            />
          </div>

          <div className="speed-controls" aria-label="Playback speed">
            {[0.5, 1, 1.5, 2].map((value) => (
              <button
                type="button"
                key={value}
                className={speed === value ? 'active' : ''}
                onClick={() => setSpeed(value)}
                disabled={!currentLottie}
              >
                {value}x
              </button>
            ))}
          </div>

          <label className="loop-toggle">
            <input
              type="checkbox"
              checked={shouldLoop}
              onChange={(event) => setShouldLoop(event.target.checked)}
              disabled={!currentLottie}
            />
            <span>循环</span>
          </label>

          <label className="loop-toggle">
            <input
              type="checkbox"
              checked={shouldAutoplay}
              onChange={(event) => setShouldAutoplay(event.target.checked)}
            />
            <span>自动播放</span>
          </label>

          <div className="canvas-background" aria-label="Canvas background">
            <span>背景</span>
            <button
              type="button"
              className={canvasBackground === 'light' ? 'active' : ''}
              onClick={() => setCanvasBackground('light')}
              title="#f3f6fa"
            >
              白
            </button>
            <button
              type="button"
              className={canvasBackground === 'dark' ? 'active' : ''}
              onClick={() => setCanvasBackground('dark')}
              title="#0f1624"
            >
              黑
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default LottieUploader;
