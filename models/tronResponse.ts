import { TronWeb } from "tronweb";

export type Account = Awaited<ReturnType<typeof TronWeb.prototype.trx.getAccount>>;
export type AccountResource = Awaited<ReturnType<typeof TronWeb.prototype.trx.getAccountResources>>;