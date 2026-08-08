export class BridgeError extends Error {
  constructor(message, code = "BRIDGE_ERROR", status = 500) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
    this.status = status;
  }
}
