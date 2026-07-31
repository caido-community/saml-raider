export type Maybe<T> = T | undefined;

export const isAbsent = <T>(argument: Maybe<T>): argument is undefined => {
  return argument === undefined || argument === null;
};

export const isPresent = <T>(
  argument: Maybe<T>,
): argument is NonNullable<T> => {
  return argument !== undefined && argument !== null;
};
