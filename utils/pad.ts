/**
 * Two-digit zero padding, in one place.
 *
 * Its own module because both things that need it - the running clock in
 * elapsed.ts and the date box in dateInput.ts - are about different quantities
 * and neither should have to import the other to borrow a formatter. It was
 * written twice before that, which is one copy more than a one-line function
 * can justify.
 */
export const pad = (value: number): string => String(value).padStart(2, '0')
