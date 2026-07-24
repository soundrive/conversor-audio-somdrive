/**
 * Utility for parsing EXIF orientation tags from JPEG image headers
 */

export interface ExifTransform {
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
}

/**
 * Extracts EXIF Orientation Tag (1-8) from JPEG File ArrayBuffer
 */
export async function getExifOrientation(file: File): Promise<number> {
  if (!file.type.includes("jpeg") && !file.type.includes("jpg") && !file.name.match(/\.(jpg|jpeg)$/i)) {
    return 1; // Default normal for non-JPEG
  }

  try {
    // Read first 128KB which contains EXIF APP1 metadata
    const slice = file.slice(0, 128 * 1024);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);

    if (view.getUint16(0, false) !== 0xffd8) {
      return 1; // Not a valid JPEG
    }

    const length = view.byteLength;
    let offset = 2;

    while (offset < length) {
      if (view.getUint16(offset + 2, false) <= 8) break;
      const marker = view.getUint16(offset, false);
      offset += 2;

      // APP1 Marker (0xFFE1)
      if (marker === 0xffe1) {
        if (view.getUint32(offset + 2, false) !== 0x45786966) {
          return 1; // Not "Exif"
        }

        const little = view.getUint16(offset + 8, false) === 0x4949;
        offset += 8;

        const tags = view.getUint16(offset + 2, little);
        offset += 4;

        for (let i = 0; i < tags; i++) {
          if (view.getUint16(offset + i * 12, little) === 0x0112) {
            return view.getUint16(offset + i * 12 + 8, little);
          }
        }
      } else if ((marker & 0xff00) !== 0xff00) {
        break;
      } else {
        offset += view.getUint16(offset, false);
      }
    }
  } catch (err) {
    console.warn("Could not parse EXIF orientation tag:", err);
  }

  return 1;
}

/**
 * Maps EXIF Orientation (1-8) to rotation and flip state
 */
export function exifOrientationToTransform(orientation: number): ExifTransform {
  switch (orientation) {
    case 2:
      return { rotation: 0, flipH: true, flipV: false };
    case 3:
      return { rotation: 180, flipH: false, flipV: false };
    case 4:
      return { rotation: 0, flipH: false, flipV: true };
    case 5:
      return { rotation: 270, flipH: true, flipV: false };
    case 6:
      return { rotation: 90, flipH: false, flipV: false };
    case 7:
      return { rotation: 90, flipH: true, flipV: false };
    case 8:
      return { rotation: 270, flipH: false, flipV: false };
    case 1:
    default:
      return { rotation: 0, flipH: false, flipV: false };
  }
}
