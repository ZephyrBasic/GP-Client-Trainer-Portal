// A client only ever has one trainer, so the pair's chat id can be derived
// locally by either side without a lookup or a participants-array query.
export const getChatId = (clientId, trainerId) => `${clientId}_${trainerId}`
