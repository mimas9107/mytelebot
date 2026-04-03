import { requireAdminSession } from "@/lib/auth/session";
import { getSystemBackupDownload } from "@/lib/system";

function encodeContentDispositionFilename(filename) {
  return encodeURIComponent(filename).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export async function GET(_request, { params }) {
  const user = await requireAdminSession();
  const { filename } = await params;
  const backup = await getSystemBackupDownload(user, filename);
  const encodedFilename = encodeContentDispositionFilename(backup.filename);

  return new Response(backup.buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/x-sqlite3",
      "Content-Length": String(backup.size),
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${backup.filename}"; filename*=UTF-8''${encodedFilename}`
    }
  });
}
