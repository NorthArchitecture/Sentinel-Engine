/**
 * Sentinel Protocol — North Architecture
 * Copyright (c) 2026 North Architecture. All rights reserved.
 * Ranger Earn Build-A-Bear Hackathon 2026
 *
 * Strategy engine — décision de rebalance (`rebalanceCore`) et allocations.
 * Pour une exécution on-chain (Kamino / Marginfi / Drift SDK), voir `rebalanceExecute.ts`.
 */

export {
  rebalance,
  getLastRebalanceDecision,
  allocateLending,
  allocateDeltaNeutral,
  type LastRebalanceDecision,
  type RebalanceResult,
  type RebalanceInputs,
  type LendingLeg,
  type LendingAllocationPlan,
  type DeltaNeutralAllocationPlan,
  type StrategyAllocationPlan,
  type LendingProtocol,
  type DeltaNeutralProtocol,
} from "./rebalanceCore";

/** Exécution SDK : `import { rebalanceAndExecuteOnChain } from "./rebalanceExecute"`. */
