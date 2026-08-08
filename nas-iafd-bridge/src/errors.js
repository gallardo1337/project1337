export class BridgeError extends Error {
  constructor(message, code = "BRIDGE_ERROR", status = 500, diagnostic = null) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
    this.status = status;
    this.diagnostic = diagnostic;
  }
}
