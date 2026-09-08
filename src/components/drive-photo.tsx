import { useEffect, useState } from "react";
import { fetchKsImage } from "@/lib/drive.functions";
import { driveThumbUrl } from "@/lib/ks-drive";
import { fileHref } from "@/lib/plads-file";
import { isSupabaseFile, sbFileSrc } from "@/lib/supabase";
import type { KsPhoto } from "@/lib/types";

const mem = new Map<string, string>();

export function DrivePhoto({
  photo,
  className = "w-full object-cover",
  compact = false,
}: {
  photo: KsPhoto;
  className?: string;
  compact?: boolean;
}) {
  const fileId = photo.driveFileId;
  const supabaseSrc = isSupabaseFile(fileId) || isSupabaseFile(photo.dataUrl)
    ? (sbFileSrc(fileId) || sbFileSrc(photo.dataUrl) || (fileId?.startsWith("http") ? fileId : "") || (photo.dataUrl?.startsWith("http") ? photo.dataUrl : ""))
    : "";
  const href = supabaseSrc || fileHref(photo.driveUrl) || fileHref(fileId) || undefined;
  const thumbUrl = supabaseSrc || (fileId ? driveThumbUrl(fileId) : "");
  const [src, setSrc] = useState(photo.dataUrl || supabaseSrc || (fileId && mem.get(fileId)) || "");
  const [fail, setFail] = useState(false);
  const [busy, setBusy] = useState(!src && Boolean(fileId));

  useEffect(() => {
    if (photo.dataUrl) {
      setSrc(photo.dataUrl);
      setFail(false);
      setBusy(false);
      return;
    }
    if (supabaseSrc) {
      setSrc(supabaseSrc);
      setFail(false);
      setBusy(false);
      return;
    }
    if (!fileId) {
      setBusy(false);
      return;
    }
    const cached = mem.get(fileId);
    if (cached) {
      setSrc(cached);
      setFail(false);
      setBusy(false);
      return;
    }
    setBusy(true);
    setFail(false);
    let live = true;
    void fetchKsImage({ data: { fileId } })
      .then((res) => {
        if (!live) return;
        setBusy(false);
        if (res.dataUrl) {
          mem.set(fileId, res.dataUrl);
          setSrc(res.dataUrl);
          setFail(false);
        } else if (compact && thumbUrl) {
          setSrc(thumbUrl);
          setFail(false);
        } else {
          setFail(true);
        }
      })
      .catch(() => {
        if (!live) return;
        setBusy(false);
        if (compact && thumbUrl) {
          setSrc(thumbUrl);
          setFail(false);
        } else {
          setFail(true);
        }
      });
    return () => {
      live = false;
    };
  }, [fileId, photo.dataUrl, compact, thumbUrl, supabaseSrc]);

  if (busy && !src) {
    return compact ? (
      <div className={`bg-paper ${className}`} />
    ) : (
      <div className={`flex min-h-16 items-center justify-center bg-gray-100 text-xs text-gray-500 ${className}`}>Henter foto…</div>
    );
  }
  if (!src || fail) {
    if (compact) {
      if (thumbUrl) {
        return <img src={thumbUrl} alt="" className={className} referrerPolicy="no-referrer" />;
      }
      return <span className={`block bg-paper ${className}`} />;
    }
    return href ? (
      <a href={href} target="_blank" rel="noreferrer" className={`flex min-h-32 items-center justify-center bg-gray-100 p-3 text-center text-sm text-gray-600 ${className}`}>
        Åbn foto
      </a>
    ) : (
      <span className={`flex min-h-16 items-center justify-center bg-gray-100 text-xs text-gray-500 ${className}`}>{photo.point || "—"}</span>
    );
  }
  const img = (
    <img
      src={src}
      alt=""
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        if (compact && thumbUrl && src !== thumbUrl) {
          setSrc(thumbUrl);
          setFail(false);
        } else if (compact) {
          setFail(true);
        } else {
          setFail(true);
        }
      }}
    />
  );
  if (compact) return img;
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="block">
      {img}
    </a>
  ) : (
    img
  );
}

export function DriveFileThumb({ fileId, className = "h-16 w-16 object-cover" }: { fileId: string; className?: string }) {
  return (
    <DrivePhoto
      photo={{
        id: fileId,
        dataUrl: "",
        takenAt: "",
        floor: "",
        room: "",
        point: "",
        gpsLabel: "",
        lat: null,
        lng: null,
        accuracyM: null,
        gpsSource: "unknown",
        projectId: "",
        projectName: "",
        employeeId: "",
        employeeName: "",
        driveFileId: fileId,
      }}
      className={className}
      compact
    />
  );
}
