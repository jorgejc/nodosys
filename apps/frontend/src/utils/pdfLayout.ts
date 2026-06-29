/**
 * Institutional PDF layout utility.
 * Loads the IU Digital header and footer images and applies them
 * to every page of a jsPDF document.
 */
import type jsPDF from 'jspdf';
import headerUrl from '@/assets/iudigital-header.png';
import footerUrl from '@/assets/iudigital-footer.png';

export interface ImageAsset {
  dataUrl: string;
  w: number;
  h: number;
}

export interface InstitutionalAssets {
  header: ImageAsset;
  footer: ImageAsset;
}

export interface PdfMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function loadImageAsset(url: string): Promise<ImageAsset> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas 2d not available')); return; }
      ctx.drawImage(img, 0, 0);
      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        w: img.naturalWidth,
        h: img.naturalHeight,
      });
    };
    img.onerror = () => reject(new Error(`Failed to load: ${url}`));
    img.src = url;
  });
}

/** Load both institutional images. Call once before generating a PDF. */
export async function loadInstitutionalAssets(): Promise<InstitutionalAssets> {
  const [header, footer] = await Promise.all([
    loadImageAsset(headerUrl),
    loadImageAsset(footerUrl),
  ]);
  return { header, footer };
}

/**
 * Calculate top/bottom margins so body content never overlaps the images.
 * pageWidthMM defaults to 210 (A4).
 */
export function getInstitutionalMargins(
  assets: InstitutionalAssets,
  pageWidthMM = 210,
): PdfMargins {
  const headerH = (assets.header.h / assets.header.w) * pageWidthMM;
  const footerH = (assets.footer.h / assets.footer.w) * pageWidthMM;
  return {
    top:    Math.ceil(headerH) + 5,   // image height + gap
    bottom: Math.ceil(footerH) + 6,   // image height + gap + space for page number
    left:   15,
    right:  15,
  };
}

/**
 * Stamp the institutional header/footer on every page of `doc`.
 * Must be called AFTER all content is written.
 */
export function applyInstitutionalLayout(
  doc: jsPDF,
  assets: InstitutionalAssets,
): void {
  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const headerH = (assets.header.h / assets.header.w) * pageW;
  const footerH = (assets.footer.h / assets.footer.w) * pageW;
  const n = doc.getNumberOfPages();

  for (let i = 1; i <= n; i++) {
    doc.setPage(i);

    // Header — full page width, top of page
    doc.addImage(assets.header.dataUrl, 'PNG', 0, 0, pageW, headerH);

    // Footer — full page width, bottom of page
    doc.addImage(assets.footer.dataUrl, 'PNG', 0, pageH - footerH, pageW, footerH);

    // Page number just above the footer image
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Página ${i} de ${n}`,
      pageW - 16,
      pageH - footerH - 1.5,
      { align: 'right' },
    );
    doc.setTextColor(0, 0, 0);
  }
}
