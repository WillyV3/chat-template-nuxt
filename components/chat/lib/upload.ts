// Shared large-file upload helper.
//
// Files bigger than LARGE_FILE_THRESHOLD can't go through the agent's
// `/api/upload` endpoint — it caps the body at 50 MB and Cloud Run rejects
// requests over ~32 MB. Above the threshold we ask the agent for a V4-signed
// GCS URL and PUT the file directly to the workspace bucket, bypassing Cloud
// Run entirely. Used by both the Files tab and the chat paperclip so either
// entry point handles big evidence files.

// 30 MB keeps a margin under Cloud Run's ~32 MB request cap.
export const LARGE_FILE_THRESHOLD = 30 * 1024 * 1024;

/**
 * Upload a large file directly to the workspace bucket via a V4 signed URL.
 * Asks the agent for the URL, then PUTs the file straight to GCS with progress.
 * Throws with an actionable message on failure.
 */
export async function uploadViaSignedUrl(
  file: File,
  subdir: string,
  agentUrl: string,
  token: string,
  onProgress?: (fraction: number) => void
): Promise<void> {
  const res = await fetch(`${agentUrl}/api/upload/signed-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filename: file.name, subdir }),
  });
  if (!res.ok) {
    let reason = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      reason = body.error || reason;
    } catch {
      // non-JSON error body
    }
    throw new Error(`couldn't get upload URL (${reason})`);
  }
  const { url, required_headers, max_bytes } = (await res.json()) as {
    url: string;
    // Headers baked into the V4 signature (e.g. x-goog-content-length-range) —
    // must be sent verbatim or GCS rejects the PUT. Older agents omit this.
    required_headers?: Record<string, string>;
    max_bytes?: number;
  };
  if (typeof max_bytes === "number" && file.size > max_bytes) {
    const gb = (max_bytes / (1024 * 1024 * 1024)).toFixed(1);
    throw new Error(`file is larger than the ${gb} GB upload limit`);
  }

  // XHR (not fetch) so we get upload progress for the big PUT.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(required_headers ?? {})) {
      xhr.setRequestHeader(k, v);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else
        reject(
          new Error(
            `direct upload rejected (GCS ${xhr.status})${
              xhr.responseText ? `: ${xhr.responseText.slice(0, 160)}` : ""
            }`
          )
        );
    };
    xhr.onerror = () => reject(new Error("network error during direct upload"));
    xhr.send(file);
  });
}
