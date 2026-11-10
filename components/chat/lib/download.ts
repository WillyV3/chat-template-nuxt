/** Fetch an agent file with the bearer token and hand it to the browser as a
 *  download. The anchor must be in the document and the blob URL must outlive
 *  the click: revoking synchronously cancels the download in some browsers
 *  (the button "did nothing"). */
export async function downloadAuthed(url: string, token: string, filename: string): Promise<void> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const blobUrl = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
