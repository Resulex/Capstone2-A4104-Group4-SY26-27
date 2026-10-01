'use strict';

/**
 * CloudFormation budget guard (kaBarangayConnect backend).
 *
 * Why this exists
 * ---------------
 * CloudFormation rejects any template with more than 500 resources:
 *
 *   Template format error: Number of resources, 534, is greater than maximum
 *   allowed, 500
 *
 * That is what killed the `main` deploy on 2026-10-01, 79s in, after the
 * artifacts had already been uploaded — with nothing in the message saying
 * where 534 resources came from. They were not all declared in
 * `serverless.yml`: only 99 were. The rest were auto-generated, and the
 * breakdown of the packaged template was:
 *
 *   AWS::ApiGateway::Method       154   (96 routes + 58 CORS OPTIONS methods)
 *   AWS::Logs::LogGroup            99   (one per function — removed by this)
 *   AWS::Lambda::Function          99
 *   AWS::Lambda::Permission        99
 *   AWS::ApiGateway::Resource      67
 *   everything else               ~16
 *
 * What this does
 * --------------
 * 1. Sets `disableLogs: true` on EVERY function before the template is
 *    compiled, so Serverless stops emitting an `AWS::Logs::LogGroup` per
 *    function. That is -99 resources: 534 -> 435, comfortably under the limit.
 *
 *    Nothing observable is lost. Serverless only ever put `LogGroupName` on
 *    those resources — no `RetentionInDays`, no `DataProtectionPolicy` — and
 *    Lambda creates `/aws/lambda/<function>` by itself on first invoke anyway.
 *    The only behavioural difference is that the log group is no longer owned
 *    by CloudFormation, so it is retained (rather than deleted) with the stack.
 *
 *    Doing it here instead of as 99 literal `disableLogs: true` properties in
 *    `serverless.yml` means new functions are covered automatically. That
 *    matters: the service grew from 83 to 99 functions in the three weeks
 *    before this landed, i.e. ~5.3 resources per function, so the limit is a
 *    moving target and the next contributor will not remember the flag.
 *
 * 2. Repairs the IAM logs policy that step 1 leaves broken.
 *
 *    `disableLogs` really means "this function must NOT log": besides skipping
 *    the LogGroup, Serverless's `merge-iam-templates.js` adds an explicit
 *    `Deny` for that function's log group — but only when at least one
 *    canonically-named function still keeps its log group
 *    (`hasOneOrMoreCanonicallyNamedFunctions`). With *every* function disabled
 *    that flag stays false, so no Deny is emitted (good) and
 *    `policyDocumentStatements[0..1].Resource` is never populated (bad):
 *
 *      { Action: ['logs:CreateLogStream','logs:CreateLogGroup','logs:TagResource'],
 *        Resource: [] }                                  <-- invalid IAM
 *      { Action: ['logs:PutLogEvents'], Resource: [] }    <-- invalid IAM
 *
 *    An empty `Resource` list authorises nothing, so every function would lose
 *    the ability to write the logs it still emits. This step restores exactly
 *    the ARN Serverless would have generated, using its own naming helper (see
 *    `arnForLogsGroup`), and only ever touches statements it finds empty — so
 *    it is a no-op on a Serverless version that gets this right.
 *
 * 3. Prints the compiled resource count on every `package`/`deploy` and fails
 *    with an actionable message *before* CloudFormation can fail with an
 *    opaque one. It warns at 450 so the next growth step is visible while
 *    there is still room to act.
 *
 * Usage: loaded from the `plugins:` block of `serverless.yml`, so it applies to
 * `serverless package`, `serverless deploy`, and therefore to CI.
 *
 * Headroom is finite: 435/500 leaves room for roughly 12 more functions. The
 * durable fix once that is reached is nested stacks
 * (`serverless-plugin-split-stacks`), deliberately NOT enabled here: the
 * migration deletes and recreates every resource it moves, which on this stack
 * is an outage for the whole API (stage `dev` is production), and the plugin's
 * own docs say the strategy cannot be reliably changed afterwards without
 * recreating the deployment.
 */

