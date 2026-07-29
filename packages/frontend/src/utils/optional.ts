export type Maybe<T> = T | undefined;

export const isAbsent = <T>(argument: Maybe<T>): argument is undefined => {
  return argument === undefined;
};

export const isPresent = <T>(argument: Maybe<T>): argument is T => {
  return argument !== undefined;
};
