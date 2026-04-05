/**
 * Sentinel Protocol — North Architecture
 * Copyright (c) 2026 North Architecture. All rights reserved.
 * Ranger Earn Build-A-Bear Hackathon 2026
 *
 * Exécute les appels SDK après la décision `rebalance()` (bots / backend Node).
 */

import { rebalance, type RebalanceInputs, type RebalanceResult } from "./rebalanceCore";

export type RebalanceExecuteResult = RebalanceResult;

export async function rebalanceAndExecuteOnChain(
  inputs: RebalanceInputs,
): Promise<RebalanceExecuteResult> {
  const base = await rebalance(inputs);
  let executed = base.executed;
  const txSignatures = [...base.txSignatures];

  if (inputs.kaminoDepositParams) {
    const { depositToKamino } = await import("./kamino");
    await depositToKamino(inputs.kaminoDepositParams);
    executed = true;
  }
  if (inputs.marginfiDepositParams) {
    const { depositToMarginfi } = await import("./marginfi");
    await depositToMarginfi(inputs.marginfiDepositParams);
    executed = true;
  }

  return {
    ...base,
    executed,
    txSignatures,
  };
}
