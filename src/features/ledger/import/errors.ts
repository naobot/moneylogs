export type ImportErrorCode =
  | "empty" // no data rows
  | "unknown-format" // header matches no supported app
  | "missing-columns" // a supported app, but required columns are gone
  | "ambiguous-dates"; // day/month order can't be told apart; ask the user

/** A file the importer can't read, with a code the UI turns into a message. */
export class ImportFormatError extends Error {
  readonly code: ImportErrorCode;

  constructor(code: ImportErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ImportFormatError";
    this.code = code;
  }
}
