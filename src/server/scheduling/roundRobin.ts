export function makeRoundRobin<T>(teams: T[]): Array<Array<[T,T]>> {
    const arr = [...teams];
    const hasBye = arr.length % 2 === 1;
    if (hasBye) arr.push(null as unknown as T);
  
    const n = arr.length;
    const rounds: Array<Array<[T,T]>> = [];
  
    for (let r = 0; r < n - 1; r++) {
      const pairs: Array<[T,T]> = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        if (a && b) pairs.push([a, b]);
      }
      rounds.push(pairs);
      // rotate except first
      const fixed = arr[0];
      const rest = arr.slice(1);
      rest.unshift(rest.pop()!);
      arr.splice(0, arr.length, fixed, ...rest);
    }
    return rounds;
  }
  