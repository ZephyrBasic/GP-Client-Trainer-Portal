// An Assignment's id is derived from the pair it joins, never minted randomly.
//
// This is a rules constraint, not a style choice. Firestore rules cannot run a
// query, so "may this Client read this Template?" has to be answerable by
// building a path and testing whether a document is there - see the exists()
// check on workoutTemplates in firestore.rules. A random id, or a participants
// array, would make that question unanswerable server-side.
//
// utils/chatId.ts derives a chat id the same way and for the same reason. The
// separator is '_' to match it; neither a Firestore document id nor an auth uid
// contains one, so the pair can always be read back apart.
export const getAssignmentId = (templateId: string, clientId: string): string =>
    `${templateId}_${clientId}`
