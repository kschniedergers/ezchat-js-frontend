export type IncludeOnly<T extends string, U extends T> = {
    [K in U]: K;
};
