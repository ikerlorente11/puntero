// Live typing: the phone's keyboard writes into a text field and every change goes to the PC as the
// backspaces and text that turn the old content into the new one. That way autocorrect, swipe
// typing, voice dictation and emoji all work as on the phone.

/** Code points, so an emoji or an accented letter is one backspace like on the PC. */
const points = (s: string) => Array.from(s)

export function diffText(before: string, after: string): { back: number; text: string } {
  const a = points(before)
  const b = points(after)
  let same = 0
  while (same < a.length && same < b.length && a[same] === b[same]) same++
  return { back: a.length - same, text: b.slice(same).join('') }
}

/** The command(s) for one change of the field. */
export function typingCommands(before: string, after: string): { t: string; [k: string]: unknown }[] {
  const { back, text } = diffText(before, after)
  const out: { t: string; [k: string]: unknown }[] = []
  if (back > 0) out.push({ t: 'text', s: '\b'.repeat(back) })
  if (text) out.push({ t: 'text', s: text })
  // one message when both: fewer round trips, same order on the PC
  if (out.length === 2) return [{ t: 'text', s: '\b'.repeat(back) + text }]
  return out
}
