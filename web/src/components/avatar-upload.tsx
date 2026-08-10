"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 2 * 1024 * 1024; // matches the bucket's file_size_limit
const OUTPUT_PX = 512;

/**
 * Profile picture upload.
 *
 * The file is cropped to a centred square and re-encoded to WebP on the client
 * before upload. That is not a nicety: a 6 MB phone photo would be rejected by the
 * bucket's 2 MB limit, and an uncropped portrait renders as a squashed oval inside
 * a round frame.
 *
 * Storage path is `<uid>/avatar-<timestamp>.webp`. The uid prefix is what the
 * bucket policy checks (0012) — change the shape of this path and writes start
 * failing with a policy error.
 */
export function AvatarUpload({
  userId,
  name,
  avatarUrl,
}: {
  userId: string;
  name: string;
  avatarUrl: string | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast();

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  // Optimistic preview so the new picture appears before the server round-trip.
  const [preview, setPreview] = React.useState<string | null>(null);

  const shown = preview ?? avatarUrl;

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast({
        type: "error",
        title: "Not an image",
        description: "Choose a PNG, JPEG or WebP file.",
      });
      return;
    }

    setBusy(true);
    try {
      const blob = await cropToSquareWebp(file);
      if (blob.size > MAX_BYTES) {
        throw new Error("That image is still over 2 MB after compression.");
      }

      const path = `${userId}/avatar-${Date.now()}.webp`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/webp", upsert: true });
      if (uploadErr) throw uploadErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
      if (profileErr) throw profileErr;

      setPreview(publicUrl);
      showToast({ type: "success", title: "Profile picture updated" });
      // The rail reads avatar_url from the SERVER session, so without this the new
      // picture shows here and the old initials stay in the sidebar.
      router.refresh();
    } catch (err) {
      showToast({
        type: "error",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (error) throw error;

      setPreview(null);
      showToast({
        type: "success",
        title: "Profile picture removed",
        description: "Your initials are shown instead.",
      });
      router.refresh();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not remove picture",
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar name={name} src={shown} size="lg" className="size-16" />
        {busy && (
          <span className="bg-navy-900/60 absolute inset-0 flex items-center justify-center rounded-full">
            <Loader2 size={18} className="animate-spin text-white" />
          </span>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="border-border bg-surface hover:bg-surface-subtle shadow-xs flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Camera size={14} strokeWidth={1.75} />
            {shown ? "Change picture" : "Upload picture"}
          </button>

          {shown && (
            <button
              type="button"
              disabled={busy}
              onClick={handleRemove}
              className="text-muted hover:text-loss hover:bg-loss-soft flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} strokeWidth={1.75} />
              Remove
            </button>
          )}
        </div>
        <p className="text-faint mt-1.5 text-[11px]">
          PNG, JPEG or WebP. Cropped to a square and compressed automatically.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

/** Centre-crops to a square and re-encodes at OUTPUT_PX as WebP. */
async function cropToSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_PX;
  canvas.height = OUTPUT_PX;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image in this browser.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, OUTPUT_PX, OUTPUT_PX);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9),
  );
  if (!blob) throw new Error("Could not encode the image.");
  return blob;
}
