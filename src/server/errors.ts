export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class BlockedError extends Error {
  constructor(message = "Blocked") {
    super(message);
    this.name = "BlockedError";
  }
}
