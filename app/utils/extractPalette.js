/**
 * extractPalette.js — Canvas-based dominant color extraction
 * 
 * Loads an image into an offscreen canvas, samples pixels,
 * and returns the top 3 dominant colors via simplified k-means.
 * Zero external dependencies.
 */

/**
 * Extract dominant colors from an image URL.
 * @param {string} imageUrl - URL of the image to analyze
 * @param {number} k - Number of color clusters (default 5)
 * @returns {Promise<{primary: string, secondary: string, accent: string, palette: string[]}>}
 */
export async function extractPalette(imageUrl, k = 5) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Downscale to max 100x100 for performance
        const scale = Math.min(1, 100 / Math.max(img.width, img.height));
        const w = Math.floor(img.width * scale);
        const h = Math.floor(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const pixels = [];

        // Sample every 4th pixel to speed up
        for (let i = 0; i < imageData.data.length; i += 16) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];

          // Skip mostly transparent pixels
          if (a < 128) continue;
          // Skip near-black and near-white (they're boring for theming)
          const brightness = (r + g + b) / 3;
          if (brightness < 20 || brightness > 235) continue;

          pixels.push([r, g, b]);
        }

        if (pixels.length < k) {
          resolve(fallbackPalette());
          return;
        }

        const clusters = kMeans(pixels, k, 10);
        // Sort by population (biggest cluster first)
        clusters.sort((a, b) => b.count - a.count);

        const palette = clusters.map(c => rgbToHex(c.center[0], c.center[1], c.center[2]));

        resolve({
          primary: palette[0] || '#39ff14',
          secondary: palette[1] || '#0094ff',
          accent: palette[2] || '#ff00ff',
          palette,
        });
      } catch (err) {
        console.warn('[extractPalette] Canvas analysis failed:', err);
        resolve(fallbackPalette());
      }
    };

    img.onerror = () => {
      console.warn('[extractPalette] Image load failed:', imageUrl);
      resolve(fallbackPalette());
    };

    img.src = imageUrl;
  });
}

function fallbackPalette() {
  return {
    primary: '#39ff14',
    secondary: '#0094ff',
    accent: '#ff00ff',
    palette: ['#39ff14', '#0094ff', '#ff00ff'],
  };
}

/**
 * Simplified k-means clustering on RGB pixel arrays.
 */
function kMeans(pixels, k, maxIterations) {
  // Initialize centroids by picking k random pixels
  const centroids = [];
  const step = Math.floor(pixels.length / k);
  for (let i = 0; i < k; i++) {
    centroids.push([...pixels[i * step]]);
  }

  let assignments = new Array(pixels.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each pixel to nearest centroid
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let j = 0; j < k; j++) {
        const dist = colorDist(pixels[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          minIdx = j;
        }
      }
      assignments[i] = minIdx;
    }

    // Recalculate centroids
    const sums = Array.from({ length: k }, () => [0, 0, 0]);
    const counts = new Array(k).fill(0);

    for (let i = 0; i < pixels.length; i++) {
      const idx = assignments[i];
      sums[idx][0] += pixels[i][0];
      sums[idx][1] += pixels[i][1];
      sums[idx][2] += pixels[i][2];
      counts[idx]++;
    }

    for (let j = 0; j < k; j++) {
      if (counts[j] > 0) {
        centroids[j] = [
          Math.round(sums[j][0] / counts[j]),
          Math.round(sums[j][1] / counts[j]),
          Math.round(sums[j][2] / counts[j]),
        ];
      }
    }
  }

  // Build final clusters with counts
  const counts = new Array(k).fill(0);
  for (const a of assignments) counts[a]++;

  return centroids.map((center, i) => ({ center, count: counts[i] }));
}

function colorDist(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/**
 * Generate CSS theme variables from an extracted palette.
 * @param {object} palette - Output from extractPalette()
 * @returns {object} CSS variable map
 */
export function paletteToThemeVars(palette) {
  const hex = palette.primary;
  // Derive a dark background from the primary color
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return {
    '--theme-primary': hex,
    '--theme-bg': `rgb(${Math.floor(r * 0.08)}, ${Math.floor(g * 0.08)}, ${Math.floor(b * 0.08)})`,
    '--theme-card': `rgba(${Math.floor(r * 0.08)}, ${Math.floor(g * 0.08)}, ${Math.floor(b * 0.08)}, 0.8)`,
    '--theme-text': `rgb(${Math.min(255, r + 180)}, ${Math.min(255, g + 180)}, ${Math.min(255, b + 180)})`,
  };
}
