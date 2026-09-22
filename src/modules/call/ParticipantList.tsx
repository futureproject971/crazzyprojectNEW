"use client";

import type { CallParticipant } from "./types";

export type ParticipantMediaState = {
  identity: string;
  microphone: boolean;
  camera: boolean;
  screenShare: boolean;
};

export function ParticipantList({
  participants,
  mediaStates,
  currentUserId,
  canModerate,
  isOwner,
  busyId,
  onRole,
  onKick,
}: {
  participants: CallParticipant[];
  mediaStates: ParticipantMediaState[];
  currentUserId: string;
  canModerate: boolean;
  isOwner: boolean;
  busyId: string | null;
  onRole: (participant: CallParticipant, role: "cohost" | "participant" | "viewer") => void;
  onKick: (participant: CallParticipant) => void;
}) {
  const stateMap = new Map(mediaStates.map((item) => [item.identity, item]));

  return (
    <aside className="crz-call-participants">
      <header>
        <span>PARTICIPANTES</span>
        <b>{participants.length}</b>
      </header>

      <div className="crz-call-participants__list">
        {participants.map((participant) => {
          const media = stateMap.get(participant.user_id);
          const self = participant.user_id === currentUserId;
          const canTouch =
            canModerate &&
            !self &&
            participant.role !== "host" &&
            (isOwner || participant.role !== "cohost");

          return (
            <article key={participant.id}>
              <div className="crz-call-avatar">
                {participant.avatar_url ? (
                  <img src={participant.avatar_url} alt="" />
                ) : (
                  <span>{participant.display_name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>

              <div className="crz-call-participant-copy">
                <strong>{participant.display_name}{self ? " (você)" : ""}</strong>
                <span>
                  <b>{participant.role === "host" ? "HOST" : participant.role === "cohost" ? "CO-HOST" : participant.role.toUpperCase()}</b>
                  {media?.screenShare && <em>COMPARTILHANDO</em>}
                  {!media?.microphone && <em>MUTADO</em>}
                </span>
              </div>

              <div className="crz-call-media-badges" aria-label="Estado de mídia">
                <span title={media?.microphone ? "Microfone ligado" : "Microfone desligado"}>
                  {media?.microphone ? "🎙" : "🔇"}
                </span>
                <span title={media?.camera ? "Câmera ligada" : "Câmera desligada"}>
                  {media?.camera ? "📷" : "◼"}
                </span>
                {media?.screenShare && <span title="Compartilhando tela">🖥</span>}
              </div>

              {canTouch && (
                <details className="crz-call-participant-menu">
                  <summary aria-label={"Opções de " + participant.display_name}>⋮</summary>
                  <div>
                    {isOwner && participant.role !== "cohost" && (
                      <button
                        type="button"
                        disabled={busyId === participant.id}
                        onClick={() => onRole(participant, "cohost")}
                      >
                        Tornar co-host
                      </button>
                    )}
                    {isOwner && participant.role === "cohost" && (
                      <button
                        type="button"
                        disabled={busyId === participant.id}
                        onClick={() => onRole(participant, "participant")}
                      >
                        Remover co-host
                      </button>
                    )}
                    <button
                      type="button"
                      className="is-danger"
                      disabled={busyId === participant.id}
                      onClick={() => onKick(participant)}
                    >
                      Remover da sala
                    </button>
                  </div>
                </details>
              )}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
