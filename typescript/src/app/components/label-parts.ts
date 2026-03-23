interface LabelParts {
  readonly letters: string;
  readonly number: string | null;
}

const TRAILING_NUMBER_PATTERN = /^(.*?)(\d+)$/;

export function splitLabelParts(label: string): LabelParts {
  const match = TRAILING_NUMBER_PATTERN.exec(label);
  if (!match) {
    return { letters: label, number: null };
  }

  return {
    letters: match[1] ?? label,
    number: match[2] ?? null
  };
}
