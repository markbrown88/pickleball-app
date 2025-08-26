export function generateRoundRobin(teamIds: string[]) {
    const ids = [...teamIds];
    const rounds: { games: Array<{ a: string | null; b: string | null; isBye: boolean }>}[] = [];
  
    const isOdd = ids.length % 2 === 1;
    if (isOdd) ids.push('__BYE__');
  
    const n = ids.length;
    if (n <= 1) return rounds;
  
    // circle method
    const arr = [...ids];
    for (let r = 0; r < n - 1; r++) {
      const games: Array<{ a: string | null; b: string | null; isBye: boolean }> = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i];
        const b = arr[n - 1 - i];
        const isBye = a === '__BYE__' || b === '__BYE__';
        games.push({
          a: a === '__BYE__' ? null : a,
          b: b === '__BYE__' ? null : b,
          isBye,
        });
      }
      rounds.push({ games });
      // rotate: keep first fixed
      const first = arr[0];
      arr.splice(1, 0, arr.pop() as string);
      arr[0] = first;
    }
    return rounds;
  }
  