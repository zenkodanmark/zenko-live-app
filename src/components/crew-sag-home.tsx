import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CloseX, PlusBtn, PlusRound, SagPng, plusForList, sagPngForList } from "@/components/sag-icons";
import { UdPick, UdSheet } from "@/components/sag-ud";
import { KsCompose } from "@/components/ks-compose";
import { EntDoc, KsDoc, TfDoc } from "@/components/print-docs";
import { KsListThumb, ReportThumb } from "@/components/photo-strip";
import { QuickCompose } from "@/components/quick-compose";
import { TodoSheet } from "@/components/todo-board";
import { MaterialBoard, NewOrderSheet } from "@/components/material-pane";
import { CrewTodos } from "@/components/crew-todos";
import { t } from "@/lib/i18n";
import { listUdCounts } from "@/lib/drive.functions";
import { findControlPoint } from "@/lib/seed";
import { softrKsPhotos, hydrateSoftrReport } from "@/lib/softr-ks";
import { mesterKsForJob } from "@/lib/mester-ks";
import { hydrateSoftrEnt } from "@/lib/softr-er";
import { hydrateSoftrTf } from "@/lib/softr-tf";
import { softrAsFieldItems } from "@/lib/softr-as";
import { useSessionEmployee, useYard } from "@/lib/store";
import { crewSagTodos } from "@/lib/crew-todo";
import type { Lang, Project } from "@/lib/types";

type CrewKind = "todo" | "material" | "ks" | "tf" | "ent" | "ud";
type CrewView = { kind: "todo" | "ks" | "tf" | "ent"; id: string };

export function CrewSagHome({ project, lang }: { project: Project; lang: Lang }) {
  const tfs = useYard((s) => s.tfs);
  const ents = useYard((s) => s.ents);
  const ksReports = useYard((s) => s.ksReports);
  const todos = useYard((s) => s.todos);
  const needs = useYard((s) => s.needs);
  const orders = useYard((s) => s.orders);
  const days = useYard((s) => s.days);
  const drivePhotos = useYard((s) => s.drivePhotos);
  const fieldItems = useYard((s) => s.fieldItems);
  const me = useSessionEmployee();

  const [list, setList] = useState<CrewKind | null>(null);
  const [compose, setCompose] = useState<CrewKind | null>(null);
  const [view, setView] = useState<CrewView | null>(null);
  const [udPick, setUdPick] = useState(false);
  const [udCount, setUdCount] = useState<number | null>(null);

  const jobId = project.id;
  const sagTodos = crewSagTodos(todos, jobId, me);
  const sagTodosOpen = sagTodos.filter((s) => !s.done);
  const sagTfs = tfs.filter((s) => s.projectId === jobId && !s.trashedAt);
  const sagEnts = ents.filter((s) => s.projectId === jobId && !s.trashedAt);
  const sagKs = mesterKsForJob(ksReports, jobId);
  const sagNeeds = needs.filter((n) => n.projectId === jobId && n.status === "need");
  const sagOrders = orders.filter((o) => o.projectId === jobId);
  const asPhotos = useMemo(() => [...softrAsFieldItems(), ...fieldItems], [fieldItems]);
  const photos = useMemo(
    () => [...softrKsPhotos(), ...Object.values(days).flatMap((d) => d.photos), ...drivePhotos],
    [days, drivePhotos],
  );
