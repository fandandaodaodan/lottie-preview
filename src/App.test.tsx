import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import { analyzeLottieAssets, formatFrameTime, getFolderQueueName, getZipQueueName } from './LottieUploader';

jest.mock('lottie-react', () => ({
  __esModule: true,
  default: () => <div data-testid="lottie-player" />
}));

test('renders the lottie preview workspace', () => {
  render(<App />);

  expect(screen.getByText(/Lottie Preview/i)).toBeInTheDocument();
  expect(screen.getByText(/375 × 812 mobile canvas/i)).toBeInTheDocument();
});

test('reports unused uploaded and declared lottie image assets', () => {
  const diagnostics = analyzeLottieAssets({
    layers: [
      { refId: 'comp_1' }
    ],
    assets: [
      {
        id: 'comp_1',
        layers: [
          { refId: 'image_0' }
        ]
      },
      { id: 'image_0', p: 'used.png', u: 'images/' },
      { id: 'image_1', p: 'declared-but-unused.png', u: 'images/' }
    ]
  }, [
    { name: 'used.png', path: 'images/used.png', keys: ['used.png', 'images/used.png'] },
    { name: 'extra.png', path: 'images/extra.png', keys: ['extra.png', 'images/extra.png'] }
  ]);

  expect(diagnostics.unusedUploadedImages).toEqual(['images/extra.png']);
  expect(diagnostics.unusedDeclaredImages).toEqual(['declared-but-unused.png']);
  expect(diagnostics.missingUsedImages).toEqual([]);
  expect(diagnostics.warningCount).toBe(2);
});

test('uses archive and folder names for queue labels', () => {
  const zipName = getZipQueueName('campaign-motion.zip');
  const folderName = getFolderQueueName([
    {
      name: 'animation.json',
      webkitRelativePath: 'landing-banner/animation.json'
    } as File
  ]);
  const dropzoneFolderName = getFolderQueueName([
    {
      name: 'animation.json',
      path: 'launch-card/animation.json'
    } as unknown as File
  ]);

  expect(zipName).toBe('campaign-motion');
  expect(folderName).toBe('landing-banner');
  expect(dropzoneFolderName).toBe('launch-card');
});

test('converts frames to seconds for timeline labels', () => {
  expect(formatFrameTime(45, 30)).toBe('1.500s');
  expect(formatFrameTime(0, 30)).toBe('0.000s');
});
