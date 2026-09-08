export type VoiceRequest = { projectId?: string; text?: string };

const listeners = new Set<(req: VoiceRequest) => void>();

export function requestVoice(req: VoiceRequest = {}) {
  listeners.forEach((fn) => fn(req));
}

export function onVoiceRequest(fn: (req: VoiceRequest) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