/** CloudFormation's hard ceiling for a template. */
const CFN_RESOURCE_LIMIT = 500;

/** Report the budget as a warning from here on, while there is still room. */
const CFN_WARN_THRESHOLD = 450;

/** How many resource types to name when reporting usage. */
const BREAKDOWN_TOP_N = 4;

class CloudFormationBudgetGuard {
  constructor(serverless) {
    this.serverless = serverless;
    this.disabledLogGroupCount = 0;
    this.reportedBudget = false;

    this.hooks = {
      // Fires before `package:setupProviderConfiguration`, which is where
      // Serverless's mergeIamTemplates() emits the LogGroup resources.
      'before:package:initialize': () => this.disableLogGroups(),

      // Fires once every resource-contributing compile step has run: functions
      // (package:compileFunctions), API Gateway methods/resources
      // (package:compileEvents), the IAM role
      // (package:setupProviderConfiguration), and the logs policy repaired below.
      'before:package:finalize': () => {
        this.repairLogsPolicy();
        this.assertResourceBudget();
      },
    };
  }

  get cli() {
    return this.serverless.cli;
  }

  get templateResources() {
    return (
      this.serverless.service.provider.compiledCloudFormationTemplate?.Resources ?? {}
    );
  }

  /**
   * Opt every function out of its auto-created `/aws/lambda/<name>` log group.
   * An explicit `disableLogs` in `serverless.yml` (either value) always wins.
   */
  disableLogGroups() {
    const service = this.serverless.service;
    let kept = 0;

    for (const functionName of service.getAllFunctions()) {
      const functionObject = service.getFunction(functionName);
      if (functionObject.disableLogs === undefined) {
        functionObject.disableLogs = true;
        this.disabledLogGroupCount += 1;
      } else if (!functionObject.disableLogs) {
        kept += 1;
      }
    }

    this.cli.log(
      `CloudFormation budget: not creating the Lambda log group for ` +
        `${this.disabledLogGroupCount} function(s) (-${this.disabledLogGroupCount} ` +
        `resources)${kept ? `; ${kept} kept it (explicit disableLogs: false)` : ''}`
    );
  }

  /**
   * The ARN Serverless puts in the logs policy for a canonically named
   * (`<service>-<stage>-<function>`) function, rebuilt with its own naming
   * helper so the two cannot drift. `stream` selects the `PutLogEvents` form,
   * which needs the extra `:*` segment for the log stream.
   */
  arnForLogsGroup(stream) {
    const provider = this.serverless.getProvider('aws');
    const prefix = provider.naming.getLogGroupName(
      `${this.serverless.service.service}-${provider.getStage()}`
    );
    const suffix = stream ? '*:*:*' : '*:*';
    return {
      'Fn::Sub': `arn:\${AWS::Partition}:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:${prefix}${suffix}`,
    };
  }

