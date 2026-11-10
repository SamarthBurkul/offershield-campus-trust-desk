/** "a, b ,,c" -> ["a", "b", "c"] */
export function splitList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}
