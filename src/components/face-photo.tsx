import { DriveFileThumb } from "@/components/drive-photo";
import { Avatar } from "@/components/zenko";

export function FacePhoto({
  employee,
  px = 32,
}: {
  employee?: { initials: string; profileFileId?: string } | null;
  px?: number;
}) {
  if (employee?.profileFileId) {
    return (
      <span className="inline-flex shrink-0 overflow-hidden rounded-full" style={{ width: px, height: px }}>
        <DriveFileThumb fileId={employee.profileFileId} className="size-full object-cover" />
      </span>
    );
  }
  return <Avatar initials={employee?.initials ?? "?"} px={px} />;
}
