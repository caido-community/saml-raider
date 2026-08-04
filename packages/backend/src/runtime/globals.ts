const runtime = globalThis as { self?: typeof globalThis };

runtime.self ??= globalThis;

export {};
