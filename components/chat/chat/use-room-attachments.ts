// Everything the composer's paperclip does: pick files, paste or drop them,
// show the pills, drop one before sending.
//
// Two lists, deliberately NOT one:
//   images: inlined as base64 for multimodal vision (they ride chat.send's
//           `attachments`)
//   pills:  everything else. By default each file is POSTed to the agent's
//           /api/upload (the endpoint the Files tab uses) and referenced BY
//           NAME so the agent file_reads it on the next turn. When the host
//           sets attach.onFiles it gets EVERY file (images too) and replaces
//           that upload: its results become pills and their notes ride the
//           wire text. Images are still inlined either way (routeFiles).
// They take different agent paths, which is why merging them would be a
// regression rather than a tidy-up.

import { computed, ref, toValue, type MaybeRefOrGetter } from "vue";
import { toast } from "vue-sonner";

import { LARGE_FILE_THRESHOLD, uploadViaSignedUrl } from "../lib/upload";
import { DEFAULT_ATTACH_DESTINATION, uploadPathQuery } from "./attach-destinations";
import { blobToBase64, clampImage } from "./image-clamp";
import type { ComposerAction, ComposerState } from "./composer-state";
import type { AttachResult, RoomApi } from "./room-config";

/** Where each file goes. image/* is always inlined as base64 so the model SEES
 *  it, even when the host owns storage: CrimeMiner saves a photo to the case
 *  (onFiles) AND needs vision on it (its 2026-10-19 "where was this taken" demo
 *  failed without the inline copy). With a host, the host gets every file;
 *  without one, non-images go to the agent's workspace upload. */
export function routeFiles(files: File[], hasHost: boolean): { host: File[]; inline: File[]; upload: File[] } {
  const inline = files.filter((f) => f.type.startsWith("image/"));
  if (hasHost) return { host: files, inline, upload: [] };
  return { host: [], inline, upload: files.filter((f) => !f.type.startsWith("image/")) };
}

type LooseRoom = RoomApi<string, object, object, unknown>;

export function useRoomAttachments(opts: {
  /** The AGENT's url + token: a large file bypasses the agent's request cap by
   *  going straight to GCS via a signed URL authenticated as the agent. Read at
   *  upload time, so a refreshed token is always the one used. */
  agent: MaybeRefOrGetter<{ url: string; token: string }>;
  onFiles?: MaybeRefOrGetter<
    ((files: File[], room: LooseRoom) => Promise<AttachResult[]>) | undefined
  >;
  getRoom: () => LooseRoom;
  composer: MaybeRefOrGetter<ComposerState>;
  dispatch: (a: ComposerAction) => void;
}) {
  const { getRoom, dispatch } = opts;
  const images = computed(() => toValue(opts.composer).images);
  const pills = computed(() => toValue(opts.composer).pills);
  const fileInputRef = ref<HTMLInputElement | null>(null);
  // The destination picked from the paperclip's "save to…" menu, remembered
  // between openPicker() (opens the native dialog) and onInputChange() (fires
  // once the user picks).
  const pickerDest = ref<string>(DEFAULT_ATTACH_DESTINATION);

  /** Add a pill from outside the picker. Deduped by path: attaching the same
   *  file twice is a no-op, not a second pill. */
  const attach = (result: AttachResult) =>
    dispatch({
      type: "pill/attached",
      pill: { ...result, id: `att-${Date.now()}-${Math.random()}` },
    });

  const addFiles = (files: FileList | File[], dest: string = DEFAULT_ATTACH_DESTINATION) => {
    // url + token are read HERE, per call: the large-file path signs an upload
    // against the agent, and the token is a 15-minute JWT.
    const { url, token } = toValue(opts.agent);
    const onFiles = toValue(opts.onFiles);
    const route = routeFiles(Array.from(files), !!onFiles);
    if (onFiles && route.host.length) {
      onFiles(route.host, getRoom())
        .then((results) => results.forEach(attach))
        .catch((err) =>
          toast.error(`Upload failed: ${err instanceof Error ? err.message : "network error"}`),
        );
    }
    route.upload.forEach((file) => {
      const uploadId = `upl-${Date.now()}-${Math.random()}`;
      // Optimistic pill so the user sees the upload in flight.
      dispatch({
        type: "pill/added",
        pill: { id: uploadId, label: file.name, size: file.size, uploading: true },
      });
      const markDone = (finalName: string) =>
        dispatch({
          type: "pill/patched",
          id: uploadId,
          patch: { label: finalName, uploaded: finalName, path: `uploads/${finalName}`, uploading: false },
        });
      const markFailed = (err: unknown) => {
        // Remove the pill AND say why: a pill that silently vanished was
        // reported as "the upload did nothing". Same wording as the Files tab.
        dispatch({ type: "pill/removed", id: uploadId });
        toast.error(
          `Upload failed: ${file.name}: ${err instanceof Error ? err.message : "network error"}`,
        );
      };

      if (file.size > LARGE_FILE_THRESHOLD) {
        // Big files can't go through /api/upload (50MB app / ~32MB Cloud Run
        // cap): signed URL + direct-to-GCS PUT, same as the Files tab.
        uploadViaSignedUrl(file, dest, url, token)
          .then(() => markDone(file.name))
          .catch(markFailed);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      fetch(`${url}/api/upload${uploadPathQuery(dest)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`upload failed: ${res.status} ${text}`);
          }
          const data = (await res.json()) as { filename?: string };
          markDone(data.filename || file.name);
        })
        .catch(markFailed);
    });
    route.inline.forEach((file) => {
      // Images: clamp to ≤2048px first (image-clamp.ts: a 12 MB phone photo
      // inline is the likeliest trigger for the model's empty responses),
      // then inline as base64. `path` carries the folder-picker choice to the
      // agent's server-side persist (gateway/rpc.rs persist_inline_attachments).
      clampImage(file)
        .then(async (c) => {
          const { base64, dataUrl } = await blobToBase64(c.blob);
          dispatch({
            type: "image/added",
            image: {
              id: `att-${Date.now()}-${Math.random()}`,
              mimeType: c.mimeType || file.type,
              content: base64,
              preview: dataUrl,
              name: file.name,
              path: dest,
            },
          });
        })
        .catch((err) => console.error("paperclip image attach failed", err));
    });
  };

  /** Open the OS file picker for a chosen destination. */
  const openPicker = (dest: string = DEFAULT_ATTACH_DESTINATION) => {
    pickerDest.value = dest;
    fileInputRef.value?.click();
  };

  const onInputChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files) addFiles(input.files, pickerDest.value);
    input.value = "";
  };

  const handlePaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.items ?? [])
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length > 0) addFiles(files);
  };

  const removeImage = (id: string) => dispatch({ type: "image/removed", id });

  // Removing a pill only unlinks it from THIS message; the file stays on disk
  // (delete it from the Files tab if you want it gone).
  const removePill = (id: string) => dispatch({ type: "pill/removed", id });

  return {
    images,
    pills,
    fileInputRef,
    attach,
    addFiles,
    openPicker,
    onInputChange,
    handlePaste,
    removeImage,
    removePill,
  };
}
