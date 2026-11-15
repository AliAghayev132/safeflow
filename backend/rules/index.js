/**
 * Rule registry. To add a rule: create `<name>.rule.js` exporting a rule
 * object (see services/RuleEngine.js for the shape) and append it here.
 */
import { sosClusterRule } from "./sosCluster.rule.js";
import { shelterOverloadRule } from "./shelterOverload.rule.js";
import { citizenRerouteRule } from "./citizenReroute.rule.js";

export const rules = [sosClusterRule, shelterOverloadRule, citizenRerouteRule];

export { sosClusterRule, shelterOverloadRule, citizenRerouteRule };
