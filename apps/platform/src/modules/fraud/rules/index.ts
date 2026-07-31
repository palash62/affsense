import { honeypotRule } from "./honeypot.rule";
import { duplicateRule } from "./duplicate.rule";
import { emailRule } from "./email.rule";
import { networkRule } from "./network.rule";
import { geoRule } from "./geo.rule";
import { deviceOsRule } from "./device-os.rule";
import { behavioralRule } from "./behavioral.rule";
import type { FraudEvaluationContext } from "../types/context";
import type { FraudConfig } from "../types/config";
import type { RuleOutcome } from "../types/result";

export async function runAllRules(
  ctx: FraudEvaluationContext,
  config: FraudConfig,
): Promise<RuleOutcome[]> {
  const outcomes: RuleOutcome[] = [];

  const honeypot = honeypotRule(ctx, config);
  if (honeypot) outcomes.push(honeypot);

  outcomes.push(...duplicateRule(ctx, config));
  outcomes.push(...(await emailRule(ctx, config)));
  outcomes.push(...(await networkRule(ctx, config)));

  const geo = geoRule(ctx, config);
  if (geo) outcomes.push(geo);

  const deviceOs = deviceOsRule(ctx, config);
  if (deviceOs) outcomes.push(deviceOs);

  outcomes.push(...behavioralRule(ctx, config));

  return outcomes;
}
