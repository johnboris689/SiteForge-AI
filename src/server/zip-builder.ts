import JSZip from 'jszip';
import { getProjectFullDetails, createNotification, createAuditLog } from '../db/repository.ts';
import { db } from '../db/index.ts';
import { downloads, generatedFiles } from '../db/schema.ts';
import { eq, asc } from 'drizzle-orm';

export async function buildProjectZipArchive(
  projectId: number,
  userId: number,
  downloadType: 'FULL_ZIP' | 'SOURCE_ONLY' | 'ASSETS_ONLY' = 'FULL_ZIP',
  versionId?: number,
  recordDownload = true
): Promise<{ buffer: Buffer; fileName: string; fileCount: number }> {
  const details = await getProjectFullDetails(projectId);
  if (!details) {
    throw new Error('Project not found.');
  }

  let targetFiles = details.files;
  if (versionId) {
    targetFiles = await db
      .select()
      .from(generatedFiles)
      .where(eq(generatedFiles.versionId, versionId))
      .orderBy(asc(generatedFiles.filePath));
  }

  const zip = new JSZip();
  let fileCount = 0;

  if (downloadType === 'FULL_ZIP' || downloadType === 'SOURCE_ONLY') {
    for (const file of targetFiles) {
      if (downloadType === 'SOURCE_ONLY' && file.filePath.startsWith('public/snapshots/')) {
        continue;
      }
      zip.file(file.filePath, file.content);
      fileCount++;
    }

    if (details.latestVersion?.previewHtml) {
      zip.file('preview/standalone-preview.html', details.latestVersion.previewHtml);
      fileCount++;
    }
  }

  if (downloadType === 'FULL_ZIP' || downloadType === 'ASSETS_ONLY') {
    for (const asset of details.assets) {
      if (asset.contentBase64) {
        try {
          zip.file(asset.localPath, Buffer.from(asset.contentBase64, 'base64'));
          fileCount++;
          continue;
        } catch {
          // Fall back to text content if a legacy record contains invalid base64.
        }
      }
      if (asset.contentText) {
        zip.file(asset.localPath, asset.contentText);
        fileCount++;
      }
    }
    if (details.analysis?.summaryReportMd) {
      zip.file('ANALYSIS_REPORT.md', details.analysis.summaryReportMd);
      fileCount++;
    }
  }

  if (fileCount === 0) {
    throw new Error('ZIP generation failed: No generated files or extracted assets available for this archive mode.');
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  if (!buffer || buffer.byteLength < 22) {
    throw new Error('ZIP validation failed: Generated archive buffer is invalid or empty.');
  }

  const safeSlug = details.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `project-${projectId}`;
  const suffix = downloadType === 'SOURCE_ONLY' ? '-source' : downloadType === 'ASSETS_ONLY' ? '-assets' : '';
  const fileName = `${safeSlug}${suffix}.zip`;

  if (recordDownload) {
    await db.insert(downloads).values({
      projectId,
      userId,
      downloadType,
      fileName,
      fileSizeBytes: buffer.byteLength,
    });

    await createNotification(
      userId,
      'ZIP Archive Ready',
      `Generated and validated ${fileName} (${(buffer.byteLength / 1024).toFixed(1)} KB, ${fileCount} files).`,
      'info'
    );

    await createAuditLog({
      userId,
      projectId,
      action: `DOWNLOAD_${downloadType}`,
      status: 'success',
      details: `Exported ${fileName} (${buffer.byteLength} bytes)`,
    });
  }

  return { buffer, fileName, fileCount };
}
