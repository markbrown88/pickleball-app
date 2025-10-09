export function expectedGenderForIndex(index: number): 'MALE' | 'FEMALE' {
  return index < 2 ? 'MALE' : 'FEMALE';
}

