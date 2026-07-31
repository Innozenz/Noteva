/**
 * Agrégation des fils de messages en une boîte de réception.
 *
 * Les échanges vivaient uniquement par couple, dans un onglet de fiche ou de
 * dossier : aucun endroit ne disait « qui m'a écrit ». Ce module regroupe les
 * messages du fil général (reportId nul) par couple prof↔élève, retient le
 * dernier de chaque fil et compte les non-lus — la même règle servant la liste
 * et la pastille de la barre latérale, pour qu'elles ne divergent pas.
 *
 * Pur et sans Prisma : l'appelant charge les messages et les états de lecture,
 * on regroupe et on compte ici. Un message est **non lu** pour un participant
 * s'il a été écrit par l'autre après son propre repère de lecture (`null` =
 * jamais ouvert, donc tout est non lu).
 */
export type Viewer = "TEACHER" | "STUDENT";

export type InboxMessage = {
  teacherId: string;
  studentId: string;
  sender: Viewer;
  content: string;
  hasAttachment: boolean;
  createdAt: Date;
};

export type ThreadRead = {
  teacherId: string;
  studentId: string;
  teacherReadAt: Date | null;
  studentReadAt: Date | null;
};

export type Conversation = {
  teacherId: string;
  studentId: string;
  last: {
    sender: Viewer;
    content: string;
    hasAttachment: boolean;
    createdAt: Date;
  };
  unread: number;
};

const key = (teacherId: string, studentId: string) => `${teacherId}::${studentId}`;

function readAtMap(reads: ThreadRead[], viewer: Viewer): Map<string, Date | null> {
  const map = new Map<string, Date | null>();
  for (const r of reads) {
    map.set(
      key(r.teacherId, r.studentId),
      viewer === "TEACHER" ? r.teacherReadAt : r.studentReadAt
    );
  }
  return map;
}

/** Non lu = écrit par l'autre participant, après mon repère de lecture. */
function isUnread(
  message: InboxMessage,
  viewer: Viewer,
  readAt: Date | null | undefined
): boolean {
  if (message.sender === viewer) return false;
  return !readAt || message.createdAt > readAt;
}

/**
 * Nombre total de messages non lus pour l'utilisateur, tous fils confondus.
 * Sert la pastille ; l'appelant peut ne passer que les messages entrants.
 */
export function countUnread(
  messages: InboxMessage[],
  reads: ThreadRead[],
  viewer: Viewer
): number {
  const readAt = readAtMap(reads, viewer);
  return messages.filter((m) =>
    isUnread(m, viewer, readAt.get(key(m.teacherId, m.studentId)))
  ).length;
}

/**
 * Une entrée par couple ayant au moins un message, du plus récent au plus
 * ancien, avec le dernier message et le compte de non-lus.
 */
export function buildInbox(
  messages: InboxMessage[],
  reads: ThreadRead[],
  viewer: Viewer
): Conversation[] {
  const readAt = readAtMap(reads, viewer);
  const byPair = new Map<string, Conversation>();

  for (const m of messages) {
    const k = key(m.teacherId, m.studentId);
    let convo = byPair.get(k);
    if (!convo) {
      convo = {
        teacherId: m.teacherId,
        studentId: m.studentId,
        last: {
          sender: m.sender,
          content: m.content,
          hasAttachment: m.hasAttachment,
          createdAt: m.createdAt,
        },
        unread: 0,
      };
      byPair.set(k, convo);
    } else if (m.createdAt > convo.last.createdAt) {
      convo.last = {
        sender: m.sender,
        content: m.content,
        hasAttachment: m.hasAttachment,
        createdAt: m.createdAt,
      };
    }
    if (isUnread(m, viewer, readAt.get(k))) convo.unread += 1;
  }

  return [...byPair.values()].sort(
    (a, b) => b.last.createdAt.getTime() - a.last.createdAt.getTime()
  );
}