  /**
   * Restore the log permissions that `disableLogs` on *every* function leaves
   * empty (see the file header). Only statements whose `Resource` is an empty
   * array are touched, so this is a no-op on any Serverless version that fills
   * them in itself — including this one, once a function opts back in with an
   * explicit `disableLogs: false` and the wildcard ARN gets generated anyway.
   *
   * Whatever the path, the finished template must let the role write logs, so
   * that is asserted rather than assumed.
   */
  repairLogsPolicy() {
    if (this.disabledLogGroupCount === 0) return;

    const roleLogicalId = this.serverless.getProvider('aws').naming.getRoleLogicalId();
    const role = this.templateResources[roleLogicalId];
    if (!role) {
      throw new Error(
        `CloudFormation budget: expected an IAM role at "${roleLogicalId}" after ` +
          `disabling the log groups, but the compiled template has none.`
      );
    }

    let repaired = 0;
    let canWriteLogs = false;

    for (const policy of role.Properties?.Policies ?? []) {
      for (const statement of policy.PolicyDocument?.Statement ?? []) {
        // A Deny or a NotResource statement does not need a Resource list.
        if (statement.Effect === 'Deny' || statement.NotResource) continue;

        const actions = Array.isArray(statement.Action)
          ? statement.Action
          : [statement.Action];
        const logsActions = actions.filter(
          (action) => typeof action === 'string' && action.startsWith('logs:')
        );

        if (Array.isArray(statement.Resource) && statement.Resource.length === 0) {
          if (logsActions.length === 0) {
            throw new Error(
              `CloudFormation budget: IAM policy "${policy.PolicyName}" has a statement ` +
                `with an empty Resource list (actions: ${actions.join(', ')}). An empty ` +
                `Resource authorises nothing, so this template would ship a role that ` +
                `cannot do what it claims.`
            );
          }
          statement.Resource = [
            this.arnForLogsGroup(logsActions.includes('logs:PutLogEvents')),
          ];
          repaired += 1;
        }

        if (
          logsActions.includes('logs:PutLogEvents') &&
          Array.isArray(statement.Resource) &&
          statement.Resource.length > 0
        ) {
          canWriteLogs = true;
        }
      }
    }

    if (!canWriteLogs) {
      throw new Error(
        'CloudFormation budget: the Lambda execution role would have no permission to ' +
          'write logs (no logs:PutLogEvents statement with a resource). Serverless must ' +
          'have changed how it builds that policy — re-read the header of ' +
          'scripts/serverless/cloudformation-budget.js before deploying.'
      );
    }

    if (repaired > 0) {
      this.cli.log(
        `CloudFormation budget: restored the logs ARN on ${repaired} IAM policy ` +
          `statement(s) left empty by disableLogs`
      );
    }
  }

  /** Report, and if necessary reject, the compiled template size. */
  assertResourceBudget() {
    if (this.reportedBudget) return;
    this.reportedBudget = true;

    const resources = this.templateResources;
    const logicalIds = Object.keys(resources);
    const total = logicalIds.length;
    const remaining = CFN_RESOURCE_LIMIT - total;

    const countsByType = new Map();
    for (const logicalId of logicalIds) {
      const type = resources[logicalId].Type;
      countsByType.set(type, (countsByType.get(type) ?? 0) + 1);
    }
    const topTypes = [...countsByType.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, BREAKDOWN_TOP_N)
      .map(([type, count]) => `${type} x${count}`)
      .join(', ');

    const summary =
      `CloudFormation budget: ${total}/${CFN_RESOURCE_LIMIT} resources ` +
      `(${remaining} left) — largest types: ${topTypes}`;

    if (total > CFN_RESOURCE_LIMIT) {
      throw new Error(
        `${summary}\n\n` +
          `CloudFormation allows at most ${CFN_RESOURCE_LIMIT} resources per stack, so this ` +
          `deploy would fail with "Template format error: Number of resources, ${total}, is ` +
          `greater than maximum allowed, ${CFN_RESOURCE_LIMIT}".\n\n` +
          `Note that a function costs ~5 resources, most of which never appear in ` +
          `serverless.yml: the function, its invoke permission, its API Gateway method, an ` +
          `API Gateway resource for a new path segment, and a CORS OPTIONS method whenever ` +
          `the event sets cors: true.\n\n` +
          `Fix by consolidating functions, or by moving to nested stacks with ` +
          `serverless-plugin-split-stacks (read the header of ` +
          `scripts/serverless/cloudformation-budget.js first — that migration recreates ` +
          `every resource it moves).`
      );
    }

    if (total >= CFN_WARN_THRESHOLD) {
      this.cli.log(
        `\nWARNING: ${summary}\n` +
          `         Only ${remaining} resource(s) of headroom left, at ~5 per function. ` +
          `Plan the nested-stack migration before it runs out.`
      );
      return;
    }

    this.cli.log(summary);
  }
}

module.exports = CloudFormationBudgetGuard;
