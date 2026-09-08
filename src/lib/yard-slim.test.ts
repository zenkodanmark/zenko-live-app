import assert from "node:assert/strict";
import test from "node:test";
import { mergeById, mergeChats, slimChat } from "./yard-slim.ts";
import type { ChatMessage, Todo } from "./types.ts";

test("server overskriver lokal to-do med samme id", () => {
  const local = [{ id: "td-1", title: "gammel" } as Todo, { id: "td-2", title: "kun her" } as Todo];
  const remote = [{ id: "td-1", title: "ny" } as Todo];
  const out = mergeById(local, remote);
  assert.equal(out.find((t) => t.id === "td-1")?.title, "ny");
  assert.equal(out.find((t) => t.id === "td-2")?.title, "kun her");
});

test("chat slim fjerner stor dataUrl når Drive har filen", () => {
  const row = {
    id: "ch-1",
    at: "2026-09-05T18:00:00.000Z",
    fromId: "emp-alex",
    to: { kind: "employee", id: "emp-ole" },
    projectId: "job-hillerodsholm",
    sourceLang: "da",
    original: "foto",
    translations: { da: "foto" },
    viaVoice: false,
    photos: [{ dataUrl: "data:image/jpeg;base64,aaaa", driveFileId: "file-1" }],
  } as ChatMessage;
  const slim = slimChat(row);
  assert.equal(slim.photos?.[0]?.dataUrl, "");
  assert.equal(slim.photos?.[0]?.driveFileId, "file-1");
});

test("chat-merge bevarer oversættelse og foto som serveren mangler", () => {
  const local = {
    id: "ch-1",
    at: "2026-09-05T18:00:00.000Z",
    fromId: "emp-ole",
    to: { kind: "employee", id: "emp-ion" },
    projectId: "job-hillerodsholm",
    sourceLang: "da",
    original: "Ryd bag skuret",
    translations: { da: "Ryd bag skuret", ro: "Curăță în spatele șopronului" },
    viaVoice: false,
    photos: [{ id: "p1", dataUrl: "data:image/jpeg;base64,xxx", name: "foto.jpg" }],
  } as ChatMessage;
  const remote = {
    ...local,
    translations: { da: "Ryd bag skuret" },
    photos: [{ id: "p1", name: "foto.jpg" }],
  } as ChatMessage;
  const out = mergeChats([local], [remote]);
  const hit = out.find((c) => c.id === "ch-1");
  assert.equal(hit?.translations.ro, "Curăță în spatele șopronului");
  assert.equal(hit?.photos?.[0]?.dataUrl, "data:image/jpeg;base64,xxx");
});
