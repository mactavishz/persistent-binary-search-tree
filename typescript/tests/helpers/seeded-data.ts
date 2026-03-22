export const SHUFFLED_0_TO_99: number[] = [
  42, 7, 91, 13, 58, 26, 74, 3, 65, 89, 11, 97, 50, 19, 81, 32, 60, 4, 77, 22,
  95, 38, 69, 1, 84, 29, 55, 16, 72, 9, 99, 45, 24, 67, 35, 88, 14, 53, 79, 6,
  93, 30, 63, 17, 86, 40, 71, 2, 57, 27, 94, 36, 68, 10, 83, 21, 59, 5, 76, 34,
  98, 44, 25, 66, 12, 90, 48, 20, 82, 31, 61, 8, 75, 33, 96, 41, 70, 15, 87, 23,
  54, 18, 80, 37, 64, 0, 92, 43, 28, 73, 39, 85, 46, 62, 47, 56, 49, 51, 52, 78
];

export function range(start: number, endExclusive: number): number[] {
  const values: number[] = [];
  for (let i = start; i < endExclusive; i += 1) {
    values.push(i);
  }
  return values;
}
